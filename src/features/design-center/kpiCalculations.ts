import type { DesignKpiConfig } from './designTypes';
import { isAllowedKpiField } from './kpiRegistry';

export type KpiDataSources = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getPathValue(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => asRecord(current)?.[key], value);
}

function getSourceRows(sourceValue: unknown, field: string) {
  if (Array.isArray(sourceValue)) return sourceValue;
  const [head, rest] = field.split('.', 2);
  const nested = rest ? asRecord(sourceValue)?.[head] : sourceValue;
  if (Array.isArray(nested)) return nested;
  if (nested && typeof nested === 'object') return [nested];
  return [sourceValue];
}

function getFieldValue(row: unknown, field: string) {
  if (!field.includes('.')) return asRecord(row)?.[field];
  const [, rest] = field.split('.', 2);
  return getPathValue(row, rest);
}

function filterByScope(rows: unknown[], scope: string | undefined) {
  if (!scope || scope === 'all') return rows;
  return rows.filter((row) => {
    const record = asRecord(row);
    if (!record || !('dataset_scope' in record)) return true;
    return record.dataset_scope === scope;
  });
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function calculateConfigurableKpi(kpi: DesignKpiConfig, dataSources: KpiDataSources) {
  if (!kpi.source || !kpi.field || !kpi.aggregation || !isAllowedKpiField(kpi.source, kpi.field)) {
    return { value: 0, displayValue: '0', detail: 'Sin datos' };
  }

  const source = kpi.source;
  const field = kpi.field;
  const sourceValue = dataSources[source];
  if (sourceValue == null) return { value: 0, displayValue: '0', detail: 'Sin datos' };

  const rows = filterByScope(getSourceRows(sourceValue, field), kpi.datasetScope);
  const values = rows.map((row) => getFieldValue(row, field)).filter((value) => value !== null && value !== undefined && value !== '');
  if (kpi.aggregation === 'count') {
    return { value: values.length, displayValue: values.length.toLocaleString('es-CL'), detail: `${values.length.toLocaleString('es-CL')} registros` };
  }

  const numbers = values.map(toNumber).filter((value) => Number.isFinite(value));
  if (numbers.length === 0) return { value: 0, displayValue: '0', detail: 'Sin datos' };

  const sum = numbers.reduce((total, value) => total + value, 0);
  const value = kpi.aggregation === 'sum'
    ? sum
    : kpi.aggregation === 'average'
      ? sum / numbers.length
      : kpi.aggregation === 'max'
        ? Math.max(...numbers)
        : Math.min(...numbers);

  return {
    value,
    displayValue: value.toLocaleString('es-CL', { maximumFractionDigits: 1 }),
    detail: `${kpi.aggregation} de ${kpi.field}`,
  };
}