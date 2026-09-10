import { useEffect, useState } from "react";
import { api, type ModelInfo } from "../api";
import { ConfusionHeatmap, RecallChart } from "../components/ModelCharts";
import { formatDateTime, formatPercent } from "../lib/classes";

/** scikit-learn scorer names read badly in a sentence ("f1 macro"). */
const METRIC_LABELS: Record<string, string> = {
  f1_macro: "macro F1",
  balanced_accuracy: "balanced accuracy",
  accuracy: "accuracy",
};

const metricLabel = (name: string) => METRIC_LABELS[name] ?? name.replace(/_/g, " ");

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold text-ink-1">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-3">{hint}</p>
    </div>
  );
}

/**
 * The transparency page: what the model is, how well it does, and where it
 * fails. A screening tool that will not show its confusion matrix is asking for
 * trust it has not earned.
 */
export function ModelPage() {
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.modelInfo().then(setInfo).catch((cause: Error) => setError(cause.message));
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-sm" style={{ color: "var(--status-critical)" }}>
        {error}
      </p>
    );
  }
  if (!info) return <p className="text-sm text-ink-3">Loading…</p>;

  const test = info.metrics.test;
  const totalRows = Object.values(info.class_counts).reduce((sum, count) => sum + count, 0);
  const majorityShare = Math.max(...Object.values(info.class_counts)) / totalRows;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold text-ink-1 sm:text-3xl">How this model works</h1>
        <p className="mt-2 max-w-3xl text-ink-2">
          A {info.model_name.replace(/_/g, " ")} trained on {info.training_rows.toLocaleString()}{" "}
          patient records and measured on {info.test_rows.toLocaleString()} it never saw during
          training. Selected on {metricLabel(info.selection_metric)}, using scikit-learn{" "}
          {info.sklearn_version}. Last trained {formatDateTime(info.trained_at)}.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-ink-1">Performance</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Balanced accuracy"
            value={formatPercent(test.balanced_accuracy)}
            hint="Average of how well each of the three classes is caught."
          />
          <MetricTile
            label="Macro F1"
            value={test.macro_f1.toFixed(3)}
            hint="Balances missed patients against false alarms, weighting rare classes equally."
          />
          <MetricTile
            label="Missed disease rate"
            value={formatPercent(test.missed_disease_rate)}
            hint="Share of genuinely ill patients the model called healthy - the costly error."
          />
          <MetricTile
            label="Plain accuracy"
            value={formatPercent(test.accuracy)}
            hint={`Least useful number here: guessing "Negative" every time already scores ${formatPercent(
              majorityShare,
              0,
            )}.`}
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-line bg-surface-1 p-6">
          <RecallChart metrics={test} />
        </div>
        <div className="min-w-0 rounded-2xl border border-line bg-surface-1 p-6">
          <ConfusionHeatmap metrics={test} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-1">Per class, in numbers</h2>
        <p className="mt-1 text-sm text-ink-2">
          Recall is the share of real cases found. Precision is how often a flag is correct.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface-1">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs tracking-wide text-ink-3 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Class</th>
                <th scope="col" className="px-4 py-3 font-medium">Precision</th>
                <th scope="col" className="px-4 py-3 font-medium">Recall</th>
                <th scope="col" className="px-4 py-3 font-medium">F1</th>
                <th scope="col" className="px-4 py-3 font-medium">Test cases</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {Object.entries(test.per_class).map(([name, scores]) => (
                <tr key={name} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink-1">{name}</td>
                  <td className="px-4 py-3 text-ink-2">{scores.precision.toFixed(3)}</td>
                  <td className="px-4 py-3 text-ink-2">{scores.recall.toFixed(3)}</td>
                  <td className="px-4 py-3 text-ink-2">{scores.f1.toFixed(3)}</td>
                  <td className="px-4 py-3 text-ink-2">{scores.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-1">Models that were compared</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface-1">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs tracking-wide text-ink-3 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Model</th>
                <th scope="col" className="px-4 py-3 font-medium">Macro F1</th>
                <th scope="col" className="px-4 py-3 font-medium">Balanced acc.</th>
                <th scope="col" className="px-4 py-3 font-medium">Accuracy</th>
                <th scope="col" className="px-4 py-3 font-medium">Missed disease</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {Object.entries(info.all_model_metrics).map(([name, entry]) => (
                <tr
                  key={name}
                  className="border-b border-line last:border-0"
                  style={
                    name === info.model_name ? { backgroundColor: "var(--accent-soft)" } : undefined
                  }
                >
                  <td className="px-4 py-3 text-ink-1">
                    {name.replace(/_/g, " ")}
                    {name === info.model_name && (
                      <span className="ml-2 text-[11px] font-medium text-accent">selected</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-2">{entry.test.macro_f1.toFixed(3)}</td>
                  <td className="px-4 py-3 text-ink-2">
                    {entry.test.balanced_accuracy.toFixed(3)}
                  </td>
                  <td className="px-4 py-3 text-ink-2">{entry.test.accuracy.toFixed(3)}</td>
                  <td className="px-4 py-3 text-ink-2">
                    {formatPercent(entry.test.missed_disease_rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-1">Limits you should know about</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">
          <li>
            <strong className="text-ink-1">The data is old.</strong> It comes from one
            Australian clinic in the 1980s. Assays and reference ranges have changed since,
            so real-world accuracy today would be lower than the numbers above.
          </li>
          <li>
            <strong className="text-ink-1">Rare classes are shakier.</strong> Only{" "}
            {info.class_counts.Hyperthyroid?.toLocaleString()} hyperthyroid cases exist in
            the whole dataset, so that class is the least reliable.
          </li>
          <li>
            <strong className="text-ink-1">Never externally validated.</strong> The model has
            not been tested on patients from any other hospital, country or era.
          </li>
          <li>
            <strong className="text-ink-1">Some columns were deliberately excluded.</strong>{" "}
            {Object.entries(info.dropped_columns).map(([name, reason]) => (
              <span key={name} className="mt-1 block text-ink-3">
                <code className="text-ink-2">{name}</code> — {reason}
              </span>
            ))}
          </li>
        </ul>
      </section>
    </div>
  );
}
