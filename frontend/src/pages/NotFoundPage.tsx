import { Link } from "react-router-dom";

/**
 * A real 404 rather than silently showing the screening form.
 *
 * A mistyped URL that quietly renders the home page makes a site feel broken in
 * a way people cannot name; saying what happened is kinder and takes one screen.
 */
export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <p className="text-sm font-medium tracking-wide text-ink-3 uppercase">Error 404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink-1">This page does not exist</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        The link may be out of date, or the address mistyped. Nothing is wrong with your
        saved assessments.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Run a screening
        </Link>
        <Link
          to="/about"
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink-2 hover:border-line-strong"
        >
          About this project
        </Link>
      </div>
    </div>
  );
}
