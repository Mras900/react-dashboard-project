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
  include_census?: boolean;
  include_red_zones?: boolean;
  include_source_references?: boolean;
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
  source_references?: Array<Record<string, unknown>>;
  warnings?: string[];
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
export type SimilarClaimsPayload = {
  query: string;
  limit?: number;
  filters?: DashboardAiFilters & {
    include_territorial_context?: boolean;
    only_red_zone_communes?: boolean;
    risk_level?: 'alto' | 'medio' | 'bajo' | '' | null;
  };
  provider?: AiProvider;
};

export type SimilarClaimsResponse = {
  items: Array<Record<string, unknown>>;
  count: number;
  warnings: string[];
  answer?: string;
  provider?: string;
  model?: string;
  fallback?: boolean;
};

export type RagPayload = {
  query: string;
  limit?: number;
  filters?: Record<string, unknown>;
  provider?: AiProvider;
};

export async function findSimilarClaims(payload: SimilarClaimsPayload): Promise<SimilarClaimsResponse> {
  return fetchJson<SimilarClaimsResponse>('/ai/similar-claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function summarizeSimilarClaims(payload: SimilarClaimsPayload): Promise<SimilarClaimsResponse> {
  return fetchJson<SimilarClaimsResponse>('/ai/similar-claims-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function ragSearch(payload: RagPayload): Promise<SimilarClaimsResponse> {
  return fetchJson<SimilarClaimsResponse>('/ai/rag/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function ragChat(payload: RagPayload): Promise<DashboardAiResponse & { items?: Array<Record<string, unknown>> }> {
  return fetchJson<DashboardAiResponse & { items?: Array<Record<string, unknown>> }>('/ai/rag/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function indexClaimsForRag(): Promise<{ ok: boolean; indexed: number; skipped: number }> {
  return fetchJson<{ ok: boolean; indexed: number; skipped: number }>('/ai/rag/index-claims', { method: 'POST' });
}

export async function indexReferenceSourcesForRag(): Promise<{ ok: boolean; indexed: number; skipped: number; sources: Array<Record<string, unknown>> }> {
  return fetchJson<{ ok: boolean; indexed: number; skipped: number; sources: Array<Record<string, unknown>> }>('/ai/rag/index-reference-sources', { method: 'POST' });
}

export async function exportMonthlyReport(filters: MonthlyReportFilters & { format: 'html' | 'pdf' | 'docx' }): Promise<{ ok: boolean; report_id: string; format: string; download_url: string | null; warnings: string[] }> {
  return fetchJson<{ ok: boolean; report_id: string; format: string; download_url: string | null; warnings: string[] }>('/reports/monthly/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
}
