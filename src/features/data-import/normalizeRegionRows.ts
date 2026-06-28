import type { ImportedDashboardRow, ImportMode, RawImportedRow } from './importTypes';
import { detectDatasetScope, detectImportSchema } from './detectDatasetScope';
import {
  getAliasField,
  getRawAliasField,
  formatImportedDate,
  normalizePriority,
  normalizeRegionName,
  normalizeVisitStatus,
  parseBooleanValue,
  parseMoney,
  parseNumberValue,
} from './normalizeImportedRows';

function buildValidationMessage(row: RawImportedRow) {
  const messages: string[] = [];
  const warnings: string[] = [];
  if (!getAliasField(row, 'ticket')) messages.push('Falta Ticket');
  if (!getAliasField(row, 'ciudad') && !getAliasField(row, 'comuna')) messages.push('Falta Ciudad o Comuna');
  if (!getAliasField(row, 'fechaVisita') && !getAliasField(row, 'fechaRecepcion')) warnings.push('Falta Fecha Visita o Fecha Recepción');
  return { messages, warnings };
}

export function isConsolidadoRegionesFormat(row: RawImportedRow) {
  return detectImportSchema(Object.keys(row)) === 'regiones';
}

export function normalizeRegionRows(rows: RawImportedRow[], sourceFileName: string, importMode: ImportMode = 'regiones'): ImportedDashboardRow[] {
  return rows.map((row, index) => {
    const regionOriginal = getAliasField(row, 'region');
    const regionNormalizada = normalizeRegionName(regionOriginal);
    const traslado = parseMoney(getAliasField(row, 'traslado'));
    const precioNeto = parseMoney(getAliasField(row, 'precioNeto'));
    const precioNetoTraslado = parseMoney(getAliasField(row, 'precioNetoTraslado')) || precioNeto + traslado;
    const facturacionTotal = precioNetoTraslado || precioNeto + traslado;
    const validation = buildValidationMessage(row);
    const regionWarning = regionOriginal && regionNormalizada === regionOriginal ? 'Región sin normalización confirmada' : '';
    const ciudad = getAliasField(row, 'ciudad');
    const comuna = getAliasField(row, 'comuna') || ciudad;
    const estadoVisita = getAliasField(row, 'estadoVisita');

    return {
      importRowId: `${sourceFileName}-${importMode}-regiones-${index}`,
      mes: getAliasField(row, 'mes'),
      ticket: getAliasField(row, 'ticket'),
      fechaRecepcionTicket: formatImportedDate(getRawAliasField(row, 'fechaRecepcion')),
      fechaVisita: formatImportedDate(getRawAliasField(row, 'fechaVisita')),
      fechaEnvioValija: formatImportedDate(getRawAliasField(row, 'fechaEnvio')),
      prioridad: normalizePriority(getAliasField(row, 'prioridad')),
      estadoVisita,
      estadoVisitaNormalizado: normalizeVisitStatus(estadoVisita),
      regionOriginal,
      regionNormalizada,
      ciudad,
      comuna,
      calle: getAliasField(row, 'calle'),
      numeroDireccion: getAliasField(row, 'numero'),
      cliente: getAliasField(row, 'cliente'),
      facturacionTotal,
      factura: getAliasField(row, 'factura'),
      facturaInformada: Boolean(getAliasField(row, 'factura')),
      tarifaRuta: parseMoney(getAliasField(row, 'tarifaRuta')),
      tarifaCalculada: facturacionTotal,
      km: parseNumberValue(getAliasField(row, 'km')),
      precioNeto,
      traslado,
      precioNetoTraslado,
      valorEnvioBulto: parseMoney(getAliasField(row, 'valorEnvio')),
      retiroMuestra: parseBooleanValue(getAliasField(row, 'retiroMuestra')),
      trackingStarken: getAliasField(row, 'tracking'),
      fechaEnvioMuestras: formatImportedDate(getRawAliasField(row, 'fechaEnvio')),
      observacion: getAliasField(row, 'observacion'),
      scope: detectDatasetScope({ region: regionOriginal, comuna, ciudad, importScope: 'regiones' }),
      datasetScope: detectDatasetScope({ region: regionOriginal, comuna, ciudad, importScope: 'regiones' }),
      sourceFileName,
      importMode,
      validationStatus: validation.messages.length > 0 ? ('error' as const) : (validation.warnings.length > 0 || regionWarning) ? ('warning' as const) : ('valid' as const),
      validationMessage: [...validation.messages, ...validation.warnings, regionWarning].filter(Boolean).join('; '),
      extraFields: row,
    };
  });
}
