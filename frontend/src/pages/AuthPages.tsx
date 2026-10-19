import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Icon, Logo, Spinner } from "../components/ui";
import { useAuth } from "../lib/useAuth";
import { BRAND } from "../lib/content";

/** Only same-site paths are honoured, so a crafted link cannot bounce users off-site. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="animate-fade-in">
      <div className="flex flex-col items-center text-center">
        <Logo className="h-11 w-11" />
        <h1 className="mt-5 text-2xl font-bold text-ink-1">{title}</h1>
        <p className="mt-1.5 text-sm text-ink-2">{subtitle}</p>
      </div>
      <div className="card mt-8 p-6 shadow-[var(--shadow-md)] sm:p-8">{children}</div>
      <p className="mt-6 text-center text-sm text-ink-2">{footer}</p>
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        className="input pr-16"
        required
      />
      <button
        type="button"
        onClick={() => setVisible((shown) => !shown)}
        className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-ink-3 hover:text-ink-1"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "signed-in") return <Navigate to={next} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(next, { replace: true });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle={`Sign in to your ${BRAND.name} account`}
      footer={
        <>
          New to {BRAND.name}?{" "}
          <Link to={`/register${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="link">
            Create a free account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <label htmlFor={`${id}-email`} className="label">Email address</label>
          <input
            id={`${id}-email`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="input"
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <label htmlFor={`${id}-password`} className="label">Password</label>
          <PasswordInput id={`${id}-password`} value={password} onChange={setPassword} autoComplete="current-password" />
        </div>
        <button type="submit" disabled={busy || !email || !password} className="btn btn-primary btn-lg w-full">
          {busy && <Spinner />}
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}

function passwordProblems(password: string): string[] {
  const problems = [];
  if (password.length < 8) problems.push("at least 8 characters");
  if (!/[A-Za-z]/.test(password)) problems.push("a letter");
  if (!/\d/.test(password)) problems.push("a number");
  return problems;
}

export function RegisterPage() {
  const { register, status } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const id = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  if (status === "signed-in") return <Navigate to={next} replace />;

  const problems = passwordProblems(password);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!name.trim() || !email.trim() || problems.length > 0 || !agreed) return;
    setBusy(true);
    setError(null);
    try {
      await register(name.trim(), email.trim(), password);
      navigate(next, { replace: true });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Save every check, track your trends and share reports with your doctor."
      footer={
        <>
          Already have an account?{" "}
          <Link to={`/login${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="link">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <label htmlFor={`${id}-name`} className="label">Full name</label>
          <input
            id={`${id}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            className="input"
            placeholder="As it should appear on your reports"
            aria-invalid={(touched && !name.trim()) || undefined}
            required
          />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className="label">Email address</label>
          <input
            id={`${id}-email`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="input"
            placeholder="you@example.com"
            aria-invalid={(touched && !email.trim()) || undefined}
            required
          />
        </div>
        <div>
          <label htmlFor={`${id}-password`} className="label">Password</label>
          <PasswordInput
            id={`${id}-password`}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            invalid={touched && problems.length > 0}
          />
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {["at least 8 characters", "a letter", "a number"].map((rule) => {
              const met = password.length > 0 && !problems.includes(rule);
              return (
                <li key={rule} className={`flex items-center gap-1 ${met ? "text-good" : "text-ink-3"}`}>
                  <Icon name={met ? "checkCircle" : "info"} className="h-3.5 w-3.5" />
                  {rule}
                </li>
              );
            })}
          </ul>
        </div>
        <label className="flex items-start gap-3 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            I understand {BRAND.name} provides screening support and is not a substitute for
            advice from a doctor.
          </span>
        </label>
        {touched && !agreed && (
          <p className="-mt-3 text-xs text-serious">Please confirm to continue.</p>
        )}
        <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
          {busy && <Spinner />}
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthCard>
  );
}
