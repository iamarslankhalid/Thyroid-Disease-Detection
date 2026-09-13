"""Single source of truth for features, labels, units and clinical ranges.

Both training (``ml.train``) and serving (``backend.app``) import from here, so a
feature can never be defined one way in the notebook and another way in the API.
"""

from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = PROJECT_ROOT / "data" / "raw" / "Thyroid.csv"
MODEL_DIR = PROJECT_ROOT / "models"
MODEL_FILE = MODEL_DIR / "thyroid_model.joblib"
REPORT_DIR = PROJECT_ROOT / "reports"

RANDOM_STATE = 42
TEST_SIZE = 0.2
CV_FOLDS = 5

# --- Target -----------------------------------------------------------------
# The raw dataset encodes diagnoses as letter codes (see the Garvan data
# dictionary). Codes A-D are hyperthyroid conditions, E-H hypothyroid ones and
# "-" means no condition worth commenting on. Rows carrying any other code
# (binding-protein anomalies, replacement therapy, discordant assays, ...) are
# not one of our three classes and are dropped rather than silently relabelled.
CLASS_NAMES = ["Negative", "Hypothyroid", "Hyperthyroid"]

HYPERTHYROID_CODES = {"A", "B", "C", "D"}
HYPOTHYROID_CODES = {"E", "F", "G", "H"}

# --- Features ---------------------------------------------------------------
# Numeric lab results and age. These may legitimately be missing: a patient
# rarely has every test on one report, so the pipeline imputes them and flags
# that they were missing instead of demanding a value.
NUMERIC_FEATURES = ["age", "TSH", "T3", "TT4", "T4U", "FTI"]

# Yes/no clinical history. The original notebook dropped almost all of these,
# which threw away strong signal: someone already on thyroxine or antithyroid
# medication has lab values that mean something quite different.
BINARY_FEATURES = [
    "sex_is_male",
    "on_thyroxine",
    "query_on_thyroxine",
    "on_antithyroid_meds",
    "sick",
    "pregnant",
    "thyroid_surgery",
    "I131_treatment",
    "query_hypothyroid",
    "query_hyperthyroid",
    "lithium",
    "goitre",
    "tumor",
    "psych",
]

FEATURE_ORDER = NUMERIC_FEATURES + BINARY_FEATURES

# Raw dataset columns that map onto BINARY_FEATURES (sex is handled separately).
RAW_BINARY_COLUMNS = [f for f in BINARY_FEATURES if f != "sex_is_male"]

# --- Units, plausible input bounds and reference ranges ---------------------
# ``bounds`` reject physically impossible input; ``reference`` is the typical
# adult range used to flag a value as low/normal/high in the UI. Reference
# ranges vary between laboratories, so they are guidance, not diagnosis.
FEATURE_META: dict[str, dict] = {
    "age": {
        "label": "Age",
        "unit": "years",
        "bounds": (1.0, 120.0),
        "reference": None,
        "description": "Patient age in years.",
    },
    "TSH": {
        "label": "TSH",
        "unit": "mU/L",
        "bounds": (0.001, 600.0),
        "reference": (0.4, 4.0),
        "description": "Thyroid-stimulating hormone. Usually rises in hypothyroidism and falls in hyperthyroidism.",
    },
    "T3": {
        "label": "Total T3",
        "unit": "nmol/L",
        "bounds": (0.01, 30.0),
        "reference": (1.2, 2.8),
        "description": "Total triiodothyronine.",
    },
    "TT4": {
        "label": "Total T4",
        "unit": "nmol/L",
        "bounds": (1.0, 800.0),
        "reference": (60.0, 140.0),
        "description": "Total thyroxine.",
    },
    "T4U": {
        "label": "T4 uptake",
        "unit": "ratio",
        "bounds": (0.1, 3.0),
        "reference": (0.8, 1.2),
        "description": "Thyroxine uptake ratio, used to derive the free thyroxine index.",
    },
    "FTI": {
        "label": "Free T4 index",
        "unit": "index",
        "bounds": (1.0, 900.0),
        "reference": (65.0, 155.0),
        "description": "Free thyroxine index (TT4 adjusted by T4 uptake).",
    },
}

BINARY_LABELS: dict[str, str] = {
    "sex_is_male": "Male",
    "on_thyroxine": "Currently taking thyroxine",
    "query_on_thyroxine": "Possibly taking thyroxine",
    "on_antithyroid_meds": "Currently taking antithyroid medication",
    "sick": "Currently unwell",
    "pregnant": "Pregnant",
    "thyroid_surgery": "Previous thyroid surgery",
    "I131_treatment": "Had radioactive iodine (I131) treatment",
    "query_hypothyroid": "Suspected hypothyroidism",
    "query_hyperthyroid": "Suspected hyperthyroidism",
    "lithium": "Taking lithium",
    "goitre": "Has a goitre",
    "tumor": "Has a thyroid tumour",
    "psych": "Psychiatric condition",
}

MAX_AGE = 120.0
