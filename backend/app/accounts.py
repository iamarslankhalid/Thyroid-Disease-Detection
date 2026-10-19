"""Registration, sign-in and account management."""

from __future__ import annotations

import json
import logging
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Response, status

from backend.app.db import get_db
from backend.app.schemas import (
    AuthResponse,
    DeleteAccountRequest,
    LoginRequest,
    PasswordChange,
    ProfileUpdate,
    RegisterRequest,
    UserOut,
)
from backend.app.security import (
    burn_password_check,
    create_session,
    current_user,
    hash_password,
    iso,
    limit_auth_attempts,
    revoke_other_sessions,
    revoke_session,
    session_token,
    utc_now,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["account"])


def user_out(row: sqlite3.Row) -> UserOut:
    return UserOut(
        id=row["id"],
        email=row["email"],
        full_name=row["full_name"],
        date_of_birth=row["date_of_birth"],
        sex=row["sex"],
        created_at=row["created_at"],
    )


def _fetch_user(db: sqlite3.Connection, user_id: int) -> sqlite3.Row:
    return db.execute(
        """
        SELECT id, email, password_hash, full_name, date_of_birth, sex, created_at
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    ).fetchone()


@router.post(
    "/auth/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_auth_attempts)],
)
def register(body: RegisterRequest, db: sqlite3.Connection = Depends(get_db)) -> AuthResponse:
    now = iso(utc_now())
    try:
        cursor = db.execute(
            """
            INSERT INTO users (email, password_hash, full_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (body.email, hash_password(body.password), body.full_name, now, now),
        )
    except sqlite3.IntegrityError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Try signing in instead.",
        ) from error
    db.commit()
    user_id = cursor.lastrowid
    token, expires = create_session(db, user_id)
    logger.info("Registered user %s", user_id)
    return AuthResponse(token=token, expires_at=expires, user=user_out(_fetch_user(db, user_id)))


@router.post(
    "/auth/login",
    response_model=AuthResponse,
    dependencies=[Depends(limit_auth_attempts)],
)
def login(body: LoginRequest, db: sqlite3.Connection = Depends(get_db)) -> AuthResponse:
    row = db.execute(
        """
        SELECT id, email, password_hash, full_name, date_of_birth, sex, created_at
        FROM users
        WHERE email = ?
        """,
        (body.email,),
    ).fetchone()
    if row is None:
        burn_password_check(body.password)
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    token, expires = create_session(db, row["id"])
    return AuthResponse(token=token, expires_at=expires, user=user_out(row))


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    token: str = Depends(session_token),
    db: sqlite3.Connection = Depends(get_db),
) -> Response:
    revoke_session(db, token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/auth/me", response_model=UserOut)
def me(user: sqlite3.Row = Depends(current_user)) -> UserOut:
    return user_out(user)


@router.put("/account/profile", response_model=UserOut)
def update_profile(
    body: ProfileUpdate,
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> UserOut:
    db.execute(
        """
        UPDATE users
        SET full_name = ?,
            date_of_birth = ?,
            sex = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            body.full_name,
            body.date_of_birth.isoformat() if body.date_of_birth else None,
            body.sex,
            iso(utc_now()),
            user["id"],
        ),
    )
    db.commit()
    return user_out(_fetch_user(db, user["id"]))


@router.post("/account/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: PasswordChange,
    token: str = Depends(session_token),
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> Response:
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your current password is incorrect.",
        )
    db.execute(
        """
        UPDATE users
        SET password_hash = ?, updated_at = ?
        WHERE id = ?
        """,
        (hash_password(body.new_password), iso(utc_now()), user["id"]),
    )
    db.commit()
    # Anyone holding an older session loses it; this device stays signed in.
    revoke_other_sessions(db, user["id"], token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/account/delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    body: DeleteAccountRequest,
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> Response:
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is incorrect.",
        )
    # Sessions, assessments and lab values go with it through ON DELETE CASCADE.
    db.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    db.commit()
    logger.info("Deleted user %s", user["id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/account/export")
def export_account(
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> Response:
    """Every record held about the user, as one JSON file."""
    rows = db.execute(
        """
        SELECT id, created_at, prediction, confidence, probabilities,
               input_json, result_json, note
        FROM assessments
        WHERE user_id = ?
        ORDER BY created_at DESC
        """,
        (user["id"],),
    ).fetchall()
    payload = {
        "exported_at": iso(utc_now()),
        "account": user_out(user).model_dump(mode="json"),
        "assessments": [
            {
                "id": row["id"],
                "created_at": row["created_at"],
                "prediction": row["prediction"],
                "confidence": row["confidence"],
                "probabilities": json.loads(row["probabilities"]),
                "input": json.loads(row["input_json"]),
                "result": json.loads(row["result_json"]),
                "note": row["note"],
            }
            for row in rows
        ],
    }
    return Response(
        content=json.dumps(payload, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="thyrolens-data.json"'},
    )
