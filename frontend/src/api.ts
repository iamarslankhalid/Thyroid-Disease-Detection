/** Typed client for the ThyroLens API. */

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
  /** Unit each value was written in, e.g. {TT4: "ug/dL"}. */
  units?: Record<string, string>;
  [flag: string]: number | string | boolean | null | undefined | Record<string, string>;
}

export interface Counterfactual {
  feature: string;
  label: string;
  unit: string;
  current_value: number;
  threshold: number;
  direction: "above" | "below";
  resulting_class: ClassName;
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
  counterfactuals: Counterfactual[];
  inputs_provided: number;
  inputs_total: number;
  model_name: string;
  model_trained_at: string;
  disclaimer: string;
  /** Set when the request was signed in and the result was saved. */
  assessment_id: number | null;
}

export interface UnitOption {
  code: string;
  label: string;
  note: string | null;
  min: number;
  max: number;
  reference: [number, number] | null;
}

export interface FeatureMeta {
  label: string;
  unit: string;
  min: number;
  max: number;
  reference: [number, number] | null;
  description: string;
  units: UnitOption[];
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

// --- accounts ----------------------------------------------------------------
export interface User {
  id: number;
  email: string;
  full_name: string;
  date_of_birth: string | null;
  sex: "male" | "female" | null;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  expires_at: string;
  user: User;
}

export interface ProfileUpdate {
  full_name: string;
  date_of_birth: string | null;
  sex: "male" | "female" | null;
}

export interface StoredLabOut {
  feature: string;
  label: string;
  value: number;
  unit: string;
  status: RangeStatus;
  reference_low: number;
  reference_high: number;
}

export interface AssessmentSummary {
  id: number;
  created_at: string;
  prediction: ClassName;
  confidence: number;
  probabilities: Record<ClassName, number>;
  inputs_provided: number;
  labs: StoredLabOut[];
  note: string | null;
}

export interface TrendPointOut {
  date: string;
  value: number;
  status: RangeStatus;
}

export interface LabAnalytics {
  feature: string;
  label: string;
  unit: string;
  reference_low: number;
  reference_high: number;
  readings: number;
  out_of_range: number;
  latest_value: number;
  latest_status: RangeStatus;
  latest_at: string;
  previous_value: number | null;
  change: number | null;
  minimum: number;
  maximum: number;
  average: number;
  series: TrendPointOut[];
}

export interface MonthlyCount {
  month: string;
  total: number;
  Negative: number;
  Hypothyroid: number;
  Hyperthyroid: number;
}

export interface Analytics {
  total: number;
  first_at: string | null;
  last_at: string | null;
  days_since_last: number | null;
  average_confidence: number | null;
  class_counts: Record<ClassName, number>;
  latest: AssessmentSummary | null;
  previous_prediction: ClassName | null;
  abnormal_assessments: number;
  monthly: MonthlyCount[];
  labs: LabAnalytics[];
}

// --- transport ---------------------------------------------------------------
const TOKEN_KEY = "thyrolens-session";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable - the session lasts for this page only */
  }
}

let onUnauthorised: (() => void) | null = null;

/** Lets the auth provider sign the user out when the server rejects the token. */
export function setUnauthorisedHandler(handler: (() => void) | null): void {
  onUnauthorised = handler;
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
  if (response.status >= 500) return "The server ran into a problem. Please try again shortly.";
  return `Request failed (${response.status}).`;
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch (cause) {
    console.error(`Network error calling ${path}`, cause);
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    const message = await readError(response);
    if (response.status === 401 && token) onUnauthorised?.();
    throw new ApiError(message, response.status);
  }
  return response;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await send(path, init);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Fetches a file with the session attached and hands it to the browser. */
async function download(path: string, fallbackName: string): Promise<void> {
  const response = await send(path);
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const json = (body: unknown) => JSON.stringify(body);

export interface Health {
  status: "ok" | "degraded";
  model_loaded: boolean;
  model_name?: string | null;
}

export const api = {
  health: () => request<Health>("/api/health"),
  predict: (patient: PatientInput) =>
    request<PredictionResponse>("/api/predict", { method: "POST", body: json(patient) }),
  referenceData: () => request<ReferenceData>("/api/reference-data"),
  modelInfo: () => request<ModelInfo>("/api/model"),

  register: (body: { email: string; password: string; full_name: string }) =>
    request<AuthResponse>("/api/auth/register", { method: "POST", body: json(body) }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: json(body) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<User>("/api/auth/me"),

  updateProfile: (body: ProfileUpdate) =>
    request<User>("/api/account/profile", { method: "PUT", body: json(body) }),
  changePassword: (body: { current_password: string; new_password: string }) =>
    request<void>("/api/account/password", { method: "POST", body: json(body) }),
  deleteAccount: (password: string) =>
    request<void>("/api/account/delete", { method: "POST", body: json({ password }) }),
  exportAccount: () => download("/api/account/export", "thyrolens-data.json"),

  assessments: () => request<AssessmentSummary[]>("/api/assessments"),
  updateNote: (id: number, note: string | null) =>
    request<AssessmentSummary>(`/api/assessments/${id}/note`, {
      method: "PUT",
      body: json({ note }),
    }),
  deleteAssessment: (id: number) =>
    request<void>(`/api/assessments/${id}`, { method: "DELETE" }),
  clearAssessments: () => request<void>("/api/assessments", { method: "DELETE" }),
  importAssessments: (items: { created_at: string; input: PatientInput }[]) =>
    request<{ imported: number }>("/api/assessments/import", {
      method: "POST",
      body: json({ items }),
    }),

  analytics: () => request<Analytics>("/api/analytics"),

  downloadHistoryReport: (range?: { start?: string; end?: string }) => {
    const params = new URLSearchParams();
    if (range?.start) params.set("start", range.start);
    if (range?.end) params.set("end", range.end);
    const query = params.toString();
    return download(
      `/api/reports/history.pdf${query ? `?${query}` : ""}`,
      "thyrolens-history.pdf",
    );
  },
  downloadAssessmentReport: (id: number) =>
    download(`/api/reports/assessments/${id}.pdf`, "thyrolens-screening.pdf"),
};
