"""Request and response models for the screening API.

Validation is clinical, not just structural: a TSH of 5000 mU/L is a typo, not a
patient, and the API rejects it rather than feeding nonsense to the model.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from ml.config import FEATURE_META

_LAB_FIELDS = ("TSH", "T3", "TT4", "T4U", "FTI")


def _bounds(feature: str) -> tuple[float, float]:
    low, high = FEATURE_META[feature]["bounds"]
    return float(low), float(high)


class PatientInput(BaseModel):
    """Everything the model can use. Only age and one lab result are required."""

    age: float = Field(
        ...,
        ge=_bounds("age")[0],
        le=_bounds("age")[1],
        description="Patient age in years.",
        examples=[45],
    )
    sex: Literal["male", "female"] | None = Field(
        default=None, description="Biological sex; omit if you prefer not to say."
    )

    TSH: float | None = Field(
        default=None, ge=_bounds("TSH")[0], le=_bounds("TSH")[1],
        description="Thyroid-stimulating hormone (mU/L).", examples=[2.1],
    )
    T3: float | None = Field(
        default=None, ge=_bounds("T3")[0], le=_bounds("T3")[1],
        description="Total triiodothyronine (nmol/L).", examples=[1.9],
    )
    TT4: float | None = Field(
        default=None, ge=_bounds("TT4")[0], le=_bounds("TT4")[1],
        description="Total thyroxine (nmol/L).", examples=[105],
    )
    T4U: float | None = Field(
        default=None, ge=_bounds("T4U")[0], le=_bounds("T4U")[1],
        description="Thyroxine uptake ratio.", examples=[0.98],
    )
    FTI: float | None = Field(
        default=None, ge=_bounds("FTI")[0], le=_bounds("FTI")[1],
        description="Free thyroxine index.", examples=[110],
    )

    on_thyroxine: bool = False
    query_on_thyroxine: bool = False
    on_antithyroid_meds: bool = False
    sick: bool = False
    pregnant: bool = False
    thyroid_surgery: bool = False
    I131_treatment: bool = False
    query_hypothyroid: bool = False
    query_hyperthyroid: bool = False
    lithium: bool = False
    goitre: bool = False
    tumor: bool = False
    psych: bool = False

    @model_validator(mode="after")
    def require_one_lab_result(self) -> "PatientInput":
        """Refuse to guess from history alone.

        The model can impute a missing test, but with no blood test at all the
        output would be a demographic stereotype dressed up as a screening
        result, which is exactly what a health tool must not do.
        """
        if not any(getattr(self, field) is not None for field in _LAB_FIELDS):
            raise ValueError(
                "At least one blood test result is required "
                f"({', '.join(_LAB_FIELDS)}); a screening cannot be run without one."
            )
        return self

    @model_validator(mode="after")
    def pregnancy_requires_female(self) -> "PatientInput":
        if self.pregnant and self.sex == "male":
            raise ValueError("'pregnant' cannot be set for a male patient.")
        return self


class ContributionOut(BaseModel):
    """One factor behind the result, for the 'why this answer' panel."""

    feature: str
    label: str
    value: float | None
    unit: str | None
    status: Literal["low", "normal", "high"] | None
    direction: Literal["supports", "opposes"]
    impact: float = Field(description="Absolute shift in predicted probability, 0-1.")


class LabFlag(BaseModel):
    """A single lab value placed against its reference range."""

    feature: str
    label: str
    value: float
    unit: str
    status: Literal["low", "normal", "high"]
    reference_low: float
    reference_high: float


class PredictionResponse(BaseModel):
    prediction: Literal["Negative", "Hypothyroid", "Hyperthyroid"]
    confidence: float = Field(description="Model probability for the predicted class, 0-1.")
    probabilities: dict[str, float]
    contributions: list[ContributionOut]
    lab_flags: list[LabFlag]
    inputs_provided: int
    inputs_total: int
    model_name: str
    model_trained_at: str
    disclaimer: str


class ModelInfoResponse(BaseModel):
    """Everything needed to render the transparency page."""

    model_name: str
    trained_at: str
    sklearn_version: str
    selection_metric: str
    class_names: list[str]
    training_rows: int
    test_rows: int
    class_counts: dict[str, int]
    metrics: dict
    all_model_metrics: dict
    dropped_columns: dict[str, str]


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    model_loaded: bool
    model_name: str | None = None
