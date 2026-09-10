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

    def test_input_count_measures_values_not_checkboxes(self, client) -> None:
        """Ticking history boxes must not make a sparse assessment look complete."""
        sparse = {"age": 44, "sex": "male", "TSH": 3.0}
        body = client.post("/api/predict", json=sparse).json()
        assert body["inputs_provided"] == 3
        assert body["inputs_total"] == 7

        with_history = {**sparse, "goitre": True, "psych": True, "sick": True}
        assert client.post("/api/predict", json=with_history).json()["inputs_provided"] == 3

        full = client.post("/api/predict", json=HYPOTHYROID_PATIENT).json()
        assert full["inputs_provided"] == 7

    def test_probabilities_are_labelled_by_the_estimator_class_order(self, client) -> None:
        """The predicted class must be the one holding the highest probability."""
        body = client.post("/api/predict", json=HYPOTHYROID_PATIENT).json()
        highest = max(body["probabilities"], key=lambda name: body["probabilities"][name])
        assert body["prediction"] == highest
        assert body["confidence"] == pytest.approx(body["probabilities"][highest])


class TestUnits:
    """A lab report in ug/dL must reach the model as nmol/L.

    This is the failure the unit selector exists to prevent: most laboratories
    outside Europe print total T4 in ug/dL, and a normal 8.1 ug/dL typed into a
    field measured in nmol/L would be scored against a 60-140 range and read as
    severe hypothyroidism.
    """

    def test_same_patient_in_either_unit_gets_the_same_result(self, client) -> None:
        in_nmol = {"age": 40, "sex": "female", "TSH": 2.0, "TT4": 104.2, "T3": 1.84}
        in_us = {
            "age": 40,
            "sex": "female",
            "TSH": 2.0,
            "TT4": 8.1,
            "T3": 120.0,
            "units": {"TT4": "ug/dL", "T3": "ng/dL"},
        }
        first = client.post("/api/predict", json=in_nmol).json()
        second = client.post("/api/predict", json=in_us).json()
        assert first["prediction"] == second["prediction"]
        assert first["confidence"] == pytest.approx(second["confidence"], abs=0.02)

    def test_a_normal_us_style_panel_is_not_called_hypothyroid(self, client) -> None:
        body = client.post(
            "/api/predict",
            json={
                "age": 40,
                "sex": "female",
                "TSH": 2.0,
                "TT4": 8.1,
                "T3": 120.0,
                "units": {"TT4": "ug/dL", "T3": "ng/dL"},
            },
        ).json()
        assert body["prediction"] == "Negative"
        flags = {item["feature"]: item for item in body["lab_flags"]}
        assert flags["TT4"]["status"] == "normal"

    def test_results_are_reported_back_in_the_unit_supplied(self, client) -> None:
        body = client.post(
            "/api/predict",
            json={"age": 40, "TSH": 2.0, "TT4": 8.1, "units": {"TT4": "ug/dL"}},
        ).json()
        flag = next(item for item in body["lab_flags"] if item["feature"] == "TT4")
        assert flag["unit"] == "µg/dL"
        assert flag["value"] == pytest.approx(8.1, abs=0.05)
        assert (flag["reference_low"], flag["reference_high"]) == (4.7, 10.9)

    def test_bounds_are_checked_after_conversion(self, client) -> None:
        """900 ug/dL is 11,583 nmol/L - impossible, and rejected as such."""
        response = client.post(
            "/api/predict",
            json={"age": 40, "TT4": 900, "units": {"TT4": "ug/dL"}},
        )
        assert response.status_code == 422
        assert "µg/dL" in response.text

    def test_unknown_unit_is_rejected(self, client) -> None:
        response = client.post(
            "/api/predict",
            json={"age": 40, "TSH": 2.0, "units": {"TSH": "pmol/L"}},
        )
        assert response.status_code == 422

    def test_reference_data_lists_units_with_converted_ranges(self, client) -> None:
        features = client.get("/api/reference-data").json()["features"]
        by_code = {unit["code"]: unit for unit in features["TT4"]["units"]}
        assert by_code["nmol/L"]["reference"] == [60, 140]
        assert by_code["ug/dL"]["reference"] == [4.7, 10.9]
        assert by_code["ug/dL"]["label"] == "µg/dL"


class TestCounterfactuals:
    def test_a_result_says_what_would_change_it(self, client) -> None:
        body = client.post("/api/predict", json=HYPOTHYROID_PATIENT).json()
        assert body["counterfactuals"], "a screening should say what would change it"
        item = body["counterfactuals"][0]
        assert item["resulting_class"] != body["prediction"]
        assert item["direction"] in {"above", "below"}

    def test_thresholds_are_expressed_in_the_patients_own_unit(self, client) -> None:
        body = client.post(
            "/api/predict",
            json={
                "age": 63,
                "sex": "female",
                "TSH": 68.0,
                "TT4": 3.7,
                "units": {"TT4": "ug/dL"},
            },
        ).json()
        for item in body["counterfactuals"]:
            if item["feature"] == "TT4":
                assert item["unit"] == "µg/dL"
                assert item["current_value"] == pytest.approx(3.7, abs=0.05)


class TestRouting:
    """The SPA catch-all must not answer for the API.

    Starlette prefers a full path match over a partial one, so without an
    explicit guard the frontend's catch-all route returns index.html with a 200
    for any unknown /api path or method mismatch. The client would then parse
    HTML as JSON and show the patient a syntax error instead of a real status.
    """

    def test_unknown_api_path_is_404_not_the_spa(self, client) -> None:
        response = client.get("/api/does-not-exist")
        assert response.status_code == 404
        assert response.headers["content-type"].startswith("application/json")

    def test_wrong_method_on_a_real_endpoint_is_not_html(self, client) -> None:
        response = client.get("/api/predict")
        assert response.status_code in {404, 405}
        assert "text/html" not in response.headers["content-type"]

    def test_unknown_app_route_serves_the_spa(self, client) -> None:
        """Client-side routes still have to survive a page refresh."""
        response = client.get("/history")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    def test_static_route_cannot_escape_the_static_directory(self, client) -> None:
        response = client.get("/../../ml/config.py")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]


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
