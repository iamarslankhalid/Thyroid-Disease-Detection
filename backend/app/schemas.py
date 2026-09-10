"""Request and response models for the screening API.

Validation is clinical, not just structural: a TSH of 5000 mU/L is a typo, not a
patient, and the API rejects it rather than feeding nonsense to the model.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from ml.config import FEATURE_META
from ml.units import UnknownUnitError, resolve, round_for_display, to_canonical

_LAB_FIELDS = ("TSH", "T3", "TT4", "T4U", "FTI")
_MEASURED_FIELDS = ("age", *_LAB_FIELDS)

# Field-level limits are deliberately loose. The real bounds are clinical and
# live in FEATURE_META in the training unit, but a value arriving in ug/dL is a
# different number entirely - a T3 of 120 ng/dL is normal, while 120 nmol/L is
# impossible. Bounds are therefore checked after conversion, where they mean
# something, and reported back in the unit the patient actually typed.
_ABSOLUTE_MAX = 1e6


class PatientInput(BaseModel):
    """Everything the model can use. Only age and one lab result are required."""

    age: float = Field(
        ...,
        gt=0,
        le=_ABSOLUTE_MAX,
        description="Patient age in years.",
        examples=[45],
    )
    sex: Literal["male", "female"] | None = Field(
        default=None, description="Biological sex; omit if you prefer not to say."
    )

    TSH: float | None = Field(
        default=None, gt=0, le=_ABSOLUTE_MAX,
        description="Thyroid-stimulating hormone.", examples=[2.1],
    )
    T3: float | None = Field(
        default=None, gt=0, le=_ABSOLUTE_MAX,
        description="Total triiodothyronine.", examples=[1.9],
    )
    TT4: float | None = Field(
        default=None, gt=0, le=_ABSOLUTE_MAX,
        description="Total thyroxine.", examples=[105],
    )
    T4U: float | None = Field(
        default=None, gt=0, le=_ABSOLUTE_MAX,
        description="Thyroxine uptake ratio.", examples=[0.98],
    )
    FTI: float | None = Field(
        default=None, gt=0, le=_ABSOLUTE_MAX,
        description="Free thyroxine index.", examples=[110],
    )

    units: dict[str, str] = Field(
        default_factory=dict,
        description=(
            "Unit each value was written in, keyed by field name, e.g. "
            '{"TT4": "ug/dL"}. Anything omitted is assumed to be in the '
            "canonical unit from /api/reference-data."
        ),
        examples=[{"TT4": "ug/dL", "T3": "ng/dL"}],
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
    def require_one_lab_result(self) -> PatientInput:
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
    def units_must_be_known(self) -> PatientInput:
        for field, code in self.units.items():
            if field not in _MEASURED_FIELDS:
                raise ValueError(
                    f"'{field}' is not a measured field, so it takes no unit. "
                    f"Valid fields: {', '.join(_MEASURED_FIELDS)}."
                )
            try:
                resolve(field, code)
            except UnknownUnitError as error:
                raise ValueError(str(error)) from error
        return self

    @model_validator(mode="after")
    def values_must_be_clinically_possible(self) -> PatientInput:
        """Check the real bounds once every value is in the training unit."""
        for field in _MEASURED_FIELDS:
            value = getattr(self, field)
            if value is None:
                continue
            code = self.units.get(field)
            canonical = to_canonical(field, value, code)
            low, high = FEATURE_META[field]["bounds"]
            if not low <= canonical <= high:
                unit = resolve(field, code)
                shown_low = round_for_display(low / unit.to_canonical)
                shown_high = round_for_display(high / unit.to_canonical)
                raise ValueError(
                    f"{field} of {value} {unit.label} is outside the plausible "
                    f"range ({shown_low}-{shown_high} {unit.label})."
                )
        return self

    @model_validator(mode="after")
    def pregnancy_requires_female(self) -> PatientInput:
        if self.pregnant and self.sex == "male":
            raise ValueError("'pregnant' cannot be set for a male patient.")
        return self

    def canonical_payload(self) -> dict:
        """The request with every measurement converted to the training unit."""
        payload = self.model_dump(exclude={"units"})
        for field in _MEASURED_FIELDS:
            value = payload.get(field)
            if value is not None:
                payload[field] = to_canonical(field, value, self.units.get(field))
        return payload


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
    """A single lab value placed against its reference range.

    Reported in the unit the patient supplied, not the training unit: a report
    that says 8.1 ug/dL should be answered in ug/dL.
    """

    feature: str
    label: str
    value: float
    unit: str
    status: Literal["low", "normal", "high"]
    reference_low: float
    reference_high: float


class Counterfactual(BaseModel):
    """The nearest change to one value that would alter the result."""

    feature: str
    label: str
    unit: str
    current_value: float
    threshold: float
    direction: Literal["above", "below"]
    resulting_class: Literal["Negative", "Hypothyroid", "Hyperthyroid"]


class PredictionResponse(BaseModel):
    prediction: Literal["Negative", "Hypothyroid", "Hyperthyroid"]
    confidence: float = Field(description="Model probability for the predicted class, 0-1.")
    probabilities: dict[str, float]
    contributions: list[ContributionOut]
    lab_flags: list[LabFlag]
    counterfactuals: list[Counterfactual]
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
