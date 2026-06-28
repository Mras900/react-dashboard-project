import type { DesignKpiAggregation, DesignKpiAccent, DesignKpiDatasetScope, DesignKpiIcon, DesignKpiSource } from './designTypes';

export type KpiFieldOption = {
  value: string;
  label: string;
  numeric?: boolean;
};

export type KpiSourceOption = {
  value: DesignKpiSource;
  label: string;
  fields: KpiFieldOption[];
};

export const kpiSourceOptions: KpiSourceOption[] = [
  {
    value: 'dashboard_resumen',
    label: 'dashboard_resumen',
    fields: [
      { value: 'facturacion_total', label: 'facturacion_total', numeric: true },
      { value: 'reclamos_totales', label: 'reclamos_totales', numeric: true },
      { value: 'promedio_por_reclamo', label: 'promedio_por_reclamo', numeric: true },
      { value: 'total_comunas', label: 'total_comunas', numeric: true },
      { value: 'alta_prioridad', label: 'alta_prioridad', numeric: true },
      { value: 'tickets_unicos', label: 'tickets_unicos', numeric: true },
    ],
  },
  {
    value: 'dashboard_comunas',
    label: 'dashboard_comunas',
    fields: [
      { value: 'comuna', label: 'comuna' },
      { value: 'region', label: 'region' },
      { value: 'dataset_scope', label: 'dataset_scope' },
      { value: 'reclamos', label: 'reclamos', numeric: true },
      { value: 'facturacion', label: 'facturacion', numeric: true },
      { value: 'promedio', label: 'promedio', numeric: true },
      { value: 'prioridad_alta', label: 'prioridad_alta', numeric: true },
    ],
  },
  {
    value: 'dashboard_reclamos',
    label: 'dashboard_reclamos',
    fields: [
      'ticket','mes','region','comuna','ciudad','cliente','prioridad','estado_visita','fecha_recepcion','fecha_visita','retiro_muestra','tarifa_ruta','km','precio_neto','traslado','precio_neto_traslado','fecha_envio','tracking','valor_envio','factura','calle','numero','source_file_name','facturacion','promedio','observacion','created_at','dataset_scope'
    ].map((value) => ({ value, label: value, numeric: ['tarifa_ruta','km','precio_neto','traslado','precio_neto_traslado','valor_envio','facturacion','promedio'].includes(value) })),
  },
  {
    value: 'dashboard_visitas',
    label: 'dashboard_visitas',
    fields: [
      { value: 'kpis.tickets', label: 'kpis.tickets', numeric: true },
      { value: 'kpis.visitas', label: 'kpis.visitas', numeric: true },
      { value: 'kpis.exitosas', label: 'kpis.exitosas', numeric: true },
      { value: 'kpis.no_exitosas', label: 'kpis.no_exitosas', numeric: true },
      { value: 'kpis.pendientes', label: 'kpis.pendientes', numeric: true },
      { value: 'kpis.zonas_rojas', label: 'kpis.zonas_rojas', numeric: true },
      { value: 'kpis.facturacion_visitas', label: 'kpis.facturacion_visitas', numeric: true },
      { value: 'kpis.combustible_costo', label: 'kpis.combustible_costo', numeric: true },
      { value: 'kpis.km', label: 'kpis.km', numeric: true },
      { value: 'kpis.tiempo_total_s', label: 'kpis.tiempo_total_s', numeric: true },
      { value: 'por_comuna.visitas', label: 'por_comuna.visitas', numeric: true },
      { value: 'por_comuna.tickets', label: 'por_comuna.tickets', numeric: true },
      { value: 'por_comuna.facturacion', label: 'por_comuna.facturacion', numeric: true },
      { value: 'por_region.visitas', label: 'por_region.visitas', numeric: true },
      { value: 'por_region.tickets', label: 'por_region.tickets', numeric: true },
      { value: 'por_region.facturacion', label: 'por_region.facturacion', numeric: true },
      { value: 'evidencia.valor_calculado', label: 'evidencia.valor_calculado', numeric: true },
      { value: 'evidencia.estado', label: 'evidencia.estado' },
      { value: 'evidencia.territorio', label: 'evidencia.territorio' },
    ],
  },
];

export const kpiAggregationOptions: Array<{ value: DesignKpiAggregation; label: string }> = [
  { value: 'count', label: 'count' },
  { value: 'sum', label: 'sum' },
  { value: 'average', label: 'average' },
  { value: 'max', label: 'max' },
  { value: 'min', label: 'min' },
];

export const kpiDatasetScopeOptions: Array<{ value: DesignKpiDatasetScope; label: string }> = [
  { value: 'all', label: 'all' },
  { value: 'rm', label: 'rm' },
  { value: 'regiones', label: 'regiones' },
];

export const kpiIconOptions: Array<{ value: DesignKpiIcon; label: string }> = [
  { value: 'file', label: 'Archivo' },
  { value: 'alert', label: 'Alerta' },
  { value: 'users', label: 'Usuarios' },
  { value: 'map', label: 'Mapa' },
  { value: 'shield', label: 'Escudo' },
  { value: 'chart', label: 'Grafico' },
];

export const kpiAccentOptions: Array<{ value: DesignKpiAccent; label: string }> = [
  { value: 'blue', label: 'Azul' },
  { value: 'red', label: 'Rojo' },
  { value: 'cyan', label: 'Cian' },
  { value: 'green', label: 'Verde' },
  { value: 'amber', label: 'Ambar' },
  { value: 'slate', label: 'Pizarra' },
];

export function isAllowedKpiSource(value: unknown): value is DesignKpiSource {
  return typeof value === 'string' && kpiSourceOptions.some((source) => source.value === value);
}

export function isAllowedKpiField(source: DesignKpiSource | undefined, field: unknown): field is string {
  if (!source || typeof field !== 'string') return false;
  return kpiSourceOptions.find((option) => option.value === source)?.fields.some((item) => item.value === field) ?? false;
}

export function isAllowedKpiAggregation(value: unknown): value is DesignKpiAggregation {
  return typeof value === 'string' && kpiAggregationOptions.some((option) => option.value === value);
}

export function isAllowedKpiDatasetScope(value: unknown): value is DesignKpiDatasetScope {
  return typeof value === 'string' && kpiDatasetScopeOptions.some((option) => option.value === value);
}

export function isAllowedKpiIcon(value: unknown): value is DesignKpiIcon {
  return typeof value === 'string' && kpiIconOptions.some((option) => option.value === value);
}

export function isAllowedKpiAccent(value: unknown): value is DesignKpiAccent {
  return typeof value === 'string' && kpiAccentOptions.some((option) => option.value === value);
}