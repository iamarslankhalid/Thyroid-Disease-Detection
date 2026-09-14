/**
 * Copy shared between the landing page and the about page.
 *
 * Kept in one place so the two never drift apart - a product page that claims
 * something the about page contradicts is worse than either alone. The landing
 * page shows a subset; the about page shows all of it.
 */

export const BRAND = {
  name: "ThyroLens",
  tagline: "Your thyroid blood test, explained",
};

export interface Step {
  title: string;
  body: string;
}

export const STEPS: Step[] = [
  {
    title: "Enter what your report says",
    body: "Any of five thyroid blood tests, in the unit your laboratory printed. Only your age and one result are required — missing tests are estimated, and the result tells you how many values it had to work with.",
  },
  {
    title: "It compares you with 7,679 patients",
    body: "A random forest, chosen over four other models on cross-validated performance, scores your values against historical records whose diagnosis was confirmed.",
  },
  {
    title: "You get the reasoning, not a verdict",
    body: "Which of your numbers drove the answer, how they sit against typical ranges, how close you are to a different answer, and what to do next.",
  },
];

export interface Feature {
  title: string;
  body: string;
}

export const FEATURES: Feature[] = [
  {
    title: "It explains itself",
    body: "Every result names the specific values behind it, measured for your case — not a generic chart of what matters on average.",
  },
  {
    title: "It shows you the boundary",
    body: '"If your TSH were below 4.46 mU/L, this would read Negative." A real threshold, found by re-running the model across the whole range.',
  },
  {
    title: "It speaks your lab's units",
    body: "µg/dL, ng/dL, nmol/L, mU/L. Pick what your report printed and the conversion is handled — getting this wrong is how a healthy person gets a frightening answer.",
  },
  {
    title: "Partial results are fine",
    body: "Most people only have TSH. One blood test is enough to run a screening, and the result is honest about how much it had to go on.",
  },
  {
    title: "Nothing is stored about you",
    body: "Your values are scored and discarded. Saved checks live in your own browser, which is why there is no account to create.",
  },
  {
    title: "Made to be taken to a doctor",
    body: "Print or save the result as a PDF, with your numbers, the reasoning and the caveats on one page.",
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
      "No. It says a set of numbers resembles a group in a historical dataset. Only a doctor can diagnose a thyroid disorder, and only by reading your tests alongside your symptoms and history.",
  },
  {
    question: "What happens to my health data?",
    answer:
      "Your values are sent to the server to be scored and are not stored there. Saved checks live only in this browser, which is why they disappear if you clear your browsing data or switch device.",
  },
  {
    question: "What if I only have a TSH result?",
    answer:
      "That is enough. The model estimates the tests you did not enter, and the result shows how many of the seven inputs it actually had — a screening built on one value deserves less weight than one built on six.",
  },
  {
    question: "How accurate is it really?",
    answer:
      "On held-out data from the same 1980s cohort it reaches 0.939 macro F1 and finds 99.3% of hypothyroid cases. On patients today it would do worse: assays, reference ranges and the mix of people being tested have all changed, and it has never been validated outside that one dataset.",
  },
  {
    question: "Where does the data come from?",
    answer:
      "The Garvan Institute thyroid dataset, collected at one Australian clinic in the 1980s and published through the UCI Machine Learning Repository. 9,172 records, of which 7,679 carry one of the three diagnoses this project classifies.",
  },
  {
    question: "Why does it ask for total T4 rather than free T4?",
    answer:
      "Because that is what the training data recorded. Modern reports usually give free T4, which is a different measurement — entering one in place of the other would produce a confident wrong answer, so the form asks you not to.",
  },
];

export const LIMITATIONS: string[] = [
  "It is not a medical device and has no regulatory approval of any kind.",
  "It was trained on data from a single clinic in one country, four decades ago.",
  "It has never been validated on patients from another hospital, country or era.",
  "Hyperthyroidism is rare in the training data, so that class is the least reliable of the three.",
  'A result of "Negative" does not rule anything out. If you have symptoms, see a doctor regardless of what this page says.',
];
