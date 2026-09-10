import { useEffect, useMemo, useState } from "react";
import { api, type FeatureMeta } from "../api";
import { TrendChart, type TrendPoint } from "../components/TrendChart";
import { CLASS_META, formatDateTime, formatPercent } from "../lib/classes";
import {
  clearHistory,
  deleteAssessment,
  exportHistory,
  loadHistory,
  type StoredAssessment,
} from "../lib/storage";

/** Hands the browser a JSON copy of everything stored locally. */
function downloadHistory() {
  const blob = new Blob([exportHistory()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `thyroid-assessments-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function HistoryPage() {
  const [entries, setEntries] = useState<StoredAssessment[]>(() => loadHistory());
  // The reference range comes from the same source the model was trained
  // against, so the trend band can never disagree with the result panel.
  const [tshMeta, setTshMeta] = useState<FeatureMeta | null>(null);

  useEffect(() => {
    api
      .referenceData()
      .then((reference) => setTshMeta(reference.features.TSH ?? null))
      .catch(() => setTshMeta(null));
  }, []);

  // Oldest first, and only assessments that carried a TSH value recorded in the
  // same unit as the most recent one - two units on one axis is not a trend.
  const latestTshUnit = entries
    .flatMap((entry) => entry.labs.filter((lab) => lab.feature === "TSH"))
    .at(0)?.unit;

  const tshPoints = useMemo<TrendPoint[]>(
    () =>
      [...entries]
        .reverse()
        .flatMap((entry) => {
          const lab = entry.labs.find(
            (item) => item.feature === "TSH" && item.unit === latestTshUnit,
          );
          return lab ? [{ date: entry.createdAt, value: lab.value }] : [];
        }),
    [entries, latestTshUnit],
  );

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface-1 p-8 text-center">
        <h1 className="text-xl font-semibold text-ink-1">No saved assessments yet</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">
          Every check you run is saved in this browser so you can watch your numbers
          change over time. Nothing is uploaded anywhere.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-1">Your history</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-2">
            {entries.length} saved assessment{entries.length === 1 ? "" : "s"}, stored only
            in this browser. Clearing your browser data or switching device removes them.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadHistory}
            className="rounded-lg border border-line px-3 py-2 text-sm text-ink-2 hover:border-line-strong"
          >
            Download
          </button>
          <button
            onClick={() => {
              clearHistory();
              setEntries([]);
            }}
            className="rounded-lg border border-line px-3 py-2 text-sm text-ink-2 hover:border-line-strong"
          >
            Clear all
          </button>
        </div>
      </header>

      {tshPoints.length >= 2 && tshMeta?.reference && (
        <section className="rounded-2xl border border-line bg-surface-1 p-6 shadow-sm">
          <TrendChart
            points={tshPoints}
            label={tshMeta.label}
            unit={latestTshUnit ?? tshMeta.unit}
            referenceLow={tshMeta.reference[0]}
            referenceHigh={tshMeta.reference[1]}
          />
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-surface-1 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs tracking-wide text-ink-3 uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Date</th>
              <th scope="col" className="px-4 py-3 font-medium">Result</th>
              <th scope="col" className="px-4 py-3 font-medium">Confidence</th>
              <th scope="col" className="px-4 py-3 font-medium">TSH</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-ink-2">{formatDateTime(entry.createdAt)}</td>
                <td className="px-4 py-3">
                  <span
                    aria-hidden
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                    style={{ backgroundColor: CLASS_META[entry.prediction].color }}
                  />
                  <span className="text-ink-1">{entry.prediction}</span>
                </td>
                <td className="tabular px-4 py-3 text-ink-2">
                  {formatPercent(entry.confidence)}
                </td>
                <td className="tabular px-4 py-3 text-ink-2">
                  {(() => {
                    const lab = entry.labs.find((item) => item.feature === "TSH");
                    return lab ? `${lab.value} ${lab.unit}` : "—";
                  })()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEntries(deleteAssessment(entry.id))}
                    className="text-xs text-ink-3 hover:text-ink-1"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
