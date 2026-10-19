"""Accounts, saved history, analytics and PDF reports."""

from __future__ import annotations

import itertools

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.security import auth_limiter

HEALTHY = {"age": 35, "sex": "female", "TSH": 2.0, "T3": 1.9, "TT4": 105, "T4U": 0.98, "FTI": 110}
HYPO = {"age": 63, "sex": "female", "TSH": 68.0, "T3": 1.0, "TT4": 48.0, "T4U": 1.02, "FTI": 47.0}

_counter = itertools.count()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    auth_limiter.reset()
    yield


def register(client, password: str = "correct-horse-1") -> tuple[dict, dict]:
    email = f"patient{next(_counter)}@example.com"
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "full_name": "Test Patient"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return body, {"Authorization": f"Bearer {body['token']}"}


class TestAuth:
    def test_register_then_me(self, client) -> None:
        body, headers = register(client)
        me = client.get("/api/auth/me", headers=headers).json()
        assert me["email"] == body["user"]["email"]
        assert me["full_name"] == "Test Patient"

    def test_duplicate_email_is_rejected(self, client) -> None:
        body, _ = register(client)
        response = client.post(
            "/api/auth/register",
            json={"email": body["user"]["email"].upper(), "password": "another-pass-2", "full_name": "X"},
        )
        assert response.status_code == 409

    def test_weak_password_is_rejected(self, client) -> None:
        response = client.post(
            "/api/auth/register",
            json={"email": "weak@example.com", "password": "short", "full_name": "X"},
        )
        assert response.status_code == 422

    def test_login_with_wrong_password_fails(self, client) -> None:
        body, _ = register(client)
        response = client.post(
            "/api/auth/login", json={"email": body["user"]["email"], "password": "wrong-pass-9"}
        )
        assert response.status_code == 401

    def test_login_and_logout(self, client) -> None:
        body, _ = register(client)
        login = client.post(
            "/api/auth/login", json={"email": body["user"]["email"], "password": "correct-horse-1"}
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}
        assert client.post("/api/auth/logout", headers=headers).status_code == 204
        assert client.get("/api/auth/me", headers=headers).status_code == 401

    def test_invalid_token_is_unauthorised(self, client) -> None:
        response = client.get("/api/auth/me", headers={"Authorization": "Bearer nope"})
        assert response.status_code == 401

    def test_login_is_rate_limited(self, client) -> None:
        statuses = [
            client.post("/api/auth/login", json={"email": "x@example.com", "password": "y"}).status_code
            for _ in range(12)
        ]
        assert 429 in statuses


class TestProfile:
    def test_update_profile(self, client) -> None:
        _, headers = register(client)
        response = client.put(
            "/api/account/profile",
            json={"full_name": "Ayesha Khan", "date_of_birth": "1980-05-02", "sex": "female"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["date_of_birth"] == "1980-05-02"

    def test_change_password(self, client) -> None:
        body, headers = register(client)
        bad = client.post(
            "/api/account/password",
            json={"current_password": "wrong-1", "new_password": "new-secret-22"},
            headers=headers,
        )
        assert bad.status_code == 400
        ok = client.post(
            "/api/account/password",
            json={"current_password": "correct-horse-1", "new_password": "new-secret-22"},
            headers=headers,
        )
        assert ok.status_code == 204
        login = client.post(
            "/api/auth/login", json={"email": body["user"]["email"], "password": "new-secret-22"}
        )
        assert login.status_code == 200

    def test_delete_account_removes_everything(self, client) -> None:
        _, headers = register(client)
        client.post("/api/predict", json=HEALTHY, headers=headers)
        assert client.post("/api/account/delete", json={"password": "correct-horse-1"}, headers=headers).status_code == 204
        assert client.get("/api/auth/me", headers=headers).status_code == 401


class TestHistory:
    def test_guest_prediction_is_not_saved(self, client) -> None:
        body = client.post("/api/predict", json=HEALTHY).json()
        assert body["assessment_id"] is None

    def test_signed_in_prediction_is_saved(self, client) -> None:
        _, headers = register(client)
        result = client.post("/api/predict", json=HYPO, headers=headers).json()
        assert result["assessment_id"] is not None

        items = client.get("/api/assessments", headers=headers).json()
        assert len(items) == 1
        assert items[0]["prediction"] == result["prediction"]
        assert {lab["feature"] for lab in items[0]["labs"]} == {"TSH", "T3", "TT4", "T4U", "FTI"}

        detail = client.get(f"/api/assessments/{items[0]['id']}", headers=headers).json()
        assert detail["result"]["prediction"] == result["prediction"]
        assert detail["input"]["TSH"] == 68.0

    def test_users_cannot_see_each_others_history(self, client) -> None:
        _, owner = register(client)
        _, stranger = register(client)
        saved = client.post("/api/predict", json=HEALTHY, headers=owner).json()
        assert client.get("/api/assessments", headers=stranger).json() == []
        assert client.get(f"/api/assessments/{saved['assessment_id']}", headers=stranger).status_code == 404
        assert client.delete(f"/api/assessments/{saved['assessment_id']}", headers=stranger).status_code == 404

    def test_note_delete_and_clear(self, client) -> None:
        _, headers = register(client)
        first = client.post("/api/predict", json=HEALTHY, headers=headers).json()["assessment_id"]
        client.post("/api/predict", json=HYPO, headers=headers)

        noted = client.put(f"/api/assessments/{first}/note", json={"note": "Felt tired"}, headers=headers)
        assert noted.json()["note"] == "Felt tired"

        assert client.delete(f"/api/assessments/{first}", headers=headers).status_code == 204
        assert len(client.get("/api/assessments", headers=headers).json()) == 1
        assert client.delete("/api/assessments", headers=headers).status_code == 204
        assert client.get("/api/assessments", headers=headers).json() == []

    def test_import_rescores_on_the_server(self, client) -> None:
        _, headers = register(client)
        response = client.post(
            "/api/assessments/import",
            json={"items": [{"created_at": "2026-01-10T09:00:00Z", "input": HYPO}]},
            headers=headers,
        )
        assert response.json() == {"imported": 1}
        items = client.get("/api/assessments", headers=headers).json()
        assert items[0]["created_at"].startswith("2026-01-10")

    def test_history_requires_sign_in(self, client) -> None:
        assert client.get("/api/assessments").status_code == 401
        assert client.get("/api/analytics").status_code == 401
        assert client.get("/api/reports/history.pdf").status_code == 401


class TestAnalyticsAndReports:
    def test_analytics_summarises_history(self, client) -> None:
        _, headers = register(client)
        client.post("/api/predict", json=HEALTHY, headers=headers)
        client.post("/api/predict", json=HYPO, headers=headers)

        body = client.get("/api/analytics", headers=headers).json()
        assert body["total"] == 2
        assert sum(body["class_counts"].values()) == 2
        assert body["latest"]["prediction"] == client.get("/api/assessments", headers=headers).json()[0]["prediction"]
        tsh = next(lab for lab in body["labs"] if lab["feature"] == "TSH")
        assert tsh["readings"] == 2
        assert tsh["latest_value"] == 68.0
        assert tsh["previous_value"] == 2.0
        assert tsh["out_of_range"] == 1
        assert len(tsh["series"]) == 2
        assert body["monthly"][0]["total"] == 2

    def test_empty_analytics(self, client) -> None:
        _, headers = register(client)
        body = client.get("/api/analytics", headers=headers).json()
        assert body["total"] == 0
        assert body["labs"] == []
        assert body["latest"] is None

    def test_history_pdf(self, client) -> None:
        _, headers = register(client)
        client.post("/api/predict", json=HEALTHY, headers=headers)
        client.post("/api/predict", json=HYPO, headers=headers)
        response = client.get("/api/reports/history.pdf", headers=headers)
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content.startswith(b"%PDF")

    def test_single_assessment_pdf(self, client) -> None:
        _, headers = register(client)
        saved = client.post("/api/predict", json=HYPO, headers=headers).json()
        response = client.get(f"/api/reports/assessments/{saved['assessment_id']}.pdf", headers=headers)
        assert response.status_code == 200
        assert response.content.startswith(b"%PDF")

    def test_pdf_without_history_is_404(self, client) -> None:
        _, headers = register(client)
        assert client.get("/api/reports/history.pdf", headers=headers).status_code == 404

    def test_export_contains_everything(self, client) -> None:
        _, headers = register(client)
        client.post("/api/predict", json=HEALTHY, headers=headers)
        body = client.get("/api/account/export", headers=headers).json()
        assert body["account"]["full_name"] == "Test Patient"
        assert len(body["assessments"]) == 1
