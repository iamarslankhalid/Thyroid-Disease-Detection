import { useState } from "react";
import type { ClassName, MonthlyCount, TrendPointOut } from "../api";
import { CLASS_META, CLASS_ORDER } from "../lib/classes";

/** Share of each screening result, with the counts listed beside it. */
export function ResultDonut({ counts }: { counts: Record<ClassName, number> }) {
  const total = CLASS_ORDER.reduce((sum, name) => sum + (counts[name] ?? 0), 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0" role="img" aria-label="Result distribution">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--surface-3)" strokeWidth="14" />
        {total > 0 &&
          CLASS_ORDER.map((name) => {
            const share = (counts[name] ?? 0) / total;
            if (share === 0) return null;
            const length = share * circumference;
            const segment = (
              <circle
                key={name}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={CLASS_META[name].color}
                strokeWidth="14"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
              />
            );
            offset += length;
            return segment;
          })}
        <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--ink-1)" className="tabular">
          {total}
        </text>
        <text x="60" y="75" textAnchor="middle" fontSize="10" fill="var(--ink-3)">
          {total === 1 ? "check" : "checks"}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-3">
        {CLASS_ORDER.map((name) => {
          const count = counts[name] ?? 0;
          return (
            <li key={name} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-ink-2">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CLASS_META[name].color }} />
                {name}
              </span>
              <span className="tabular font-semibold text-ink-1">
                {count}
                <span className="ml-1.5 font-normal text-ink-3">
                  {total > 0 ? `${Math.round((count / total) * 100)}%` : "0%"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function monthLabel(month: string): string {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1, 1)).toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
}

/** Every month from the first to the last with activity, so gaps show as gaps. */
function continuousMonths(months: MonthlyCount[]): MonthlyCount[] {
  if (months.length === 0) return [];
  const byMonth = new Map(months.map((month) => [month.month, month]));
  const [startYear, startMonth] = months[0].month.split("-").map(Number);
  const [endYear, endMonth] = months[months.length - 1].month.split("-").map(Number);
  const filled: MonthlyCount[] = [];
  for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth); ) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    filled.push(byMonth.get(key) ?? { month: key, total: 0, Negative: 0, Hypothyroid: 0, Hyperthyroid: 0 });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return filled.slice(-12);
}

/** Checks per month, stacked by result, over the last twelve months of activity. */
export function MonthlyBars({ months }: { months: MonthlyCount[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = continuousMonths(months);
  const max = Math.max(1, ...shown.map((month) => month.total));

  if (shown.length === 0) return <p className="text-sm text-ink-3">No activity yet.</p>;

  const active = hovered !== null ? shown[hovered] : null;

  return (
    <div className="relative" role="img" aria-label="Checks per month by result">
      <div className="flex h-36 items-end gap-1.5 border-b border-line">
        {shown.map((month, index) => (
          <div
            key={month.month}
            className="flex h-full flex-1 flex-col justify-end"
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            style={{ opacity: hovered === null || hovered === index ? 1 : 0.5 }}
          >
            <div className="mx-auto flex w-full max-w-7 flex-col-reverse overflow-hidden rounded-t-md">
              {CLASS_ORDER.map((name) =>
                month[name] > 0 ? (
                  <div
                    key={name}
                    style={{ height: `${(month[name] / max) * 128}px`, backgroundColor: CLASS_META[name].color }}
                  />
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {shown.map((month) => (
          <span key={month.month} className="flex-1 text-center text-[10px] text-ink-3">
            {monthLabel(month.month)}
          </span>
        ))}
      </div>
      {active && (
        <div className="pointer-events-none absolute top-0 right-0 rounded-lg border border-line bg-surface-1 px-3 py-2 text-xs shadow-[var(--shadow-md)]">
          <p className="font-semibold text-ink-1">
            {monthLabel(active.month)} {active.month.slice(0, 4)} · {active.total} {active.total === 1 ? "check" : "checks"}
          </p>
          {CLASS_ORDER.filter((name) => active[name] > 0).map((name) => (
            <p key={name} className="text-ink-2">
              {name}: {active[name]}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** A tiny line of recent readings, with the reference band behind it. */
export function Sparkline({
  points,
  low,
  high,
}: {
  points: TrendPointOut[];
  low: number;
  high: number;
}) {
  const width = 120;
  const height = 36;
  if (points.length < 2) {
    return <div className="flex h-9 items-center text-xs text-ink-3">One reading so far</div>;
  }
  const values = points.map((point) => point.value);
  const min = Math.min(...values, low);
  const max = Math.max(...values, high);
  const span = max - min || 1;
  const y = (value: number) => height - 3 - ((value - min) / span) * (height - 6);
  const x = (index: number) => (index / (points.length - 1)) * (width - 6) + 3;
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.value)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-9 w-full" aria-hidden>
      <rect x={0} y={y(high)} width={width} height={Math.max(y(low) - y(high), 1)} fill="var(--status-good)" opacity={0.1} />
      <path
        d={path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Where a value sits relative to its reference range. */
export function RangeBar({ value, low, high }: { value: number; low: number; high: number }) {
  const span = high - low;
  const min = low - span * 0.6;
  const max = high + span * 0.6;
  const clamp = (n: number) => Math.min(Math.max(n, 0), 100);
  const position = clamp(((value - min) / (max - min)) * 100);
  const start = ((low - min) / (max - min)) * 100;
  const end = ((high - min) / (max - min)) * 100;
  return (
    <div className="relative h-1.5 w-full rounded-full bg-surface-3" aria-hidden>
      <div className="absolute inset-y-0 rounded-full bg-good/35" style={{ left: `${start}%`, width: `${end - start}%` }} />
      <div
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-1 bg-ink-1"
        style={{ left: `${position}%` }}
      />
    </div>
  );
}
