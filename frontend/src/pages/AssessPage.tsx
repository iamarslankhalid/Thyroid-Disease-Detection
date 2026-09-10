import { useEffect, useRef, useState } from "react";
import { api, type PatientInput, type PredictionResponse, type ReferenceData } from "../api";
import { AssessmentForm } from "../components/AssessmentForm";
import { ResultPanel } from "../components/ResultPanel";
import { loadHistory, saveAssessment, type StoredAssessment } from "../lib/storage";

export function AssessPage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [previous, setPrevious] = useState<StoredAssessment | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Remounting the form is how "New assessment" clears it: the fields are
  // local state, so hiding the result alone would leave the last patient's
  // values sitting in the inputs.
  const [formKey, setFormKey] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Units and reference ranges come from the API so the UI and the model can
    // never disagree about what a field means.
    api.referenceData().then(setReference).catch((cause: Error) => setError(cause.message));
  }, []);

  async function handleSubmit(patient: PatientInput) {
    setSubmitting(true);
    setError(null);
    try {
      // Captured before saving, so the comparison is against the last visit
      // rather than against the assessment just made.
      const priorEntry = loadHistory()[0] ?? null;
      const response = await api.predict(patient);
      setResult(response);
      setPrevious(priorEntry);
      saveAssessment(patient, response);
      resultRef.current?.focus({ preventScroll: true });
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (cause) {
      // Clear the previous result: leaving it under an error banner would let a
      // stale screening read as the answer to the values just entered.
      setResult(null);
      setError((cause as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setPrevious(null);
    setFormKey((key) => key + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-8">
      <header className="no-print">
        <h1 className="text-2xl font-semibold text-ink-1 sm:text-3xl">
          Check your thyroid blood test
        </h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          Enter the values from your lab report, in the units your laboratory used. The
          model compares them with 7,679 historical patient records, explains which of
          your numbers drove the result, and shows how close you are to a different
          answer. It is a screening aid, not a diagnosis.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-critical px-4 py-3 text-sm text-critical">
          {error}
        </p>
      )}

      {reference ? (
        <section className="no-print rounded-2xl border border-line bg-surface-1 p-6 shadow-sm sm:p-8">
          {result ? (
            // Once there is a result the form folds away. On a phone it is
            // taller than the screen, and scrolling back up through it to reach
            // the answer is the whole problem.
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-2">
                Showing the result for the values you entered.
              </p>
              <button
                onClick={reset}
                className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-1 hover:border-accent"
              >
                Start a new check
              </button>
            </div>
          ) : (
            <AssessmentForm
              key={formKey}
              reference={reference}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          )}
        </section>
      ) : (
        !error && (
          <div className="rounded-2xl border border-line bg-surface-1 p-6" aria-busy="true">
            <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-10 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          </div>
        )
      )}

      {/* Announced to screen readers, and focusable so the jump to the result
          moves the keyboard caret with it rather than only the viewport. */}
      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {result && <ResultPanel result={result} previous={previous} onReset={reset} />}
      </div>
    </div>
  );
}
