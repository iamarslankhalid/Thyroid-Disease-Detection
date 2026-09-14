import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BRAND } from "./lib/content";
import { AboutPage } from "./pages/AboutPage";
import { AssessPage } from "./pages/AssessPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LandingPage } from "./pages/LandingPage";
import { ModelPage } from "./pages/ModelPage";
import { NotFoundPage } from "./pages/NotFoundPage";

type Theme = "light" | "dark" | "system";

function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("theme") as Theme) ?? "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* private browsing - the choice simply will not persist */
    }
  }, [theme]);

  return [theme, setTheme];
}

/** Every route, with the browser-tab title that belongs to it. */
const ROUTES = [
  { to: "/", end: true, title: `${BRAND.name} — ${BRAND.tagline}`, nav: null },
  { to: "/screening", end: false, title: "Check your report", nav: null },
  { to: "/history", end: false, title: "Your history", nav: "History" },
  { to: "/model", end: false, title: "How this model works", nav: "The model" },
  { to: "/about", end: false, title: "About", nav: "About" },
];

const NAV = ROUTES.filter((route) => route.nav !== null);

/** Keeps the browser tab and history entries meaningful per route. */
function useDocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = ROUTES.find((item) =>
      item.end ? pathname === item.to : pathname.startsWith(item.to),
    );
    // The landing page carries the full name and tagline; inner pages are
    // suffixed with the product name so a tab is identifiable either way.
    if (!match) {
      document.title = `Page not found · ${BRAND.name}`;
    } else {
      document.title = match.to === "/" ? match.title : `${match.title} · ${BRAND.name}`;
    }
  }, [pathname]);
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden focusable="false">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <g fill="#ffffff">
        <rect x="14.7" y="6.4" width="2.6" height="6.6" rx="1.3" />
        <ellipse cx="11.9" cy="18" rx="4.6" ry="7" transform="rotate(-14 11.9 18)" />
        <ellipse cx="20.1" cy="18" rx="4.6" ry="7" transform="rotate(14 20.1 18)" />
        <rect x="12" y="14.8" width="8" height="5" rx="2.5" />
      </g>
    </svg>
  );
}

export default function App() {
  const [theme, setTheme] = useTheme();
  useDocumentTitle();

  return (
    <div className="flex min-h-full flex-col">
      {/* First stop for a keyboard user, so the nav can be skipped. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
      >
        Skip to content
      </a>

      <header className="no-print sticky top-0 z-10 border-b border-line bg-surface-1/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-ink-1"
          >
            <Logo />
            {BRAND.name}
          </Link>

          <nav aria-label="Main" className="flex gap-1 text-sm">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 transition ${
                    isActive
                      ? "bg-surface-2 font-medium text-ink-1"
                      : "text-ink-2 hover:text-ink-1"
                  }`
                }
              >
                {item.nav}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/screening"
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold whitespace-nowrap text-accent-ink transition hover:opacity-90 sm:px-4"
            >
              Check my report
            </Link>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-lg border border-line px-2.5 py-1.5 text-sm text-ink-2 hover:border-line-strong"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? "☾" : "☀"}
            </button>
          </div>
        </div>
      </header>

      {/* Shown on every page and in print: the claim this tool must never make
          is that it diagnoses anything. */}
      <p
        className="border-b px-4 py-2 text-center text-xs"
        style={{
          borderColor: "var(--border-subtle)",
          backgroundColor: "var(--surface-2)",
          color: "var(--ink-2)",
        }}
      >
        Educational project — not a medical device, and not a substitute for a doctor.
      </p>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/screening" element={<AssessPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/model" element={<ModelPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="no-print border-t border-line bg-surface-1">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 text-sm sm:grid-cols-3 sm:px-6">
          <div>
            <p className="font-semibold text-ink-1">{BRAND.name}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
              An educational demonstration of explainable machine learning for thyroid
              blood tests. Not a medical device.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">
              This project
            </p>
            <ul className="mt-2 space-y-1.5 text-xs">
              <li>
                <Link to="/about" className="text-ink-3 hover:text-ink-1">
                  About the project
                </Link>
              </li>
              <li>
                <Link to="/model" className="text-ink-3 hover:text-ink-1">
                  Model performance
                </Link>
              </li>
              <li>
                <a href="/docs" className="text-ink-3 hover:text-ink-1">
                  API documentation
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">Source</p>
            <ul className="mt-2 space-y-1.5 text-xs">
              <li>
                <a
                  href="https://github.com/iamarslankhalid/Thyroid-Disease-Detection"
                  className="text-ink-3 hover:text-ink-1"
                >
                  GitHub repository
                </a>
              </li>
              <li>
                <a
                  href="https://archive.ics.uci.edu/dataset/102/thyroid+disease"
                  className="text-ink-3 hover:text-ink-1"
                >
                  Garvan Institute dataset
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line px-4 py-4 text-center text-xs text-ink-3">
          Built by Muhammad Arslan Khalid and Zainab Nadeem.
        </div>
      </footer>
    </div>
  );
}
