/**
 * Copy shared between the landing page and the about page, kept in one place
 * so the two never contradict each other.
 */

export const BRAND = {
  name: "ThyroLens",
  tagline: "Understand your thyroid blood test",
};

export interface Step {
  title: string;
  body: string;
}

export const STEPS: Step[] = [
  {
    title: "Enter your lab values",
    body: "Type in any of five thyroid tests exactly as your report shows them, in your laboratory's units. Age and a single result are enough to start.",
  },
  {
    title: "Get an explained result",
    body: "Our model compares your panel with 7,679 confirmed cases and tells you what it suggests, which values drove the answer and how close you are to a different one.",
  },
  {
    title: "Track it and share it",
    body: "Every check is saved to your account. Watch your TSH and T4 trend over time and download a PDF summary to take to your doctor.",
  },
];

export interface Feature {
  title: string;
  body: string;
  icon: "sparkles" | "adjustments" | "beaker" | "trend" | "document" | "lock";
}

export const FEATURES: Feature[] = [
  {
    title: "Explained, not just labelled",
    body: "Every result names the specific values behind it, measured for your case rather than a generic chart of what matters on average.",
    icon: "sparkles",
  },
  {
    title: "See where the line is",
    body: '"If your TSH were below 4.46 mU/L, this would read Negative." Real thresholds, found by re-running the model across the range.',
    icon: "adjustments",
  },
  {
    title: "Speaks your lab's units",
    body: "µg/dL, ng/dL, nmol/L or mU/L. Choose what your report printed and conversion is handled for you.",
    icon: "beaker",
  },
  {
    title: "Analytics over time",
    body: "A personal dashboard charts every test against its reference range, flags readings outside it and shows how each value is moving.",
    icon: "trend",
  },
  {
    title: "Doctor-ready PDF reports",
    body: "Download your full history or a single result as a clean PDF with values, reference ranges, trends and your own notes.",
    icon: "document",
  },
  {
    title: "Private by design",
    body: "Your history belongs to your account alone. Export it or delete it permanently at any time from your account settings.",
    icon: "lock",
  },
];

export interface Question {
  question: string;
  answer: string;
}

/** The first four are shown on the landing page; the about page shows all. */
export const FAQ: Question[] = [
  {
    question: "Is this a diagnosis?",
    answer:
      "No. ThyroLens tells you which pattern your numbers most resemble. Only a doctor can diagnose a thyroid disorder, by reading your tests alongside your symptoms and history. That is why every result can be exported as a PDF for your appointment.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No, you can run a check as a guest. Creating a free account saves every check, unlocks your analytics dashboard and lets you download your history as a PDF. Checks run as a guest on this device can be moved into your account when you sign up.",
  },
  {
    question: "What if I only have a TSH result?",
    answer:
      "That is enough. The model estimates the tests you did not enter, and the result shows how many of the seven inputs it actually had, so you know how much weight it deserves.",
  },
  {
    question: "How accurate is it?",
    answer:
      "On held-out patients it reaches 0.939 macro F1 and finds 99.3% of hypothyroid cases. Real-world accuracy can be lower, because laboratories, assays and patient groups differ from the data it learned from.",
  },
  {
    question: "Who can see my data?",
    answer:
      "Only you. Your history is tied to your account and is never shared. You can export everything as a file or permanently delete your account and all saved checks from the account page.",
  },
  {
    question: "Why does it ask for total T4 rather than free T4?",
    answer:
      "Because that is what the model was trained on. Free T4 is a different measurement, and entering one in place of the other would give a confident but wrong answer, so leave that field empty if you only have free T4.",
  },
];

export const LIMITATIONS: string[] = [
  "ThyroLens is a screening aid. It does not diagnose, and it does not replace a consultation with a doctor.",
  "The model was trained on records from a single clinical dataset; results for other populations may differ.",
  "Hyperthyroidism is less common in the training data, so that result is the least certain of the three.",
  'A "Negative" result does not rule anything out. If you have symptoms, see a doctor regardless.',
];
