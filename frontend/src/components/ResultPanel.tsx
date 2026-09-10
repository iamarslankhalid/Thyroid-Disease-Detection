import type { PredictionResponse } from "../api";
import { CLASS_META, TONE_COLOR, formatPercent, formatDateTime } from "../lib/classes";
import { ContributionList } from "./ContributionList";
import { LabFlags } from "./LabFlags";
import { ProbabilityBars } from "./ProbabilityBars";

const TONE_SYMBOL = { good: "✓", warning: "!", serious: "!" } as const;

/** The screening outcome, its reasoning and the caveats that belong with it. */
export function ResultPanel({
  result,
  onReset,
}: {
  result: PredictionResponse;
  onReset: () => void;
}) {
  const meta = CLASS_META[result.prediction];
  const tone = TONE_COLOR[meta.tone];
  const completeness = result.inputs_provided;

  return (
    <div className="space-y-6">
      {/* Headline. Status colour never carries the meaning alone - the symbol
          and the sentence do. */}
      <section
        className="print-block rounded-2xl border bg-surface-1 p-6 shadow-sm"
        style={{ borderColor: tone }}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold"
            style={{ backgroundColor: "var(--surface-2)", color: tone }}
          >
            {TONE_SYMBOL[meta.tone]}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-ink-3 uppercase">
              Screening result
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink-1 sm:text-2xl">
              {meta.headline}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{meta.summary}</p>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-3">Model confidence</dt>
            <dd className="tabular mt-0.5 text-lg font-semibold text-ink-1">
              {formatPercent(result.confidence)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Values you provided</dt>
            <dd className="tabular mt-0.5 text-lg font-semibold text-ink-1">
              {completeness}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Model</dt>
            <dd className="mt-0.5 text-sm text-ink-2">
              {result.model_name.replace(/_/g, " ")}
              <span className="block text-xs text-ink-3">
                trained {formatDateTime(result.model_trained_at)}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface-1 p-6 shadow-sm">
          <ProbabilityBars
            probabilities={result.probabilities}
            predicted={result.prediction}
          />
        </section>
        <section className="rounded-2xl border border-line bg-surface-1 p-6 shadow-sm">
          <ContributionList
            contributions={result.contributions}
            prediction={result.prediction}
          />
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-surface-1 p-6 shadow-sm">
        <LabFlags flags={result.lab_flags} />
      </section>

      <section
        className="print-block rounded-2xl border p-5"
        style={{ borderColor: "var(--border-strong)", backgroundColor: "var(--surface-2)" }}
      >
        <h3 className="text-sm font-semibold text-ink-1">Please read this</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{result.disclaimer}</p>
      </section>

      <div className="no-print flex flex-wrap gap-3">
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-line-strong bg-surface-1 px-4 py-2.5 text-sm font-medium text-ink-1 hover:border-accent"
        >
          Save as PDF
        </button>
        <button
          onClick={onReset}
          className="rounded-lg border border-line bg-surface-1 px-4 py-2.5 text-sm font-medium text-ink-2 hover:border-line-strong"
        >
          New assessment
        </button>
      </div>
    </div>
  );
}
