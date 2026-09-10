import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { AssessPage } from "./pages/AssessPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ModelPage } from "./pages/ModelPage";

type Theme = "light" | "dark" | "system";

function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) ?? "system",
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return [theme, setTheme];
}

const NAV = [
  { to: "/", label: "Screening", end: true },
  { to: "/history", label: "History", end: false },
  { to: "/model", label: "The model", end: false },
];

export default function App() {
  const [theme, setTheme] = useTheme();

  return (
    <div className="min-h-full">
      <header className="no-print sticky top-0 z-10 border-b border-line bg-surface-1/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 font-semibold text-ink-1">
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-lg text-sm"
              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
            >
              ⌁
            </span>
            Thyroid Screening
          </span>

          <nav className="flex gap-1 text-sm">
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
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="ml-auto rounded-lg border border-line px-2.5 py-1.5 text-sm text-ink-2 hover:border-line-strong"
            aria-label="Toggle colour theme"
          >
            {theme === "dark" ? "☾" : "☀"}
          </button>
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

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Routes>
          <Route path="/" element={<AssessPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/model" element={<ModelPage />} />
          <Route path="*" element={<AssessPage />} />
        </Routes>
      </main>

      <footer className="no-print border-t border-line px-4 py-6 text-center text-xs text-ink-3">
        Built on the Garvan Institute thyroid dataset (UCI / Kaggle). Source code on{" "}
        <a
          className="underline hover:text-ink-2"
          href="https://github.com/iamarslankhalid/Thyroid-Disease-Detection"
        >
          GitHub
        </a>
        .
      </footer>
    </div>
  );
}
