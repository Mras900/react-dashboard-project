import type { AggregationType, ChartConfig, ChartDataPoint } from './chart-types';

type GenericRow = Record<string, unknown>;

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const aggregate = (values: number[], aggregation: AggregationType): number => {
  if (aggregation === 'count') return values.length;
  if (values.length === 0) return 0;
  if (aggregation === 'avg') return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (aggregation === 'max') return Math.max(...values);
  if (aggregation === 'min') return Math.min(...values);
  return values.reduce((sum, value) => sum + value, 0);
};

export function buildChartData(config: ChartConfig, rows: GenericRow[]): ChartDataPoint[] {
  const grouped = new Map<string, GenericRow[]>();

  rows.forEach((row) => {
    const key = String(row[config.dimension] ?? 'Sin dato');
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  });

  let data = Array.from(grouped.entries()).map(([name, groupRows]) => {
    const values = groupRows.map((row) => toNumber(row[config.metric]));
    return {
      name,
      value: aggregate(values, config.aggregation),
      raw: { rows: groupRows.length },
    };
  });

  if (config.sortBy === 'value-desc') data = data.sort((a, b) => b.value - a.value);
  if (config.sortBy === 'value-asc') data = data.sort((a, b) => a.value - b.value);
  if (config.sortBy === 'name-asc') data = data.sort((a, b) => a.name.localeCompare(b.name));
  if (config.sortBy === 'name-desc') data = data.sort((a, b) => b.name.localeCompare(a.name));

  if (config.topN && config.topN > 0) {
    data = data.slice(0, config.topN);
  }

  return data;
}

export const formatChartValue = (value: number, metric: string): string => {
  if (metric === 'facturacion' || metric === 'ticketPromedio' || metric === 'average') {
    return value.toLocaleString('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    });
  }

  if (metric === 'ratio' || metric === 'share') {
    return `${value.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`;
  }

  return value.toLocaleString('es-CL');
};
