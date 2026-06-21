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
};

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), { signal });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(payload.detail ?? 'No se pudieron cargar los datos del dashboard');
  }
  return (await response.json()) as T;
}

export async function fetchDashboardDatabase(
  signal?: AbortSignal,
): Promise<DashboardDatabaseResponse> {
  const [resumen, comunas, reclamos] = await Promise.all([
    fetchJson<DashboardSummary>('/dashboard/resumen', signal),
    fetchJson<DashboardCommune[]>('/dashboard/comunas', signal),
    fetchJson<DashboardClaim[]>('/dashboard/reclamos', signal),
  ]);

  return { resumen, comunas, reclamos };
}
