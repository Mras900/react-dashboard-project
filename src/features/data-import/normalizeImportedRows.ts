import type { ImportedDashboardRow, ImportedPriority, ImportedVisitStatus, ImportSummary, RawImportedRow } from './importTypes';

export const IMPORT_COLUMN_ALIASES = {
  ticket: ['Ticket', 'N° Ticket', 'N Ticket', 'ID'],
  prioridad: ['Prioridad'],
  retiroMuestra: ['Retiro Muestra'],
  region: ['Región', 'Region', 'REGION_KUT'],
  ciudad: ['Ciudad'],
  comuna: ['Comuna', 'COMUNA', 'comuna', 'Ciudad/Comuna', 'Ciudad Comuna', 'Nombre Comuna', 'Comuna Normalizada', 'comuna_normalizada', 'Descripción Comuna', 'Descripcion Comuna'],
  cliente: ['Cliente'],
  fechaRecepcion: ['Fecha Recepción', 'Fecha Recepcion', 'Fecha Recepcion ticket', 'Fecha Recepcion Ticket'],
  fechaVisita: ['Fecha Visita', 'Fecha de Retiro / Entrega'],
  estadoVisita: ['Estado Visita', 'Estado'],
  tarifaRuta: ['Tarifa Ruta'],
  km: ['KM', 'Cant. KM', 'Cant KM'],
  precioNeto: ['Precio Neto', 'Precio Neto (Tarifa Plana)', 'Precio Neto Tarifa Plana'],
  traslado: ['Traslado'],
  precioNetoTraslado: ['Precio Neto + Traslado'],
  fechaEnvio: ['Fecha Envío', 'Fecha Envio', 'Fecha Envio Valija', 'Fecha Envio de Muestras', 'Fecha Envio Muestras'],
  tracking: ['Tracking', 'N° Tracking Starken', 'N Tracking Starken'],
  valorEnvio: ['Valor Envío', 'Valor Envio', 'Valor Envio Bulto'],
  observacion: ['Observación', 'Observacion', 'OBSERVACION', 'OBSERVCION'],
  factura: ['Factura', 'FACTURA', 'Facturación', 'Facturacion', 'facturacion', 'FACTURACION'],
  calle: ['Calle'],
  numero: ['Número', 'Numero'],
  mes: ['Mes'],
} as const;

export type ImportColumnKey = keyof typeof IMPORT_COLUMN_ALIASES;

export function aliasesFor(key: ImportColumnKey): string[] {
  return [...IMPORT_COLUMN_ALIASES[key]];
}

export function normalizeHeader(value: string) {
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

export function detectImportedColumns(rows: RawImportedRow[]) {
  const detected = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (String(key).trim()) detected.add(key);
    });
  });
  return [...detected].sort((a, b) => a.localeCompare(b, 'es'));
}

export function getField(row: RawImportedRow, candidates: readonly string[]) {
  const normalizedCandidates = candidates.map(normalizeHeader);
  const entry = Object.entries(row).find(([key]) => normalizedCandidates.includes(normalizeHeader(key)));
  const value = entry?.[1];

  return value === null || value === undefined ? '' : String(value).trim();
}

export function getAliasField(row: RawImportedRow, key: ImportColumnKey) {
  return getField(row, IMPORT_COLUMN_ALIASES[key]);
}

export function getRawField(row: RawImportedRow, candidates: readonly string[]) {
  const normalizedCandidates = candidates.map(normalizeHeader);
  const entry = Object.entries(row).find(([key]) => normalizedCandidates.includes(normalizeHeader(key)));
  return entry?.[1];
}

export function getRawAliasField(row: RawImportedRow, key: ImportColumnKey) {
  return getRawField(row, IMPORT_COLUMN_ALIASES[key]);
}

export function formatImportedDate(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  const text = String(value ?? '').trim();
  if (!text) return '';
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
}

export function parseMoney(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const normalized = text.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseNumberValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const parsed = Number(text.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseBooleanValue(value: unknown) {
  const text = String(value ?? '').trim().toLowerCase();
  if (['si', 'sí', 's', 'true', '1'].includes(text)) return true;
  if (['no', 'n', 'false', '0'].includes(text)) return false;
  return false;
}

export function normalizePriority(value: unknown): ImportedPriority {
  const text = String(value ?? '').trim().toLowerCase();
  if (text.includes('alta')) return 'alta';
  if (text.includes('media')) return 'media';
  if (text.includes('baja')) return 'baja';
  return 'sin_prioridad';
}

export function normalizeVisitStatus(value: unknown): ImportedVisitStatus {
  const text = String(value ?? '').trim().toLowerCase();
  if (['realizada', 'realizado', 'completada', 'finalizada', 'entregada'].some((item) => text.includes(item))) return 'completada';
  if (['no realizada', 'no exitosa', 'fallida'].some((item) => text.includes(item))) return 'no_realizada';
  if (['pendiente', 'programada'].some((item) => text.includes(item))) return 'pendiente';
  return 'sin_estado';
}

export function normalizeRegionName(value: string) {
  const normalized = value.trim();
  const simple = normalizeHeader(normalized);
  if (!normalized) return '';
  if (simple.includes('rancagua') || simple.includes('ohiggins') || simple.includes('libertador')) return "Libertador Bernardo O'Higgins";
  if (simple.includes('metropolitana') || simple === 'rm' || simple.includes('santiago')) return 'Región Metropolitana';
  return normalized;
}

export function summarizeImportRows(rows: ImportedDashboardRow[]): ImportSummary {
  const uniqueTickets = new Set(rows.filter((row) => row.ticket).map((row) => row.ticket));

  return {
    totalRows: rows.length,
    rmRows: rows.filter((row) => row.scope === 'rm').length,
    regionesRows: rows.filter((row) => row.scope === 'regiones').length,
    validRows: rows.filter((row) => row.validationStatus === 'valid').length,
    warningRows: rows.filter((row) => row.validationStatus === 'warning').length,
    errorRows: rows.filter((row) => row.validationStatus === 'error').length,
    totalFacturacion: rows.reduce((sum, row) => sum + (row.facturacionTotal ?? 0), 0),
    totalKm: rows.reduce((sum, row) => sum + (row.km ?? 0), 0),
    totalTraslado: rows.reduce((sum, row) => sum + (row.traslado ?? 0), 0),
    uniqueTickets: uniqueTickets.size,
  };
}
