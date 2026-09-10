import { useEffect, useRef, useState } from "react";
import { api, type PatientInput, type PredictionResponse, type ReferenceData } from "../api";
import { AssessmentForm } from "../components/AssessmentForm";
import { ResultPanel } from "../components/ResultPanel";
import { saveAssessment } from "../lib/storage";

export function AssessPage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const response = await api.predict(patient);
      setResult(response);
      saveAssessment(patient, response);
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

  return (
    <div className="space-y-8">
      <header className="no-print">
        <h1 className="text-2xl font-semibold text-ink-1 sm:text-3xl">
          Check your thyroid blood test
        </h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          Enter the values from your lab report. The model compares them with 7,679
          historical patient records and explains which of your numbers drove the
          result. It is a screening aid, not a diagnosis.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
        >
          {error}
        </p>
      )}

      {reference ? (
        <section className="no-print rounded-2xl border border-line bg-surface-1 p-6 shadow-sm sm:p-8">
          <AssessmentForm
            reference={reference}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </section>
      ) : (
        !error && <p className="text-sm text-ink-3">Loading…</p>
      )}

      <div ref={resultRef}>
        {result && <ResultPanel result={result} onReset={() => setResult(null)} />}
      </div>
    </div>
  );
}
