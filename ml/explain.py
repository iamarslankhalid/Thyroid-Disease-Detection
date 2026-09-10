"""Per-prediction explanations.

A screening result that just says "Hypothyroid, 94%" is not usable by a patient
or trustworthy to a clinician. This module answers "which of *my* numbers drove
that answer?".

The method is occlusion: replace one feature with the value of a typical patient
(the median or mode of the training set), re-predict, and measure how far the
probability of the predicted class moves. A large drop means that feature was
holding the prediction up. It is an approximation - unlike exact Shapley values
it does not split credit between interacting features - but it needs no extra
dependency, works with any estimator, and costs one prediction per feature.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import pandas as pd

from ml.config import BINARY_LABELS, FEATURE_META


@dataclass
class Contribution:
    """One feature's influence on the predicted class."""

    feature: str
    label: str
    value: float | None
    unit: str | None
    status: str | None  # "low" | "normal" | "high" for lab values
    direction: str  # "supports" | "opposes"
    impact: float  # absolute probability shift, 0-1

    def to_dict(self) -> dict:
        return asdict(self)


def classify_value(feature: str, value: float | None) -> str | None:
    """Place a lab value against its typical adult reference range."""
    if value is None:
        return None
    meta = FEATURE_META.get(feature)
    if not meta or not meta.get("reference"):
        return None
    low, high = meta["reference"]
    if value < low:
        return "low"
    if value > high:
        return "high"
    return "normal"


def _describe(feature: str, value: float | None) -> tuple[str, str | None]:
    """Return a human label and unit for a feature."""
    if feature in FEATURE_META:
        return FEATURE_META[feature]["label"], FEATURE_META[feature]["unit"]
    label = BINARY_LABELS.get(feature, feature.replace("_", " ").title())
    if feature in BINARY_LABELS and value is not None:
        return (label if value >= 0.5 else f"Not: {label}"), None
    return label, None


def explain_prediction(
    pipeline,
    row: pd.DataFrame,
    metadata: dict,
    predicted_index: int,
    provided_features: set[str] | None = None,
    top_k: int = 6,
    min_impact: float = 0.005,
) -> list[Contribution]:
    """Rank the features that pushed the prediction towards ``predicted_index``.

    Only features the user actually supplied are explained. Attributing a result
    to a value the pipeline imputed would be telling the patient something about
    a number they never gave.
    """
    reference = metadata["reference_row"]
    feature_order = metadata["feature_order"]
    if provided_features is None:
        provided_features = {name for name in feature_order if pd.notna(row.iloc[0][name])}

    base_probability = float(pipeline.predict_proba(row)[0][predicted_index])

    contributions: list[Contribution] = []
    for feature in feature_order:
        if feature not in provided_features:
            continue

        actual = row.iloc[0][feature]
        neutral = reference.get(feature)
        if neutral is None or (pd.notna(actual) and float(actual) == float(neutral)):
            continue

        counterfactual = row.copy()
        counterfactual.loc[counterfactual.index[0], feature] = neutral
        shifted = float(pipeline.predict_proba(counterfactual)[0][predicted_index])

        delta = base_probability - shifted
        if abs(delta) < min_impact:
            continue

        value = float(actual) if pd.notna(actual) else None
        label, unit = _describe(feature, value)
        contributions.append(
            Contribution(
                feature=feature,
                label=label,
                value=value,
                unit=unit,
                status=classify_value(feature, value),
                direction="supports" if delta > 0 else "opposes",
                impact=abs(delta),
            )
        )

    contributions.sort(key=lambda item: item.impact, reverse=True)
    return contributions[:top_k]


__all__ = ["Contribution", "classify_value", "explain_prediction"]
