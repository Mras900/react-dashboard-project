import type { RawImportedRow, TerritoryScope } from './importTypes';

export type ImportSchema = 'rm' | 'regiones' | 'unknown';

export type DetectDatasetScopeInput = {
  region?: string | null;
  comuna?: string | null;
  ciudad?: string | null;
  importScope?: string | null;
};

export const RM_COMUNAS = [
  'Cerrillos',
  'Cerro Navia',
  'Conchali',
  'El Bosque',
  'Estacion Central',
  'Huechuraba',
  'Independencia',
  'La Cisterna',
  'La Florida',
  'La Granja',
  'La Pintana',
  'La Reina',
  'Las Condes',
  'Lo Barnechea',
  'Lo Espejo',
  'Lo Prado',
  'Macul',
  'Maipu',
  'Nunoa',
  'Pedro Aguirre Cerda',
  'Penalolen',
  'Providencia',
  'Pudahuel',
  'Quilicura',
  'Quinta Normal',
  'Recoleta',
  'Renca',
  'San Joaquin',
  'San Miguel',
  'San Ramon',
  'Santiago',
  'Vitacura',
  'Puente Alto',
  'Pirque',
  'San Jose de Maipo',
  'Colina',
  'Lampa',
  'Tiltil',
  'San Bernardo',
  'Buin',
  'Calera de Tango',
  'Paine',
  'Melipilla',
  'Alhue',
  'Curacavi',
  'Maria Pinto',
  'San Pedro',
  'Talagante',
  'El Monte',
  'Isla de Maipo',
  'Padre Hurtado',
  'Penaflor',
] as const;

const RM_COMUNAS_NORMALIZED = new Set(RM_COMUNAS.map(normalizeImportText));

const RM_REGION_ALIASES = new Set([
  'rm',
  'metropolitana',
  'region metropolitana',
  'region metropolitana de santiago',
]);

const RM_SCHEMA_HEADERS = [
  'Comuna',
  'Fecha Visita',
  'ticket',
  'Calle',
  'Cliente',
  'Prioridad',
  'Numero',
  'FACTURA',
];

const REGIONES_SCHEMA_HEADERS = [
  'Ciudad',
  'Fecha Recepcion Ticket',
  'Fecha Visita',
  'Estado Visita',
  'Cant KM',
  'Traslado',
  'Precio Neto + Traslado',
];

export function normalizeImportText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeImportHeader(value: string): string {
  return normalizeImportText(value);
}

function hasAll(headers: Set<string>, required: readonly string[]) {
  return required.every((header) => headers.has(normalizeImportHeader(header)));
}

export function detectImportSchema(headers: Iterable<string>): ImportSchema {
  const normalizedHeaders = new Set([...headers].map(normalizeImportHeader).filter(Boolean));
  if (hasAll(normalizedHeaders, RM_SCHEMA_HEADERS)) return 'rm';
  if (hasAll(normalizedHeaders, REGIONES_SCHEMA_HEADERS)) return 'regiones';
  return 'unknown';
}

export function detectRowsImportSchema(rows: RawImportedRow[]): ImportSchema {
  const headers = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((key) => headers.add(key)));
  return detectImportSchema(headers);
}

export function isRmComuna(comuna?: string | null, ciudad?: string | null): boolean {
  const comunaName = normalizeImportText(comuna);
  const ciudadName = normalizeImportText(ciudad);
  return Boolean((comunaName && RM_COMUNAS_NORMALIZED.has(comunaName)) || (ciudadName && RM_COMUNAS_NORMALIZED.has(ciudadName)));
}

export function isRmRegion(region?: string | null): boolean {
  const normalized = normalizeImportText(region);
  if (!normalized) return false;
  return RM_REGION_ALIASES.has(normalized) || normalized.includes('metropolitana');
}

export function detectDatasetScope(input: DetectDatasetScopeInput): TerritoryScope {
  if (isRmComuna(input.comuna, input.ciudad)) return 'rm';
  if (isRmRegion(input.region)) return 'rm';
  if (input.importScope === 'rm' || input.importScope === 'regiones') return input.importScope;
  return 'regiones';
}

function getRawField(row: RawImportedRow, aliases: readonly string[]) {
  const normalizedAliases = aliases.map(normalizeImportHeader);
  return Object.entries(row).find(([key]) => normalizedAliases.includes(normalizeImportHeader(key)))?.[1];
}

export function detectRowDatasetScope(row: RawImportedRow, importScope?: string | null): TerritoryScope {
  return detectDatasetScope({
    comuna: String(getRawField(row, ['Comuna', 'Descripcion Comuna', 'Descripción Comuna']) ?? ''),
    ciudad: String(getRawField(row, ['Ciudad']) ?? ''),
    region: String(getRawField(row, ['Region', 'Región', 'REGION_KUT']) ?? ''),
    importScope,
  });
}
