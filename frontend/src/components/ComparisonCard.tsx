import type { PredictionResponse } from "../api";
import { CLASS_META, formatDate } from "../lib/classes";
import type { StoredAssessment } from "../lib/storage";

const TRACKED = ["TSH", "T3", "TT4", "T4U", "FTI"] as const;

interface Props {
  result: PredictionResponse;
  previous: StoredAssessment;
}

/**
 * This result against the last one.
 *
 * A single reading says little; a reading that has halved since March says a
 * great deal. The history is already stored locally, so this costs nothing but
 * is the thing a returning patient actually wants to know.
 */
export function ComparisonCard({ result, previous }: Props) {
  const changes = TRACKED.map((feature) => {
    const before = previous.labs.find((lab) => lab.feature === feature);
    const now = result.lab_flags.find((flag) => flag.feature === feature);
    if (!before || !now) return null;
    // Only compare values recorded in the same unit. Someone who entered
    // 8.1 µg/dL in March and 104 nmol/L in June has not seen their T4 rise
    // thirteenfold, and showing that as a change would be alarming nonsense.
    if (before.unit !== now.unit) return null;
    return {
      feature,
      label: now.label,
      before: before.value,
      now: now.value,
      unit: now.unit,
      delta: now.value - before.value,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  const classChanged = previous.prediction !== result.prediction;

  return (
    <div className="print-block">
      <h3 className="text-sm font-semibold text-ink-1">Compared with your last check</h3>
      <p className="mt-1 text-xs text-ink-3">
        Your previous assessment was on {formatDate(previous.createdAt)}.
      </p>

      <p className="mt-3 text-sm text-ink-2">
        {classChanged ? (
          <>
            The result changed from{" "}
            <span
              className="font-medium"
              style={{ color: CLASS_META[previous.prediction].color }}
            >
              {previous.prediction}
            </span>{" "}
            to{" "}
            <span className="font-medium" style={{ color: CLASS_META[result.prediction].color }}>
              {result.prediction}
            </span>
            .
          </>
        ) : (
          <>
            The result is unchanged at{" "}
            <span className="font-medium" style={{ color: CLASS_META[result.prediction].color }}>
              {result.prediction}
            </span>
            .
          </>
        )}
      </p>

      {changes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {changes.map((change) => {
            const rising = change.delta > 0;
            const flat = Math.abs(change.delta) < 1e-9;
            return (
              <li
                key={change.feature}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="text-ink-2">{change.label}</span>
                <span className="tabular text-ink-1">
                  {change.before} <span className="text-ink-3">→</span> {change.now}{" "}
                  <span className="text-ink-3">{change.unit}</span>
                  {!flat && (
                    // Direction is carried by the arrow and the signed number,
                    // never by colour alone - a rising TSH is not "bad" and a
                    // falling one is not "good" without clinical context.
                    <span className="ml-2 text-xs text-ink-3">
                      {rising ? "▲" : "▼"} {rising ? "+" : ""}
                      {Number(change.delta.toFixed(2))}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
