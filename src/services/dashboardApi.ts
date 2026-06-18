const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export type DashboardDailyMetric = {
  nombre: string;
  visitas: number;
  tickets: number;
  exitosas: number;
  no_exitosas: number;
  pendientes: number;
  zonas_rojas: number;
  facturacion: number;
  combustible_costo: number;
  km: number;
  lat: number | null;
  lon: number | null;
};

export type DashboardDailyResponse = {
  kpis: {
    tickets: number;
    visitas: number;
    exitosas: number;
    no_exitosas: number;
    pendientes: number;
    zonas_rojas: number;
    facturacion_visitas: number;
    combustible_costo: number;
    km: number;
    tiempo_total_s: number;
  };
  por_comuna: DashboardDailyMetric[];
  por_region: DashboardDailyMetric[];
  evidencia: Array<{
    ticket_id: string;
    referencia: string;
    fecha_visita: string;
    comuna: string | null;
    region: string | null;
    territorio: string;
    estado: string;
    valor_calculado: number;
    visitador: string | null;
  }>;
};

export async function fetchDashboardDailyVisits(params: {
  territorio: 'rm' | 'regiones';
  fechaDesde?: string;
  fechaHasta?: string;
}): Promise<DashboardDailyResponse> {
  const query = new URLSearchParams({ territorio: params.territorio });
  if (params.fechaDesde) query.set('fecha_desde', params.fechaDesde);
  if (params.fechaHasta) query.set('fecha_hasta', params.fechaHasta);

  const response = await fetch(`${API_BASE}/api/dashboard/visitas?${query.toString()}`);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(payload.detail ?? 'No se pudieron cargar las visitas diarias');
  }
  return (await response.json()) as DashboardDailyResponse;
}
