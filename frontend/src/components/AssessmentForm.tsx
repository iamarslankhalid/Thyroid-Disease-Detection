import { useId, useState } from "react";
import type { PatientInput, ReferenceData } from "../api";

const LAB_FIELDS = ["TSH", "T3", "TT4", "T4U", "FTI"] as const;
type LabField = (typeof LAB_FIELDS)[number];

type Sex = "female" | "male" | "unspecified";

interface Example {
  name: string;
  description: string;
  age: string;
  sex: Sex;
  values: Partial<Record<LabField, string>>;
}

/** Three panels a visitor can try without owning a lab report. */
const EXAMPLES: Example[] = [
  {
    name: "Underactive",
    description: "High TSH with low T4 - the textbook hypothyroid picture.",
    age: "58",
    sex: "female",
    values: { TSH: "18.4", T3: "1.1", TT4: "52", T4U: "0.99", FTI: "53" },
  },
  {
    name: "Overactive",
    description: "Suppressed TSH with raised hormone levels.",
    age: "41",
    sex: "female",
    values: { TSH: "0.02", T3: "4.9", TT4: "198", T4U: "1.08", FTI: "185" },
  },
  {
    name: "Healthy",
    description: "Everything within the usual adult range.",
    age: "35",
    sex: "female",
    values: { TSH: "2.1", T3: "1.9", TT4: "105", T4U: "0.98", FTI: "110" },
  },
];

/** What a lab report may call each test, for people matching fields to paper. */
const ALSO_KNOWN_AS: Record<LabField, string> = {
  TSH: "Thyrotropin, Thyroid Stimulating Hormone",
  T3: "Total T3, Triiodothyronine (total, not free)",
  TT4: "Total T4, Total Thyroxine, Serum T4",
  T4U: "T-Uptake, THBR, Thyroid Hormone Binding Ratio",
  FTI: "T7, Free Thyroxine Index, FT4 Index",
};

interface Props {
  reference: ReferenceData;
  onSubmit: (patient: PatientInput) => void;
  isSubmitting: boolean;
}

export function AssessmentForm({ reference, onSubmit, isSubmitting }: Props) {
  const [values, setValues] = useState<Record<string, string>>({ age: "" });
  const [units, setUnits] = useState<Record<string, string>>({});
  // Starts as null, not "": an empty string would match the "Prefer not to say"
  // option and render the form as though a choice had already been made.
  const [sex, setSex] = useState<Sex | null>(null);
  const [history, setHistory] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formId = useId();

  const ageMeta = reference.features.age;

  const setValue = (field: string, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  /** The unit selected for a field, defaulting to the canonical one. */
  const unitFor = (field: LabField) =>
    units[field] ?? reference.features[field]?.units?.[0]?.code ?? "";

  const unitOption = (field: LabField) =>
    reference.features[field]?.units?.find((option) => option.code === unitFor(field));

  /** Changing sex clears a pregnancy tick that no longer applies. */
  function changeSex(next: Sex) {
    setSex(next);
    if (next !== "female") {
      setHistory((current) => ({ ...current, pregnant: false }));
    }
  }

  function applyExample(example: Example) {
    setValues({ age: example.age, ...example.values });
    setUnits({});
    setSex(example.sex);
    setHistory({});
    setErrors({});
  }

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};

    const age = Number(values.age);
    if (!values.age?.trim()) {
      found.age = "Please enter your age.";
    } else if (Number.isNaN(age) || age < (ageMeta?.min ?? 1) || age > (ageMeta?.max ?? 120)) {
      found.age = `Age should be between ${ageMeta?.min ?? 1} and ${ageMeta?.max ?? 120}.`;
    }

    let anyLab = false;
    for (const field of LAB_FIELDS) {
      const raw = values[field]?.trim();
      if (!raw) continue;
      anyLab = true;
      const parsed = Number(raw);
      const option = unitOption(field);
      if (Number.isNaN(parsed)) {
        found[field] = "Enter a number.";
      } else if (option && (parsed < option.min || parsed > option.max)) {
        // Bounds are shown in the unit on screen, so the message matches what
        // the patient is looking at rather than the model's internal unit.
        found[field] = `Expected between ${option.min} and ${option.max} ${option.label}.`;
      }
    }
    if (!anyLab) {
      found.form = "Enter at least one blood test result - a screening needs a lab value.";
    }
    return found;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Move focus to the first problem, so a keyboard or screen-reader user is
      // taken to it rather than told, somewhere off screen, that it exists.
      const firstField = Object.keys(found).find((key) => key !== "form");
      if (firstField) document.getElementById(`${formId}-${firstField}`)?.focus();
      return;
    }

    const patient: PatientInput = {
      age: Number(values.age),
      sex: sex && sex !== "unspecified" ? sex : null,
    };
    const chosenUnits: Record<string, string> = {};
    for (const field of LAB_FIELDS) {
      const raw = values[field]?.trim();
      patient[field] = raw ? Number(raw) : null;
      if (raw) chosenUnits[field] = unitFor(field);
    }
    patient.units = chosenUnits;

    for (const item of reference.history) {
      if (item.feature === "pregnant" && sex !== "female") continue;
      patient[item.feature] = Boolean(history[item.feature]);
    }

    onSubmit(patient);
  }

  const historyCount = Object.values(history).filter(Boolean).length;
  const fieldClass = (field: string) =>
    `w-full rounded-lg border bg-surface-1 px-3 py-2 text-ink-1 outline-none tabular focus:ring-2 focus:ring-accent/20 ${
      errors[field] ? "border-critical focus:border-critical" : "border-line focus:border-accent"
    }`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold tracking-wide text-ink-1 uppercase">About you</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-age`} className="text-sm text-ink-2">
              Age
            </label>
            <input
              id={`${formId}-age`}
              type="number"
              inputMode="numeric"
              min={ageMeta?.min}
              max={ageMeta?.max}
              value={values.age ?? ""}
              onChange={(event) => setValue("age", event.target.value)}
              placeholder="e.g. 45"
              aria-invalid={Boolean(errors.age)}
              aria-describedby={errors.age ? `${formId}-age-error` : undefined}
              className={`mt-1 ${fieldClass("age")}`}
            />
            {errors.age && (
              <p id={`${formId}-age-error`} className="mt-1 text-xs text-critical">
                {errors.age}
              </p>
            )}
          </div>

          <fieldset>
            <legend className="text-sm text-ink-2">Sex</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {(
                [
                  { value: "female", label: "Female" },
                  { value: "male", label: "Male" },
                  { value: "unspecified", label: "Prefer not to say" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={sex === option.value}
                  onClick={() => changeSex(option.value)}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    sex === option.value
                      ? "border-accent bg-accent-soft font-medium text-ink-1"
                      : "border-line bg-surface-1 text-ink-2 hover:border-line-strong"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-ink-1 uppercase">
            Blood test results
          </h2>
          <button
            type="button"
            onClick={() => setShowHelp((open) => !open)}
            aria-expanded={showHelp}
            className="text-xs font-medium text-accent hover:underline"
          >
            Where do I find these on my report?
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-3">
          Enter whatever your report shows - you do not need all five, and you can pick the
          unit your laboratory used. Missing tests are estimated.
        </p>

        {showHelp && (
          <div className="mt-3 rounded-lg border border-line bg-surface-2 p-4 text-xs leading-relaxed text-ink-2">
            <p>
              Laboratories name these tests differently. Match yours by the alternative
              names below, and check the unit printed beside your number - most reports
              outside Europe use µg/dL for T4 and ng/dL for T3.
            </p>
            <dl className="mt-3 space-y-1.5">
              {LAB_FIELDS.map((field) => (
                <div key={field} className="sm:flex sm:gap-2">
                  <dt className="font-medium text-ink-1 sm:w-32 sm:shrink-0">
                    {reference.features[field]?.label ?? field}
                  </dt>
                  <dd className="text-ink-3">{ALSO_KNOWN_AS[field]}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-ink-3">
              Only have free T4 or free T3? Those are different measurements from the ones
              this model was trained on, so leave those fields empty rather than entering
              them here.
            </p>
          </div>
        )}

        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LAB_FIELDS.map((field) => {
            const meta = reference.features[field];
            if (!meta) return null;
            const option = unitOption(field);
            const choices = meta.units ?? [];
            return (
              <div key={field}>
                <label htmlFor={`${formId}-${field}`} className="text-sm text-ink-2">
                  {meta.label}
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id={`${formId}-${field}`}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={values[field] ?? ""}
                    onChange={(event) => setValue(field, event.target.value)}
                    aria-invalid={Boolean(errors[field])}
                    aria-describedby={`${formId}-${field}-hint`}
                    className={`${fieldClass(field)} min-w-0 flex-1`}
                  />
                  {choices.length > 1 ? (
                    <select
                      value={unitFor(field)}
                      onChange={(event) =>
                        setUnits((current) => ({ ...current, [field]: event.target.value }))
                      }
                      aria-label={`Unit for ${meta.label}`}
                      className="rounded-lg border border-line bg-surface-1 px-2 py-2 text-sm text-ink-2 outline-none focus:border-accent"
                    >
                      {choices.map((choice) => (
                        <option key={choice.code} value={choice.code}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="flex items-center px-1 text-xs text-ink-3">
                      {choices[0]?.label ?? meta.unit}
                    </span>
                  )}
                </div>
                <p id={`${formId}-${field}-hint`} className="mt-1 text-[11px] text-ink-3">
                  {errors[field] ? (
                    <span className="text-critical">{errors[field]}</span>
                  ) : option?.reference ? (
                    `typical ${option.reference[0]}–${option.reference[1]} ${option.label}`
                  ) : (
                    ""
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <button
          type="button"
          onClick={() => setShowHistory((open) => !open)}
          aria-expanded={showHistory}
          className="flex w-full items-center justify-between rounded-lg border border-line bg-surface-1 px-4 py-3 text-left hover:border-line-strong"
        >
          <span>
            <span className="text-sm font-semibold tracking-wide text-ink-1 uppercase">
              Medical history
            </span>
            <span className="ml-2 text-xs text-ink-3">
              optional{historyCount > 0 ? ` · ${historyCount} selected` : ""}
            </span>
          </span>
          <span aria-hidden className="text-ink-3">
            {showHistory ? "−" : "+"}
          </span>
        </button>

        {showHistory && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {reference.history
              .filter((item) => item.feature !== "pregnant" || sex === "female")
              .map((item) => (
                <label
                  key={item.feature}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface-1 px-3 py-2.5 text-sm text-ink-2 hover:border-line-strong"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(history[item.feature])}
                    onChange={(event) =>
                      setHistory((current) => ({
                        ...current,
                        [item.feature]: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {item.label}
                </label>
              ))}
          </div>
        )}
      </section>

      {errors.form && (
        <p
          role="alert"
          className="rounded-lg border border-critical px-4 py-3 text-sm text-critical"
        >
          {errors.form}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-accent px-5 py-3 font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? "Analysing…" : "Check my results"}
        </button>
        <span className="text-xs text-ink-3">or try an example:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example.name}
            type="button"
            onClick={() => applyExample(example)}
            title={example.description}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-2 transition hover:border-accent hover:text-ink-1"
          >
            {example.name}
          </button>
        ))}
      </div>
    </form>
  );
}
