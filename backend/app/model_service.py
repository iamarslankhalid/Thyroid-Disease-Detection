"""Loads the trained artifact and turns a validated request into a result.

The service holds the *only* copy of the pipeline in the process. Because the
pipeline carries its own preprocessing, there is no way for the API to apply a
different transformation than training did.
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ml.config import (
    BINARY_FEATURES,
    FEATURE_META,
    FEATURE_ORDER,
    MODEL_FILE,
    NUMERIC_FEATURES,
)
from ml.explain import classify_value, explain_prediction

logger = logging.getLogger(__name__)

DISCLAIMER = (
    "This is an educational screening aid, not a medical diagnosis. It was "
    "trained on a historical dataset and can be wrong. Always discuss your "
    "results with a qualified doctor before making any health decision."
)


class ModelNotLoadedError(RuntimeError):
    """Raised when a prediction is requested before the artifact is available."""


class ModelService:
    """Holds the fitted pipeline and its metadata for the process.

    ``load()`` is guarded so a reload cannot publish a half-swapped pipeline.
    Prediction is lock-free: it only reads attributes, and the pipeline itself
    is not mutated by ``predict``.
    """

    def __init__(self, model_path: Path = MODEL_FILE) -> None:
        self.model_path = Path(model_path)
        self._pipeline = None
        self._metadata: dict = {}
        self._lock = threading.Lock()

    # --- lifecycle ---------------------------------------------------------
    def load(self) -> None:
        if not self.model_path.exists():
            logger.error(
                "Model artifact missing at %s. Run 'python -m ml.train' first.",
                self.model_path,
            )
            return
        with self._lock:
            bundle = joblib.load(self.model_path)
            self._pipeline = bundle["pipeline"]
            self._metadata = bundle["metadata"]
        logger.info(
            "Loaded %s trained at %s",
            self._metadata.get("model_name"),
            self._metadata.get("trained_at"),
        )

    @property
    def is_loaded(self) -> bool:
        return self._pipeline is not None

    @property
    def metadata(self) -> dict:
        return self._metadata

    # --- inference ---------------------------------------------------------
    # The values a patient reads off a report: age, sex and the five blood
    # tests. History checkboxes are not counted, because "I ticked three boxes"
    # is not the same kind of evidence as "I entered three lab results", and
    # conflating them would let a sparse assessment look complete.
    MEASURED_INPUTS = ("age", "sex", "TSH", "T3", "TT4", "T4U", "FTI")

    def _to_frame(self, payload: dict) -> tuple[pd.DataFrame, set[str]]:
        """Map an API payload onto the exact feature frame the model expects.

        Values the caller did not supply stay as NaN so the pipeline's imputer
        handles them, and are recorded as "not provided" so the explainer never
        attributes the result to a number the patient never gave.
        """
        row: dict[str, float | None] = {}
        provided: set[str] = set()

        for feature in NUMERIC_FEATURES:
            value = payload.get(feature)
            row[feature] = float(value) if value is not None else np.nan
            if value is not None:
                provided.add(feature)

        sex = payload.get("sex")
        row["sex_is_male"] = np.nan if sex is None else float(sex == "male")
        if sex is not None:
            provided.add("sex_is_male")

        for feature in BINARY_FEATURES:
            if feature == "sex_is_male":
                continue
            value = bool(payload.get(feature, False))
            row[feature] = float(value)
            # Only an affirmative answer is treated as information worth
            # explaining; "no" is the default for almost every patient.
            if value:
                provided.add(feature)

        frame = pd.DataFrame([row], columns=FEATURE_ORDER)
        return frame, provided

    def predict(self, payload: dict) -> dict:
        if not self.is_loaded:
            raise ModelNotLoadedError(
                "No trained model is loaded. Run 'python -m ml.train' to create "
                f"{self.model_path}."
            )

        frame, provided = self._to_frame(payload)
        class_names = self._metadata["class_names"]

        probabilities = self._pipeline.predict_proba(frame)[0]
        column_index = int(np.argmax(probabilities))
        # predict_proba's columns follow the estimator's own class order, which
        # is not guaranteed to match CLASS_NAMES; going through classes_ keeps
        # the labels attached to the right numbers even if a future training run
        # sees the classes in a different order.
        class_order = [class_names[int(label)] for label in self._pipeline.classes_]
        predicted_index = int(self._pipeline.classes_[column_index])

        contributions = explain_prediction(
            self._pipeline,
            frame,
            self._metadata,
            column_index,
            provided_features=provided,
        )

        return {
            "prediction": class_names[predicted_index],
            "confidence": float(probabilities[column_index]),
            "probabilities": {
                name: float(probability)
                for name, probability in zip(class_order, probabilities)
            },
            "contributions": [item.to_dict() for item in contributions],
            "lab_flags": self._lab_flags(payload),
            "inputs_provided": sum(
                payload.get(field) is not None for field in self.MEASURED_INPUTS
            ),
            "inputs_total": len(self.MEASURED_INPUTS),
            "model_name": self._metadata["model_name"],
            "model_trained_at": self._metadata["trained_at"],
            "disclaimer": DISCLAIMER,
        }

    @staticmethod
    def _lab_flags(payload: dict) -> list[dict]:
        """Compare each supplied lab value with its typical reference range."""
        flags = []
        for feature, meta in FEATURE_META.items():
            reference = meta.get("reference")
            value = payload.get(feature)
            if reference is None or value is None:
                continue
            flags.append(
                {
                    "feature": feature,
                    "label": meta["label"],
                    "value": float(value),
                    "unit": meta["unit"],
                    "status": classify_value(feature, float(value)),
                    "reference_low": float(reference[0]),
                    "reference_high": float(reference[1]),
                }
            )
        return flags


model_service = ModelService()
