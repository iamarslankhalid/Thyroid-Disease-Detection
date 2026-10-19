import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Analytics, type LabAnalytics } from "../api";
import { MonthlyBars, RangeBar, ResultDonut, Sparkline } from "../components/AnalyticsCharts";
import { ImportLocalHistory } from "../components/ImportLocalHistory";
import { ReportDownload } from "../components/ReportDownload";
import { TrendChart } from "../components/TrendChart";
import { Alert, EmptyState, Icon, LoadingCard, PageHeader, StatCard } from "../components/ui";
import { useAuth } from "../lib/useAuth";
import { CLASS_META, STATUS_STYLE, formatDate, formatPercent } from "../lib/classes";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${Number(value.toFixed(3))}`;
}

function LabCard({ lab, active, onSelect }: { lab: LabAnalytics; active: boolean; onSelect: () => void }) {
  const status = STATUS_STYLE[lab.latest_status];
  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={`card card-hover p-4 text-left ${active ? "border-accent ring-4 ring-[var(--accent-ring)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink-1">{lab.label}</p>
          <p className="text-xs text-ink-3">{lab.readings} {lab.readings === 1 ? "reading" : "readings"}</p>
        </div>
        <span className={`badge ${status.className}`}>
          <span aria-hidden className="text-[9px]">{status.symbol}</span>
          {status.label}
        </span>
      </div>
      <p className="tabular mt-3 text-xl font-bold text-ink-1">
        {lab.latest_value}
        <span className="ml-1 text-xs font-normal text-ink-3">{lab.unit}</span>
      </p>
      <p className="tabular mt-0.5 text-xs text-ink-3">
        {lab.change === null ? "No earlier reading" : `${signed(lab.change)} since previous`}
      </p>
      <div className="mt-3">
        <RangeBar value={lab.latest_value} low={lab.reference_low} high={lab.reference_high} />
        <p className="tabular mt-1.5 text-[11px] text-ink-3">
          Reference {lab.reference_low}–{lab.reference_high}
        </p>
      </div>
      <div className="mt-2">
        <Sparkline points={lab.series} low={lab.reference_low} high={lab.reference_high} />
      </div>
    </button>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("TSH");

  const load = useCallback(() => {
    api
      .analytics()
      .then((data) => {
        setAnalytics(data);
        setError(null);
      })
      .catch((cause: Error) => setError(cause.message));
  }, []);

  useEffect(load, [load]);

  const selectedLab = useMemo(
    () => analytics?.labs.find((lab) => lab.feature === selected) ?? analytics?.labs[0] ?? null,
    [analytics, selected],
  );

  const firstName = user?.full_name.split(" ")[0] ?? "";

  const header = (
    <PageHeader
      eyebrow="Dashboard"
      title={`${greeting()}, ${firstName}`}
      description="Your thyroid results at a glance: latest status, how each test is moving and a report you can take to your doctor."
      actions={
        <Link to="/screening" className="btn btn-primary">
          <Icon name="plus" className="h-4 w-4" />
          New check
        </Link>
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

  if (!analytics) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="card skeleton h-28" />
          ))}
        </div>
        <LoadingCard lines={5} />
      </div>
    );
  }

  if (analytics.total === 0) {
    return (
      <div className="space-y-6">
        {header}
        <ImportLocalHistory onImported={load} />
        <EmptyState
          icon="chart"
          title="Your analytics will appear here"
          description="Run your first check and it will be saved to your account. With two or more, you'll see how each test is trending against its reference range."
          action={
            <Link to="/screening" className="btn btn-primary">
              Run your first check
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          }
        />
      </div>
    );
  }

  const latest = analytics.latest!;
  const latestMeta = CLASS_META[latest.prediction];
  const outOfRangeNow = analytics.labs.filter((lab) => lab.latest_status !== "normal").length;
  const resultChanged =
    analytics.previous_prediction !== null && analytics.previous_prediction !== latest.prediction;

  return (
    <div className="space-y-8">
      {header}
      <ImportLocalHistory onImported={load} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Latest result"
          icon={latestMeta.tone === "good" ? "checkCircle" : "alert"}
          tone={latestMeta.tone === "good" ? "good" : latestMeta.tone === "warning" ? "warning" : "serious"}
          value={<span className="text-xl">{latest.prediction}</span>}
          hint={
            resultChanged
              ? `Changed from ${analytics.previous_prediction} · ${formatPercent(latest.confidence)} confidence`
              : `${formatPercent(latest.confidence)} confidence · ${formatDate(latest.created_at)}`
          }
        />
        <StatCard
          label="Total checks"
          icon="clock"
          value={analytics.total}
          hint={analytics.first_at ? `Since ${formatDate(analytics.first_at)}` : undefined}
        />
        <StatCard
          label="Tests out of range"
          icon="beaker"
          tone={outOfRangeNow > 0 ? "warning" : "good"}
          value={
            <>
              {outOfRangeNow}
              <span className="text-base font-normal text-ink-3"> / {analytics.labs.length}</span>
            </>
          }
          hint="In your most recent reading of each test"
        />
        <StatCard
          label="Last check"
          icon="calendar"
          value={
            analytics.days_since_last === 0
              ? "Today"
              : `${analytics.days_since_last} ${analytics.days_since_last === 1 ? "day" : "days"} ago`
          }
          hint={
            analytics.abnormal_assessments > 0
              ? `${analytics.abnormal_assessments} of ${analytics.total} checks flagged a disorder`
              : "No check has flagged a disorder"
          }
        />
      </section>

      {analytics.labs.length > 0 && (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink-1">Your tests</h2>
            <p className="text-xs text-ink-3">
              Values in standard units, so readings entered in different units are comparable.
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {analytics.labs.map((lab) => (
              <LabCard
                key={lab.feature}
                lab={lab}
                active={selectedLab?.feature === lab.feature}
                onSelect={() => setSelected(lab.feature)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card min-w-0 p-6 lg:col-span-2">
          {selectedLab && selectedLab.series.length >= 2 ? (
            <>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {analytics.labs.map((lab) => (
                  <button
                    key={lab.feature}
                    onClick={() => setSelected(lab.feature)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      selectedLab.feature === lab.feature
                        ? "bg-accent text-accent-ink"
                        : "bg-surface-2 text-ink-2 hover:text-ink-1"
                    }`}
                  >
                    {lab.label}
                  </button>
                ))}
              </div>
              <TrendChart
                points={selectedLab.series}
                label={selectedLab.label}
                unit={selectedLab.unit}
                referenceLow={selectedLab.reference_low}
                referenceHigh={selectedLab.reference_high}
              />
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
                <div>
                  <dt className="text-xs text-ink-3">Lowest</dt>
                  <dd className="tabular font-semibold text-ink-1">{selectedLab.minimum}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">Average</dt>
                  <dd className="tabular font-semibold text-ink-1">{selectedLab.average}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">Highest</dt>
                  <dd className="tabular font-semibold text-ink-1">{selectedLab.maximum}</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon name="trend" className="h-5 w-5" />
              </span>
              <p className="mt-3 font-semibold text-ink-1">Trends need two readings</p>
              <p className="mt-1 max-w-sm text-sm text-ink-2">
                Add another check with {selectedLab?.label ?? "a lab value"} and you'll see how it
                moves against its reference range.
              </p>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-ink-1">Result distribution</h2>
          <p className="mt-0.5 text-xs text-ink-3">Across all your saved checks</p>
          <div className="mt-5">
            <ResultDonut counts={analytics.class_counts} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-1">
          <h2 className="font-semibold text-ink-1">Activity</h2>
          <p className="mt-0.5 text-xs text-ink-3">Checks per month, by result</p>
          <div className="mt-5">
            <MonthlyBars months={analytics.monthly} />
          </div>
        </div>
        <div className="lg:col-span-2">
          <ReportDownload />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <h2 className="font-semibold text-ink-1">Most recent check</h2>
          <Link to="/history" className="link text-sm">
            View full history
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-5">
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-3 w-3 rounded-full" style={{ backgroundColor: latestMeta.color }} />
            <div>
              <p className="font-semibold text-ink-1">{latestMeta.headline}</p>
              <p className="text-xs text-ink-3">{formatDate(latest.created_at)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {latest.labs.map((lab) => {
              const status = STATUS_STYLE[lab.status];
              return (
                <span key={lab.feature} className="tabular rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                  <span className="font-medium text-ink-1">{lab.label}</span> {lab.value} {lab.unit}
                  {lab.status !== "normal" && (
                    <span className={`ml-1.5 rounded px-1 ${status.className}`}>{status.symbol}</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
