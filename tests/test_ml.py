"""Tests for data cleaning, the pipeline and the explainer."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from ml.config import BINARY_FEATURES, CLASS_NAMES, FEATURE_ORDER, NUMERIC_FEATURES
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
