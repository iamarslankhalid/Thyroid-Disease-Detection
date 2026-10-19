import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type PredictionResponse } from "../api";
import { CLASS_META, NEXT_STEPS, formatPercent } from "../lib/classes";
import { ComparisonCard, type PreviousCheck } from "./ComparisonCard";
import { ContributionList } from "./ContributionList";
import { LabFlags } from "./LabFlags";
import { ProbabilityBars } from "./ProbabilityBars";
import { Alert, Icon, Spinner, type IconName } from "./ui";
import { WhatWouldChange } from "./WhatWouldChange";

const TONE: Record<"good" | "warning" | "serious", { icon: IconName; badge: string; ring: string }> = {
  good: { icon: "checkCircle", badge: "bg-good-soft text-good", ring: "border-t-good" },
  warning: { icon: "alert", badge: "bg-warning-soft text-warning", ring: "border-t-warning" },
  serious: { icon: "alert", badge: "bg-serious-soft text-serious", ring: "border-t-serious" },
};

/** The screening outcome, its reasoning and the caveats that belong with it. */
export function ResultPanel({
  result,
  previous,
  onReset,
  signedIn,
}: {
  result: PredictionResponse;
  previous: PreviousCheck | null;
  onReset: () => void;
  signedIn: boolean;
}) {
  const meta = CLASS_META[result.prediction];
  const tone = TONE[meta.tone];
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function downloadReport() {
    if (result.assessment_id == null) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await api.downloadAssessmentReport(result.assessment_id);
    } catch (cause) {
      console.error("PDF download failed", cause);
      setDownloadError((cause as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <section className={`card print-block overflow-hidden border-t-4 ${tone.ring}`}>
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone.badge}`}>
                <Icon name={tone.icon} className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
                  Screening result
                </p>
                <h2 className="mt-1 text-xl font-bold text-ink-1 sm:text-2xl">{meta.headline}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{meta.summary}</p>
              </div>
            </div>
            {result.assessment_id != null && (
              <span className="badge no-print bg-good-soft text-good">
                <Icon name="check" className="h-3.5 w-3.5" />
                Saved to your history
              </span>
            )}
          </div>

          <dl className="mt-6 grid gap-4 rounded-xl bg-surface-2 p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-3">Model confidence</dt>
              <dd className="tabular mt-0.5 text-lg font-bold text-ink-1">
                {formatPercent(result.confidence)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Values provided</dt>
              <dd className="tabular mt-0.5 text-lg font-bold text-ink-1">
                {result.inputs_provided}
                <span className="font-normal text-ink-3"> of {result.inputs_total}</span>
              </dd>
              {result.inputs_provided < result.inputs_total && (
                <p className="mt-0.5 text-xs text-ink-3">Missing values were estimated.</p>
              )}
            </div>
            <div>
              <dt className="text-xs text-ink-3">Result class</dt>
              <dd className="mt-0.5 flex items-center gap-2 text-lg font-bold text-ink-1">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                {result.prediction}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <ProbabilityBars probabilities={result.probabilities} predicted={result.prediction} />
        </section>
        <section className="card p-6">
          <ContributionList contributions={result.contributions} prediction={result.prediction} />
        </section>
      </div>

      <section className="card p-6">
        <LabFlags flags={result.lab_flags} />
      </section>

      {result.counterfactuals.length > 0 && (
        <section className="card p-6">
          <WhatWouldChange items={result.counterfactuals} />
        </section>
      )}

      {previous && (
        <section className="card p-6">
          <ComparisonCard result={result} previous={previous} />
        </section>
      )}

      <section className="card print-block p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-1">
          <Icon name="stethoscope" className="h-4 w-4 text-accent" />
          What to do next
        </h3>
        <ul className="mt-3 space-y-2.5">
          {NEXT_STEPS[result.prediction].map((step) => (
            <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {step}
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">
          {result.disclaimer}
        </p>
      </section>

      {downloadError && <Alert tone="error">{downloadError}</Alert>}

      <div className="no-print card flex flex-wrap items-center justify-between gap-4 p-5">
        {signedIn && result.assessment_id != null ? (
          <p className="text-sm text-ink-2">
            Take this to your appointment, or see how it fits your{" "}
            <Link to="/dashboard" className="link">trends</Link>.
          </p>
        ) : (
          <p className="text-sm text-ink-2">
            <Link to="/register" className="link">Create a free account</Link> to save this
            result, track trends and download PDF reports.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {result.assessment_id != null ? (
            <button onClick={downloadReport} disabled={downloading} className="btn btn-primary">
              {downloading ? <Spinner /> : <Icon name="download" className="h-4 w-4" />}
              Download PDF report
            </button>
          ) : (
            <button onClick={() => window.print()} className="btn btn-secondary">
              <Icon name="document" className="h-4 w-4" />
              Print result
            </button>
          )}
          <button onClick={onReset} className="btn btn-secondary">
            <Icon name="plus" className="h-4 w-4" />
            New check
          </button>
        </div>
      </div>
    </div>
  );
}
