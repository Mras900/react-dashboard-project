import type { ImportedDashboardRow, ImportMode, RawImportedRow } from './importTypes';
import {
  getField,
  getRawField,
  formatImportedDate,
  normalizeHeader,
  normalizePriority,
  normalizeRegionName,
  normalizeVisitStatus,
  parseBooleanValue,
  parseMoney,
  parseNumberValue,
} from './normalizeImportedRows';

function buildValidationMessage(row: RawImportedRow) {
  const messages: string[] = [];
  if (!getField(row, ['N° Ticket', 'Ticket'])) messages.push('Falta Ticket');
  if (!getField(row, ['Ciudad'])) messages.push('Falta Ciudad');
  if (!getField(row, ['Estado Visita'])) messages.push('Falta Estado Visita');
  if (!getField(row, ['Precio Neto + Traslado']) && !getField(row, ['Precio Neto (Tarifa Plana)', 'Precio Neto Tarifa Plana'])) {
    messages.push('Falta Precio Neto + Traslado o Precio Neto Tarifa Plana');
  }
  return messages;
}

export function isConsolidadoRegionesFormat(row: RawImportedRow) {
  const headers = new Set(Object.keys(row).map(normalizeHeader));
  return ['Mes', 'Ticket', 'Ciudad', 'Estado Visita', 'Precio Neto Tarifa Plana', 'Traslado', 'Precio Neto + Traslado'].every((header) =>
    headers.has(normalizeHeader(header)),
  );
}

export function normalizeRegionRows(rows: RawImportedRow[], sourceFileName: string, importMode: ImportMode = 'regiones'): ImportedDashboardRow[] {
  return rows.map((row, index) => {
    const regionOriginal = getField(row, ['Región']);
    const regionNormalizada = normalizeRegionName(regionOriginal);
    const traslado = parseMoney(getField(row, ['Traslado']));
    const precioNetoTarifaPlana = parseMoney(getField(row, ['Precio Neto (Tarifa Plana)', 'Precio Neto Tarifa Plana']));
    const precioNetoTraslado = parseMoney(getField(row, ['Precio Neto + Traslado']));
    const facturacionTotal = precioNetoTraslado || precioNetoTarifaPlana + traslado;
    const validationMessages = buildValidationMessage(row);
    const regionWarning = regionOriginal && regionNormalizada === regionOriginal ? 'Región sin normalización confirmada' : '';
    const ciudad = getField(row, ['Ciudad']);

    return {
      importRowId: `${sourceFileName}-${importMode}-regiones-${index}`,
      mes: getField(row, ['Mes']),
      ticket: getField(row, ['N° Ticket', 'Ticket']),
      fechaRecepcionTicket: formatImportedDate(getRawField(row, ['Fecha Recepcion ticket', 'Fecha Recepcion Ticket'])),
      fechaVisita: formatImportedDate(getRawField(row, ['Fecha Visita'])),
      fechaEnvioValija: formatImportedDate(getRawField(row, ['Fecha Envio Valija'])),
      prioridad: normalizePriority(getField(row, ['Prioridad'])),
      estadoVisita: getField(row, ['Estado Visita']),
      estadoVisitaNormalizado: normalizeVisitStatus(getField(row, ['Estado Visita'])),
      regionOriginal,
      regionNormalizada,
      ciudad,
      comuna: ciudad,
      cliente: getField(row, ['Cliente']),
      facturacionTotal,
      tarifaRuta: parseMoney(getField(row, ['Tarifa Ruta'])),
      km: parseNumberValue(getField(row, ['Cant. KM', 'Cant KM'])),
      traslado,
      valorEnvioBulto: parseMoney(getField(row, ['Valor Envio Bulto'])),
      retiroMuestra: parseBooleanValue(getField(row, ['Retiro Muestra'])),
      trackingStarken: getField(row, ['N° Tracking Starken', 'N Tracking Starken']),
      fechaEnvioMuestras: formatImportedDate(getRawField(row, ['Fecha Envio de Muestras', 'Fecha Envio Muestras'])),
      observacion: getField(row, ['OBSERVACION', 'Observacion']),
      scope: 'regiones' as const,
      sourceFileName,
      importMode,
      validationStatus: validationMessages.length > 0 ? ('error' as const) : regionWarning ? ('warning' as const) : ('valid' as const),
      validationMessage: [...validationMessages, regionWarning].filter(Boolean).join('; '),
      extraFields: row,
    };
  });
}
