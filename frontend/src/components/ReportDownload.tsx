import { useId, useState } from "react";
import { api } from "../api";
import { Icon, Spinner } from "./ui";

const PERIODS = [
  { value: "all", label: "All time", months: null },
  { value: "3", label: "Last 3 months", months: 3 },
  { value: "6", label: "Last 6 months", months: 6 },
  { value: "12", label: "Last 12 months", months: 12 },
] as const;

type Period = (typeof PERIODS)[number]["value"];

/** Download the account's history as a PDF summary for a consultation. */
export function ReportDownload({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const [period, setPeriod] = useState<Period>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const months = PERIODS.find((item) => item.value === period)?.months;
      let start: string | undefined;
      if (months) {
        const since = new Date();
        since.setMonth(since.getMonth() - months);
        start = since.toISOString();
      }
      await api.downloadHistoryReport({ start });
    } catch (cause) {
      console.error("History report download failed", cause);
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "" : "card p-6"}>
      {!compact && (
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Icon name="document" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-ink-1">Report for your doctor</h2>
            <p className="mt-0.5 text-sm text-ink-2">
              A PDF with your details, latest panel against reference ranges, trend charts and
              every saved check.
            </p>
          </div>
        </div>
      )}
      <div className={`flex flex-wrap items-end gap-3 ${compact ? "" : "mt-5"}`}>
        <div className="min-w-40 flex-1">
          <label htmlFor={`${id}-period`} className="label">Period</label>
          <select
            id={`${id}-period`}
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
            className="input"
          >
            {PERIODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <button onClick={handleDownload} disabled={busy} className="btn btn-primary">
          {busy ? <Spinner /> : <Icon name="download" className="h-4 w-4" />}
          Download PDF
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-serious">{error}</p>}
    </div>
  );
}
