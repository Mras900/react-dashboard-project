import type { GeoJsonObject } from 'geojson';
import type { ImportedDashboardRow } from '../data-import/importTypes';

export type RutaVisitStatus = 'pendiente' | 'exitosa' | 'no_exitosa';

export type AddressSuggestion = {
  label: string;
  lat: number;
  lon: number;
  query_used: string;
};

export type RutaStartPoint = {
  label: string;
  lat: number;
  lon: number;
  source: 'manual_map' | 'search';
};

export type RutaBackendVisit = {
  referencia: string;
  ticket_id: string | null;
  nombre: string | null;
  rut: string | null;
  direccion: string | null;
  direccion_limpia?: string | null;
  telefono: string | null;
  correo: string | null;
  cantidad_reclamos: number;
  tickets: string[];
  lat: number | null;
  lon: number | null;
  peligro: boolean;
  prioridad?: 'alta' | 'media' | 'baja' | null;
  customer_id: string | null;
  geocode_query_used?: string | null;
};

export type RutaOptimizadaPoint = {
  orden: number;
  tipo: 'inicio' | 'visita';
  referencia: string;
  nombre: string;
  rut: string;
  direccion: string;
  lat: number;
  lon: number;
  peligro: boolean;
};

export type RutaOptimizadaResponse = {
  inicio: string;
  puntos: RutaOptimizadaPoint[];
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  distance_m: number;
  duration_s: number;
  travel_duration_s?: number;
  service_duration_s?: number;
  service_minutes_per_stop?: number;
  valid_visits_count?: number;
  detalle: RutaOptimizadaPoint[];
};

export type RutaCrmTicket = {
  id: string;
  clientName: string;
  rut?: string;
  address: string;
  phone?: string;
  email?: string;
};

export type RutaStop = RutaCrmTicket & {
  referencia: string;
  tickets: string[];
  customerId?: string;
  claimsCount: number;
  cleanAddress?: string;
  geocodeQueryUsed?: string;
  lat?: number;
  lng?: number;
  status: RutaVisitStatus;
  observation: string;
  isRedZone: boolean;
  error?: string;
};

export type RutaVisitadorViewProps = {
  redZonesGeoJson: string;
  importedReclamos?: ImportedDashboardRow[];
};

export type RutaSummary = {
  ticketsToday: number;
  successful: number;
  unsuccessful: number;
  pending: number;
  redZones: number;
  totalValued: number;
  projectedMax: number;
};

export type RutaFareTable = {
  successful: number;
  unsuccessful: number;
};

export type CrmFetchResult = {
  ticket?: RutaCrmTicket;
  error?: string;
  corsLikely?: boolean;
};

export type RedZonesLoadState = {
  data: GeoJsonObject | null;
  error: string | null;
};

export type SaveDailyVisitsResponse = {
  ok: boolean;
  saved: number;
  updated: number;
  rm: number;
  regiones: number;
  warnings: string[];
};

export type SaveDailyVisitsPayload = {
  fecha_carga: string;
  fecha_visita: string;
  visitador: string;
  visitas: Array<{
    ticket_id: string | null;
    referencia: string;
    nombre: string;
    rut: string | null;
    direccion_original: string | null;
    direccion: string | null;
    comuna?: string | null;
    region?: string | null;
    lat: number | null;
    lon: number | null;
    peligro: boolean;
    estado: RutaVisitStatus;
    observacion: string;
    cantidad_reclamos: number;
    tickets: string[];
    valor_visita: number;
    valor_no_exitosa: number;
    valor_calculado: number;
  }>;
  resumen_ruta: {
    inicio_label: string;
    inicio_lat: number | null;
    inicio_lon: number | null;
    geometry: RutaOptimizadaResponse['geometry'];
    distance_m: number;
    duration_s: number;
    travel_duration_s: number;
    service_duration_s: number;
    service_minutes_per_stop: number;
    fuel_efficiency_km_l: number;
    fuel_price: number;
    fuel_liters: number;
    fuel_cost: number;
  } | null;
};

