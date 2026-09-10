/** Typed client for the screening API. */

export type ClassName = "Negative" | "Hypothyroid" | "Hyperthyroid";
export type RangeStatus = "low" | "normal" | "high";

export interface PatientInput {
  age: number;
  sex?: "male" | "female" | null;
  TSH?: number | null;
  T3?: number | null;
  TT4?: number | null;
  T4U?: number | null;
  FTI?: number | null;
  [flag: string]: number | string | boolean | null | undefined;
}

export interface Contribution {
  feature: string;
  label: string;
  value: number | null;
  unit: string | null;
  status: RangeStatus | null;
  direction: "supports" | "opposes";
  impact: number;
}

export interface LabFlag {
  feature: string;
  label: string;
  value: number;
  unit: string;
  status: RangeStatus;
  reference_low: number;
  reference_high: number;
}

export interface PredictionResponse {
  prediction: ClassName;
  confidence: number;
  probabilities: Record<ClassName, number>;
  contributions: Contribution[];
  lab_flags: LabFlag[];
  inputs_provided: number;
  inputs_total: number;
  model_name: string;
  model_trained_at: string;
  disclaimer: string;
}

export interface FeatureMeta {
  label: string;
  unit: string;
  min: number;
  max: number;
  reference: [number, number] | null;
  description: string;
}

export interface ReferenceData {
  features: Record<string, FeatureMeta>;
  history: { feature: string; label: string }[];
}

export interface ClassScores {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface TestMetrics {
  accuracy: number;
  balanced_accuracy: number;
  macro_f1: number;
  missed_disease_rate: number;
  /** Absent for the baseline, which has no probability estimates. */
  roc_auc_ovr_macro?: number | null;
  per_class: Record<string, ClassScores>;
  confusion_matrix: number[][];
  confusion_matrix_labels: string[];
}

export interface ModelInfo {
  model_name: string;
  trained_at: string;
  sklearn_version: string;
  selection_metric: string;
  class_names: string[];
  training_rows: number;
  test_rows: number;
  class_counts: Record<string, number>;
  metrics: { cv: Record<string, { mean: number; std: number }> | null; test: TestMetrics };
  all_model_metrics: Record<
    string,
    { cv: Record<string, { mean: number; std: number }> | null; test: TestMetrics }
  >;
  dropped_columns: Record<string, string>;
}

/** Turns a FastAPI error body into a message worth showing a user. */
async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((item: { msg?: string }) => item.msg?.replace(/^Value error, /, ""))
        .filter(Boolean)
        .join(" ");
    }
  } catch {
    /* fall through to the generic message */
  }
  return `Request failed (${response.status}).`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

export const api = {
  predict: (patient: PatientInput) =>
    request<PredictionResponse>("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patient),
    }),
  referenceData: () => request<ReferenceData>("/api/reference-data"),
  modelInfo: () => request<ModelInfo>("/api/model"),
};
