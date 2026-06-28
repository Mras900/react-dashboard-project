import type { ImportedDashboardRow, ImportMode, RawImportedRow } from './importTypes';
import { detectDatasetScope } from './detectDatasetScope';
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

function getRmTicket(row: RawImportedRow) {
  return getAliasField(row, 'ticket');
}

function getRmDate(row: RawImportedRow) {
  return getAliasField(row, 'fechaVisita');
}

function getRmComuna(row: RawImportedRow) {
  return getAliasField(row, 'comuna');
}

function buildValidationMessage(row: RawImportedRow) {
  const messages: string[] = [];
  if (!getRmTicket(row)) messages.push('Falta Ticket');
  if (!getRmComuna(row)) messages.push('Falta comuna');
  if (!getRmDate(row)) messages.push('Falta fecha visita');
  return messages;
}

export function normalizeRmRows(rows: RawImportedRow[], sourceFileName: string, importMode: ImportMode = 'rm'): ImportedDashboardRow[] {
  const normalizedRows = rows.map((row, index) => {
    const ticket = getRmTicket(row);
    const estadoVisita = getAliasField(row, 'estadoVisita');
    const validationMessages = buildValidationMessage(row);
    const comuna = getRmComuna(row);
    const factura = getAliasField(row, 'factura');
    const facturaInformada = factura !== '';
    const precioNeto = parseMoney(getAliasField(row, 'precioNeto'));
    const traslado = parseMoney(getAliasField(row, 'traslado'));
    const precioNetoTraslado = parseMoney(getAliasField(row, 'precioNetoTraslado')) || precioNeto + traslado;
    const facturacionTotal = facturaInformada ? parseMoney(factura) : precioNetoTraslado;
    const regionOriginal = getAliasField(row, 'region') || 'Región Metropolitana';

    return {
      importRowId: `${sourceFileName}-${importMode}-rm-${index}`,
      ticket,
      fechaVisita: formatImportedDate(getRawAliasField(row, 'fechaVisita')),
      fechaRecepcionTicket: formatImportedDate(getRawAliasField(row, 'fechaRecepcion')),
      fechaEnvioMuestras: formatImportedDate(getRawAliasField(row, 'fechaEnvio')),
      prioridad: normalizePriority(getAliasField(row, 'prioridad')),
      estadoVisita,
      estadoVisitaNormalizado: normalizeVisitStatus(estadoVisita),
      regionOriginal,
      regionNormalizada: normalizeRegionName(regionOriginal),
      comuna,
      ciudad: getAliasField(row, 'ciudad') || comuna,
      calle: getAliasField(row, 'calle'),
      numeroDireccion: getAliasField(row, 'numero'),
      cliente: getAliasField(row, 'cliente'),
      facturacionTotal,
      factura,
      facturaInformada,
      tarifaRuta: parseMoney(getAliasField(row, 'tarifaRuta')),
      tarifaCalculada: facturaInformada ? facturacionTotal : 0,
      km: parseNumberValue(getAliasField(row, 'km')),
      precioNeto,
      traslado,
      precioNetoTraslado,
      valorEnvioBulto: parseMoney(getAliasField(row, 'valorEnvio')),
      retiroMuestra: parseBooleanValue(getAliasField(row, 'retiroMuestra')),
      trackingStarken: getAliasField(row, 'tracking'),
      scope: detectDatasetScope({ region: regionOriginal, comuna, ciudad: getAliasField(row, 'ciudad'), importScope: 'rm' }),
      datasetScope: detectDatasetScope({ region: regionOriginal, comuna, ciudad: getAliasField(row, 'ciudad'), importScope: 'rm' }),
      sourceFileName,
      importMode,
      validationStatus: validationMessages.length > 0 ? ('warning' as const) : ('valid' as const),
      validationMessage: validationMessages.join('; '),
      observacion: getAliasField(row, 'observacion'),
      extraFields: row,
    };
  });

  const rowsByDate = new Map<string, ImportedDashboardRow[]>();
  normalizedRows.forEach((row) => {
    const dateKey = row.fechaVisita || 'sin_fecha';
    rowsByDate.set(dateKey, [...(rowsByDate.get(dateKey) ?? []), row]);
  });

  rowsByDate.forEach((dailyRows) => {
    const isHighVolumeDay = dailyRows.length > 13;
    dailyRows.forEach((row) => {
      if (row.facturaInformada || row.precioNetoTraslado) return;

      let tariff = 0;
      if (row.estadoVisitaNormalizado === 'completada') tariff = isHighVolumeDay ? 17500 : 21500;
      if (row.estadoVisitaNormalizado === 'no_realizada') tariff = isHighVolumeDay ? 8500 : 10500;

      row.tarifaCalculada = tariff;
      row.facturacionTotal = tariff;
    });
  });

  return normalizedRows;
}
