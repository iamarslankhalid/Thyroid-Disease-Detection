import type { Counterfactual } from "../api";
import { CLASS_META } from "../lib/classes";

/**
 * How close this result sits to a different answer.
 *
 * Each line is a real boundary found by re-running the model across the whole
 * plausible range of one value: "your TSH would have to exceed 6.8" is checked,
 * not estimated. It tells a patient whether they are borderline or clear-cut,
 * which a probability alone does not.
 */
export function WhatWouldChange({ items }: { items: Counterfactual[] }) {
  if (items.length === 0) return null;

  return (
    <div className="print-block">
      <h3 className="text-sm font-semibold text-ink-1">What would change this result</h3>
      <p className="mt-1 text-xs text-ink-3">
        Found by re-running the model across each value in turn. This describes how the
        model behaves - it is not a target to aim for, and not medical advice.
      </p>

      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={item.feature}
            className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm"
          >
            <p className="text-ink-1">
              If your <span className="font-medium">{item.label}</span> were{" "}
              <span className="font-semibold">
                {item.direction} {item.threshold} {item.unit}
              </span>
              , this would read{" "}
              <span
                className="font-semibold"
                style={{ color: CLASS_META[item.resulting_class].color }}
              >
                {item.resulting_class}
              </span>
              .
            </p>
            <p className="tabular mt-1 text-xs text-ink-3">
              yours is {item.current_value} {item.unit}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
