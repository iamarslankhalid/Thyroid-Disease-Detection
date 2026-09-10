"""Train, compare and persist the thyroid screening model.

Run with ``python -m ml.train``. The script is deterministic: given the same
CSV it produces the same model, which the original notebook could not do
because it filled missing values with unseeded random numbers.
"""

from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split

from ml import __version__
from ml.config import (
    BINARY_FEATURES,
    CLASS_NAMES,
    CV_FOLDS,
    DATA_FILE,
    FEATURE_ORDER,
    MODEL_FILE,
    NUMERIC_FEATURES,
    RANDOM_STATE,
    REPORT_DIR,
    TEST_SIZE,
)
from ml.data import DROPPED_COLUMNS, build_dataset
from ml.evaluate import compute_metrics, format_metrics
from ml.pipeline import build_baseline, build_candidates

logger = logging.getLogger("ml.train")

# Model selection is decided on macro F1, and the choice is deliberate.
# Accuracy is useless here: 88% of patients are healthy, so "always Negative"
# already scores 0.88. Balanced accuracy is the opposite failure - it counts
# only recall, so a model that flags half the healthy population as ill still
# looks excellent. Macro F1 is the metric that punishes both missed patients
# and false alarms, and it weights the rare classes equally with the common
# one. The missed-disease rate is reported alongside it as the safety check.
SELECTION_METRIC = "f1_macro"


def _cross_validate(name: str, pipeline, X_train, y_train) -> dict:
    splitter = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    scores = cross_validate(
        pipeline,
        X_train,
        y_train,
        cv=splitter,
        scoring=["balanced_accuracy", "f1_macro", "accuracy"],
        n_jobs=-1,
    )
    summary = {
        metric: {
            "mean": float(np.mean(scores[f"test_{metric}"])),
            "std": float(np.std(scores[f"test_{metric}"])),
        }
        for metric in ("balanced_accuracy", "f1_macro", "accuracy")
    }
    logger.info(
        "%-24s CV balanced acc %.4f (+/-%.4f)  macro F1 %.4f",
        name,
        summary["balanced_accuracy"]["mean"],
        summary["balanced_accuracy"]["std"],
        summary["f1_macro"]["mean"],
    )
    return summary


def _reference_row(X_train: pd.DataFrame) -> dict[str, float]:
    """A 'typical patient' used as the neutral value by the explainer."""
    reference: dict[str, float] = {}
    for column in NUMERIC_FEATURES:
        reference[column] = float(X_train[column].median())
    for column in BINARY_FEATURES:
        mode = X_train[column].mode(dropna=True)
        reference[column] = float(mode.iloc[0]) if len(mode) else 0.0
    return reference


def train(data_path: Path = DATA_FILE, output: Path = MODEL_FILE) -> dict:
    X, y, dataset_report = build_dataset(data_path)
    print(dataset_report.describe(), "\n")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )
    logger.info("Train rows: %d   Test rows: %d", len(X_train), len(X_test))

    results: dict[str, dict] = {}

    baseline = build_baseline().fit(X_train, y_train)
    results["baseline_majority_class"] = {
        "cv": None,
        "test": compute_metrics(y_test.to_numpy(), baseline.predict(X_test)),
    }
    print(format_metrics("baseline (always Negative)", results["baseline_majority_class"]["test"]))

    fitted: dict[str, object] = {}
    for name, pipeline in build_candidates().items():
        cv_summary = _cross_validate(name, pipeline, X_train, y_train)
        pipeline.fit(X_train, y_train)
        proba = pipeline.predict_proba(X_test) if hasattr(pipeline, "predict_proba") else None
        test_metrics = compute_metrics(y_test.to_numpy(), pipeline.predict(X_test), proba)
        results[name] = {"cv": cv_summary, "test": test_metrics}
        fitted[name] = pipeline
        print(format_metrics(name, test_metrics))

    best_name = max(fitted, key=lambda name: results[name]["cv"][SELECTION_METRIC]["mean"])
    best_pipeline = fitted[best_name]
    logger.info("Selected %s on cross-validated %s", best_name, SELECTION_METRIC)

    metadata = {
        "model_name": best_name,
        "package_version": __version__,
        "sklearn_version": sklearn.__version__,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "random_state": RANDOM_STATE,
        "selection_metric": SELECTION_METRIC,
        "class_names": list(CLASS_NAMES),
        "feature_order": list(FEATURE_ORDER),
        "numeric_features": list(NUMERIC_FEATURES),
        "binary_features": list(BINARY_FEATURES),
        "reference_row": _reference_row(X_train),
        "training_rows": len(X_train),
        "test_rows": len(X_test),
        "class_counts": dataset_report.class_counts,
        "dropped_columns": DROPPED_COLUMNS,
        "metrics": results[best_name],
        "all_model_metrics": results,
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": best_pipeline, "metadata": metadata}, output)
    logger.info("Saved model to %s", output)

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / "metrics.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    (REPORT_DIR / "dataset_report.txt").write_text(dataset_report.describe(), encoding="utf-8")
    _write_model_card(metadata, results)

    return metadata


def _write_model_card(metadata: dict, results: dict) -> None:
    """Write a model card - the artifact a reviewer looks for before trusting a model."""
    best = metadata["model_name"]
    test = results[best]["test"]

    rows = "\n".join(
        f"| {name} | {r['cv'][SELECTION_METRIC]['mean']:.4f} "
        f"| {r['test']['balanced_accuracy']:.4f} | {r['test']['macro_f1']:.4f} "
        f"| {r['test']['accuracy']:.4f} | {r['test']['missed_disease_rate']:.4f} |"
        for name, r in results.items()
        if r["cv"] is not None
    )
    per_class = "\n".join(
        f"| {name} | {s['precision']:.3f} | {s['recall']:.3f} | {s['f1']:.3f} | {s['support']} |"
        for name, s in test["per_class"].items()
    )
    matrix_rows = "\n".join(
        f"| **{label}** | " + " | ".join(str(value) for value in row) + " |"
        for label, row in zip(test["confusion_matrix_labels"], test["confusion_matrix"])
    )
    dropped = "\n".join(
        f"- `{name}`: {reason}" for name, reason in metadata["dropped_columns"].items()
    )
    header = " | ".join(test["confusion_matrix_labels"])
    baseline_accuracy = results["baseline_majority_class"]["test"]["accuracy"]
    total_rows = sum(metadata["class_counts"].values())
    balance = ", ".join(f"{name} {count:,}" for name, count in metadata["class_counts"].items())

    card = f"""# Model card - thyroid screening classifier

*Generated by `ml/train.py` on {metadata["trained_at"]}. Do not edit by hand.*

## Intended use

Educational decision **support**: it flags lab results that look consistent with
hypothyroidism or hyperthyroidism so that a person knows to speak to a doctor.
It is **not** a medical device, it does not diagnose, and it must not be used to
make a treatment decision.

## Model

- Selected estimator: **{best}** (chosen on cross-validated {SELECTION_METRIC})
- scikit-learn {metadata["sklearn_version"]}, random_state {metadata["random_state"]}
- Trained on {metadata["training_rows"]:,} rows, tested on {metadata["test_rows"]:,} held-out rows
- Features: {len(metadata["feature_order"])} ({len(metadata["numeric_features"])} numeric, {len(metadata["binary_features"])} binary)

## Results on the held-out test set

| model | CV {SELECTION_METRIC} | test balanced acc | test macro F1 | test accuracy | missed disease rate |
|---|---|---|---|---|---|
{rows}

A model that always answers "Negative" scores **{baseline_accuracy:.4f}** accuracy
on this data. Accuracy alone therefore proves nothing; balanced accuracy, macro
F1 and the missed-disease rate are the numbers that matter.

### Selected model, per class

| class | precision | recall | F1 | support |
|---|---|---|---|---|
{per_class}

### Confusion matrix (rows = truth, columns = prediction)

| | {header} |
|---|---|---|---|
{matrix_rows}

## Training data

Garvan Institute thyroid dataset (UCI / Kaggle), {total_rows:,} usable patient
records. Class balance: {balance}.

Columns removed and why:

{dropped}

## Limitations

- The data was collected at one Australian clinic in the 1980s. Assay methods,
  reference ranges and the patient mix have all changed since, so real-world
  accuracy today would be lower than the table above.
- Hyperthyroid cases are rare in this dataset, so that class is the least
  reliable of the three.
- Modern lab reports often give free T4/T3 rather than the T4-uptake and
  free-T4-index measures this dataset uses. Missing inputs are imputed, and
  predictions made from few labs are correspondingly less certain.
- The model has never been validated on any external cohort.
"""

    card_path = MODEL_FILE.parent
    card_path.mkdir(parents=True, exist_ok=True)
    (card_path / "MODEL_CARD.md").write_text(card, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the thyroid screening model.")
    parser.add_argument("--data", type=Path, default=DATA_FILE)
    parser.add_argument("--output", type=Path, default=MODEL_FILE)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s %(message)s")
    metadata = train(args.data, args.output)
    print(f"\nSelected model: {metadata['model_name']}")
    print(f"Artifact:       {args.output}")


if __name__ == "__main__":
    main()
