import { Link } from "react-router-dom";
import { Reveal } from "../components/Reveal";
import { Icon } from "../components/ui";
import { useAuth } from "../lib/useAuth";
import { BRAND, FAQ, FEATURES, STEPS } from "../lib/content";

export function LandingPage() {
  return (
    <div className="space-y-24 pb-8 sm:space-y-28">
      <Hero />
      <Stats />
      <HowItWorks />
      <Features />
      <ReportShowcase />
      <Questions />
      <FinalCall />
    </div>
  );
}

function PrimaryCta() {
  const { status } = useAuth();
  return status === "signed-in" ? (
    <Link to="/dashboard" className="btn btn-primary btn-lg">
      Go to your dashboard
      <Icon name="arrowRight" className="h-4 w-4" />
    </Link>
  ) : (
    <Link to="/register" className="btn btn-primary btn-lg">
      Create free account
      <Icon name="arrowRight" className="h-4 w-4" />
    </Link>
  );
}

function Hero() {
  return (
    <section className="relative -mx-4 -mt-8 px-4 pt-14 sm:-mx-6 sm:-mt-10 sm:px-6 sm:pt-20">
      <div
        className="pointer-events-none absolute -top-28 bottom-0 left-1/2 w-screen -translate-x-1/2 overflow-hidden"
        aria-hidden
      >
        <div className="aurora">
          <span className="top-[10%] left-[4%] h-[26rem] w-[max(20rem,32vw)] bg-accent" />
          <span className="top-[2%] right-[4%] h-[28rem] w-[max(22rem,34vw)] bg-accent-2 [animation-delay:-5s]" />
          <span className="top-[38%] left-[34%] h-[22rem] w-[max(18rem,30vw)] bg-accent-3 [animation-delay:-9s]" />
        </div>
        <div className="bg-dots absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_65%)]" />
      </div>
      <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <span className="badge animate-slide-down border border-accent/20 bg-accent-soft/80 text-accent backdrop-blur">
            <Icon name="sparkles" className="h-3.5 w-3.5" />
            Explainable thyroid screening
          </span>
          <h1
            className="animate-page-in mt-5 text-4xl leading-[1.08] font-extrabold text-balance text-ink-1 sm:text-5xl lg:text-[3.4rem]"
            style={{ animationDelay: "80ms" }}
          >
            Make sense of your{" "}
            <span className="text-gradient">thyroid blood test</span>
          </h1>
          <p
            className="animate-page-in mt-5 max-w-xl text-lg leading-relaxed text-ink-2"
            style={{ animationDelay: "160ms" }}
          >
            Enter your TSH, T3 and T4 results and {BRAND.name} explains what they suggest,
            which values drove the answer, and how they change over time — with a PDF report
            ready for your doctor.
          </p>
          <div className="animate-page-in mt-8 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
            <PrimaryCta />
            <Link to="/screening" className="btn btn-secondary btn-lg">
              Check results now
            </Link>
          </div>
          <ul
            className="animate-page-in mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2"
            style={{ animationDelay: "320ms" }}
          >
            {["Free to use", "Results in seconds", "Doctor-ready PDF reports"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Icon name="checkCircle" className="h-4 w-4 text-good" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <ProductPreview />
      </div>
    </section>
  );
}

/** An illustration of the dashboard layout. Placeholder bars, not real or invented readings. */
function ProductPreview() {
  const curve = "M8,70 C48,66 70,52 104,46 S160,22 190,30 S250,58 292,40";

  return (
    <figure
      className="animate-page-in relative lg:pl-6"
      style={{ animationDelay: "200ms" }}
      aria-label="Illustration of the ThyroLens dashboard"
    >
      <div
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-accent/25 via-accent-2/20 to-accent-3/20 blur-2xl"
        aria-hidden
      />
      <div className="animate-float relative">
        <div className="card overflow-hidden border-line/80 bg-surface-1/90 shadow-[var(--shadow-lg)] backdrop-blur" aria-hidden>
          <div className="flex items-center gap-1.5 border-b border-line bg-surface-2/80 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-serious/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-good/70" />
            <span className="ml-3 h-2 w-28 rounded-full bg-surface-3" />
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-3 gap-3">
              {["Latest result", "Checks", "Out of range"].map((label, index) => (
                <div key={label} className="rounded-xl border border-line p-3">
                  <p className="text-[10px] font-medium text-ink-3">{label}</p>
                  <div
                    className="skeleton mt-2 h-3 rounded-full"
                    style={{ width: `${[78, 44, 60][index]}%`, animationDelay: `${index * 0.2}s` }}
                  />
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-1">Trend over time</p>
                <span className="flex items-center gap-1.5 text-[10px] text-ink-3">
                  <span className="h-2 w-3 rounded-sm bg-good/20 ring-1 ring-good/40" />
                  Reference range
                </span>
              </div>
              <svg viewBox="0 0 300 96" className="mt-2 w-full">
                <defs>
                  <linearGradient id="preview-line" x1="0" x2="1">
                    <stop offset="0%" stopColor="var(--accent)" />
                    <stop offset="60%" stopColor="var(--accent-2)" />
                    <stop offset="100%" stopColor="var(--accent-3)" />
                  </linearGradient>
                  <linearGradient id="preview-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <rect x={0} y={34} width={300} height={34} fill="var(--status-good)" opacity={0.1} rx={4} />
                <path d={`${curve} L292,96 L8,96 Z`} fill="url(#preview-fill)" className="animate-fade-in" style={{ animationDelay: "1.2s" }} />
                <path
                  d={curve}
                  fill="none"
                  stroke="url(#preview-line)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  pathLength={600}
                  className="animate-draw"
                />
                <circle cx={292} cy={40} r={4} fill="var(--accent-3)" className="animate-fade-in" style={{ animationDelay: "2.4s" }} />
              </svg>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-accent-soft px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Icon name="document" className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-xs font-semibold text-ink-1">Report for your doctor</p>
                  <p className="text-[10px] text-ink-3">PDF · trends included</p>
                </div>
              </div>
              <span className="rounded-lg bg-gradient-to-r from-accent to-accent-2 px-2.5 py-1 text-[10px] font-semibold text-accent-ink">
                Download
              </span>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

function Stats() {
  const stats = [
    { value: "7,679", label: "confirmed cases the model learned from" },
    { value: "99.3%", label: "of hypothyroid cases detected on held-out data" },
    { value: "0.939", label: "macro F1 score across all three classes" },
    { value: "5", label: "thyroid tests supported, in your lab's units" },
  ];
  return (
    <Reveal as="section" className="card grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
      {stats.map((stat) => (
        <div key={stat.label} className="group p-6">
          <p className="tabular font-display text-3xl font-extrabold text-ink-1 transition-colors duration-300 group-hover:text-accent">
            {stat.value}
          </p>
          <p className="mt-1 text-sm text-ink-2">{stat.label}</p>
        </div>
      ))}
    </Reveal>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold text-balance text-ink-1 sm:text-[2.1rem]">{title}</h2>
      {body && <p className="mt-3 text-ink-2">{body}</p>}
    </Reveal>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24">
      <SectionHeading eyebrow="How it works" title="From lab report to clear answers in three steps" />
      <ol className="mt-12 grid gap-6 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <Reveal as="li" key={step.title} delay={index * 120} className="card card-hover relative p-6">
            <span className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-sm font-bold text-accent-ink shadow-[0_8px_20px_-8px_var(--accent)]">
              {index + 1}
            </span>
            <h3 className="mt-5 text-lg font-semibold text-ink-1">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{step.body}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

function Features() {
  return (
    <section>
      <SectionHeading
        eyebrow="Features"
        title="Everything you need to understand your thyroid health"
        body="Not just a label. Every result comes with its reasoning, and every check builds a history you can act on."
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <Reveal key={feature.title} delay={(index % 3) * 100} className="card card-hover group p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent transition duration-500 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-gradient-to-br group-hover:from-accent group-hover:to-accent-2 group-hover:text-accent-ink">
              <Icon name={feature.icon} className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold text-ink-1">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{feature.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function ReportShowcase() {
  return (
    <Reveal as="section" className="card overflow-hidden">
      <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="eyebrow">For your appointment</p>
          <h2 className="mt-3 text-3xl font-bold text-balance text-ink-1">
            Walk into your consultation prepared
          </h2>
          <p className="mt-4 leading-relaxed text-ink-2">
            Download a clean, professional PDF of your history in one click. Your doctor gets
            exactly what they need on a single document.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-ink-2">
            {[
              "Your details and the period covered",
              "Latest panel against reference ranges, with high and low flags",
              "Trend charts and change since your previous reading",
              "Every saved check, plus the notes you added",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="group relative mx-auto w-full max-w-sm [perspective:1200px]" aria-hidden>
          <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-xl border border-line bg-surface-2 transition duration-700 group-hover:translate-x-6 group-hover:translate-y-6" />
          <div className="relative rounded-xl border border-line bg-white p-6 text-slate-900 shadow-[var(--shadow-lg)] transition duration-700 [transform:rotateY(-8deg)_rotateX(4deg)] group-hover:[transform:none]">
            <div className="-mx-6 -mt-6 mb-5 h-1.5 rounded-t-xl bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-500" />
            <p className="text-sm font-bold">{BRAND.name} · Thyroid screening history</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Prepared for review with a doctor</p>
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 rounded-md bg-slate-50 p-2.5 text-[9px]">
              {["Patient", "Screenings", "Date of birth", "Period"].map((label, index) => (
                <span key={label} className="flex items-center gap-1.5">
                  <b>{label}</b>
                  <span className="h-1.5 rounded-full bg-slate-200" style={{ width: `${[56, 18, 40, 48][index]}%` }} />
                </span>
              ))}
            </div>
            <table className="mt-4 w-full text-[9px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr><th className="p-1 text-left">Test</th><th className="p-1 text-left">Result</th><th className="p-1 text-left">Range</th><th className="p-1 text-left">Status</th></tr>
              </thead>
              <tbody>
                {["TSH", "Total T3", "Total T4"].map((test) => (
                  <tr key={test} className="border-b border-slate-100">
                    <td className="p-1">{test}</td>
                    <td className="p-1"><span className="block h-1.5 w-10 rounded-full bg-slate-300" /></td>
                    <td className="p-1"><span className="block h-1.5 w-8 rounded-full bg-slate-200" /></td>
                    <td className="p-1"><span className="block h-1.5 w-7 rounded-full bg-emerald-200" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 h-12 overflow-hidden rounded-md bg-emerald-50">
              <svg viewBox="0 0 200 48" className="h-full w-full">
                <path d="M6,34 C40,30 60,24 90,18 S150,10 194,26" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function Questions() {
  return (
    <section>
      <SectionHeading eyebrow="FAQ" title="Common questions" />
      <div className="mx-auto mt-10 max-w-3xl space-y-3">
        {FAQ.slice(0, 4).map((item, index) => (
          <Reveal key={item.question} delay={index * 80}>
            <details className="card group p-5 transition-colors duration-300 open:border-accent/40 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink-1">
                {item.question}
                <Icon name="chevronDown" className="h-4 w-4 shrink-0 text-ink-3 transition duration-300 group-open:rotate-180 group-open:text-accent" />
              </summary>
              <p className="animate-fade-in mt-3 text-sm leading-relaxed text-ink-2">{item.answer}</p>
            </details>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 text-center text-sm">
        <Link to="/about#faq" className="link">See all questions</Link>
      </p>
    </section>
  );
}

function FinalCall() {
  return (
    <Reveal
      as="section"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 px-6 py-14 text-center sm:px-12"
    >
      <div className="pointer-events-none absolute inset-0 opacity-15 [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="aurora !inset-0 !h-full !opacity-40" aria-hidden>
        <span className="-top-10 -left-10 h-64 w-64 bg-cyan-400" />
        <span className="-right-10 -bottom-16 h-72 w-72 bg-fuchsia-500 [animation-delay:-6s]" />
      </div>
      <div className="relative">
        <h2 className="text-3xl font-bold text-balance text-white">
          Start tracking your thyroid health today
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-white/85">
          Create a free account to save every check, see your trends and share a report with
          your doctor.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/register" className="btn btn-lg bg-white text-blue-700 hover:bg-blue-50">
            Create free account
          </Link>
          <Link to="/screening" className="btn btn-lg border-white/40 text-white hover:bg-white/10">
            Check results as a guest
          </Link>
        </div>
      </div>
    </Reveal>
  );
}
