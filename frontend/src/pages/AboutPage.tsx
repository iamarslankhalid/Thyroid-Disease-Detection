import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon, PageHeader } from "../components/ui";
import { BRAND, FAQ, LIMITATIONS } from "../lib/content";

export function AboutPage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="About"
        title={`About ${BRAND.name}`}
        description={`${BRAND.name} helps people understand their thyroid blood tests: what the numbers suggest, why, and how they change over time, so every conversation with a doctor starts from a clearer picture.`}
      />

      <section className="grid gap-5 md:grid-cols-3">
        {[
          {
            icon: "sparkles" as const,
            title: "Clarity",
            body: "Plain-language results with the reasoning attached, never just a label.",
          },
          {
            icon: "shield" as const,
            title: "Privacy",
            body: "Your history is tied to your account alone, and you can export or delete it at any time.",
          },
          {
            icon: "stethoscope" as const,
            title: "Built around your doctor",
            body: "Reports are designed for consultations: reference ranges, flags, trends and your notes.",
          },
        ].map((value) => (
          <div key={value.title} className="card p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Icon name={value.icon} className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-semibold text-ink-1">{value.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{value.body}</p>
          </div>
        ))}
      </section>

      <section className="card p-6 sm:p-8">
        <h2 className="text-lg font-bold text-ink-1">The data behind the model</h2>
        <div className="mt-4 grid gap-6 text-sm leading-relaxed text-ink-2 md:grid-cols-2">
          <p>
            The model learned from the Garvan Institute thyroid dataset, published through the
            UCI Machine Learning Repository: 9,172 patient records with demographics, medical
            history and thyroid function tests. Of those, 7,679 carry a confirmed diagnosis in one
            of the three classes {BRAND.name} reports on: negative, hypothyroid or hyperthyroid.
          </p>
          <p>
            Columns that would not generalise to a new patient, such as the referring clinic,
            are deliberately excluded. Five candidate models were compared on cross-validated
            performance; the full evaluation, including where the model makes mistakes, is on
            the{" "}
            <Link to="/model" className="link">model page</Link>.
          </p>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24">
        <h2 className="text-lg font-bold text-ink-1">Frequently asked questions</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.question} className="card p-5">
              <h3 className="text-sm font-semibold text-ink-1">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card border-warning/30 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-soft text-warning">
            <Icon name="info" className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-bold text-ink-1">Medical information</h2>
        </div>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink-2">
          {LIMITATIONS.map((limitation) => (
            <li key={limitation} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
              {limitation}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
