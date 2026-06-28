import type { DesignChartConfig } from './designTypes';
import type { KpiDataSources } from './kpiCalculations';

export type ChartDataPoint = {
  name: string;
  value: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function normalizeResumenToRows(sourceValue: unknown): Record<string, unknown>[] {
  const obj = asRecord(sourceValue);
  if (!obj) return [];
  return Object.entries(obj).map(([key, value]) => ({
    field: key,
    value: toNumber(value),
    _raw_value: value,
  }));
}

function getNestedArray(sourceValue: unknown, prefix: string): Record<string, unknown>[] {
  const obj = asRecord(sourceValue);
  if (!obj) return [];
  const arr = obj[prefix];
  if (Array.isArray(arr)) return arr.map((item) => asRecord(item)).filter(Boolean) as Record<string, unknown>[];
  return [];
}

function filterByScope(rows: Record<string, unknown>[], scope: string | undefined): Record<string, unknown>[] {
  if (!scope || scope === 'all') return rows;
  return rows.filter((row) => {
    if (!('dataset_scope' in row)) return true;
    return row.dataset_scope === scope;
  });
}

export function extractChartData(
  chart: DesignChartConfig,
  dataSources: KpiDataSources,
): ChartDataPoint[] | null {
  const sourceValue = dataSources[chart.source];
  if (sourceValue == null) return null;

  let rows: Record<string, unknown>[] = [];

  if (chart.source === 'dashboard_resumen') {
    rows = normalizeResumenToRows(sourceValue);
  } else if (chart.source === 'dashboard_visitas') {
    const xPrefix = chart.xField.includes('.') ? chart.xField.split('.')[0] : '';
    const yPrefix = chart.yField.includes('.') ? chart.yField.split('.')[0] : '';
    const prefix = xPrefix || yPrefix;
    if (prefix && (prefix === 'por_comuna' || prefix === 'por_region' || prefix === 'evidencia')) {
      rows = getNestedArray(sourceValue, prefix);
    } else {
      const obj = asRecord(sourceValue);
      if (obj) rows = [obj];
    }
  } else if (Array.isArray(sourceValue)) {
    rows = sourceValue.map((item) => asRecord(item)).filter(Boolean) as Record<string, unknown>[];
  } else {
    const obj = asRecord(sourceValue);
    if (obj) rows = [obj];
  }

  rows = filterByScope(rows, chart.datasetScope);
  if (rows.length === 0) return null;

  const xLocalField = chart.xField.includes('.') ? chart.xField.split('.').slice(1).join('.') : chart.xField;
  const yLocalField = chart.yField.includes('.') ? chart.yField.split('.').slice(1).join('.') : chart.yField;

  const groups = new Map<string, number[]>();

  for (const row of rows) {
    let xVal: unknown;
    let yVal: unknown;

    if (chart.source === 'dashboard_visitas' && xLocalField !== chart.xField) {
      xVal = resolvePath(row, xLocalField);
      yVal = resolvePath(row, yLocalField);
    } else {
      xVal = row[xLocalField];
      yVal = row[yLocalField];
    }

    if (xVal == null || xVal === '') continue;

    const label = String(xVal);
    if (!groups.has(label)) groups.set(label, []);
    const num = toNumber(yVal);
    if (num !== 0 || yVal !== undefined) {
      groups.get(label)!.push(num);
    }
  }

  if (groups.size === 0) return null;

  const data: ChartDataPoint[] = [];

  for (const [name, nums] of groups) {
    if (nums.length === 0) continue;
    let value = 0;
    switch (chart.aggregation) {
      case 'count':
        value = nums.length;
        break;
      case 'sum':
        value = nums.reduce((a, b) => a + b, 0);
        break;
      case 'average':
        value = nums.reduce((a, b) => a + b, 0) / nums.length;
        break;
      case 'max':
        value = Math.max(...nums);
        break;
      case 'min':
        value = Math.min(...nums);
        break;
    }
    data.push({ name, value: Math.round(value * 100) / 100 });
  }

  if (data.length === 0) return null;

  if (chart.type !== 'pie') {
    data.sort((a, b) => b.value - a.value);
  }

  return data;
}
