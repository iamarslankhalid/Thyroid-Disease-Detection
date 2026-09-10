"""Tests for data cleaning, the pipeline and the explainer."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from ml import units
from ml.config import (
    BINARY_FEATURES,
    CLASS_NAMES,
    FEATURE_META,
    FEATURE_ORDER,
    NUMERIC_FEATURES,
)
from ml.counterfactual import find_counterfactuals
from ml.data import build_dataset, map_target
from ml.explain import classify_value, explain_prediction
from ml.pipeline import build_candidates


class TestTargetMapping:
    @pytest.mark.parametrize("code", ["A", "B", "C", "D", "AK", "C|I"])
    def test_hyperthyroid_codes(self, code: str) -> None:
        assert map_target(code) == "Hyperthyroid"

    @pytest.mark.parametrize("code", ["E", "F", "G", "H", "FK", "GKJ", "H|K"])
    def test_hypothyroid_codes(self, code: str) -> None:
        assert map_target(code) == "Hypothyroid"

    def test_dash_is_negative(self) -> None:
        assert map_target("-") == "Negative"

    @pytest.mark.parametrize("code", ["I", "J", "K", "L", "R", "", None, float("nan")])
    def test_other_diagnoses_are_dropped_not_relabelled(self, code) -> None:
        """Binding-protein and therapy codes are not one of our classes."""
        assert map_target(code) is None


class TestDataset:
    @pytest.fixture(scope="class")
    def dataset(self):
        return build_dataset()

    def test_columns_match_the_declared_feature_order(self, dataset) -> None:
        X, _, _ = dataset
        assert list(X.columns) == FEATURE_ORDER

    def test_labels_are_valid_class_indices(self, dataset) -> None:
        _, y, _ = dataset
        assert set(y.unique()) <= set(range(len(CLASS_NAMES)))
        assert y.notna().all()

    def test_implausible_ages_become_missing(self, dataset) -> None:
        """The raw file contains an age of 65,526; it must not reach the model."""
        X, _, report = dataset
        assert report.implausible_ages_nulled > 0
        assert X["age"].max() <= 120

    def test_extreme_but_real_lab_values_are_kept(self, dataset) -> None:
        """A very high TSH is the clearest hypothyroid signal, not an outlier."""
        X, _, _ = dataset
        assert X["TSH"].max() > 100

    def test_no_negative_lab_values(self, dataset) -> None:
        """The notebook's random imputation produced negative TSH; ours cannot."""
        X, _, _ = dataset
        for feature in NUMERIC_FEATURES:
            values = X[feature].dropna()
            assert (values > 0).all(), f"{feature} contains a non-positive value"

    def test_binary_features_are_zero_one_or_missing(self, dataset) -> None:
        X, _, _ = dataset
        for feature in BINARY_FEATURES:
            values = set(X[feature].dropna().unique())
            assert values <= {0.0, 1.0}

    def test_is_deterministic(self) -> None:
        """Same CSV, same dataset - unlike the unseeded notebook."""
        first, y_first, _ = build_dataset()
        second, y_second, _ = build_dataset()
        pd.testing.assert_frame_equal(first, second)
        pd.testing.assert_series_equal(y_first, y_second)


class TestPipeline:
    @pytest.fixture(scope="class")
    def trained(self):
        X, y, _ = build_dataset()
        pipeline = build_candidates()["random_forest"]
        return pipeline.fit(X.head(2000), y.head(2000))

    def test_handles_rows_with_missing_labs(self, trained) -> None:
        """A patient with only TSH must still get a prediction, not a crash."""
        row = pd.DataFrame([{name: np.nan for name in FEATURE_ORDER}])
        row.loc[0, "age"] = 40.0
        row.loc[0, "TSH"] = 12.0
        probabilities = trained.predict_proba(row)[0]
        assert len(probabilities) == len(CLASS_NAMES)
        assert probabilities.sum() == pytest.approx(1.0)

    def test_preprocessing_travels_with_the_model(self, trained) -> None:
        """Serving cannot forget a transform, because it is inside the pipeline."""
        assert "preprocess" in dict(trained.named_steps)


class TestExplain:
    @pytest.mark.parametrize(
        ("feature", "value", "expected"),
        [("TSH", 0.1, "low"), ("TSH", 2.0, "normal"), ("TSH", 40.0, "high"), ("age", 30, None)],
    )
    def test_reference_range_classification(self, feature, value, expected) -> None:
        assert classify_value(feature, value) == expected

    def test_only_provided_features_are_explained(self) -> None:
        """Never attribute a result to a number the patient did not give."""
        X, y, _ = build_dataset()
        pipeline = build_candidates()["random_forest"].fit(X.head(1500), y.head(1500))
        metadata = {
            "feature_order": FEATURE_ORDER,
            "reference_row": {name: float(X[name].median()) for name in FEATURE_ORDER},
        }
        row = pd.DataFrame([{name: np.nan for name in FEATURE_ORDER}])
        row.loc[0, "age"] = 55.0
        row.loc[0, "TSH"] = 60.0

        contributions = explain_prediction(
            pipeline, row, metadata, predicted_index=1, provided_features={"age", "TSH"}
        )
        assert {item.feature for item in contributions} <= {"age", "TSH"}


class TestUnits:
    """Conversions are the difference between a screening and a wrong answer."""

    def test_canonical_units_are_unchanged(self) -> None:
        assert units.to_canonical("TT4", 105.0) == pytest.approx(105.0)
        assert units.to_canonical("T3", 1.9, "nmol/L") == pytest.approx(1.9)

    def test_total_t4_converts_from_micrograms_per_decilitre(self) -> None:
        """8.1 ug/dL is a normal T4; read as nmol/L it looks severely low."""
        canonical = units.to_canonical("TT4", 8.1, "ug/dL")
        assert canonical == pytest.approx(104.2, abs=0.5)
        low, high = FEATURE_META["TT4"]["reference"]
        assert low < canonical < high

    def test_total_t3_converts_from_nanograms_per_decilitre(self) -> None:
        canonical = units.to_canonical("T3", 120.0, "ng/dL")
        assert canonical == pytest.approx(1.84, abs=0.05)

    def test_microinternational_units_equal_milliunits(self) -> None:
        """The same quantity under two names; patients should not need to know."""
        assert units.to_canonical("TSH", 4.2, "uIU/mL") == pytest.approx(4.2)

    def test_conversion_round_trips(self) -> None:
        for feature, value, code in [("TT4", 96.0, "ug/dL"), ("T3", 2.2, "ng/dL")]:
            canonical = units.to_canonical(feature, value, code)
            assert units.from_canonical(feature, canonical, code) == pytest.approx(value)

    def test_reference_range_converts(self) -> None:
        low, high = units.convert_range("TT4", 60.0, 140.0, "ug/dL")
        assert (round(low, 1), round(high, 1)) == (4.7, 10.9)

    def test_unknown_unit_is_rejected(self) -> None:
        with pytest.raises(units.UnknownUnitError):
            units.to_canonical("TT4", 100.0, "pmol/L")

    def test_uptake_offers_no_conversion(self) -> None:
        """Turning a T-uptake percentage into this ratio needs the lab's own
        normal mean, so no conversion is offered rather than a wrong one."""
        assert [unit.code for unit in units.units_for("T4U")] == ["ratio"]


class TestCounterfactuals:
    @pytest.fixture(scope="class")
    def trained(self):
        X, y, _ = build_dataset()
        pipeline = build_candidates()["random_forest"]
        return pipeline.fit(X, y)

    def _row(self, **values) -> pd.DataFrame:
        row = pd.DataFrame([{name: np.nan for name in FEATURE_ORDER}])
        for name, value in values.items():
            row.loc[0, name] = value
        return row

    def test_finds_a_threshold_that_flips_a_hypothyroid_result(self, trained) -> None:
        row = self._row(age=58, sex_is_male=0, TSH=40.0, T3=1.0, TT4=50.0, T4U=1.0, FTI=48.0)
        metadata = {"class_names": CLASS_NAMES}
        predicted = int(np.argmax(trained.predict_proba(row)[0]))

        results = find_counterfactuals(
            trained, row, metadata, predicted, provided_features=set(FEATURE_ORDER)
        )
        assert results, "a borderline-able case should have some reachable boundary"
        for item in results:
            assert item.resulting_class != CLASS_NAMES[predicted]
            assert item.direction in {"above", "below"}
            if item.direction == "below":
                assert item.threshold < item.current_value
            else:
                assert item.threshold > item.current_value

    def test_only_suggests_changes_to_values_that_were_given(self, trained) -> None:
        """Proposing a threshold for a test the patient never took is nonsense."""
        row = self._row(age=58, TSH=40.0)
        results = find_counterfactuals(
            trained, row, {"class_names": CLASS_NAMES}, 1, provided_features={"age", "TSH"}
        )
        assert {item.feature for item in results} <= {"TSH"}

    def test_crossing_the_threshold_really_changes_the_prediction(self, trained) -> None:
        """The reported boundary must hold when the model is asked again."""
        row = self._row(age=58, sex_is_male=0, TSH=40.0, T3=1.0, TT4=50.0, T4U=1.0, FTI=48.0)
        metadata = {"class_names": CLASS_NAMES}
        predicted = int(np.argmax(trained.predict_proba(row)[0]))
        results = find_counterfactuals(
            trained, row, metadata, predicted, provided_features=set(FEATURE_ORDER)
        )

        for item in results:
            moved = row.copy()
            moved.loc[0, item.feature] = item.threshold
            assert CLASS_NAMES[int(trained.predict(moved)[0])] == item.resulting_class
