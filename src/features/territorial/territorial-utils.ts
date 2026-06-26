import type { TerritorialComunaMetric } from './territorial-types';

export function formatTerritorialNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits }).format(Number.isFinite(value) ? value : 0);
}

export function formatTerritorialMoney(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function getTopTerritorialCommunes(
  rows: readonly TerritorialComunaMetric[],
  metric: keyof Pick<
    TerritorialComunaMetric,
    'reclamosTotales' | 'reclamosPor100kHabitantes' | 'criticidadScore' | 'facturacionTotal'
  >,
  limit = 10,
) {
  return [...rows].sort((a, b) => Number(b[metric] ?? 0) - Number(a[metric] ?? 0)).slice(0, limit);
}

export function getRiskTone(level: string) {
  if (level === 'Crítico') return 'critical';
  if (level === 'Alto') return 'high';
  if (level === 'Medio') return 'medium';
  if (level === 'Bajo') return 'low';
  return 'empty';
}

