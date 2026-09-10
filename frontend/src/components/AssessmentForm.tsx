import { useState } from "react";
import type { PatientInput, ReferenceData } from "../api";

const LAB_FIELDS = ["TSH", "T3", "TT4", "T4U", "FTI"] as const;

/** A textbook hypothyroid panel, so the demo can be tried without a lab report. */
const EXAMPLE: Record<string, string> = {
  age: "58",
  TSH: "18.4",
  T3: "1.1",
  TT4: "52",
  T4U: "0.99",
  FTI: "53",
};

interface Props {
  reference: ReferenceData;
  onSubmit: (patient: PatientInput) => void;
  isSubmitting: boolean;
}

export function AssessmentForm({ reference, onSubmit, isSubmitting }: Props) {
  const [values, setValues] = useState<Record<string, string>>({ age: "" });
  const [sex, setSex] = useState<"female" | "male" | "">("");
  const [history, setHistory] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setValue = (field: string, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const age = Number(values.age);
    if (!values.age || Number.isNaN(age)) {
      setError("Please enter your age.");
      return;
    }

    const labs = LAB_FIELDS.filter((field) => values[field]?.trim());
    if (labs.length === 0) {
      setError("Enter at least one blood test result - a screening needs a lab value.");
      return;
    }

    const patient: PatientInput = { age, sex: sex || null };
    for (const field of LAB_FIELDS) {
      const raw = values[field]?.trim();
      patient[field] = raw ? Number(raw) : null;
    }
    for (const item of reference.history) {
      // Pregnancy is only sent when it is possible, so an ignored checkbox can
      // never make the API reject an otherwise valid request.
      if (item.feature === "pregnant" && sex !== "female") continue;
      patient[item.feature] = Boolean(history[item.feature]);
    }

    onSubmit(patient);
  }

  const historyCount = Object.values(history).filter(Boolean).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold tracking-wide text-ink-1 uppercase">About you</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-ink-2">Age</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={values.age ?? ""}
              onChange={(event) => setValue("age", event.target.value)}
              placeholder="e.g. 45"
              className="mt-1 w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-ink-1 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <div>
            <span className="text-sm text-ink-2">Sex</span>
            <div className="mt-1 flex gap-2">
              {[
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
                { value: "", label: "Prefer not to say" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setSex(option.value as typeof sex)}
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
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-ink-1 uppercase">
            Blood test results
          </h2>
          <button
            type="button"
            onClick={() => setValues({ ...EXAMPLE })}
            className="text-xs font-medium text-accent hover:underline"
          >
            Fill an example
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-3">
          Enter whatever your report shows - you do not need all five. Missing tests are
          estimated, and the result says how much you gave.
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LAB_FIELDS.map((field) => {
            const meta = reference.features[field];
            if (!meta) return null;
            return (
              <label key={field} className="block">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-ink-2">{meta.label}</span>
                  <span className="text-[11px] text-ink-3">{meta.unit}</span>
                </span>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  min={meta.min}
                  max={meta.max}
                  value={values[field] ?? ""}
                  onChange={(event) => setValue(field, event.target.value)}
                  placeholder={meta.reference ? `${meta.reference[0]}–${meta.reference[1]}` : ""}
                  className="mt-1 w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-ink-1 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 tabular"
                />
                <span className="mt-1 block text-[11px] text-ink-3">
                  {meta.reference ? `typical ${meta.reference[0]}–${meta.reference[1]}` : ""}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <button
          type="button"
          onClick={() => setShowHistory((open) => !open)}
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

      {error && (
        <p
          role="alert"
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-accent px-5 py-3 font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {isSubmitting ? "Analysing…" : "Check my results"}
      </button>
    </form>
  );
}
