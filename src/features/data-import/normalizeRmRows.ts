import type { ImportedDashboardRow, ImportMode, RawImportedRow } from './importTypes';
import { getField, normalizePriority, normalizeRegionName, normalizeVisitStatus, parseMoney } from './normalizeImportedRows';

function getRmTicket(row: RawImportedRow) {
  return getField(row, ['ID', 'N° Ticket', 'Ticket']);
}

function getRmDate(row: RawImportedRow) {
  return getField(row, ['Fecha de Retiro / Entrega', 'Fecha Visita']);
}

function getRmComuna(row: RawImportedRow) {
  return getField(row, ['Descripción Comuna', 'Comuna', 'Ciudad']);
}

function buildValidationMessage(row: RawImportedRow) {
  const messages: string[] = [];
  if (!getRmTicket(row)) messages.push('Falta ID, N° Ticket o Ticket');
  if (!getRmComuna(row)) messages.push('Falta comuna');
  if (!getRmDate(row)) messages.push('Falta fecha visita');
  return messages;
}

export function normalizeRmRows(rows: RawImportedRow[], sourceFileName: string, importMode: ImportMode = 'rm'): ImportedDashboardRow[] {
  const normalizedRows = rows.map((row, index) => {
    const ticket = getRmTicket(row);
    const estadoVisita = getField(row, ['Estado', 'Estado Visita']);
    const validationMessages = buildValidationMessage(row);
    const comuna = getRmComuna(row);
    const facturaField = getField(row, ['FACTURA']);
    const facturaInformada = facturaField !== '';
    const facturacionTotal = facturaInformada ? parseMoney(facturaField) : 0;

    return {
      importRowId: `${sourceFileName}-${importMode}-rm-${index}`,
      ticket,
      fechaVisita: getRmDate(row),
      prioridad: normalizePriority(getField(row, ['Prioridad'])),
      estadoVisita,
      estadoVisitaNormalizado: normalizeVisitStatus(estadoVisita),
      regionOriginal: getField(row, ['REGION_KUT', 'Región']),
      regionNormalizada: normalizeRegionName(getField(row, ['REGION_KUT', 'Región'])),
      comuna,
      ciudad: comuna,
      calle: getField(row, ['Calle']),
      numeroDireccion: getField(row, ['Número', 'Numero']),
      cliente: getField(row, ['Cliente']),
      facturacionTotal,
      facturaInformada,
      tarifaCalculada: facturaInformada ? facturacionTotal : 0,
      scope: 'rm' as const,
      sourceFileName,
      importMode,
      validationStatus: validationMessages.length > 0 ? ('warning' as const) : ('valid' as const),
      validationMessage: validationMessages.join('; '),
      observacion: getField(row, ['OBSERVCION', 'OBSERVACION']),
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
      if (row.facturaInformada) return;

      let tariff = 0;
      if (row.estadoVisitaNormalizado === 'completada') tariff = isHighVolumeDay ? 17500 : 21500;
      if (row.estadoVisitaNormalizado === 'no_realizada') tariff = isHighVolumeDay ? 8500 : 10500;

      row.tarifaCalculada = tariff;
      row.facturacionTotal = tariff;
    });
  });

  return normalizedRows;
}
