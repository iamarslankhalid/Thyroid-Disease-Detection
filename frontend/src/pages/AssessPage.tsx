import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PatientInput, type PredictionResponse, type ReferenceData } from "../api";
import { AssessmentForm } from "../components/AssessmentForm";
import type { PreviousCheck } from "../components/ComparisonCard";
import { ResultPanel } from "../components/ResultPanel";
import { Alert, Icon, LoadingCard, PageHeader } from "../components/ui";
import { useAuth } from "../lib/useAuth";
import { loadHistory, saveAssessment } from "../lib/storage";

/** The most recent earlier check, from the account or from this browser. */
async function findPrevious(signedIn: boolean): Promise<PreviousCheck | null> {
  if (!signedIn) {
    const local = loadHistory()[0];
    return local ? { createdAt: local.createdAt, prediction: local.prediction, labs: local.labs } : null;
  }
  try {
    const latest = (await api.assessments())[0];
    return latest
      ? { createdAt: latest.created_at, prediction: latest.prediction, labs: latest.labs }
      : null;
  } catch (error) {
    // A comparison is a nice-to-have; never block the screening on it.
    console.error("Could not load the previous check", error);
    return null;
  }
}

export function AssessPage() {
  const { status } = useAuth();
  const signedIn = status === "signed-in";
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [previous, setPrevious] = useState<PreviousCheck | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Remounting the form is how "New check" clears it: the fields are local
  // state, so hiding the result alone would leave the last values in place.
  const [formKey, setFormKey] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .referenceData()
      .then(setReference)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  async function handleSubmit(patient: PatientInput) {
    setSubmitting(true);
    setError(null);
    try {
      // Captured before saving, so the comparison is against the last visit
      // rather than against the check just made.
      const priorEntry = await findPrevious(signedIn);
      const response = await api.predict(patient);
      setResult(response);
      setPrevious(priorEntry);
      if (response.assessment_id == null) saveAssessment(patient, response);
      requestAnimationFrame(() => {
        resultRef.current?.focus({ preventScroll: true });
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (cause) {
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
      <PageHeader
        eyebrow="New check"
        title="Check your thyroid blood test"
        description="Enter the values from your lab report, in the units your laboratory used. Only your age and one result are required."
      />

      {status === "signed-out" && !result && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3 text-sm">
          <p className="flex items-center gap-2 text-ink-1">
            <Icon name="info" className="h-4 w-4 text-accent" />
            You're checking as a guest. Sign in to save results to your account and download PDF reports.
          </p>
          <div className="flex gap-2">
            <Link to="/login?next=/screening" className="btn btn-sm btn-secondary">Sign in</Link>
            <Link to="/register?next=/screening" className="btn btn-sm btn-primary">Create account</Link>
          </div>
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {reference ? (
        result ? (
          <div className="no-print card flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <Icon name="checkCircle" className="h-4 w-4 text-good" />
              Showing the result for the values you entered.
            </p>
            <button onClick={reset} className="btn btn-sm btn-secondary">
              Start a new check
            </button>
          </div>
        ) : (
          <section className="no-print card p-6 sm:p-8">
            <AssessmentForm
              key={formKey}
              reference={reference}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          </section>
        )
      ) : (
        !error && <LoadingCard lines={4} />
      )}

      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="scroll-mt-24 outline-none">
        {result && (
          <ResultPanel result={result} previous={previous} onReset={reset} signedIn={signedIn} />
        )}
      </div>
    </div>
  );
}
