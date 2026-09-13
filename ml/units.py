"""Unit handling for lab values.

The training data records thyroid hormones in nmol/L, but most laboratories in
Pakistan, the United States and much of Asia print total T4 in ug/dL and total
T3 in ng/dL. Someone copying "8.1" off a ug/dL report into a field scored
against a 60-140 nmol/L range would be told a perfectly normal thyroid looks
severely underactive, so the API accepts a unit alongside every value and
converts to the training unit before the model sees it.

Only conversions that are exact are offered. Thyroid uptake is sometimes
reported as a percentage, but turning that into the ratio this dataset uses
needs the reporting laboratory's own normal mean - so no conversion is offered
for it, and the UI says so rather than guessing.
"""

from __future__ import annotations

from dataclasses import dataclass

# Molar masses: thyroxine (T4) 776.87 g/mol, triiodothyronine (T3) 650.98 g/mol.
#   1 ug/dL of T4 = 10 ug/L / 776.87 g/mol = 12.87 nmol/L
#   1 ng/dL of T3 = 10 ng/L / 650.98 g/mol = 0.01536 nmol/L
UG_DL_TO_NMOL_L_T4 = 12.87
NG_DL_TO_NMOL_L_T3 = 0.01536


@dataclass(frozen=True)
class Unit:
    """One way of writing a measurement, and how to reach the training unit."""

    code: str
    label: str
    #: Multiply a value in this unit by this factor to get the canonical unit.
    to_canonical: float
    note: str | None = None

    @property
    def is_canonical(self) -> bool:
        return self.to_canonical == 1.0


# The first entry for each feature is canonical: the unit the model was trained
# on, and the one every stored and predicted value is expressed in.
UNITS: dict[str, tuple[Unit, ...]] = {
    "TSH": (
        Unit("mU/L", "mU/L", 1.0),
        # Numerically identical - the same quantity under two names. Offered
        # because a patient should not have to know that to trust the form.
        Unit("uIU/mL", "µIU/mL", 1.0, note="Same numeric value as mU/L."),
    ),
    "T3": (
        Unit("nmol/L", "nmol/L", 1.0),
        Unit("ng/dL", "ng/dL", NG_DL_TO_NMOL_L_T3),
    ),
    "TT4": (
        Unit("nmol/L", "nmol/L", 1.0),
        Unit("ug/dL", "µg/dL", UG_DL_TO_NMOL_L_T4),
    ),
    "T4U": (Unit("ratio", "ratio", 1.0),),
    "FTI": (Unit("index", "index", 1.0),),
    "age": (Unit("years", "years", 1.0),),
}


class UnknownUnitError(ValueError):
    """Raised when a request names a unit that does not apply to a feature."""


def units_for(feature: str) -> tuple[Unit, ...]:
    return UNITS.get(feature, ())


def canonical_unit(feature: str) -> Unit | None:
    options = units_for(feature)
    return options[0] if options else None


def resolve(feature: str, code: str | None) -> Unit:
    """Return the named unit for a feature, defaulting to the canonical one."""
    options = units_for(feature)
    if not options:
        raise UnknownUnitError(f"{feature} has no unit definitions.")
    if code is None:
        return options[0]
    for unit in options:
        if unit.code == code:
            return unit
    valid = ", ".join(option.code for option in options)
    raise UnknownUnitError(f"'{code}' is not a valid unit for {feature}. Use one of: {valid}.")


def to_canonical(feature: str, value: float, code: str | None = None) -> float:
    """Convert a value written in ``code`` into the unit the model expects."""
    return value * resolve(feature, code).to_canonical


def from_canonical(feature: str, value: float, code: str | None = None) -> float:
    """Convert a canonical value back into ``code``, for display."""
    return value / resolve(feature, code).to_canonical


def convert_range(
    feature: str, low: float, high: float, code: str | None = None
) -> tuple[float, float]:
    """Express a canonical reference range in another unit."""
    unit = resolve(feature, code)
    return low / unit.to_canonical, high / unit.to_canonical


def _decimals_for(magnitude: float) -> int:
    """How many decimals a number of this size deserves on screen."""
    if magnitude == 0:
        return 0
    if magnitude < 0.1:
        return 4
    if magnitude < 10:
        return 2
    if magnitude < 100:
        return 1
    return 0


def round_for_display(value: float) -> float:
    """Round to a number of decimals that suits the magnitude.

    A converted value like 8.0994... is arithmetically right and unreadable; a
    patient comparing against their own report needs 8.1.
    """
    return round(value, _decimals_for(abs(value)))


def round_range(low: float, high: float) -> tuple[float, float]:
    """Round both ends of a range to the same precision.

    Rounding each end independently gives "4.66-10.9", which looks like a typo
    rather than a reference range. The larger end sets the precision for both.
    """
    decimals = _decimals_for(max(abs(low), abs(high)))
    return round(low, decimals), round(high, decimals)


__all__ = [
    "UNITS",
    "Unit",
    "UnknownUnitError",
    "canonical_unit",
    "convert_range",
    "from_canonical",
    "resolve",
    "round_for_display",
    "round_range",
    "to_canonical",
    "units_for",
]
