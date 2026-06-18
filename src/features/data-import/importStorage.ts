import type { ComunaMetric } from '../../data/dashboardData';
import type { ImportedDashboardRow, ImportMode, TerritoryScope } from './importTypes';

export const RM_STORAGE_KEY = 'dashboard-rm-data';
export const REGIONES_STORAGE_KEY = 'dashboard-regiones-data';
export const IMPORT_METADATA_STORAGE_KEY = 'dashboard-import-metadata';

function isImportedDashboardRow(value: unknown): value is ImportedDashboardRow {
  return Boolean(value && typeof value === 'object' && 'scope' in value);
}

function loadRows(key: string): ImportedDashboardRow[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isImportedDashboardRow) : [];
  } catch {
    return [];
  }
}

function saveRows(key: string, rows: ImportedDashboardRow[]) {
  window.localStorage.setItem(key, JSON.stringify(rows));
}

export function loadRmImportedRows() {
  return loadRows(RM_STORAGE_KEY).filter((row) => row.scope === 'rm');
}

export function loadRegionImportedRows() {
  return loadRows(REGIONES_STORAGE_KEY).filter((row) => row.scope === 'regiones');
}

export function saveImportedRows(scope: TerritoryScope, rows: ImportedDashboardRow[]) {
  const scopedRows = rows.filter((row) => row.scope === scope && row.validationStatus !== 'error');
  saveRows(scope === 'rm' ? RM_STORAGE_KEY : REGIONES_STORAGE_KEY, scopedRows);
  window.localStorage.setItem(IMPORT_METADATA_STORAGE_KEY, JSON.stringify({ updatedAt: new Date().toISOString(), scope }));
}

export function saveAutoImportedRows(rows: ImportedDashboardRow[]) {
  saveRows(RM_STORAGE_KEY, rows.filter((row) => row.scope === 'rm' && row.validationStatus !== 'error'));
  saveRows(REGIONES_STORAGE_KEY, rows.filter((row) => row.scope === 'regiones' && row.validationStatus !== 'error'));
  window.localStorage.setItem(IMPORT_METADATA_STORAGE_KEY, JSON.stringify({ updatedAt: new Date().toISOString(), scope: 'auto' satisfies ImportMode }));
}

export function clearImportedRows(scope?: TerritoryScope) {
  if (!scope || scope === 'rm') window.localStorage.removeItem(RM_STORAGE_KEY);
  if (!scope || scope === 'regiones') window.localStorage.removeItem(REGIONES_STORAGE_KEY);
  window.localStorage.setItem(IMPORT_METADATA_STORAGE_KEY, JSON.stringify({ updatedAt: new Date().toISOString(), cleared: scope ?? 'all' }));
}

export function aggregateImportedRows(rows: ImportedDashboardRow[]): ComunaMetric[] {
  const grouped = new Map<string, ComunaMetric>();
  const ticketsByGroup = new Map<string, Set<string>>();

  rows
    .filter((row) => row.validationStatus !== 'error')
    .forEach((row) => {
      const comuna = row.comuna || row.ciudad || row.regionNormalizada || row.regionOriginal || 'Sin comuna';
      const current = grouped.get(comuna) ?? {
        comuna,
        visitas: 0,
        ticketsUnicos: 0,
        facturacion: 0,
        alta: 0,
        media: 0,
        baja: 0,
        reiteradas: 0,
        lat: 0,
        lng: 0,
      };
      const tickets = ticketsByGroup.get(comuna) ?? new Set<string>();

      current.visitas += 1;
      current.facturacion += row.facturacionTotal ?? 0;
      if (row.prioridad === 'alta') current.alta += 1;
      if (row.prioridad === 'media') current.media += 1;
      if (row.prioridad === 'baja') current.baja += 1;
      if (row.ticket) tickets.add(row.ticket);
      current.ticketsUnicos = tickets.size;

      grouped.set(comuna, current);
      ticketsByGroup.set(comuna, tickets);
    });

  return [...grouped.values()].sort((a, b) => b.visitas - a.visitas);
}
