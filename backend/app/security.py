"""Password hashing, session tokens, rate limiting and the auth dependencies.

Passwords use scrypt from the standard library. Session tokens are random,
handed to the client once, and stored only as a SHA-256 digest - a leaked
database therefore cannot be replayed as a set of live logins.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import sqlite3
import threading
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

from fastapi import Depends, Header, HTTPException, Request, status

from backend.app.db import get_db

SESSION_LIFETIME = timedelta(days=30)

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 64


def utc_now() -> datetime:
    return datetime.now(UTC)


def iso(moment: datetime) -> str:
    """The one timestamp format stored, so text ordering is time ordering."""
    return moment.astimezone(UTC).isoformat(timespec="seconds")


# --- passwords ---------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=_SCRYPT_DKLEN
    )
    return "$".join(
        [
            "scrypt",
            str(_SCRYPT_N),
            str(_SCRYPT_R),
            str(_SCRYPT_P),
            base64.b64encode(salt).decode(),
            base64.b64encode(digest).decode(),
        ]
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, digest_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest_b64)
        actual = hashlib.scrypt(
            password.encode(),
            salt=base64.b64decode(salt_b64),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


# A real hash to verify against when the email is unknown, so a login attempt
# takes the same time whether or not the account exists.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def burn_password_check(password: str) -> None:
    verify_password(password, _DUMMY_HASH)


# --- sessions ----------------------------------------------------------------
def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: sqlite3.Connection, user_id: int) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    now = utc_now()
    expires = now + SESSION_LIFETIME
    db.execute(
        """
        INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (_digest(token), user_id, iso(now), iso(expires)),
    )
    # Expired sessions are swept opportunistically rather than by a scheduler.
    db.execute("DELETE FROM sessions WHERE expires_at < ?", (iso(now),))
    db.commit()
    return token, expires


def revoke_session(db: sqlite3.Connection, token: str) -> None:
    db.execute("DELETE FROM sessions WHERE token_hash = ?", (_digest(token),))
    db.commit()


def revoke_other_sessions(db: sqlite3.Connection, user_id: int, keep_token: str) -> None:
    db.execute(
        "DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?",
        (user_id, _digest(keep_token)),
    )
    db.commit()


def _bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def _user_for_token(db: sqlite3.Connection, token: str) -> sqlite3.Row | None:
    return db.execute(
        """
        SELECT u.id, u.email, u.password_hash, u.full_name, u.date_of_birth,
               u.sex, u.created_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
          AND s.expires_at > ?
        """,
        (_digest(token), iso(utc_now())),
    ).fetchone()


_UNAUTHORISED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Your session has expired. Please sign in again.",
    headers={"WWW-Authenticate": "Bearer"},
)


def session_token(authorization: str | None = Header(default=None)) -> str:
    token = _bearer(authorization)
    if token is None:
        raise _UNAUTHORISED
    return token


def current_user(
    token: str = Depends(session_token),
    db: sqlite3.Connection = Depends(get_db),
) -> sqlite3.Row:
    user = _user_for_token(db, token)
    if user is None:
        raise _UNAUTHORISED
    return user


def optional_user(
    authorization: str | None = Header(default=None),
    db: sqlite3.Connection = Depends(get_db),
) -> sqlite3.Row | None:
    """Guests may screen without an account; a stale token is still an error,
    because silently dropping a signed-in user's result from their history is
    worse than asking them to sign in again."""
    token = _bearer(authorization)
    if token is None:
        return None
    user = _user_for_token(db, token)
    if user is None:
        raise _UNAUTHORISED
    return user


# --- rate limiting -----------------------------------------------------------
class RateLimiter:
    """Sliding-window limit per client address, held in process memory.

    Enough for a single-process deployment; several replicas would need a
    shared store such as Redis.
    """

    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                retry_after = int(self.window - (now - hits[0])) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please wait a few minutes and try again.",
                    headers={"Retry-After": str(retry_after)},
                )
            hits.append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


auth_limiter = RateLimiter(limit=10, window_seconds=300)


def limit_auth_attempts(request: Request) -> None:
    client = request.client.host if request.client else "unknown"
    auth_limiter.check(client)
