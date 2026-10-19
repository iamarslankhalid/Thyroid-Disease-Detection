import { Link } from "react-router-dom";

/** A real 404 rather than silently showing another page. */
export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-display text-6xl font-extrabold text-accent">404</p>
      <h1 className="mt-4 text-2xl font-bold text-ink-1">This page does not exist</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        The link may be out of date, or the address mistyped. Your saved checks are safe.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/screening" className="btn btn-primary">
          Check my results
        </Link>
        <Link to="/" className="btn btn-secondary">
          Back to home
        </Link>
      </div>
    </div>
  );
}
