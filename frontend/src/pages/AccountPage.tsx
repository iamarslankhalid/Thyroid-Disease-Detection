import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { ReportDownload } from "../components/ReportDownload";
import { Alert, Icon, PageHeader, Spinner, type IconName } from "../components/ui";
import { useAuth } from "../lib/useAuth";
import { formatDate } from "../lib/classes";

function Section({
  icon,
  title,
  description,
  children,
  danger = false,
}: {
  icon: IconName;
  title: string;
  description: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section className={`card grid gap-6 p-6 sm:p-8 lg:grid-cols-[16rem_1fr] ${danger ? "border-serious/30" : ""}`}>
      <div>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            danger ? "bg-serious-soft text-serious" : "bg-accent-soft text-accent"
          }`}
        >
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <h2 className="mt-3 font-semibold text-ink-1">{title}</h2>
        <p className="mt-1 text-sm text-ink-2">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function ProfileForm() {
  const { user, setUser } = useAuth();
  const id = useId();
  const [name, setName] = useState(user?.full_name ?? "");
  const [dob, setDob] = useState(user?.date_of_birth ?? "");
  const [sex, setSex] = useState<"" | "male" | "female">(user?.sex ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const updated = await api.updateProfile({
        full_name: name.trim(),
        date_of_birth: dob || null,
        sex: sex || null,
      });
      setUser(updated);
      setMessage({ tone: "success", text: "Profile saved." });
    } catch (cause) {
      setMessage({ tone: "error", text: (cause as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-name`} className="label">Full name</label>
          <input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} className="input" autoComplete="name" required />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-email`} className="label">Email address</label>
          <input id={`${id}-email`} value={user?.email ?? ""} className="input bg-surface-2 text-ink-3" disabled />
        </div>
        <div>
          <label htmlFor={`${id}-dob`} className="label">Date of birth</label>
          <input
            id={`${id}-dob`}
            type="date"
            value={dob}
            onChange={(event) => setDob(event.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="input"
          />
        </div>
        <div>
          <label htmlFor={`${id}-sex`} className="label">Sex</label>
          <select id={`${id}-sex`} value={sex} onChange={(event) => setSex(event.target.value as typeof sex)} className="input">
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-ink-3">
        Your name, date of birth and sex are printed on the PDF reports you download, so your
        doctor can match them to your records.
      </p>
      <button type="submit" disabled={busy || !name.trim()} className="btn btn-primary">
        {busy && <Spinner />}
        Save profile
      </button>
    </form>
  );
}

function PasswordForm() {
  const id = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (next !== confirm) {
      setMessage({ tone: "error", text: "The new passwords do not match." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.changePassword({ current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage({ tone: "success", text: "Password changed. Other devices have been signed out." });
    } catch (cause) {
      setMessage({ tone: "error", text: (cause as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <div>
        <label htmlFor={`${id}-current`} className="label">Current password</label>
        <input id={`${id}-current`} type="password" value={current} onChange={(event) => setCurrent(event.target.value)} className="input" autoComplete="current-password" required />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-new`} className="label">New password</label>
          <input id={`${id}-new`} type="password" value={next} onChange={(event) => setNext(event.target.value)} className="input" autoComplete="new-password" required />
        </div>
        <div>
          <label htmlFor={`${id}-confirm`} className="label">Confirm new password</label>
          <input id={`${id}-confirm`} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="input" autoComplete="new-password" required />
        </div>
      </div>
      <p className="text-xs text-ink-3">At least 8 characters, with a letter and a number.</p>
      <button type="submit" disabled={busy || !current || !next || !confirm} className="btn btn-primary">
        {busy && <Spinner />}
        Update password
      </button>
    </form>
  );
}

function DataControls() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setBusy(true);
    setError(null);
    try {
      await api.exportAccount();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-ink-1">PDF report for your doctor</h3>
        <p className="mt-0.5 text-sm text-ink-2">Your details, latest results, trends and full history.</p>
        <div className="mt-3">
          <ReportDownload compact />
        </div>
      </div>
      <div className="border-t border-line pt-6">
        <h3 className="text-sm font-semibold text-ink-1">Export all data</h3>
        <p className="mt-0.5 text-sm text-ink-2">
          A machine-readable JSON file with your profile and every saved check.
        </p>
        <button onClick={exportData} disabled={busy} className="btn btn-secondary mt-3">
          {busy ? <Spinner /> : <Icon name="download" className="h-4 w-4" />}
          Download JSON
        </button>
        {error && <p className="mt-2 text-xs text-serious">{error}</p>}
      </div>
    </div>
  );
}

function DeleteAccount() {
  const { clearSession } = useAuth();
  const navigate = useNavigate();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      clearSession();
      navigate("/", { replace: true });
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div>
        <p className="text-sm text-ink-2">
          Permanently delete your account, all saved checks and notes. This cannot be undone.
        </p>
        <button onClick={() => setOpen(true)} className="btn btn-danger mt-4">
          <Icon name="trash" className="h-4 w-4" />
          Delete my account
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleDelete} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-sm text-ink-2">
        Enter your password to confirm. Consider downloading your PDF report or data export first.
      </p>
      <div className="max-w-sm">
        <label htmlFor={`${id}-password`} className="label">Password</label>
        <input id={`${id}-password`} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input" autoComplete="current-password" autoFocus required />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !password} className="btn btn-danger">
          {busy && <Spinner />}
          Permanently delete
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

export function AccountPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Account settings"
        description={user ? `Signed in as ${user.email} · member since ${formatDate(user.created_at)}` : undefined}
      />
      <Section icon="user" title="Profile" description="How you appear on your reports.">
        <ProfileForm />
      </Section>
      <Section icon="lock" title="Password" description="Changing it signs out every other device.">
        <PasswordForm />
      </Section>
      <Section icon="document" title="Your data" description="Reports for consultations and a full export of everything we hold.">
        <DataControls />
      </Section>
      <Section icon="trash" title="Delete account" description="Remove your account and history for good." danger>
        <DeleteAccount />
      </Section>
    </div>
  );
}
