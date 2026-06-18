import type { GeoJsonObject } from 'geojson';

export type RedZoneSeverity = 'baja' | 'media' | 'alta' | 'critica';
export type RedZoneDisplayMode = 'circle' | 'heatpoint' | 'polygon';
export type RedZoneStatus = 'active' | 'inactive';

export type RedZone = {
  id: number;
  name: string;
  comuna: string | null;
  region: string | null;
  lat: number | null;
  lon: number | null;
  radius_m: number;
  severity: RedZoneSeverity;
  source: string;
  status: RedZoneStatus;
  display_mode: RedZoneDisplayMode;
  polygon_geojson: GeoJsonObject | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RedZonePayload = Omit<RedZone, 'id' | 'created_at' | 'updated_at' | 'polygon_geojson'> & {
  polygon_geojson?: GeoJsonObject | null;
};

export type RedZoneDraft = RedZonePayload & { id?: number };
