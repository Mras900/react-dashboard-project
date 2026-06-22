const LEGACY_API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ||
  (LEGACY_API_BASE ? `${LEGACY_API_BASE}/api` : '/api');

const apiUrl = (path: string) => `${API_BASE}${path}`;

export type DashboardSummary = {
  facturacion_total: number;
  reclamos_totales: number;
  promedio_por_reclamo: number;
  total_comunas: number;
  alta_prioridad: number;
  tickets_unicos: number;
};

export type DashboardCommune = {
  comuna: string;
  region: string | null;
  reclamos: number;
  facturacion: number;
  promedio: number;
  prioridad_alta: number;
};

export type DashboardClaim = {
  ticket: string | null;
  mes: string | null;
  region: string | null;
  comuna: string | null;
  cliente: string | null;
  prioridad: string | null;
  estado_visita: string | null;
  fecha_recepcion: string | null;
  fecha_visita: string | null;
  facturacion: number | null;
  promedio: number | null;
  observacion: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

export type DashboardDatabaseResponse = {
  resumen: DashboardSummary;
  comunas: DashboardCommune[];
  reclamos: DashboardClaim[];
  errors: string[];
  available: boolean;
};

export const EMPTY_DASHBOARD_SUMMARY: DashboardSummary = {
  facturacion_total: 0,
  reclamos_totales: 0,
  promedio_por_reclamo: 0,
  total_comunas: 0,
  alta_prioridad: 0,
  tickets_unicos: 0,
};

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), { signal });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(payload.detail ?? 'No se pudieron cargar los datos del dashboard');
  }
  return (await response.json()) as T;
}

export type DashboardDatabaseFilters = {
  mes?: string;
  fechaInicio?: string;
  fechaFin?: string;
  region?: string;
  comuna?: string;
  prioridad?: string;
};

export async function fetchDashboardDatabase(
  filters: DashboardDatabaseFilters = {},
  signal?: AbortSignal,
): Promise<DashboardDatabaseResponse> {
  const query = new URLSearchParams();
  if (filters.mes) query.set('mes', filters.mes);
  if (filters.fechaInicio) query.set('fecha_inicio', filters.fechaInicio);
  if (filters.fechaFin) query.set('fecha_fin', filters.fechaFin);
  if (filters.region) query.set('region', filters.region);
  if (filters.comuna) query.set('comuna', filters.comuna);
  if (filters.prioridad) query.set('prioridad', filters.prioridad);
  const suffix = query.size > 0 ? `?${query.toString()}` : '';

  const results = await Promise.allSettled([
    fetchJson<DashboardSummary>(`/dashboard/resumen${suffix}`, signal),
    fetchJson<DashboardCommune[]>(`/dashboard/comunas${suffix}`, signal),
    fetchJson<DashboardClaim[]>(`/dashboard/reclamos${suffix}`, signal),
  ]);
  const [summaryResult, communesResult, claimsResult] = results;
  const errors = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return [];
    const endpoint = ['resumen', 'comunas', 'reclamos'][index];
    const message = result.reason instanceof Error ? result.reason.message : 'Error de conexión';
    return [`${endpoint}: ${message}`];
  });

  return {
    resumen: summaryResult.status === 'fulfilled' && summaryResult.value && typeof summaryResult.value === 'object'
      ? { ...EMPTY_DASHBOARD_SUMMARY, ...summaryResult.value }
      : EMPTY_DASHBOARD_SUMMARY,
    comunas: communesResult.status === 'fulfilled' && Array.isArray(communesResult.value) ? communesResult.value : [],
    reclamos: claimsResult.status === 'fulfilled' && Array.isArray(claimsResult.value) ? claimsResult.value : [],
    errors,
    available: results.some((result) => result.status === 'fulfilled'),
  };
}
