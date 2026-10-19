import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Icon, Logo, Spinner } from "./components/ui";
import { api } from "./api";
import { useAuth } from "./lib/useAuth";
import { BRAND } from "./lib/content";
import { AboutPage } from "./pages/AboutPage";
import { AccountPage } from "./pages/AccountPage";
import { AssessPage } from "./pages/AssessPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { ModelPage } from "./pages/ModelPage";
import { NotFoundPage } from "./pages/NotFoundPage";

type Theme = "light" | "dark" | "system";

function resolveDark(theme: Theme): boolean {
  if (theme === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches;
  return theme === "dark";
}

function useTheme(): [boolean, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("theme") as Theme) ?? "system";
    } catch {
      return "system";
    }
  });
  const [isDark, setDark] = useState(() => resolveDark(theme));

  useEffect(() => {
    const apply = () => {
      const dark = resolveDark(theme);
      setDark(dark);
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    };
    apply();
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* private browsing - the choice simply will not persist */
    }
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  return [isDark, () => setTheme(isDark ? "light" : "dark")];
}

const TITLES: { path: string; title: string; exact?: boolean }[] = [
  { path: "/", title: `${BRAND.name} — ${BRAND.tagline}`, exact: true },
  { path: "/screening", title: "New check" },
  { path: "/dashboard", title: "Dashboard" },
  { path: "/history", title: "History" },
  { path: "/account", title: "Account" },
  { path: "/login", title: "Sign in" },
  { path: "/register", title: "Create account" },
  { path: "/model", title: "Our model" },
  { path: "/about", title: "About" },
];

function useDocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = TITLES.find((item) =>
      item.exact ? pathname === item.path : pathname.startsWith(item.path),
    );
    if (!match) document.title = `Page not found · ${BRAND.name}`;
    else document.title = match.path === "/" ? match.title : `${match.title} · ${BRAND.name}`;
  }, [pathname]);
}

/** Pages that only make sense with an account send guests to sign in first. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") {
    return (
      <div className="flex justify-center py-24 text-ink-3">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (status === "signed-out") {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <>{children}</>;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-line bg-surface-1 py-1 pr-2.5 pl-1 text-sm text-ink-1 transition hover:border-line-strong"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-ink">
          {initials(user.full_name) || "?"}
        </span>
        <span className="hidden max-w-[9rem] truncate font-medium lg:inline">
          {user.full_name.split(" ")[0]}
        </span>
        <Icon name="chevronDown" className="h-3.5 w-3.5 text-ink-3" />
      </button>
      {open && (
        <div
          role="menu"
          className="animate-pop-in absolute right-0 z-50 mt-3 w-60 overflow-hidden rounded-2xl border border-line bg-surface-1 shadow-[var(--shadow-lg)]"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink-1">{user.full_name}</p>
            <p className="truncate text-xs text-ink-3">{user.email}</p>
          </div>
          <div className="p-1.5">
            {(
              [
                { to: "/dashboard", label: "Dashboard", icon: "chart" },
                { to: "/history", label: "History", icon: "clock" },
                { to: "/account", label: "Account settings", icon: "user" },
              ] as const
            ).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink-1"
              >
                <Icon name={item.icon} className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            <button
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                await logout();
                navigate("/");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-surface-2 hover:text-ink-1"
            >
              <Icon name="logout" className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Whether the page has scrolled, plus a ref whose width tracks scroll progress. */
function useScrollState(threshold = 12) {
  const [scrolled, setScrolled] = useState(() => window.scrollY > threshold);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > threshold);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [threshold]);

  return { scrolled, progressRef };
}

type ServiceState = "checking" | "online" | "degraded" | "offline";

const SERVICE_LABEL: Record<ServiceState, { text: string; title: string; tone: string }> = {
  checking: { text: "Connecting", title: "Checking the screening service", tone: "text-ink-3" },
  online: { text: "Model online", title: "The screening model is loaded and ready", tone: "text-good" },
  degraded: { text: "Model unavailable", title: "The server is up but the model did not load", tone: "text-warning" },
  offline: { text: "Offline", title: "The screening service cannot be reached", tone: "text-serious" },
};

/** Live status of the prediction service, re-checked every minute. */
function ServiceStatus() {
  const [state, setState] = useState<ServiceState>("checking");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const health = await api.health();
        if (!cancelled) setState(health.model_loaded ? "online" : "degraded");
      } catch (error) {
        console.error("Health check failed", error);
        if (!cancelled) setState("offline");
      }
    };
    void check();
    const timer = window.setInterval(check, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const label = SERVICE_LABEL[state];
  return (
    <span className={`status-pill hidden xl:inline-flex ${label.tone}`} title={label.title} role="status">
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${state === "online" ? "pulse-dot" : ""}`} />
      {label.text}
    </span>
  );
}

interface NavItem {
  to: string;
  label: string;
}

/**
 * Desktop navigation with two sliding highlights: one parked under the current
 * page, one following the pointer. Both are positioned by writing styles
 * directly, so moving them never re-renders the header.
 */
function NavTrack({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const trackRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLSpanElement>(null);
  const hoverRef = useRef<HTMLSpanElement>(null);
  const itemsKey = items.map((item) => item.to).join("|");

  const place = (marker: HTMLSpanElement | null, target: HTMLElement | null) => {
    if (!marker) return;
    if (!target) {
      marker.style.opacity = "0";
      return;
    }
    marker.style.width = `${target.offsetWidth}px`;
    marker.style.transform = `translateX(${target.offsetLeft}px)`;
    marker.style.opacity = "1";
  };

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => place(activeRef.current, track.querySelector<HTMLElement>('a[aria-current="page"]'));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [pathname, itemsKey]);

  return (
    <nav
      ref={trackRef}
      aria-label="Main"
      className="nav-track hidden md:flex"
      onMouseOver={(event) => place(hoverRef.current, (event.target as HTMLElement).closest("a"))}
      onMouseLeave={() => place(hoverRef.current, null)}
    >
      <span ref={hoverRef} className="nav-hover" aria-hidden />
      <span ref={activeRef} className="nav-active" aria-hidden />
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className="nav-link">
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Header({ isDark, toggleTheme }: { isDark: boolean; toggleTheme: () => void }) {
  const { status } = useAuth();
  const { pathname } = useLocation();
  const { scrolled, progressRef } = useScrollState();
  // Remembering which page the menu was opened on closes it on navigation.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const mobileOpen = openedOn === pathname;
  const signedIn = status === "signed-in";

  const nav: NavItem[] = signedIn
    ? [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/screening", label: "New check" },
        { to: "/history", label: "History" },
        { to: "/model", label: "Our model" },
      ]
    : [
        { to: "/screening", label: "Check results" },
        { to: "/model", label: "Our model" },
        { to: "/about", label: "About" },
      ];

  const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink-1"
    }`;

  return (
    <header className="no-print sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <div
        data-scrolled={scrolled}
        className="header-bar mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-3 data-[scrolled=true]:h-14 sm:px-4"
      >
        <div className="flex items-center gap-6">
          <Link to={signedIn ? "/dashboard" : "/"} className="group flex items-center gap-2.5">
            <span className="logo-mark">
              <Logo />
            </span>
            <span className="font-display text-[1.05rem] font-bold tracking-tight text-ink-1">
              {BRAND.name}
            </span>
          </Link>
          <NavTrack items={nav} />
        </div>

        <div className="flex items-center gap-2">
          <ServiceStatus />
          <button
            onClick={toggleTheme}
            className="btn btn-ghost h-9 w-9 overflow-hidden rounded-xl p-0"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          >
            <span key={isDark ? "sun" : "moon"} className="animate-spin-in">
              <Icon name={isDark ? "sun" : "moon"} className="h-[18px] w-[18px]" />
            </span>
          </button>
          {status === "signed-out" && (
            <>
              <Link to="/login" className="btn btn-ghost hidden sm:inline-flex">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary hidden rounded-xl sm:max-md:inline-flex lg:inline-flex">
                Create free account
              </Link>
            </>
          )}
          {signedIn && <UserMenu />}
          <button
            onClick={() => setOpenedOn(mobileOpen ? null : pathname)}
            className="btn btn-ghost h-9 w-9 p-0 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <span key={mobileOpen ? "close" : "menu"} className="animate-spin-in">
              <Icon name={mobileOpen ? "close" : "menu"} className="h-5 w-5" />
            </span>
          </button>
        </div>
        <div ref={progressRef} className="scroll-progress" aria-hidden />
      </div>

      {mobileOpen && (
        <nav
          aria-label="Mobile"
          className="header-bar animate-slide-down mx-auto mt-2 max-w-6xl p-2 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {nav.map((item, index) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={(state) => `${mobileNavClass(state)} animate-slide-down`}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                {item.label}
              </NavLink>
            ))}
            {signedIn ? (
              <NavLink to="/account" className={mobileNavClass}>
                Account settings
              </NavLink>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link to="/login" className="btn btn-secondary">
                  Sign in
                </Link>
                <Link to="/register" className="btn btn-primary">
                  Create account
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="no-print border-t border-line bg-surface-1">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="font-display font-bold text-ink-1">{BRAND.name}</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-3">
            Clear, explained screening for thyroid blood tests, with history, analytics and
            doctor-ready reports.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-1">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-3">
            <li><Link to="/screening" className="hover:text-ink-1">Check your results</Link></li>
            <li><Link to="/dashboard" className="hover:text-ink-1">Dashboard</Link></li>
            <li><Link to="/history" className="hover:text-ink-1">History &amp; reports</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-1">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-3">
            <li><Link to="/about" className="hover:text-ink-1">About</Link></li>
            <li><Link to="/model" className="hover:text-ink-1">How our model works</Link></li>
            <li><Link to="/about#faq" className="hover:text-ink-1">FAQ</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
          <p className="max-w-xl sm:text-right">
            {BRAND.name} provides screening support and does not replace professional medical
            advice, diagnosis or treatment.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const [isDark, toggleTheme] = useTheme();
  const { pathname } = useLocation();
  useDocumentTitle();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  return (
    <div className="flex min-h-full flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
      >
        Skip to content
      </a>

      <Header isDark={isDark} toggleTheme={toggleTheme} />

      <main
        id="main"
        className={`mx-auto w-full flex-1 px-4 sm:px-6 ${
          isAuthPage ? "max-w-md py-12 sm:py-16" : "max-w-6xl py-8 sm:py-10"
        }`}
      >
        <div key={pathname} className="animate-page-in">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/screening" element={<AssessPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/model" element={<ModelPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </div>
      </main>

      <Footer />
    </div>
  );
}
