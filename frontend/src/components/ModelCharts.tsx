import type { ClassName, TestMetrics } from "../api";
import { CLASS_META, formatPercent } from "../lib/classes";

/**
 * Recall per class: the share of real cases the model actually finds.
 *
 * Horizontal bars, because the labels are words. Every bar is directly
 * labelled, so no value depends on telling two hues apart.
 */
export function RecallChart({ metrics }: { metrics: TestMetrics }) {
  const entries = Object.entries(metrics.per_class);

  return (
    <figure>
      <figcaption className="text-sm font-semibold text-ink-1">
        Cases found, by class
      </figcaption>
      <p className="mt-1 text-xs text-ink-3">
        Recall on the held-out test set. The hyperthyroid bar is shortest because the
        dataset holds the fewest of those cases.
      </p>
      <ul className="mt-4 space-y-3">
        {entries.map(([name, scores]) => (
          <li key={name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink-2">
                <span
                  aria-hidden
                  className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                  style={{ backgroundColor: CLASS_META[name as ClassName]?.color }}
                />
                {name}
              </span>
              <span className="tabular text-ink-1">
                {formatPercent(scores.recall)}
                <span className="ml-2 text-xs font-normal text-ink-3">
                  of {scores.support}
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(scores.recall * 100, 1.5)}%`,
                  backgroundColor: CLASS_META[name as ClassName]?.color,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * The confusion matrix as a heatmap.
 *
 * A sequential single-hue ramp, light to dark, because the quantity is a
 * magnitude. Every cell still shows its number, so the colour is a reading aid
 * rather than the only way to read the table.
 */
export function ConfusionHeatmap({ metrics }: { metrics: TestMetrics }) {
  const labels = metrics.confusion_matrix_labels;
  const matrix = metrics.confusion_matrix;
  const rowTotals = matrix.map((row) => row.reduce((sum, value) => sum + value, 0));

  return (
    <figure>
      <figcaption className="text-sm font-semibold text-ink-1">
        Where it gets things wrong
      </figcaption>
      <p className="mt-1 text-xs text-ink-3">
        Rows are the true diagnosis, columns what the model predicted. Shading is the
        share of that row, so the rare classes stay readable next to the common one.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[320px] border-separate border-spacing-1 text-sm">
          <caption className="sr-only">
            Confusion matrix: true diagnosis by predicted diagnosis
          </caption>
          <thead>
            <tr>
              <td />
              {labels.map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-2 pb-1 text-xs font-medium text-ink-3"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={labels[rowIndex]}>
                <th
                  scope="row"
                  className="pr-2 text-right text-xs font-medium whitespace-nowrap text-ink-3"
                >
                  {labels[rowIndex]}
                </th>
                {row.map((count, columnIndex) => {
                  const share = rowTotals[rowIndex] ? count / rowTotals[rowIndex] : 0;
                  const correct = rowIndex === columnIndex;
                  return (
                    <td
                      key={columnIndex}
                      className="rounded-md px-2 py-3 text-center"
                      style={{
                        // One hue, light to dark. The diagonal uses the same
                        // ramp - being correct is not a different quantity.
                        backgroundColor: `color-mix(in oklab, var(--series-negative) ${Math.round(
                          share * 88,
                        )}%, var(--surface-2))`,
                        color: share > 0.45 ? "#ffffff" : "var(--ink-1)",
                        fontWeight: correct ? 600 : 400,
                      }}
                      title={`${labels[rowIndex]} predicted as ${labels[columnIndex]}: ${count}`}
                    >
                      <span className="tabular">{count}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
