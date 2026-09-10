import { Link } from "react-router-dom";

const STEPS = [
  {
    title: "You enter what your report says",
    body: "Any of five thyroid blood tests, in the unit your laboratory printed. Nothing is required except your age and one result - missing tests are estimated, and the result says how many values it had to work with.",
  },
  {
    title: "A trained model compares you with 7,679 patients",
    body: "A random forest, chosen over four other models on cross-validated macro F1, scores your values against historical records with a confirmed diagnosis.",
  },
  {
    title: "You get the reasoning, not just a verdict",
    body: "Which of your numbers drove the answer, how they sit against typical ranges, and how far you are from the model giving a different answer entirely.",
  },
];

const FAQ = [
  {
    question: "Is this a diagnosis?",
    answer:
      "No. It says a set of numbers resembles a group in a historical dataset. Only a doctor can diagnose a thyroid disorder, and only with tests interpreted in the context of your symptoms and history.",
  },
  {
    question: "Where does the data come from?",
    answer:
      "The Garvan Institute thyroid dataset, collected at one Australian clinic in the 1980s and published through the UCI Machine Learning Repository. 9,172 records, of which 7,679 carry one of the three diagnoses this project classifies.",
  },
  {
    question: "Why does it ask for total T4 rather than free T4?",
    answer:
      "Because that is what the training data recorded. Modern reports usually give free T4, which is a different measurement - entering one in place of the other would produce a confident wrong answer, so the form asks you not to.",
  },
  {
    question: "What happens to my health data?",
    answer:
      "Your values are sent to the server to be scored and are not stored there. Your saved history lives only in this browser, which is why it disappears if you clear your browsing data or switch device.",
  },
  {
    question: "How accurate is it really?",
    answer:
      "On held-out data from the same 1980s cohort it reaches 0.939 macro F1 and finds 99.3% of hypothyroid cases. On patients today it would do worse: assays, reference ranges and the mix of people being tested have all changed, and the model has never been validated outside that one dataset.",
  },
];

export function AboutPage() {
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-2xl font-semibold text-ink-1 sm:text-3xl">About this project</h1>
        <p className="mt-3 max-w-3xl text-ink-2">
          A machine-learning screening aid for thyroid disorders, built as a demonstration
          of how a model can be made useful to the person whose results it is reading - and
          honest about what it does not know.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-ink-1">How it works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-line bg-surface-1 p-5">
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold"
                style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {index + 1}
              </span>
              <h3 className="mt-3 text-sm font-semibold text-ink-1">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-1">Common questions</h2>
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
          <li>It is not a medical device and has no regulatory approval of any kind.</li>
          <li>It was trained on data from a single clinic in one country, four decades ago.</li>
          <li>
            It has never been validated on patients from any other hospital, country or era.
          </li>
          <li>
            Hyperthyroidism is rare in the training data, so that class is the least reliable
            of the three.
          </li>
          <li>
            A result that says "Negative" does not rule anything out. If you have symptoms,
            see a doctor regardless of what this page says.
          </li>
        </ul>
        <p className="mt-4 text-sm text-ink-2">
          The full performance breakdown, including the confusion matrix, is on the{" "}
          <Link to="/model" className="font-medium text-accent hover:underline">
            model page
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-1">Built with</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          scikit-learn for the model, FastAPI for the service, React and TypeScript for this
          interface. The training run generates its own model card and metrics, and the test
          suite covers the data cleaning, the API contract and the unit conversions. Source
          code is on{" "}
          <a
            href="https://github.com/iamarslankhalid/Thyroid-Disease-Detection"
            className="font-medium text-accent hover:underline"
          >
            GitHub
          </a>
          .
        </p>
      </section>
    </div>
  );
}
