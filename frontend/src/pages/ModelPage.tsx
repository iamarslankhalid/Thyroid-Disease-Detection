import { useEffect, useState } from "react";
import { api, type ModelInfo } from "../api";
import { ConfusionHeatmap, RecallChart } from "../components/ModelCharts";
import { Alert, Icon, LoadingCard, PageHeader, StatCard } from "../components/ui";
import { formatDate, formatPercent } from "../lib/classes";

/** scikit-learn scorer names read badly in a sentence ("f1 macro"). */
const METRIC_LABELS: Record<string, string> = {
  f1_macro: "macro F1",
  balanced_accuracy: "balanced accuracy",
  accuracy: "accuracy",
};

const metricLabel = (name: string) => METRIC_LABELS[name] ?? name.replace(/_/g, " ");
const modelLabel = (name: string) => name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** How the model performs, and where it falls short. */
export function ModelPage() {
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.modelInfo().then(setInfo).catch((cause: Error) => setError(cause.message));
  }, []);

  const header = (
    <PageHeader
      eyebrow="Our model"
      title="How the model works"
      description={
        info
          ? `A ${modelLabel(info.model_name).toLowerCase()} trained on ${info.training_rows.toLocaleString()} patient records and evaluated on ${info.test_rows.toLocaleString()} it never saw during training. Selected on ${metricLabel(info.selection_metric)}; last trained ${formatDate(info.trained_at)}.`
          : "Performance measured on patients the model never saw during training."
      }
    />
  );

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <Alert tone="error">{error}</Alert>
      </div>
    );
  }
  if (!info) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingCard lines={5} />
      </div>
    );
  }

  const test = info.metrics.test;
  const totalRows = Object.values(info.class_counts).reduce((sum, count) => sum + count, 0);
  const majorityShare = Math.max(...Object.values(info.class_counts)) / totalRows;

  return (
    <div className="space-y-8">
      {header}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Balanced accuracy"
          icon="checkCircle"
          tone="good"
          value={formatPercent(test.balanced_accuracy)}
          hint="Average of how well each class is detected."
        />
        <StatCard
          label="Macro F1"
          icon="chart"
          value={test.macro_f1.toFixed(3)}
          hint="Balances missed cases against false alarms."
        />
        <StatCard
          label="Missed disease rate"
          icon="alert"
          tone="warning"
          value={formatPercent(test.missed_disease_rate)}
          hint="Patients with a disorder the model called negative."
        />
        <StatCard
          label="Accuracy"
          icon="beaker"
          value={formatPercent(test.accuracy)}
          hint={`For reference, always guessing "Negative" scores ${formatPercent(majorityShare, 0)}.`}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card min-w-0 p-6">
          <RecallChart metrics={test} />
        </div>
        <div className="card min-w-0 p-6">
          <ConfusionHeatmap metrics={test} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-1">Per-class performance</h2>
        <p className="mt-1 text-sm text-ink-2">
          Recall is the share of real cases found. Precision is how often a flag is correct.
        </p>
        <div className="card mt-4 overflow-x-auto">
          <table className="table-base tabular">
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">Precision</th>
                <th scope="col">Recall</th>
                <th scope="col">F1</th>
                <th scope="col">Test cases</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(test.per_class).map(([name, scores]) => (
                <tr key={name}>
                  <td className="font-medium text-ink-1">{name}</td>
                  <td>{scores.precision.toFixed(3)}</td>
                  <td>{scores.recall.toFixed(3)}</td>
                  <td>{scores.f1.toFixed(3)}</td>
                  <td>{scores.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-1">Models compared</h2>
        <div className="card mt-4 overflow-x-auto">
          <table className="table-base tabular">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Macro F1</th>
                <th scope="col">Balanced acc.</th>
                <th scope="col">Accuracy</th>
                <th scope="col">Missed disease</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(info.all_model_metrics).map(([name, entry]) => (
                <tr key={name} className={name === info.model_name ? "[&>td]:bg-accent-soft" : ""}>
                  <td className="font-medium text-ink-1">
                    {modelLabel(name)}
                    {name === info.model_name && (
                      <span className="badge ml-2 bg-accent text-accent-ink">Selected</span>
                    )}
                  </td>
                  <td>{entry.test.macro_f1.toFixed(3)}</td>
                  <td>{entry.test.balanced_accuracy.toFixed(3)}</td>
                  <td>{entry.test.accuracy.toFixed(3)}</td>
                  <td>{formatPercent(entry.test.missed_disease_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-soft text-warning">
            <Icon name="info" className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-ink-1">Things to keep in mind</h2>
        </div>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-2">
          <li>
            <strong className="text-ink-1">One source dataset.</strong> The model learned from a
            single clinical dataset. Laboratories, assays and reference ranges vary, so accuracy on
            your results may differ from the figures above.
          </li>
          <li>
            <strong className="text-ink-1">Hyperthyroidism is less certain.</strong> Only{" "}
            {info.class_counts.Hyperthyroid?.toLocaleString()} hyperthyroid cases were available,
            making it the least reliable of the three results.
          </li>
          <li>
            <strong className="text-ink-1">Some columns are excluded on purpose.</strong>
            {Object.entries(info.dropped_columns).map(([name, reason]) => (
              <span key={name} className="mt-1 block text-ink-3">
                <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-ink-2">{name}</code> — {reason}
              </span>
            ))}
          </li>
        </ul>
      </section>
    </div>
  );
}
