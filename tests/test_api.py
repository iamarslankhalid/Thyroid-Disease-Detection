"""Tests for the screening API."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

HEALTHY_PATIENT = {
    "age": 35,
    "sex": "female",
    "TSH": 2.0,
    "T3": 1.9,
    "TT4": 105,
    "T4U": 0.98,
    "FTI": 110,
}

HYPOTHYROID_PATIENT = {
    "age": 63,
    "sex": "female",
    "TSH": 68.0,
    "T3": 1.0,
    "TT4": 48.0,
    "T4U": 1.02,
    "FTI": 47.0,
}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


class TestSystemEndpoints:
    def test_health_reports_a_loaded_model(self, client) -> None:
        body = client.get("/api/health").json()
        assert body["status"] == "ok"
        assert body["model_loaded"] is True

    def test_reference_data_exposes_units_and_ranges(self, client) -> None:
        """The UI reads clinical ranges from here instead of hard-coding them."""
        body = client.get("/api/reference-data").json()
        assert body["features"]["TSH"]["unit"] == "mU/L"
        assert body["features"]["TSH"]["reference"] == [0.4, 4.0]
        assert any(item["feature"] == "on_thyroxine" for item in body["history"])

    def test_model_info_includes_metrics_and_provenance(self, client) -> None:
        body = client.get("/api/model").json()
        assert body["model_name"]
        assert body["metrics"]["test"]["macro_f1"] > 0.5
        assert set(body["class_names"]) == {"Negative", "Hypothyroid", "Hyperthyroid"}


class TestPrediction:
    def test_returns_a_class_with_calibrated_probabilities(self, client) -> None:
        body = client.post("/api/predict", json=HEALTHY_PATIENT).json()
        assert body["prediction"] in {"Negative", "Hypothyroid", "Hyperthyroid"}
        assert sum(body["probabilities"].values()) == pytest.approx(1.0, abs=1e-6)
        assert 0.0 <= body["confidence"] <= 1.0

    def test_clear_hypothyroid_case_is_detected(self, client) -> None:
        """Very high TSH with very low T4 is the textbook picture."""
        body = client.post("/api/predict", json=HYPOTHYROID_PATIENT).json()
        assert body["prediction"] == "Hypothyroid"

    def test_result_explains_itself(self, client) -> None:
        body = client.post("/api/predict", json=HYPOTHYROID_PATIENT).json()
        assert body["contributions"], "a result with no explanation is not usable"
        top = body["contributions"][0]
        assert top["direction"] in {"supports", "opposes"}
        assert top["impact"] > 0

    def test_lab_values_are_flagged_against_reference_ranges(self, client) -> None:
        flags = client.post("/api/predict", json=HYPOTHYROID_PATIENT).json()["lab_flags"]
        by_feature = {item["feature"]: item for item in flags}
        assert by_feature["TSH"]["status"] == "high"
        assert by_feature["TT4"]["status"] == "low"

    def test_every_response_carries_the_disclaimer(self, client) -> None:
        body = client.post("/api/predict", json=HEALTHY_PATIENT).json()
        assert "not a medical diagnosis" in body["disclaimer"]

    def test_works_with_a_single_lab_result(self, client) -> None:
        """Real lab reports are incomplete; the model imputes the rest."""
        response = client.post("/api/predict", json={"age": 44, "sex": "male", "TSH": 3.0})
        assert response.status_code == 200
        assert response.json()["inputs_provided"] < response.json()["inputs_total"]


class TestValidation:
    def test_rejects_a_request_with_no_lab_results(self, client) -> None:
        """History alone would produce a demographic stereotype, not a screening."""
        response = client.post("/api/predict", json={"age": 44, "sex": "male"})
        assert response.status_code == 422

    @pytest.mark.parametrize(
        ("field", "value"),
        [("TSH", 5000), ("TSH", -1), ("age", 0), ("age", 500), ("T4U", 99)],
    )
    def test_rejects_clinically_impossible_values(self, client, field, value) -> None:
        payload = {**HEALTHY_PATIENT, field: value}
        assert client.post("/api/predict", json=payload).status_code == 422

    def test_rejects_pregnancy_in_a_male_patient(self, client) -> None:
        payload = {**HEALTHY_PATIENT, "sex": "male", "pregnant": True}
        assert client.post("/api/predict", json=payload).status_code == 422

    def test_rejects_an_unknown_sex_value(self, client) -> None:
        payload = {**HEALTHY_PATIENT, "sex": "other"}
        assert client.post("/api/predict", json=payload).status_code == 422
