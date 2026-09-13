/** Presentation metadata for the three screening outcomes. */

import type { ClassName } from "../api";

export interface ClassMeta {
  /** CSS custom property holding this class's categorical hue. */
  color: string;
  /** Plain-language headline for a patient. */
  headline: string;
  summary: string;
  /** Reserved status role, never a categorical hue. */
  tone: "good" | "warning" | "serious";
}

export const CLASS_META: Record<ClassName, ClassMeta> = {
  Negative: {
    color: "var(--series-negative)",
    headline: "No thyroid disorder indicated",
    summary:
      "Your results look similar to those of people without a thyroid disorder in the training data. This is not a clean bill of health - if you have symptoms, see a doctor anyway.",
    tone: "good",
  },
  Hypothyroid: {
    color: "var(--series-hypo)",
    headline: "Signs consistent with an underactive thyroid",
    summary:
      "Your results resemble those of people with hypothyroidism, where the thyroid produces too little hormone. It is treatable, and a doctor can confirm it with a repeat blood test.",
    tone: "warning",
  },
  Hyperthyroid: {
    color: "var(--series-hyper)",
    headline: "Signs consistent with an overactive thyroid",
    summary:
      "Your results resemble those of people with hyperthyroidism, where the thyroid produces too much hormone. Please take these results to a doctor for proper testing.",
    tone: "serious",
  },
};

export const TONE_COLOR: Record<ClassMeta["tone"], string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
};

export const CLASS_ORDER: ClassName[] = ["Negative", "Hypothyroid", "Hyperthyroid"];

/**
 * What a person can reasonably do with each result.
 *
 * Deliberately procedural rather than clinical: how to get a real answer, what
 * a doctor will probably do next, what to ask. Nothing here recommends a
 * treatment, a dose or a supplement, because a screening tool trained on
 * 1980s data has no business doing that.
 */
export const NEXT_STEPS: Record<ClassName, string[]> = {
  Negative: [
    "Keep the report - a single set of results is a snapshot, and change over time is what matters.",
    "If you have symptoms such as persistent fatigue, weight change, hair loss or palpitations, see a doctor anyway. A screening tool cannot rule anything out.",
    "Ask your doctor whether a free T4 test would add anything, since this model only reads total T4.",
  ],
  Hypothyroid: [
    "Take your original lab report to a doctor. Bring this page if it helps, but the report is what counts.",
    "Expect a repeat blood test. Thyroid results move around, and diagnosis is not made from one reading.",
    "Ask whether thyroid antibodies (anti-TPO) should be checked, since they help explain the cause.",
    "Do not start, stop or change any medication based on this page.",
  ],
  Hyperthyroid: [
    "Take your original lab report to a doctor, and mention any racing heartbeat, tremor, heat intolerance or weight loss.",
    "Ask about a repeat test with free T4 and free T3, which are the usual next step.",
    "If you have chest pain, a very fast heartbeat or severe symptoms, seek medical care promptly rather than waiting.",
    "Do not start, stop or change any medication based on this page.",
  ],
};

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
