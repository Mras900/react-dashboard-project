import type { DesignChartType, DesignKpiAccent, DesignKpiAggregation, DesignKpiDatasetScope, DesignKpiSource } from './designTypes';

export type ChartFieldOption = {
  value: string;
  label: string;
};

export type ChartTypeOption = {
  value: DesignChartType;
  label: string;
};

export type ChartSourceOption = {
  value: DesignKpiSource;
  label: string;
  xFields: ChartFieldOption[];
  yFields: ChartFieldOption[];
};

export const chartTypeOptions: ChartTypeOption[] = [
  { value: 'bar', label: 'Barras' },
  { value: 'line', label: 'Linea' },
  { value: 'pie', label: 'Torta' },
];

export const chartSourceOptions: ChartSourceOption[] = [
  {
    value: 'dashboard_resumen',
    label: 'dashboard_resumen',
    xFields: [
      { value: 'field', label: 'Campo (auto)' },
    ],
    yFields: [
      { value: 'value', label: 'Valor (auto)' },
    ],
  },
  {
    value: 'dashboard_comunas',
    label: 'dashboard_comunas',
    xFields: [
      { value: 'comuna', label: 'comuna' },
      { value: 'region', label: 'region' },
      { value: 'dataset_scope', label: 'dataset_scope' },
    ],
    yFields: [
      { value: 'reclamos', label: 'reclamos' },
      { value: 'facturacion', label: 'facturacion' },
      { value: 'promedio', label: 'promedio' },
      { value: 'prioridad_alta', label: 'prioridad_alta' },
    ],
  },
  {
    value: 'dashboard_reclamos',
    label: 'dashboard_reclamos',
    xFields: [
      { value: 'mes', label: 'mes' },
      { value: 'region', label: 'region' },
      { value: 'comuna', label: 'comuna' },
      { value: 'ciudad', label: 'ciudad' },
      { value: 'cliente', label: 'cliente' },
      { value: 'prioridad', label: 'prioridad' },
      { value: 'estado_visita', label: 'estado_visita' },
      { value: 'ticket', label: 'ticket' },
    ],
    yFields: [
      { value: 'tarifa_ruta', label: 'tarifa_ruta' },
      { value: 'km', label: 'km' },
      { value: 'precio_neto', label: 'precio_neto' },
      { value: 'traslado', label: 'traslado' },
      { value: 'precio_neto_traslado', label: 'precio_neto_traslado' },
      { value: 'valor_envio', label: 'valor_envio' },
      { value: 'facturacion', label: 'facturacion' },
      { value: 'promedio', label: 'promedio' },
      { value: 'reclamos', label: 'reclamos' },
    ],
  },
  {
    value: 'dashboard_visitas',
    label: 'dashboard_visitas',
    xFields: [
      { value: 'por_comuna.nombre', label: 'por_comuna.nombre' },
      { value: 'por_region.nombre', label: 'por_region.nombre' },
    ],
    yFields: [
      { value: 'kpis.tickets', label: 'kpis.tickets' },
      { value: 'kpis.visitas', label: 'kpis.visitas' },
      { value: 'kpis.exitosas', label: 'kpis.exitosas' },
      { value: 'kpis.no_exitosas', label: 'kpis.no_exitosas' },
      { value: 'kpis.pendientes', label: 'kpis.pendientes' },
      { value: 'kpis.zonas_rojas', label: 'kpis.zonas_rojas' },
      { value: 'kpis.facturacion_visitas', label: 'kpis.facturacion_visitas' },
      { value: 'kpis.combustible_costo', label: 'kpis.combustible_costo' },
      { value: 'kpis.km', label: 'kpis.km' },
      { value: 'kpis.tiempo_total_s', label: 'kpis.tiempo_total_s' },
      { value: 'por_comuna.visitas', label: 'por_comuna.visitas' },
      { value: 'por_comuna.tickets', label: 'por_comuna.tickets' },
      { value: 'por_comuna.facturacion', label: 'por_comuna.facturacion' },
      { value: 'por_region.visitas', label: 'por_region.visitas' },
      { value: 'por_region.tickets', label: 'por_region.tickets' },
      { value: 'por_region.facturacion', label: 'por_region.facturacion' },
    ],
  },
];

export const chartAggregationOptions: Array<{ value: DesignKpiAggregation; label: string }> = [
  { value: 'count', label: 'count' },
  { value: 'sum', label: 'sum' },
  { value: 'average', label: 'average' },
  { value: 'max', label: 'max' },
  { value: 'min', label: 'min' },
];

export const chartDatasetScopeOptions: Array<{ value: DesignKpiDatasetScope; label: string }> = [
  { value: 'all', label: 'all' },
  { value: 'rm', label: 'rm' },
  { value: 'regiones', label: 'regiones' },
];

export const chartAccentOptions: Array<{ value: DesignKpiAccent; label: string; hex: string }> = [
  { value: 'blue', label: 'Azul', hex: '#073B91' },
  { value: 'red', label: 'Rojo', hex: '#DC2626' },
  { value: 'cyan', label: 'Cian', hex: '#0891B2' },
  { value: 'green', label: 'Verde', hex: '#059669' },
  { value: 'amber', label: 'Ambar', hex: '#D97706' },
  { value: 'slate', label: 'Pizarra', hex: '#475569' },
];

const accentHexMap: Record<string, string> = {
  blue: '#073B91',
  red: '#DC2626',
  cyan: '#0891B2',
  green: '#059669',
  amber: '#D97706',
  slate: '#475569',
};

export function getChartAccentHex(accent: string): string {
  return accentHexMap[accent] ?? '#073B91';
}

export const chartPalette = ['#073B91', '#DC2626', '#0891B2', '#059669', '#D97706', '#475569', '#7C3AED', '#DB2777'];

export function isAllowedChartSource(value: unknown): value is DesignKpiSource {
  return typeof value === 'string' && chartSourceOptions.some((source) => source.value === value);
}

export function isAllowedChartXField(source: DesignKpiSource | undefined, field: unknown): field is string {
  if (!source || typeof field !== 'string') return false;
  const src = chartSourceOptions.find((option) => option.value === source);
  if (!src) return false;
  return src.xFields.some((item) => item.value === field);
}

export function isAllowedChartYField(source: DesignKpiSource | undefined, field: unknown): field is string {
  if (!source || typeof field !== 'string') return false;
  const src = chartSourceOptions.find((option) => option.value === source);
  if (!src) return false;
  return src.yFields.some((item) => item.value === field);
}

export function isAllowedChartType(value: unknown): value is DesignChartType {
  return typeof value === 'string' && chartTypeOptions.some((option) => option.value === value);
}
