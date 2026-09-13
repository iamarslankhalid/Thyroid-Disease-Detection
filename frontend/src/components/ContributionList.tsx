import type { Contribution } from "../api";

/**
 * Why the model answered the way it did.
 *
 * Each row is measured by re-running the prediction with that one value
 * replaced by a typical patient's, so the bar length is a real probability
 * shift rather than a global "feature importance" that says nothing about
 * this particular person.
 */
export function ContributionList({
  contributions,
  prediction,
}: {
  contributions: Contribution[];
  prediction: string;
}) {
  if (contributions.length === 0) {
    return (
      <div className="print-block">
        <h3 className="text-sm font-semibold text-ink-1">Why this result</h3>
        <p className="mt-2 text-sm text-ink-2">
          No single value stands out - this result comes from the combination of your
          inputs rather than one dominant number.
        </p>
      </div>
    );
  }

  const strongest = Math.max(...contributions.map((item) => item.impact));

  return (
    <div className="print-block">
      <h3 className="text-sm font-semibold text-ink-1">Why this result</h3>
      <p className="mt-1 text-xs text-ink-3">
        The values that moved the result towards{" "}
        <span className="font-medium text-ink-2">{prediction}</span>, strongest first.
        Only values you entered are listed.
      </p>

      <ul className="mt-4 space-y-3">
        {contributions.map((item) => {
          const supports = item.direction === "supports";
          return (
            <li key={item.feature} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-ink-1">
                    {item.label}
                    {item.value !== null && item.unit ? (
                      <span className="tabular text-ink-3">
                        {" "}
                        {item.value} {item.unit}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-3">
                    {supports ? "supports" : "argues against"}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max((item.impact / strongest) * 100, 3)}%`,
                      backgroundColor: supports
                        ? "var(--series-negative)"
                        : "var(--border-strong)",
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
