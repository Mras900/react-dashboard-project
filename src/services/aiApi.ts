const LEGACY_API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ||
  (LEGACY_API_BASE ? `${LEGACY_API_BASE}/api` : '/api');

const apiUrl = (path: string) => `${API_BASE}${path}`;

export type AiProvider = 'auto' | 'nvidia' | 'gemini' | 'groq' | 'openrouter';

export type AskAiPayload = {
  prompt: string;
  context?: string;
  provider?: AiProvider;
};

export type AskAiResponse = {
  provider: string;
  model: string;
  fallback: boolean;
  answer: string;
};

export type DashboardAiFilters = {
  territorio?: 'rm' | 'regiones' | 'nacional';
  year?: number;
  month?: number;
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
  comuna?: string;
  region?: string;
  estado?: string;
  prioridad?: string;
  provider?: AiProvider;
};

export type DashboardAiResponse = AskAiResponse & {
  metrics?: Record<string, unknown>;
};

export type MonthlyReportFilters = DashboardAiFilters & {
  year: number;
  month: number;
  include_ai_analysis?: boolean;
  include_sensitive_data?: boolean;
};

export type MonthlyReportPreview = {
  ok: boolean;
  report_id: string;
  title: string;
  markdown: string;
  metrics: Record<string, unknown>;
  fallback?: boolean;
  provider?: string | null;
  model?: string | null;
};

async function fetchJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? 'No se pudo consultar el backend');
  }
  return (await response.json()) as T;
}

export async function askAi(payload: AskAiPayload): Promise<AskAiResponse> {
  return fetchJson<AskAiResponse>('/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: payload.prompt,
      context: payload.context,
      provider: payload.provider ?? 'auto',
    }),
  });
}

export async function getDashboardAiSummary(filters: DashboardAiFilters): Promise<DashboardAiResponse> {
  return fetchJson<DashboardAiResponse>('/ai/dashboard-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
}

export async function analyzeComunasWithAi(filters: DashboardAiFilters): Promise<DashboardAiResponse> {
  return fetchJson<DashboardAiResponse>('/ai/analyze-comunas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
}

export async function generateAiReport(filters: DashboardAiFilters): Promise<DashboardAiResponse> {
  return fetchJson<DashboardAiResponse>('/ai/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
}

export async function previewMonthlyReport(filters: MonthlyReportFilters): Promise<MonthlyReportPreview> {
  return fetchJson<MonthlyReportPreview>('/reports/monthly/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
}

export async function getMonthlyReportHtml(filters: MonthlyReportFilters): Promise<string> {
  const response = await fetch(apiUrl('/reports/monthly/html'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? 'No se pudo generar el HTML del informe');
  }
  return response.text();
}
