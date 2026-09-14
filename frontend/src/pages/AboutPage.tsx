import { Link } from "react-router-dom";
import { BRAND, FAQ, LIMITATIONS } from "../lib/content";

/**
 * The reference page, for someone who wants the detail behind the claims.
 *
 * The landing page owns the pitch and the three-step explanation; this page
 * owns the data, the limits and the full set of questions. Neither repeats the
 * other, and both read from lib/content so they cannot contradict each other.
 */
export function AboutPage() {
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-2xl font-semibold text-ink-1 sm:text-3xl">About {BRAND.name}</h1>
        <p className="mt-3 max-w-3xl text-ink-2">
          A machine-learning screening aid for thyroid blood tests, built to demonstrate
          that a model can be genuinely useful to the person whose results it is reading —
          and honest about what it does not know. If you have not seen{" "}
          <Link to="/" className="font-medium text-accent hover:underline">
            how it works
          </Link>
          , start there.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-ink-1">The data behind it</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-2">
          <p>
            The Garvan Institute thyroid dataset, collected at a single Australian clinic
            during the 1980s and published through the UCI Machine Learning Repository. It
            holds 9,172 patient records with 31 attributes: demographics, medical history,
            and the thyroid function tests of the day.
          </p>
          <p>
            Of those, 7,679 carry a diagnosis belonging to one of the three classes this
            project predicts — negative, hypothyroid or hyperthyroid. The rest describe
            conditions such as binding-protein anomalies or replacement therapy, and are
            excluded rather than forced into a class they do not belong to.
          </p>
          <p>
            Four columns are deliberately left out of the model, including the referring
            clinic, which correlates with diagnosis in this dataset but is meaningless for
            a new patient. The{" "}
            <Link to="/model" className="font-medium text-accent hover:underline">
              model page
            </Link>{" "}
            lists each exclusion and the reason for it.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-1">Questions</h2>
        <dl className="mt-4 space-y-3">
          {FAQ.map((item) => (
            <div
              key={item.question}
              className="rounded-2xl border border-line bg-surface-1 p-5"
            >
              <dt className="text-sm font-semibold text-ink-1">{item.question}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-ink-2">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        className="rounded-2xl border p-6"
        style={{ borderColor: "var(--status-warning)", backgroundColor: "var(--surface-1)" }}
      >
        <h2 className="text-lg font-semibold text-ink-1">Limitations, stated plainly</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">
          {LIMITATIONS.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-1">How it is built</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          scikit-learn for the model, FastAPI for the service, React and TypeScript for
          this interface. Preprocessing travels inside the saved pipeline, so serving
          cannot apply a different transformation than training did. The training run
          writes its own model card and metrics, and the test suite covers the data
          cleaning, the API contract and the unit conversions. Source code is on{" "}
          <a
            href="https://github.com/iamarslankhalid/Thyroid-Disease-Detection"
            className="font-medium text-accent hover:underline"
          >
            GitHub
          </a>
          .
        </p>
        <p className="mt-4 text-sm text-ink-2">
          Built by Muhammad Arslan Khalid and Zainab Nadeem.
        </p>
      </section>
    </div>
  );
}
