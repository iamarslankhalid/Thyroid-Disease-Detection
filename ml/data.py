"""Loading and cleaning of the raw thyroid dataset.

Deliberately *no* imputation happens here. Filling missing values is part of the
scikit-learn pipeline so that it is fitted on the training fold only and can
never leak test-set information, which is what the original notebook did.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from ml.config import (
    BINARY_FEATURES,
    CLASS_NAMES,
    DATA_FILE,
    FEATURE_ORDER,
    HYPERTHYROID_CODES,
    HYPOTHYROID_CODES,
    MAX_AGE,
    NUMERIC_FEATURES,
    RAW_BINARY_COLUMNS,
)

logger = logging.getLogger(__name__)

# Columns removed from the raw file, with the reason recorded so the choice is
# auditable rather than buried in a notebook cell.
DROPPED_COLUMNS = {
    "TBG": "96% missing; nothing reliable can be learned from 349 values",
    "patient_id": "identifier, not a clinical signal",
    "referral_source": (
        "encodes which clinic sent the sample, which correlates with diagnosis "
        "in this dataset but is unknown for a new patient - using it would "
        "inflate offline scores and fail in the real world"
    ),
    "hypopituitary": "only 2 positive cases in 9,172 rows",
}

# The *_measured flags simply restate whether the matching value is present.
# The pipeline adds explicit missing-indicator columns, so keeping these would
# duplicate the same information.
MEASURED_COLUMNS = [
    "TSH_measured",
    "T3_measured",
    "TT4_measured",
    "T4U_measured",
    "FTI_measured",
    "TBG_measured",
]


@dataclass
class DatasetReport:
    """What cleaning actually did, so it can be printed and put in the model card."""

    raw_rows: int = 0
    rows_after_target_mapping: int = 0
    dropped_unmapped_target: int = 0
    implausible_ages_nulled: int = 0
    male_pregnancy_flags_fixed: int = 0
    missing_per_feature: dict[str, int] = field(default_factory=dict)
    class_counts: dict[str, int] = field(default_factory=dict)

    def describe(self) -> str:
        lines = [
            f"Raw rows:                    {self.raw_rows:,}",
            f"Rows kept after target map:  {self.rows_after_target_mapping:,}",
            f"Dropped (other diagnoses):   {self.dropped_unmapped_target:,}",
            f"Implausible ages set to NaN: {self.implausible_ages_nulled:,}",
            f"Male 'pregnant' flags fixed: {self.male_pregnancy_flags_fixed:,}",
            "Class balance:",
        ]
        total = sum(self.class_counts.values()) or 1
        for name, count in self.class_counts.items():
            lines.append(f"  {name:<13} {count:>6,} ({count / total:6.2%})")
        lines.append("Missing values per feature (left for the pipeline to impute):")
        for name, count in self.missing_per_feature.items():
            if count:
                lines.append(f"  {name:<13} {count:>6,} ({count / total:6.2%})")
        return "\n".join(lines)


def map_target(code: str) -> str | None:
    """Map a raw diagnosis code to one of the three classes, or ``None`` to drop.

    A code may combine several letters (e.g. ``"AK"`` or ``"C|I"``): the first
    letter is the primary diagnosis, so classification follows that letter.
    """
    if not isinstance(code, str) or not code.strip():
        return None
    code = code.strip()
    if code == "-":
        return "Negative"
    primary = code[0].upper()
    if primary in HYPERTHYROID_CODES:
        return "Hyperthyroid"
    if primary in HYPOTHYROID_CODES:
        return "Hypothyroid"
    return None


def _to_binary(series: pd.Series) -> pd.Series:
    """Convert the dataset's ``t``/``f`` strings to 1.0/0.0, keeping NaN as NaN."""
    return series.astype(str).str.strip().str.lower().map({"t": 1.0, "f": 0.0})


def load_raw(path: Path | str = DATA_FILE) -> pd.DataFrame:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset not found at {path}. It ships with the repository at "
            "data/raw/Thyroid.csv."
        )
    return pd.read_csv(path)


def build_dataset(
    path: Path | str = DATA_FILE,
) -> tuple[pd.DataFrame, pd.Series, DatasetReport]:
    """Return ``(X, y, report)`` ready for a stratified split.

    ``X`` holds exactly ``FEATURE_ORDER`` columns and may contain NaN. ``y``
    holds integer class indices matching ``CLASS_NAMES``.
    """
    raw = load_raw(path)
    report = DatasetReport(raw_rows=len(raw))

    # --- target ---
    mapped = raw["target"].map(map_target)
    keep = mapped.notna()
    report.dropped_unmapped_target = int((~keep).sum())
    df = raw.loc[keep].copy()
    labels = mapped.loc[keep]
    report.rows_after_target_mapping = len(df)

    # --- features ---
    features = pd.DataFrame(index=df.index)

    age = pd.to_numeric(df["age"], errors="coerce")
    implausible = (age > MAX_AGE) | (age < 1)
    report.implausible_ages_nulled = int(implausible.sum())
    features["age"] = age.mask(implausible)

    for column in NUMERIC_FEATURES:
        if column == "age":
            continue
        # Kept as-is: no outlier trimming. Extreme TSH values are precisely the
        # clearest hypothyroid cases, and the notebook's 3-sigma filter deleted
        # them along with the signal they carry.
        features[column] = pd.to_numeric(df[column], errors="coerce")

    sex = df["sex"].astype(str).str.strip().str.upper().map({"M": 1.0, "F": 0.0})
    features["sex_is_male"] = sex

    for column in RAW_BINARY_COLUMNS:
        features[column] = _to_binary(df[column])

    # A recorded pregnancy in a male patient is a data-entry error.
    male_pregnant = (features["sex_is_male"] == 1.0) & (features["pregnant"] == 1.0)
    report.male_pregnancy_flags_fixed = int(male_pregnant.sum())
    features.loc[male_pregnant, "pregnant"] = 0.0

    features = features[FEATURE_ORDER]

    y = labels.map({name: index for index, name in enumerate(CLASS_NAMES)}).astype(int)

    report.missing_per_feature = {
        column: int(features[column].isna().sum()) for column in FEATURE_ORDER
    }
    report.class_counts = {
        name: int((y == index).sum()) for index, name in enumerate(CLASS_NAMES)
    }

    logger.info("Built dataset with %d rows and %d features", len(features), features.shape[1])
    return features.reset_index(drop=True), y.reset_index(drop=True), report


__all__ = ["build_dataset", "load_raw", "map_target", "DatasetReport", "DROPPED_COLUMNS"]
