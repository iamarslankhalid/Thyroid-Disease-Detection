import { useState } from "react";
import { api } from "../api";
import { clearHistory, loadHistory } from "../lib/storage";
import { Alert, Icon, Spinner } from "./ui";

/**
 * Offers to move checks a guest ran on this device into their account.
 *
 * Only the inputs are uploaded; the server re-scores each one, so imported
 * records are always results this server actually produced.
 */
export function ImportLocalHistory({ onImported }: { onImported: () => void }) {
  const [entries, setEntries] = useState(() => loadHistory());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  if (done !== null) {
    return (
      <Alert tone="success">
        Moved {done} {done === 1 ? "check" : "checks"} from this device into your account.
      </Alert>
    );
  }
  if (entries.length === 0) return null;

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      const response = await api.importAssessments(
        entries.slice(0, 100).map((entry) => ({ created_at: entry.createdAt, input: entry.input })),
      );
      clearHistory();
      setEntries([]);
      setDone(response.imported);
      onImported();
    } catch (cause) {
      console.error("Import of local history failed", cause);
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print rounded-xl border border-accent/25 bg-accent-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-2.5 text-sm text-ink-1">
          <Icon name="upload" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            <span className="font-semibold">
              {entries.length} {entries.length === 1 ? "check was" : "checks were"} saved on this
              device before you signed in.
            </span>{" "}
            Add them to your account so they appear in your history, analytics and reports.
          </span>
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              clearHistory();
              setEntries([]);
            }}
            className="btn btn-sm btn-ghost"
            disabled={busy}
          >
            Discard
          </button>
          <button onClick={handleImport} className="btn btn-sm btn-primary" disabled={busy}>
            {busy && <Spinner />}
            Add to my account
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-serious">{error}</p>}
    </div>
  );
}
