import type { RedZone, RedZonePayload } from './redZoneTypes';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(payload.detail ?? 'No se pudo completar la operación de zonas rojas');
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchRedZones(status?: string): Promise<RedZone[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return requestJson<RedZone[]>(`/api/red-zones${query}`);
}

export function createRedZone(payload: RedZonePayload): Promise<RedZone> {
  return requestJson<RedZone>('/api/red-zones', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateRedZone(id: number, payload: RedZonePayload): Promise<RedZone> {
  return requestJson<RedZone>(`/api/red-zones/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteRedZone(id: number): Promise<void> {
  return requestJson<void>(`/api/red-zones/${id}`, { method: 'DELETE' });
}
