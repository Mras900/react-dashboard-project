import type { AddressSuggestion } from '../ruta/rutaTypes';
import { searchAddress } from '../ruta/services/rutaApi';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

export type MapValidationZone = {
  id: number | null;
  name: string;
  source: string;
  comuna: string | null;
  region: string | null;
  distance_m: number;
  radius_m: number | null;
  severity: string | null;
  lat: number | null;
  lon: number | null;
};

export type MapValidationResponse = {
  ok: boolean;
  status: 'inside' | 'nearby' | 'safe';
  message: string;
  lat: number;
  lon: number;
  inside_zones: MapValidationZone[];
  nearby_zones: MapValidationZone[];
  nearest_zone: MapValidationZone | null;
};

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(payload.detail ?? 'No se pudo completar la validación del mapa');
  }
  return (await response.json()) as T;
}

export { searchAddress };

export function validateRedZonePoint(lat: number, lon: number, nearbyThresholdM = 500): Promise<MapValidationResponse> {
  return requestJson<MapValidationResponse>(
    `/api/red-zones/validate-point?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&nearby_threshold_m=${encodeURIComponent(nearbyThresholdM)}`,
  );
}

export type { AddressSuggestion };
