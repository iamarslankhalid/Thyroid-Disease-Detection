"""Metrics that are honest about an imbalanced, safety-critical problem.

Plain accuracy is close to meaningless here: 90.7% of patients in this dataset
are healthy, so predicting "Negative" for everyone already scores ~0.91. Every
report therefore leads with balanced accuracy, macro F1 and - most importantly -
per-class recall, because a missed hypothyroid patient is the costly error.
"""

from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
    roc_auc_score,
)

from ml.config import CLASS_NAMES


def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_proba: np.ndarray | None = None,
) -> dict:
    """Return a JSON-serialisable metric bundle for one model."""
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=range(len(CLASS_NAMES)), zero_division=0
    )

    metrics: dict = {
        "accuracy": float((np.asarray(y_true) == np.asarray(y_pred)).mean()),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "macro_f1": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "per_class": {
            name: {
                "precision": float(precision[index]),
                "recall": float(recall[index]),
                "f1": float(f1[index]),
                "support": int(support[index]),
            }
            for index, name in enumerate(CLASS_NAMES)
        },
        "confusion_matrix": confusion_matrix(
            y_true, y_pred, labels=range(len(CLASS_NAMES))
        ).tolist(),
        "confusion_matrix_labels": list(CLASS_NAMES),
    }

    if y_proba is not None:
        try:
            metrics["roc_auc_ovr_macro"] = float(
                roc_auc_score(y_true, y_proba, multi_class="ovr", average="macro")
            )
        except ValueError:
            # Happens if a class is absent from a fold; not worth failing over.
            metrics["roc_auc_ovr_macro"] = None

    # The share of genuinely ill patients that the model sends home reassured.
    disease_indices = [i for i, name in enumerate(CLASS_NAMES) if name != "Negative"]
    negative_index = CLASS_NAMES.index("Negative")
    matrix = np.asarray(metrics["confusion_matrix"])
    diseased = matrix[disease_indices].sum()
    missed = matrix[disease_indices, negative_index].sum()
    metrics["missed_disease_rate"] = float(missed / diseased) if diseased else 0.0

    return metrics


def format_metrics(name: str, metrics: dict) -> str:
    """Human-readable summary for the training log."""
    lines = [
        f"--- {name} ---",
        f"  accuracy           {metrics['accuracy']:.4f}",
        f"  balanced accuracy  {metrics['balanced_accuracy']:.4f}",
        f"  macro F1           {metrics['macro_f1']:.4f}",
    ]
    if metrics.get("roc_auc_ovr_macro") is not None:
        lines.append(f"  ROC AUC (ovr)      {metrics['roc_auc_ovr_macro']:.4f}")
    lines.append(f"  missed disease     {metrics['missed_disease_rate']:.4f}")
    lines.append(f"  {'class':<14}{'prec':>8}{'recall':>8}{'f1':>8}{'n':>8}")
    for class_name, scores in metrics["per_class"].items():
        lines.append(
            f"  {class_name:<14}{scores['precision']:>8.3f}"
            f"{scores['recall']:>8.3f}{scores['f1']:>8.3f}{scores['support']:>8d}"
        )
    return "\n".join(lines)


__all__ = ["compute_metrics", "format_metrics"]
