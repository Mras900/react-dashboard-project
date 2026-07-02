const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// --- Types ---

export interface HistoricalImportResponse {
  imported: number;
  skipped_duplicates: number;
  errors: number;
  source_years_detected: number[];
  rows_by_year: Record<string, number>;
  rows_by_comuna: Array<{ comuna: string; total: number }>;
  rows_by_estado: Record<string, number>;
  rows_by_prioridad: Record<string, number>;
  message: string;
}

export interface HistoricalSummaryResponse {
  total: number;
  by_year: Record<string, number>;
  by_month: Record<string, number>;
  by_comuna: Array<{ comuna: string; total: number }>;
  by_prioridad: Record<string, number>;
  by_estado: Record<string, number>;
  by_categoria_incidente: Record<string, number>;
  by_categoria_causa: Record<string, number>;
  by_producto: Array<{ producto: string; total: number }>;
  promedio_dias_visita_respuesta: number | null;
}

export interface CompareYearMetric {
  year: number;
  total: number;
  by_comuna: Array<{ comuna: string; total: number }>;
  by_prioridad: Record<string, number>;
  by_estado: Record<string, number>;
  by_categoria_incidente: Record<string, number>;
  by_mes: Record<string, number>;
}

export interface HistoricalCompareResponse {
  year_a: CompareYearMetric;
  year_b: CompareYearMetric;
  diferencia_absoluta: number;
  variacion_porcentual: number | null;
  top_comunas_aumento: Array<{
    comuna: string;
    year_a: number;
    year_b: number;
    diferencia: number;
  }>;
  top_comunas_baja: Array<{
    comuna: string;
    year_a: number;
    year_b: number;
    diferencia: number;
  }>;
  top_categorias_aumento: Array<{
    categoria: string;
    year_a: number;
    year_b: number;
    diferencia: number;
  }>;
  top_estados: Record<string, { year_a: number; year_b: number }>;
  top_prioridades: Record<string, { year_a: number; year_b: number }>;
  resumen_textual_base: string;
}

export interface HistoricalAiContextResponse {
  totales: Record<string, number>;
  variaciones: Record<string, number | null>;
  top_comunas: Array<{ comuna: string; total: number }>;
  top_categorias: Array<{ categoria: string; total: number }>;
  tendencias_mensuales: Record<string, Record<string, number>>;
  hallazgos_principales: string[];
}

// --- API Client ---

export async function importHistoricalVisits(
  file: File,
  datasetName?: string,
  sourceYear?: number
): Promise<HistoricalImportResponse> {
  const form = new FormData();
  form.append('file', file);
  if (datasetName) form.append('dataset_name', datasetName);
  if (sourceYear) form.append('source_year', String(sourceYear));

  const res = await fetch(`${API_BASE}/api/historical-visits/import`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(payload.detail ?? 'Error al importar visitas históricas');
  }
  return (await res.json()) as HistoricalImportResponse;
}

export async function fetchHistoricalSummary(params: {
  year?: number;
  from_date?: string;
  to_date?: string;
  comuna?: string;
  region?: string;
}): Promise<HistoricalSummaryResponse> {
  const q = new URLSearchParams();
  if (params.year) q.set('year', String(params.year));
  if (params.from_date) q.set('from_date', params.from_date);
  if (params.to_date) q.set('to_date', params.to_date);
  if (params.comuna) q.set('comuna', params.comuna);
  if (params.region) q.set('region', params.region);

  const res = await fetch(`${API_BASE}/api/historical-visits/summary?${q.toString()}`);
  if (!res.ok) throw new Error('Error al cargar resumen histórico');
  return (await res.json()) as HistoricalSummaryResponse;
}

export async function fetchHistoricalCompare(params: {
  year_a: number;
  year_b: number;
  month?: number;
  comuna?: string;
  region?: string;
}): Promise<HistoricalCompareResponse> {
  const q = new URLSearchParams({ year_a: String(params.year_a), year_b: String(params.year_b) });
  if (params.month) q.set('month', String(params.month));
  if (params.comuna) q.set('comuna', params.comuna);
  if (params.region) q.set('region', params.region);

  const res = await fetch(`${API_BASE}/api/historical-visits/compare?${q.toString()}`);
  if (!res.ok) throw new Error('Error al cargar comparación histórica');
  return (await res.json()) as HistoricalCompareResponse;
}

export async function fetchHistoricalAiContext(params: {
  year_a: number;
  year_b?: number;
  month?: number;
  comuna?: string;
}): Promise<HistoricalAiContextResponse> {
  const q = new URLSearchParams({ year_a: String(params.year_a) });
  if (params.year_b) q.set('year_b', String(params.year_b));
  if (params.month) q.set('month', String(params.month));
  if (params.comuna) q.set('comuna', params.comuna);

  const res = await fetch(`${API_BASE}/api/historical-visits/ai-context?${q.toString()}`);
  if (!res.ok) throw new Error('Error al cargar contexto IA histórico');
  return (await res.json()) as HistoricalAiContextResponse;
}
