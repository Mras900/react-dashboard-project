import type { ImportedDashboardRow, ImportMode } from './importTypes';
import { normalizePriority, normalizeVisitStatus, parseMoney, parseNumberValue } from './normalizeImportedRows';

export type EditableImportedField =
  | 'ticket'
  | 'fechaVisita'
  | 'regionOriginal'
  | 'regionNormalizada'
  | 'ciudad'
  | 'comuna'
  | 'cliente'
  | 'prioridad'
  | 'estadoVisita'
  | 'facturacionTotal'
  | 'km'
  | 'traslado'
  | 'observacion';

export type EditableImportedChanges = Partial<Record<EditableImportedField, string>>;

function hasValue(value: unknown) {
  return String(value ?? '').trim().length > 0;
}

export function validateImportedRow(row: ImportedDashboardRow, _importMode: ImportMode): ImportedDashboardRow {
  const messages: string[] = [];
  const warnings: string[] = [];

  if (!hasValue(row.ticket)) messages.push('Falta ticket');

  if (row.scope === 'regiones') {
    if (!hasValue(row.ciudad) && !hasValue(row.comuna)) messages.push('Falta ciudad/comuna');
  }

  if (row.scope === 'rm') {
    if (!hasValue(row.comuna)) warnings.push('Falta comuna');
    if (!hasValue(row.fechaVisita)) warnings.push('Falta fecha visita');
  }


  return {
    ...row,
    prioridad: row.prioridad ?? 'sin_prioridad',
    estadoVisitaNormalizado: normalizeVisitStatus(row.estadoVisita),
    validationStatus: messages.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid',
    validationMessage: [...messages, ...warnings].join('; '),
  };
}

export function applyEditableImportedChanges(row: ImportedDashboardRow, changes: EditableImportedChanges, importMode: ImportMode): ImportedDashboardRow {
  const next: ImportedDashboardRow = { ...row };

  Object.entries(changes).forEach(([field, value]) => {
    if (field === 'facturacionTotal' || field === 'traslado') {
      next[field] = parseMoney(value);
      return;
    }

    if (field === 'km') {
      next.km = parseNumberValue(value);
      return;
    }

    if (field === 'prioridad') {
      next.prioridad = normalizePriority(value);
      return;
    }

    if (field === 'estadoVisita') {
      next.estadoVisita = value;
      next.estadoVisitaNormalizado = normalizeVisitStatus(value);
      return;
    }

    next[field as Exclude<EditableImportedField, 'facturacionTotal' | 'traslado' | 'km' | 'prioridad' | 'estadoVisita'>] = value;
  });

  return validateImportedRow(next, importMode);
}
