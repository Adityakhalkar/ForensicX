export type CaseItem = {
  id: number;
  title: string;
  description?: string | null;
  created_at: string;
  images: ImageItem[];
};

export type ImageItem = {
  id: number;
  case_id: number;
  original_path: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type RunItem = {
  id: number;
  case_id: number;
  status: string;
  progress: number;
  config_json: Record<string, unknown>;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://127.0.0.1:8000/api";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

function authTokenQueryPart(): string {
  const token = localStorage.getItem("token");
  return token ? `token=${encodeURIComponent(token)}` : "";
}

export async function register(email: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function logout() {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: authHeaders()
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function listCases(): Promise<CaseItem[]> {
  const response = await fetch(`${API_BASE}/cases`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function createCase(title: string, description?: string) {
  const response = await fetch(`${API_BASE}/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title, description })
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function getCase(caseId: number): Promise<CaseItem> {
  const response = await fetch(`${API_BASE}/cases/${caseId}`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function uploadCaseImage(caseId: number, file: File): Promise<ImageItem> {
  const data = new FormData();
  data.append("file", file);
  const response = await fetch(`${API_BASE}/cases/${caseId}/images`, {
    method: "POST",
    headers: authHeaders(),
    body: data
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function createRun(payload: Record<string, unknown>): Promise<RunItem> {
  const response = await fetch(`${API_BASE}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function getRunStatus(runId: number): Promise<RunItem> {
  const response = await fetch(`${API_BASE}/runs/${runId}`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function getRunResults(runId: number) {
  const response = await fetch(`${API_BASE}/runs/${runId}/results`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function createBatchExperiment(payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE}/experiments/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function getExperimentSummary(experimentId: number) {
  const response = await fetch(`${API_BASE}/experiments/${experimentId}/summary`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export function getExperimentCsvUrl(experimentId: number) {
  const tokenPart = authTokenQueryPart();
  return `${API_BASE}/experiments/${experimentId}/csv${tokenPart ? `?${tokenPart}` : ""}`;
}

export async function generateReport(payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE}/reports/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export function getReportUrl(exportId: number) {
  const tokenPart = authTokenQueryPart();
  return `${API_BASE}/reports/${exportId}${tokenPart ? `?${tokenPart}` : ""}`;
}

export function getArtifactUrl(path: string) {
  const pathPart = `path=${encodeURIComponent(path)}`;
  const tokenPart = authTokenQueryPart();
  return `${API_BASE}/files?${pathPart}${tokenPart ? `&${tokenPart}` : ""}`;
}
