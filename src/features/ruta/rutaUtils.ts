import type { Feature, FeatureCollection, GeoJsonObject, Geometry, Position } from 'geojson';
import type { CrmSession } from './crmAuth';
import type { CrmFetchResult, RedZonesLoadState, RutaCrmTicket, RutaFareTable, RutaStop, RutaSummary, RutaVisitStatus } from './rutaTypes';

const CRM_COLLECTION_CANDIDATES = ['ServiceRequestCollection', 'TicketCollection'];

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const getFirstString = (source: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = normalizeText(source[key]);
    if (value) return value;
  }

  return '';
};

const unwrapODataResult = (payload: unknown): Record<string, unknown> | null => {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const d = record.d as Record<string, unknown> | undefined;
  const root = d ?? record;
  const results = root.results;

  if (Array.isArray(results)) {
    return (results[0] as Record<string, unknown> | undefined) ?? null;
  }

  return root;
};

const quoteODataValue = (value: string) => value.replace(/'/g, "''");

const buildCrmTicketUrls = (baseUrl: string, ticketId: string): string[] => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const safeTicketId = encodeURIComponent(quoteODataValue(ticketId));
  const filterTicketId = encodeURIComponent(`ID eq '${quoteODataValue(ticketId)}'`);

  return CRM_COLLECTION_CANDIDATES.flatMap((collection) => [
    `${normalizedBaseUrl}/${collection}('${safeTicketId}')?$format=json`,
    `${normalizedBaseUrl}/${collection}?$filter=${filterTicketId}&$top=1&$format=json`,
  ]);
};

export function parseTicketIds(value: string): string[] {
  const seen = new Set<string>();

  return value
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

export function mapCrmTicket(rawTicket: Record<string, unknown>, fallbackId: string): RutaCrmTicket {
  const id = getFirstString(rawTicket, ['ID', 'ObjectID', 'TicketID', 'ServiceRequestID', 'InternalID']) || fallbackId;
  const clientName =
    getFirstString(rawTicket, ['CustomerName', 'AccountName', 'BuyerPartyName', 'Name', 'FormattedName']) ||
    'Cliente sin nombre';
  const address =
    getFirstString(rawTicket, ['Address', 'FormattedAddress', 'StreetPostalAddress', 'LocationAddress', 'InstallationAddress']) ||
    [
      getFirstString(rawTicket, ['StreetName', 'Street']),
      getFirstString(rawTicket, ['HouseID', 'HouseNumber']),
      getFirstString(rawTicket, ['CityName', 'City']),
      getFirstString(rawTicket, ['RegionName', 'Region']),
    ]
      .filter(Boolean)
      .join(', ');

  return {
    id,
    clientName,
    rut: getFirstString(rawTicket, ['TaxNumber', 'RUT', 'Rut', 'CustomerTaxID']) || undefined,
    address,
    phone: getFirstString(rawTicket, ['Phone', 'PhoneNumber', 'Mobile', 'MobilePhone']) || undefined,
    email: getFirstString(rawTicket, ['Email', 'EmailAddress', 'EMail']) || undefined,
  };
}

export async function fetchTicketFromCrm(ticketId: string, session: CrmSession): Promise<CrmFetchResult> {
  const urls = buildCrmTicketUrls(session.baseUrl, ticketId);
  let lastError = 'No se encontró el ticket en el CRM';

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: session.authHeader,
        },
      });

      if (response.status === 401) return { error: 'Sesión CRM no autorizada' };
      if (response.status === 403) return { error: 'Sin permisos para consultar tickets CRM' };
      if (response.status === 404) {
        lastError = 'No se encontró el ticket en el CRM';
        continue;
      }
      if (!response.ok) {
        lastError = 'No se pudo consultar el ticket en el CRM';
        continue;
      }

      const payload = await response.json();
      const rawTicket = unwrapODataResult(payload);

      if (rawTicket) {
        return { ticket: mapCrmTicket(rawTicket, ticketId) };
      }
    } catch {
      return {
        error: 'No se pudo conectar al CRM. Si el navegador bloquea CORS, se debe crear un proxy en vite.config.ts en una fase separada.',
        corsLikely: true,
      };
    }
  }

  return { error: lastError };
}

export async function loadRedZonesGeoJson(url: string): Promise<RedZonesLoadState> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return { data: null, error: 'No se encontró el GeoJSON de zonas rojas' };
    }

    return { data: (await response.json()) as GeoJsonObject, error: null };
  } catch {
    return { data: null, error: 'No se pudo cargar el GeoJSON de zonas rojas' };
  }
}

export async function loadGenericGeoJson(url: string): Promise<RedZonesLoadState> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return { data: null, error: `No se encontró el GeoJSON ${url}` };
    }

    return { data: (await response.json()) as GeoJsonObject, error: null };
  } catch {
    return { data: null, error: `No se pudo cargar el GeoJSON ${url}` };
  }
}

export function normalizeName(value: unknown): string {
  return typeof value === 'string'
    ? value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase()
    : '';
}

export function getFeatureComunaName(feature: Feature | undefined): string {
  const properties = feature?.properties as Record<string, unknown> | null | undefined;
  return (
    (properties?.COMUNA as string | undefined) ??
    (properties?.Comuna as string | undefined) ??
    (properties?.comuna as string | undefined) ??
    (properties?.NOM_COMUNA as string | undefined) ??
    (properties?.NOM_COM as string | undefined) ??
    (properties?.NOMBRE as string | undefined) ??
    (properties?.name as string | undefined) ??
    (properties?.NAME as string | undefined) ??
    ''
  );
}

export function getFeatureRegionName(feature: Feature | undefined): string {
  const properties = feature?.properties as Record<string, unknown> | null | undefined;
  return (
    (properties?.REGION as string | undefined) ??
    (properties?.Region as string | undefined) ??
    (properties?.region as string | undefined) ??
    (properties?.NOM_REGION as string | undefined) ??
    (properties?.NOM_REG as string | undefined) ??
    (properties?.['REGIÓN'] as string | undefined) ??
    (properties?.NOMBRE_REG as string | undefined) ??
    ''
  );
}

export function findComunaRegionByPoint(lat: number, lon: number, geoJson: GeoJsonObject | null): { comuna: string; region: string } | null {
  if (!geoJson || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const point: [number, number] = [lon, lat];
  const root = geoJson as FeatureCollection | Feature;

  if ('features' in root && Array.isArray(root.features)) {
    for (const feature of root.features) {
      if (geometryContainsPoint(feature.geometry, point)) {
        return {
          comuna: getFeatureComunaName(feature),
          region: getFeatureRegionName(feature),
        };
      }
    }
  }

  if ('geometry' in root && geometryContainsPoint(root.geometry, point)) {
    return {
      comuna: getFeatureComunaName(root),
      region: getFeatureRegionName(root),
    };
  }

  return null;
}

function pointInRing(point: [number, number], ring: Position[]): boolean {
  const [lng, lat] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygon(point: [number, number], polygon: Position[][]): boolean {
  const outerRing = polygon[0];
  if (!outerRing || !pointInRing(point, outerRing)) return false;

  return !polygon.slice(1).some((hole) => pointInRing(point, hole));
}

function geometryContainsPoint(geometry: Geometry | null, point: [number, number]): boolean {
  if (!geometry) return false;

  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry.coordinates);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
  }

  return false;
}

export function isPointInRedZone(lat: number | undefined, lng: number | undefined, redZones: GeoJsonObject | null): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !redZones) return false;

  const point: [number, number] = [lng as number, lat as number];
  const root = redZones as Feature | { features?: Feature[] };

  if ('features' in root && Array.isArray(root.features)) {
    return root.features.some((feature) => geometryContainsPoint(feature.geometry, point));
  }

  if ('geometry' in root) {
    return geometryContainsPoint(root.geometry, point);
  }

  return false;
}

export function getFareTable(totalTickets: number): RutaFareTable {
  if (totalTickets >= 13) {
    return {
      successful: 17500,
      unsuccessful: 8500,
    };
  }

  return {
    successful: 21500,
    unsuccessful: 10500,
  };
}

export function calculateStopValue(status: RutaVisitStatus, totalTickets: number): number {
  const fares = getFareTable(totalTickets);

  if (status === 'exitosa') return fares.successful;
  if (status === 'no_exitosa') return fares.unsuccessful;

  return 0;
}

export function buildRutaSummary(stops: RutaStop[]): RutaSummary {
  const fares = getFareTable(stops.length);

  return {
    ticketsToday: stops.length,
    successful: stops.filter((stop) => stop.status === 'exitosa').length,
    unsuccessful: stops.filter((stop) => stop.status === 'no_exitosa').length,
    pending: stops.filter((stop) => stop.status === 'pendiente').length,
    redZones: stops.filter((stop) => stop.isRedZone).length,
    totalValued: stops.reduce((sum, stop) => sum + calculateStopValue(stop.status, stops.length), 0),
    projectedMax: stops.length * fares.successful,
  };
}

export function createRutaStop(ticket: RutaCrmTicket, redZones: GeoJsonObject | null, coordinates: { lat?: number; lng?: number; error?: string }): RutaStop {
  return {
    ...ticket,
    referencia: `Ticket ${ticket.id}`,
    tickets: [ticket.id],
    claimsCount: 1,
    lat: coordinates.lat,
    lng: coordinates.lng,
    status: 'pendiente',
    observation: '',
    isRedZone: isPointInRedZone(coordinates.lat, coordinates.lng, redZones),
    error: coordinates.error,
  };
}

const escapeCsvValue = (value: unknown): string => {
  const text = String(value ?? '');

  if (/[",\n;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

type RutaCsvRouteSummary = {
  totalKm: number;
  estimatedLiters: number;
  estimatedFuelCost: number;
  fuelEfficiency: number;
  fuelPrice: number;
};

export function buildRutaCsv(stops: RutaStop[], routeSummary?: RutaCsvRouteSummary): string {
  const headers = ['ticket', 'cliente', 'rut', 'direccion', 'telefono', 'correo', 'lat', 'lng', 'estado', 'zona_roja', 'observacion', 'valor'];
  const rows = stops.map((stop) => [
    stop.id,
    stop.clientName,
    stop.rut ?? '',
    stop.address,
    stop.phone ?? '',
    stop.email ?? '',
    stop.lat ?? '',
    stop.lng ?? '',
    stop.status,
    stop.isRedZone ? 'si' : 'no',
    stop.observation,
    calculateStopValue(stop.status, stops.length),
  ]);

  const stopRows = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(';'));

  if (!routeSummary) return stopRows.join('\n');

  const summaryRows = [
    [],
    ['resumen_ruta'],
    ['kilometros_totales', routeSummary.totalKm.toFixed(1)],
    ['litros_estimados', routeSummary.estimatedLiters.toFixed(1)],
    ['costo_combustible', Math.round(routeSummary.estimatedFuelCost)],
    ['rendimiento_km_l', routeSummary.fuelEfficiency],
    ['precio_litro', routeSummary.fuelPrice],
  ];

  return [...stopRows, ...summaryRows.map((row) => row.map(escapeCsvValue).join(';'))].join('\n');
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function getRutaIntegrationMessage(corsWarning: boolean): string {
  if (corsWarning) {
    return 'El navegador puede bloquear el CRM por CORS. En una fase separada se debe crear un proxy en vite.config.ts.';
  }

  return 'La carga CRM directa queda preparada para MVP. Si el CRM bloquea CORS, se debe implementar proxy en una fase separada.';
}
