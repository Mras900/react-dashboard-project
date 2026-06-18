import type { AddressSuggestion, RutaBackendVisit, RutaOptimizadaResponse, RutaStartPoint, SaveDailyVisitsPayload, SaveDailyVisitsResponse } from '../rutaTypes';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let detail = 'No se pudo conectar con el backend';

    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail ?? detail;
    } catch {
      detail = response.statusText || detail;
    }

    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export function buscarPorTicket(ticketId: string): Promise<RutaBackendVisit> {
  return requestJson<RutaBackendVisit>(`${API_BASE}/api/ruta/ticket/${encodeURIComponent(ticketId)}`);
}

export function buscarPorRut(rut: string): Promise<RutaBackendVisit> {
  return requestJson<RutaBackendVisit>(`${API_BASE}/api/ruta/rut/${encodeURIComponent(rut)}`);
}

export function optimizarRuta(
  inicio: string,
  visitas: RutaBackendVisit[],
  serviceMinutesPerStop: number,
  startPoint?: RutaStartPoint | null,
): Promise<RutaOptimizadaResponse> {
  return requestJson<RutaOptimizadaResponse>(`${API_BASE}/api/ruta/optimizar`, {
    method: 'POST',
    body: JSON.stringify({
      inicio,
      service_minutes_per_stop: Math.max(serviceMinutesPerStop, 10),
      visitas,
      ...(startPoint ? { inicio_lat: startPoint.lat, inicio_lon: startPoint.lon } : {}),
    }),
  });
}

export function searchAddress(query: string): Promise<AddressSuggestion[]> {
  return requestJson<AddressSuggestion[]>(`${API_BASE}/api/geocode/search?q=${encodeURIComponent(query)}`);
}

export function guardarVisitasDiarias(payload: SaveDailyVisitsPayload): Promise<SaveDailyVisitsResponse> {
  return requestJson<SaveDailyVisitsResponse>(`${API_BASE}/api/ruta/visitas-diarias`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
