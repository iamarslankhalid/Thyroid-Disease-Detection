import type { LabFlag, RangeStatus } from "../api";

const STATUS_STYLE: Record<RangeStatus, { color: string; label: string; symbol: string }> = {
  // Status colour is always paired with a word and a symbol, so the meaning
  // survives colour blindness, greyscale printing and forced-colours mode.
  low: { color: "var(--status-serious)", label: "Below range", symbol: "▼" },
  normal: { color: "var(--status-good)", label: "In range", symbol: "●" },
  high: { color: "var(--status-critical)", label: "Above range", symbol: "▲" },
};

/** Where a value sits on a strip that spans a little beyond the normal range. */
function markerPosition(flag: LabFlag): number {
  const span = flag.reference_high - flag.reference_low;
  const low = flag.reference_low - span;
  const high = flag.reference_high + span;
  const clamped = Math.min(Math.max(flag.value, low), high);
  return ((clamped - low) / (high - low)) * 100;
}

function normalZone(flag: LabFlag): { left: number; width: number } {
  const span = flag.reference_high - flag.reference_low;
  const low = flag.reference_low - span;
  const high = flag.reference_high + span;
  const total = high - low;
  return {
    left: ((flag.reference_low - low) / total) * 100,
    width: (span / total) * 100,
  };
}

/**
 * The patient's own numbers against typical adult reference ranges.
 *
 * This is not the model's opinion - it is arithmetic anyone can check, which is
 * why it sits beside the prediction rather than inside it.
 */
export function LabFlags({ flags }: { flags: LabFlag[] }) {
  if (flags.length === 0) return null;

  return (
    <div className="print-block">
      <h3 className="text-sm font-semibold text-ink-1">Your results vs typical ranges</h3>
      <p className="mt-1 text-xs text-ink-3">
        Reference ranges differ between laboratories. Use the ranges printed on your own
        report if they differ from these.
      </p>

      <ul className="mt-4 space-y-4">
        {flags.map((flag) => {
          const style = STATUS_STYLE[flag.status];
          const zone = normalZone(flag);
          return (
            <li key={flag.feature}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-sm text-ink-2">{flag.label}</span>
                <span className="flex items-baseline gap-2">
                  <span className="tabular text-sm font-semibold text-ink-1">
                    {flag.value} <span className="font-normal text-ink-3">{flag.unit}</span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ color: style.color, backgroundColor: "var(--surface-2)" }}
                  >
                    <span aria-hidden>{style.symbol}</span>
                    {style.label}
                  </span>
                </span>
              </div>

              <div className="relative mt-2 h-1.5 w-full rounded-full bg-surface-2">
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: `${zone.left}%`,
                    width: `${zone.width}%`,
                    backgroundColor: "var(--status-good)",
                    opacity: 0.25,
                  }}
                />
                {/* 2px surface ring keeps the marker readable over the zone fill. */}
                <span
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${markerPosition(flag)}%`,
                    backgroundColor: style.color,
                    boxShadow: "0 0 0 2px var(--surface-1)",
                  }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-ink-3 tabular">
                <span>
                  normal {flag.reference_low}–{flag.reference_high} {flag.unit}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
