"""The nearest change that would have produced a different result.

"Hypothyroid, 94%" tells a patient what the model thinks. "Your TSH would have
to fall below 6.2 for this to read Negative" tells them what the model is
actually keying on, in the units on their own report, and whether they are
sitting near a boundary or far from one.

The search is a scan rather than a gradient method: the selected model is a
random forest, whose decision surface is a step function with no useful
gradient. Every candidate is evaluated in one batched call, so the whole thing
costs about as much as a single prediction.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from ml.config import FEATURE_META

#: Values tried per feature. Enough resolution to place a boundary tightly
#: without the grid itself becoming the dominant cost.
GRID_SIZE = 96

#: Features a patient could plausibly see change. Age is excluded: telling
#: someone their result would differ if they were 20 years younger is true and
#: useless.
SEARCHABLE = ("TSH", "T3", "TT4", "T4U", "FTI")


@dataclass
class Counterfactual:
    feature: str
    label: str
    unit: str
    current_value: float
    threshold: float
    direction: str  # "above" | "below"
    resulting_class: str

    def to_dict(self) -> dict:
        return asdict(self)


def _grid(feature: str, low: float, high: float) -> np.ndarray:
    """Candidate values spanning the plausible range for a feature.

    TSH is log-spaced because it spans four orders of magnitude in this
    dataset; a linear grid would spend almost every point in the region above
    normal and none in the region where the decision boundary actually sits.
    """
    if feature == "TSH":
        return np.geomspace(max(low, 1e-3), high, GRID_SIZE)
    return np.linspace(low, high, GRID_SIZE)


def find_counterfactuals(
    pipeline,
    row: pd.DataFrame,
    metadata: dict,
    predicted_index: int,
    provided_features: set[str],
    max_results: int = 2,
) -> list[Counterfactual]:
    """Find, per feature, the closest value that flips the predicted class.

    Only features the patient actually supplied are searched - proposing a
    threshold for a test they never took would be advice about a number that
    does not exist.
    """
    class_names = metadata["class_names"]
    candidates: list[Counterfactual] = []

    for feature in SEARCHABLE:
        if feature not in provided_features:
            continue
        meta = FEATURE_META.get(feature)
        if meta is None:
            continue

        actual = row.iloc[0][feature]
        if pd.isna(actual):
            continue
        actual = float(actual)

        low, high = meta["bounds"]
        grid = _grid(feature, float(low), float(high))

        # One frame holding every candidate, so this is a single batched
        # predict rather than GRID_SIZE separate calls.
        probe = pd.concat([row] * len(grid), ignore_index=True)
        probe[feature] = grid
        predictions = pipeline.predict(probe)

        flipped = np.flatnonzero(predictions != pipeline.classes_[predicted_index])
        if flipped.size == 0:
            continue

        # The boundary that matters is the one nearest the patient's own value.
        nearest = flipped[np.argmin(np.abs(grid[flipped] - actual))]
        threshold = float(grid[nearest])
        resulting = class_names[int(predictions[nearest])]

        candidates.append(
            Counterfactual(
                feature=feature,
                label=meta["label"],
                unit=meta["unit"],
                current_value=actual,
                threshold=threshold,
                direction="above" if threshold > actual else "below",
                resulting_class=resulting,
            )
        )

    # Closest boundary first, measured relative to the value itself so that a
    # TSH shift of 2 and an FTI shift of 2 are not treated as equally near.
    candidates.sort(
        key=lambda item: abs(item.threshold - item.current_value) / max(abs(item.current_value), 1e-6)
    )
    return candidates[:max_results]


__all__ = ["Counterfactual", "find_counterfactuals"]
