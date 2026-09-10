import type { ClassName } from "../api";
import { CLASS_META, CLASS_ORDER, formatPercent } from "../lib/classes";

interface Props {
  probabilities: Record<ClassName, number>;
  predicted: ClassName;
}

/**
 * How the model split its confidence across the three outcomes.
 *
 * Horizontal bars: the labels are words, so they belong on a horizontal axis
 * where they read straight. Every bar carries a direct label, which is also
 * what earns the palette its light-mode relief - no value depends on telling
 * two hues apart.
 */
export function ProbabilityBars({ probabilities, predicted }: Props) {
  return (
    <div className="print-block">
      <h3 className="text-sm font-semibold text-ink-1">Model confidence</h3>
      <p className="mt-1 text-xs text-ink-3">
        How the model divided its confidence between the three possible outcomes.
      </p>

      <ul className="mt-4 space-y-3">
        {CLASS_ORDER.map((name) => {
          const value = probabilities[name] ?? 0;
          const isPredicted = name === predicted;
          return (
            <li key={name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span
                  className={
                    isPredicted ? "font-semibold text-ink-1" : "text-ink-2"
                  }
                >
                  <span
                    aria-hidden
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                    style={{ backgroundColor: CLASS_META[name].color }}
                  />
                  {name}
                </span>
                <span
                  className={`tabular text-sm ${
                    isPredicted ? "font-semibold text-ink-1" : "text-ink-2"
                  }`}
                >
                  {formatPercent(value)}
                </span>
              </div>
              {/* Track and fill: 4px rounded data-end, anchored at zero. */}
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(value * 100, value > 0 ? 1.5 : 0)}%`,
                    backgroundColor: CLASS_META[name].color,
                    opacity: isPredicted ? 1 : 0.55,
                  }}
                  role="img"
                  aria-label={`${name}: ${formatPercent(value)}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
