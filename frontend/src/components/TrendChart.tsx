import { useId, useMemo, useState } from "react";

export interface TrendPoint {
  date: string;
  value: number;
}

interface Props {
  points: TrendPoint[];
  label: string;
  unit: string;
  referenceLow: number;
  referenceHigh: number;
}

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 44 };

/**
 * One measurement over time, with the normal range drawn behind it.
 *
 * A single series, so no legend: the title names it. The reference band is the
 * point of the chart - a TSH of 6 means nothing on its own, but "6, and the
 * normal ceiling is 4, and last time it was 3.2" is a story.
 */
export function TrendChart({ points, label, unit, referenceLow, referenceHigh }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const clipId = useId();

  const chart = useMemo(() => {
    const plotWidth = WIDTH - PADDING.left - PADDING.right;
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

    const values = points.map((point) => point.value);
    // The band must stay visible even when every reading sits far outside it.
    const rawMin = Math.min(...values, referenceLow);
    const rawMax = Math.max(...values, referenceHigh);
    const pad = (rawMax - rawMin) * 0.15 || Math.max(rawMax * 0.15, 0.5);
    const min = Math.max(rawMin - pad, 0);
    const max = rawMax + pad;

    const x = (index: number) =>
      PADDING.left +
      (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
    const y = (value: number) =>
      PADDING.top + plotHeight - ((value - min) / (max - min)) * plotHeight;

    return {
      x,
      y,
      min,
      max,
      plotWidth,
      plotHeight,
      ticks: [min, (min + max) / 2, max],
      path: points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.value)}`).join(" "),
    };
  }, [points, referenceLow, referenceHigh]);

  if (points.length === 0) return null;

  const active = hovered !== null ? points[hovered] : null;

  return (
    <figure className="print-block">
      <figcaption className="text-sm font-semibold text-ink-1">
        {label} over time
        <span className="ml-2 font-normal text-ink-3">({unit})</span>
      </figcaption>

      <div className="relative mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full min-w-[380px]"
          role="img"
          aria-label={`${label} across ${points.length} assessments`}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x={PADDING.left}
                y={PADDING.top}
                width={chart.plotWidth}
                height={chart.plotHeight}
              />
            </clipPath>
          </defs>

          {/* Normal range, drawn first so the data sits on top of it. */}
          <rect
            x={PADDING.left}
            y={chart.y(referenceHigh)}
            width={chart.plotWidth}
            height={Math.max(chart.y(referenceLow) - chart.y(referenceHigh), 1)}
            fill="var(--status-good)"
            opacity={0.12}
            clipPath={`url(#${clipId})`}
          />
          <text
            x={PADDING.left + 6}
            y={chart.y(referenceHigh) + 12}
            fontSize={10}
            fill="var(--ink-3)"
          >
            normal {referenceLow}–{referenceHigh}
          </text>

          {/* Recessive axis furniture. */}
          {chart.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={chart.y(tick)}
                y2={chart.y(tick)}
                stroke="var(--border-subtle)"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 8}
                y={chart.y(tick) + 3}
                fontSize={10}
                textAnchor="end"
                fill="var(--ink-3)"
                className="tabular"
              >
                {tick >= 10 ? tick.toFixed(0) : tick.toFixed(1)}
              </text>
            </g>
          ))}

          <path
            d={chart.path}
            fill="none"
            stroke="var(--series-negative)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point, index) => (
            <g key={point.date + index}>
              {hovered === index && (
                <line
                  x1={chart.x(index)}
                  x2={chart.x(index)}
                  y1={PADDING.top}
                  y2={HEIGHT - PADDING.bottom}
                  stroke="var(--border-strong)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              )}
              <circle
                cx={chart.x(index)}
                cy={chart.y(point.value)}
                r={hovered === index ? 6 : 4.5}
                fill="var(--series-negative)"
                stroke="var(--surface-1)"
                strokeWidth={2}
              />
              {/* Hit target far larger than the mark itself. */}
              <circle
                cx={chart.x(index)}
                cy={chart.y(point.value)}
                r={16}
                fill="transparent"
                onMouseEnter={() => setHovered(index)}
              />
            </g>
          ))}

          {/* Only the endpoints are labelled - a number on every point is noise. */}
          {[0, points.length - 1]
            .filter((index, position, all) => all.indexOf(index) === position)
            .map((index) => (
              <text
                key={`tick-${index}`}
                x={chart.x(index)}
                y={HEIGHT - 8}
                fontSize={10}
                textAnchor={index === 0 && points.length > 1 ? "start" : "middle"}
                fill="var(--ink-3)"
              >
                {new Date(points[index].date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </text>
            ))}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute top-2 rounded-md border border-line bg-surface-1 px-2.5 py-1.5 text-xs shadow-sm"
            style={{ left: `${(chart.x(hovered!) / WIDTH) * 100}%`, transform: "translateX(-50%)" }}
          >
            <div className="tabular font-semibold text-ink-1">
              {active.value} {unit}
            </div>
            <div className="text-ink-3">
              {new Date(active.date).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
