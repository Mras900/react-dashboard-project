export type ChartType =
  | 'bar'
  | 'horizontalBar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'stackedBar'
  | 'radar'
  | 'scatter'
  | 'heatmap'
  | 'gauge'
  | 'table'
  | 'mapChoropleth'
  | 'mapBubbles';

export type DataScope = 'rm' | 'regiones' | 'ambos';

export type MetricKey =
  | 'visitas'
  | 'ticketsUnicos'
  | 'facturacion'
  | 'alta'
  | 'media'
  | 'baja'
  | 'reiteradas'
  | 'average'
  | 'share';

export type DimensionKey =
  | 'comuna'
  | 'region'
  | 'mes'
  | 'prioridad'
  | 'estadoVisita';

export type AggregationType = 'sum' | 'avg' | 'max' | 'min' | 'count';

export type SortMode = 'value-desc' | 'value-asc' | 'name-asc' | 'name-desc';

export type ChartConfig = {
  id: string;
  title: string;
  type: ChartType;
  scope: DataScope;
  metric: MetricKey;
  dimension: DimensionKey;
  aggregation: AggregationType;
  topN?: number;
  sortBy?: SortMode;
  showLegend?: boolean;
  showLabels?: boolean;
};

export type ChartDataPoint = {
  name: string;
  value: number;
  raw?: Record<string, unknown>;
};
