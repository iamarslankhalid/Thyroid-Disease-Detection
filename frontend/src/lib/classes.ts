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
