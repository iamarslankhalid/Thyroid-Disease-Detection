/**
 * Assessment history, kept in the browser.
 *
 * Deliberately not sent to a server: these are health details, and storing them
 * locally means the app needs no account, no database and no privacy policy it
 * cannot honour. The trade-off - history does not follow the user to another
 * device - is stated in the UI.
 */

import type { ClassName, PatientInput, PredictionResponse } from "../api";
import { CLASS_ORDER } from "./classes";

const STORAGE_KEY = "thyroid-assessments-v1";
const MAX_ENTRIES = 50;

export interface StoredAssessment {
  id: string;
  createdAt: string;
  prediction: ClassName;
  confidence: number;
  probabilities: Record<ClassName, number>;
  input: PatientInput;
}

function isAssessment(value: unknown): value is StoredAssessment {
  const candidate = value as StoredAssessment;
  // `prediction` is checked against the real class list, not merely for being a
  // string: entries written by an older version, or edited by hand, would
  // otherwise reach CLASS_META[prediction] and crash the whole history page on
  // an undefined lookup.
  return (
    typeof candidate?.id === "string" &&
    typeof candidate?.createdAt === "string" &&
    !Number.isNaN(Date.parse(candidate?.createdAt)) &&
    CLASS_ORDER.includes(candidate?.prediction) &&
    typeof candidate?.confidence === "number" &&
    Number.isFinite(candidate.confidence)
  );
}

export function loadHistory(): StoredAssessment[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAssessment);
  } catch {
    // Private browsing, cleared storage or corrupt JSON: an empty history is
    // the correct answer, never a crash on load.
    return [];
  }
}

function persist(entries: StoredAssessment[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable - the current result is still shown on screen */
  }
}

export function saveAssessment(
  input: PatientInput,
  result: PredictionResponse,
): StoredAssessment {
  const entry: StoredAssessment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    prediction: result.prediction,
    confidence: result.confidence,
    probabilities: result.probabilities,
    input,
  };
  persist([entry, ...loadHistory()].slice(0, MAX_ENTRIES));
  return entry;
}

export function deleteAssessment(id: string): StoredAssessment[] {
  const remaining = loadHistory().filter((entry) => entry.id !== id);
  persist(remaining);
  return remaining;
}

export function clearHistory(): void {
  persist([]);
}
