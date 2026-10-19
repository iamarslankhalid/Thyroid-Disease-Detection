import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AssessmentSummary, type ClassName } from "../api";
import { ImportLocalHistory } from "../components/ImportLocalHistory";
import { ReportDownload } from "../components/ReportDownload";
import { Alert, EmptyState, Icon, LoadingCard, PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../lib/useAuth";
import { CLASS_META, CLASS_ORDER, STATUS_STYLE, formatDateTime, formatPercent } from "../lib/classes";
import { clearHistory, deleteAssessment, loadHistory, type StoredAssessment } from "../lib/storage";

export function HistoryPage() {
  const { status } = useAuth();
  if (status === "loading") return <LoadingCard lines={6} />;
  return status === "signed-in" ? <AccountHistory /> : <GuestHistory />;
}

function ResultLabel({ prediction }: { prediction: ClassName }) {
  return (
    <span className="inline-flex items-center gap-2 font-medium text-ink-1">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CLASS_META[prediction].color }} />
      {prediction}
    </span>
  );
}

function LabChips({ labs }: { labs: { feature: string; label: string; value: number; unit: string; status?: string }[] }) {
  if (labs.length === 0) return <span className="text-ink-3">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {labs.map((lab) => {
        const style = lab.status ? STATUS_STYLE[lab.status as keyof typeof STATUS_STYLE] : null;
        return (
          <span key={lab.feature} className="tabular rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
            <span className="font-medium text-ink-1">{lab.feature}</span> {lab.value}
            {style && lab.status !== "normal" && (
              <span className={`ml-1 rounded px-1 text-[10px] ${style.className}`}>{style.symbol}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function NoteEditor({ item, onSaved }: { item: AssessmentSummary; onSaved: (next: AssessmentSummary) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.updateNote(item.id, draft.trim() || null));
      setEditing(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-2 text-sm">
        <p className={item.note ? "text-ink-2" : "text-ink-3 italic"}>
          {item.note ?? "No note. Add symptoms, medication or anything your doctor should know."}
        </p>
        <button onClick={() => setEditing(true)} className="btn btn-sm btn-ghost shrink-0 px-2 py-1">
          <Icon name="pencil" className="h-3.5 w-3.5" />
          {item.note ? "Edit" : "Add note"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={1000}
        rows={3}
        className="input text-sm"
        placeholder="e.g. Feeling tired for 3 weeks, started levothyroxine 50 µg on 1 March"
        autoFocus
      />
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={busy} className="btn btn-sm btn-primary">
          {busy && <Spinner />}
          Save note
        </button>
        <button onClick={() => setEditing(false)} className="btn btn-sm btn-ghost">Cancel</button>
        <span className="ml-auto text-xs text-ink-3">{draft.length}/1000</span>
      </div>
      {error && <p className="text-xs text-serious">{error}</p>}
    </div>
  );
}

function AccountHistory() {
  const [items, setItems] = useState<AssessmentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ClassName | "all">("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(() => {
    api
      .assessments()
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch((cause: Error) => setError(cause.message));
  }, []);

  useEffect(load, [load]);

  const shown = useMemo(
    () => (items ?? []).filter((item) => filter === "all" || item.prediction === filter),
    [items, filter],
  );

  async function remove(id: number) {
    setPending(id);
    try {
      await api.deleteAssessment(id);
      setItems((current) => current?.filter((item) => item.id !== id) ?? null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function downloadOne(id: number) {
    setPending(id);
    try {
      await api.downloadAssessmentReport(id);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function clearAll() {
    try {
      await api.clearAssessments();
      setItems([]);
      setConfirmClear(false);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  const header = (
    <PageHeader
      eyebrow="History"
      title="Your screening history"
      description="Every check saved to your account. Add notes for your doctor and download your history as a PDF."
      actions={
        <Link to="/screening" className="btn btn-primary">
          <Icon name="plus" className="h-4 w-4" />
          New check
        </Link>
      }
    />
  );

  if (items === null && !error) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingCard lines={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <ImportLocalHistory onImported={load} />
      {error && <Alert tone="error">{error}</Alert>}

      {items && items.length === 0 ? (
        <EmptyState
          icon="clock"
          title="No saved checks yet"
          description="Checks you run while signed in are saved here automatically."
          action={<Link to="/screening" className="btn btn-primary">Run a check</Link>}
        />
      ) : (
        <>
          <ReportDownload />

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by result">
                {(["all", ...CLASS_ORDER] as const).map((value) => {
                  const count = value === "all" ? items?.length ?? 0 : (items ?? []).filter((item) => item.prediction === value).length;
                  return (
                    <button
                      key={value}
                      onClick={() => setFilter(value)}
                      aria-pressed={filter === value}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        filter === value ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2 hover:text-ink-1"
                      }`}
                    >
                      {value === "all" ? "All" : value} · {count}
                    </button>
                  );
                })}
              </div>
              {confirmClear ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-ink-2">Delete all {items?.length} checks permanently?</span>
                  <button onClick={clearAll} className="btn btn-sm btn-danger">Delete all</button>
                  <button onClick={() => setConfirmClear(false)} className="btn btn-sm btn-ghost">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmClear(true)} className="btn btn-sm btn-danger-ghost">
                  <Icon name="trash" className="h-3.5 w-3.5" />
                  Clear history
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Result</th>
                    <th scope="col">Confidence</th>
                    <th scope="col">Lab values</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((item) => (
                    <HistoryRow
                      key={item.id}
                      item={item}
                      expanded={expanded === item.id}
                      busy={pending === item.id}
                      onToggle={() => setExpanded((current) => (current === item.id ? null : item.id))}
                      onDelete={() => remove(item.id)}
                      onDownload={() => downloadOne(item.id)}
                      onNoteSaved={(next) =>
                        setItems((current) => current?.map((entry) => (entry.id === next.id ? next : entry)) ?? null)
                      }
                    />
                  ))}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-ink-3">
                        No checks with this result.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function HistoryRow({
  item,
  expanded,
  busy,
  onToggle,
  onDelete,
  onDownload,
  onNoteSaved,
}: {
  item: AssessmentSummary;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onNoteSaved: (next: AssessmentSummary) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <tr className="cursor-pointer" onClick={onToggle}>
        <td className="whitespace-nowrap">
          <span className="flex items-center gap-2">
            <Icon name="chevronDown" className={`h-3.5 w-3.5 text-ink-3 transition ${expanded ? "rotate-180" : ""}`} />
            {formatDateTime(item.created_at)}
            {item.note && <Icon name="pencil" className="h-3 w-3 text-ink-3" />}
          </span>
        </td>
        <td><ResultLabel prediction={item.prediction} /></td>
        <td className="tabular">{formatPercent(item.confidence)}</td>
        <td><LabChips labs={item.labs} /></td>
        <td className="text-right whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
          {confirming ? (
            <span className="inline-flex items-center gap-1">
              <button onClick={onDelete} disabled={busy} className="btn btn-sm btn-danger">Delete</button>
              <button onClick={() => setConfirming(false)} className="btn btn-sm btn-ghost">Cancel</button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <button onClick={onDownload} disabled={busy} className="btn btn-sm btn-ghost px-2" aria-label="Download PDF for this check" title="Download PDF">
                {busy ? <Spinner /> : <Icon name="download" className="h-4 w-4" />}
              </button>
              <button onClick={() => setConfirming(true)} className="btn btn-sm btn-ghost px-2 hover:text-serious" aria-label="Delete this check" title="Delete">
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="bg-surface-2/60">
            <div className="grid gap-5 py-2 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Lab values</p>
                <table className="mt-2 w-full text-sm">
                  <tbody>
                    {item.labs.map((lab) => {
                      const style = STATUS_STYLE[lab.status];
                      return (
                        <tr key={lab.feature} className="border-b border-line last:border-0">
                          <td className="py-2 pr-3 text-ink-1">{lab.label}</td>
                          <td className="tabular py-2 pr-3 text-ink-1">{lab.value} {lab.unit}</td>
                          <td className="tabular py-2 pr-3 text-xs text-ink-3">{lab.reference_low}–{lab.reference_high}</td>
                          <td className="py-2"><span className={`badge ${style.className}`}>{style.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Note for your doctor</p>
                <div className="mt-2">
                  <NoteEditor item={item} onSaved={onNoteSaved} />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function GuestHistory() {
  const [entries, setEntries] = useState<StoredAssessment[]>(() => loadHistory());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="History"
        title="Your screening history"
        description="Checks you run as a guest are kept only in this browser."
      />

      <div className="card overflow-hidden">
        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div>
            <h2 className="text-xl font-bold text-ink-1">Keep your history safe in an account</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              With a free account every check is saved securely, follows you to any device, powers
              your analytics dashboard and can be downloaded as a PDF report for your doctor.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/register?next=/history" className="btn btn-primary">Create free account</Link>
              <Link to="/login?next=/history" className="btn btn-secondary">Sign in</Link>
            </div>
          </div>
          <ul className="space-y-2.5 text-sm text-ink-2">
            {[
              "Trend charts for TSH, T3, T4 and more",
              "PDF report with reference ranges for consultations",
              "Notes on each check for your doctor",
              "Checks from this browser move over when you sign up",
            ].map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <Icon name="checkCircle" className="mt-0.5 h-4 w-4 shrink-0 text-good" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon="clock"
          title="No checks on this device"
          description="Run a check and it will appear here."
          action={<Link to="/screening" className="btn btn-secondary">Run a check</Link>}
        />
      ) : (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <p className="text-sm font-semibold text-ink-1">
              {entries.length} {entries.length === 1 ? "check" : "checks"} on this device
            </p>
            <button
              onClick={() => {
                clearHistory();
                setEntries([]);
              }}
              className="btn btn-sm btn-danger-ghost"
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Result</th>
                  <th scope="col">Confidence</th>
                  <th scope="col">Lab values</th>
                  <th scope="col"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</td>
                    <td><ResultLabel prediction={entry.prediction} /></td>
                    <td className="tabular">{formatPercent(entry.confidence)}</td>
                    <td><LabChips labs={entry.labs} /></td>
                    <td className="text-right">
                      <button
                        onClick={() => setEntries(deleteAssessment(entry.id))}
                        className="btn btn-sm btn-ghost px-2 hover:text-serious"
                        aria-label="Remove this check"
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
