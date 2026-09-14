import { Link } from "react-router-dom";
import { BRAND, FAQ, FEATURES, LIMITATIONS, STEPS } from "../lib/content";

/**
 * What someone sees before they trust the tool with their blood test.
 *
 * The order answers the questions a visitor actually arrives with: what is
 * this, why would I need it, how does it work, what makes it different, can I
 * trust it, and only then - shall I try it. The limitations sit above the final
 * call to action rather than buried in a footer, because a health tool that
 * hides its caveats until after you have used it has hidden them.
 */
export function LandingPage() {
  return (
    <div className="space-y-20 sm:space-y-28">
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <Trust />
      <Questions />
      <FinalCall />
    </div>
  );
}

function Hero() {
  return (
    <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">
          Free · No account · Private
        </p>
        <h1 className="mt-4 text-4xl leading-[1.1] font-semibold text-balance text-ink-1 sm:text-5xl">
          {BRAND.tagline}
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
          Your lab report is a column of numbers. {BRAND.name} reads them the way a
          screening tool should: it tells you what they suggest, which of your values drove
          the answer, and how close you are to a different one.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/screening"
            className="rounded-lg bg-accent px-6 py-3.5 font-semibold text-accent-ink transition hover:opacity-90"
          >
            Check my report
          </Link>
          <a
            href="#how-it-works"
            className="rounded-lg border border-line px-6 py-3.5 font-medium text-ink-2 transition hover:border-line-strong hover:text-ink-1"
          >
            See how it works
          </a>
        </div>

        <p className="mt-5 text-sm text-ink-3">
          Takes about a minute. Nothing you enter is stored on a server.
        </p>
      </div>

      <ExampleResult />
    </section>
  );
}

/**
 * A still of the real output, built from the same tokens as the live result.
 *
 * Labelled as an example in the markup and on screen: a product shot that could
 * be mistaken for a real person's screening would be a lie about both the data
 * and the diagnosis.
 */
function ExampleResult() {
  return (
    <figure className="rounded-2xl border border-line bg-surface-1 p-6 shadow-sm">
      <figcaption className="text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
        Example result
      </figcaption>

      <div className="mt-4 flex items-baseline gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
          style={{ backgroundColor: "var(--accent-soft)", color: "var(--status-warning)" }}
        >
          !
        </span>
        <div>
          <p className="text-lg font-semibold text-ink-1">Signs of an underactive thyroid</p>
          <p className="tabular text-sm text-ink-3">94.2% confidence · 6 of 7 inputs given</p>
        </div>
      </div>

      <dl className="mt-5 space-y-3 border-t border-line pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-sm text-ink-2">TSH</dt>
          <dd className="tabular text-sm text-ink-1">
            18.4 mU/L
            <span className="ml-2 text-xs" style={{ color: "var(--status-warning)" }}>
              above range
            </span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-sm text-ink-2">Total T4</dt>
          <dd className="tabular text-sm text-ink-1">
            52 nmol/L
            <span className="ml-2 text-xs" style={{ color: "var(--status-warning)" }}>
              below range
            </span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-sm text-ink-2">T4 uptake</dt>
          <dd className="tabular text-sm text-ink-1">
            0.99 ratio
            <span className="ml-2 text-xs" style={{ color: "var(--status-good)" }}>
              in range
            </span>
          </dd>
        </div>
      </dl>

      <p className="mt-5 rounded-lg bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-2">
        If your <span className="font-medium text-ink-1">TSH</span> were{" "}
        <span className="font-semibold text-ink-1">below 4.46 mU/L</span>, this would read{" "}
        <span className="font-semibold" style={{ color: "var(--status-good)" }}>
          Negative
        </span>
        .
      </p>
    </figure>
  );
}

function Problem() {
  const points = [
    {
      title: "A number with no meaning attached",
      body: 'Your report says TSH 6.2. Above the range printed beside it — but by how much, and does it matter? "Consult your physician" is not an answer you can act on tonight.',
    },
    {
      title: "Every laboratory writes it differently",
      body: "8.1 µg/dL and 104 nmol/L are the same thyroxine result. Compare one against the other's reference range and a perfectly healthy person looks seriously ill.",
    },
    {
      title: "Borderline is the normal case",
      body: "Most results are not dramatic. What people want to know is which way they are leaning and how far from the line they sit — precisely what a single verdict hides.",
    },
  ];

  return (
    <section>
      <h2 className="text-2xl font-semibold text-balance text-ink-1 sm:text-3xl">
        Getting the results is easy. Understanding them is not.
      </h2>
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {points.map((point) => (
          <div key={point.title}>
            <h3 className="text-sm font-semibold text-ink-1">{point.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{point.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24">
      <h2 className="text-2xl font-semibold text-ink-1 sm:text-3xl">How it works</h2>
      <ol className="mt-8 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="rounded-2xl border border-line bg-surface-1 p-6 shadow-sm"
          >
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {index + 1}
            </span>
            <h3 className="mt-4 font-semibold text-ink-1">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Features() {
  return (
    <section>
      <h2 className="text-2xl font-semibold text-balance text-ink-1 sm:text-3xl">
        Built to be understood, not just obeyed
      </h2>
      <p className="mt-3 max-w-2xl text-ink-2">
        A screening tool that only produces a label asks you to take it on faith. Every
        result here comes with its reasoning attached.
      </p>

      <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="border-t border-line pt-5">
            <h3 className="font-semibold text-ink-1">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{feature.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="rounded-2xl border border-line bg-surface-1 p-6 shadow-sm sm:p-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
        <div>
          <h2 className="text-2xl font-semibold text-balance text-ink-1 sm:text-3xl">
            What it cannot do
          </h2>
          <p className="mt-3 text-ink-2">
            The honest limits matter more than the accuracy figure. Everything below is
            stated before you use the tool, not after.
          </p>
          <Link
            to="/model"
            className="mt-5 inline-block font-medium text-accent hover:underline"
          >
            See the full performance breakdown →
          </Link>
        </div>

        <ul className="space-y-3">
          {LIMITATIONS.map((limitation) => (
            <li key={limitation} className="flex gap-3 text-sm leading-relaxed text-ink-2">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: "var(--status-warning)" }}
              />
              {limitation}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Questions() {
  return (
    <section>
      <h2 className="text-2xl font-semibold text-ink-1 sm:text-3xl">Common questions</h2>
      <dl className="mt-8 space-y-6">
        {FAQ.slice(0, 4).map((item) => (
          <div key={item.question} className="border-t border-line pt-5">
            <dt className="font-semibold text-ink-1">{item.question}</dt>
            <dd className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
              {item.answer}
            </dd>
          </div>
        ))}
      </dl>
      <Link to="/about" className="mt-6 inline-block font-medium text-accent hover:underline">
        More about the project and its data →
      </Link>
    </section>
  );
}

function FinalCall() {
  return (
    <section className="rounded-2xl border border-line bg-surface-2 p-8 text-center sm:p-12">
      <h2 className="text-2xl font-semibold text-balance text-ink-1 sm:text-3xl">
        Have your lab report to hand?
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-ink-2">
        One value is enough to start. You will get the reasoning behind the result, not
        just the result.
      </p>
      <Link
        to="/screening"
        className="mt-7 inline-block rounded-lg bg-accent px-7 py-3.5 font-semibold text-accent-ink transition hover:opacity-90"
      >
        Check my report
      </Link>
      <p className="mt-5 text-xs text-ink-3">
        {BRAND.name} is an educational project, not a medical device. Always discuss your
        results with a doctor.
      </p>
    </section>
  );
}
