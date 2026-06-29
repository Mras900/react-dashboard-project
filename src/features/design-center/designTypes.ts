export const DESIGN_STORAGE_KEY = 'dashboard-visual-config-v1';
export const DESIGN_CONFIG_VERSION = 1;
export const CURRENT_DESIGN_CONFIG_VERSION = 1;

export type DesignColorOption = 'default' | 'blue' | 'emerald' | 'slate' | 'white' | 'soft';
export type DesignRadiusOption = 'default' | 'compact' | 'rounded';
export type DesignSpacingMode = 'compact' | 'comfortable';
export type DesignSectionId = 'hero' | 'main' | 'side' | 'bottom';
export type DesignWidgetSize = 'small' | 'medium' | 'large';
export type DesignComponentSize = 'small' | 'medium' | 'large' | 'full';
export type DesignKpiSource = 'dashboard_resumen' | 'dashboard_comunas' | 'dashboard_reclamos' | 'dashboard_visitas';
export type DesignKpiAggregation = 'count' | 'sum' | 'average' | 'max' | 'min';
export type DesignKpiDatasetScope = 'all' | 'rm' | 'regiones';
export type DesignKpiIcon = 'file' | 'alert' | 'users' | 'map' | 'shield' | 'chart';
export type DesignKpiAccent = 'blue' | 'red' | 'cyan' | 'green' | 'amber' | 'slate';
export type DesignChartType = 'bar' | 'line' | 'pie';

export type DesignChartId =
  | 'chartGraficoFacturacionMensual'
  | 'chartTopComunasReclamos'
  | 'chartTopComunasFacturacion'
  | 'chartDistribucionPrioridad'
  | `customConfigChart:${string}`;

export type DesignChartConfig = {
  id: DesignChartId;
  title: string;
  subtitle?: string;
  type: DesignChartType;
  source: DesignKpiSource;
  xField: string;
  yField: string;
  aggregation: DesignKpiAggregation;
  datasetScope: DesignKpiDatasetScope;
  visible: boolean;
  section: DesignSectionId;
  order: number;
  size: DesignWidgetSize;
  accent: DesignKpiAccent;
  protected: boolean;
};

export type DesignComponentId =
  | 'header'
  | 'filters'
  | 'left-kpi-facturacion'
  | 'left-kpi-reclamos'
  | 'left-kpi-promedio'
  | 'main-map'
  | 'right-summary'
  | 'card-total-comunas'
  | 'card-alta-prioridad'
  | 'card-periodo'
  | 'card-tickets'
  | 'chart-facturacion-mensual'
  | 'chart-top-reclamos'
  | 'chart-top-facturacion'
  | 'chart-prioridad'
  | 'table-evidencia'
  | 'route-visitador';

export type DesignComponentConfig = {
  id: DesignComponentId;
  title: string;
  subtitle?: string;
  visible: boolean;
  order: number;
  section: DesignSectionId;
  size: DesignComponentSize;
  accent?: DesignKpiAccent;
};

export type DesignWidgetId =
  | 'kpiFacturacion'
  | 'kpiReclamos'
  | 'kpiPromedio'
  | 'kpiComunaTop'
  | 'kpiFacturacionTop'
  | 'kpiCoberturaComunas'
  | 'mapaReclamos'
  | 'statTotalComunas'
  | 'statAltaPrioridad'
  | 'statVariacionMensual'
  | 'statTicketsUnicos'
  | 'graficoFacturacionMensual'
  | 'topComunasReclamos'
  | 'topComunasFacturacion'
  | 'distribucionPrioridad'
  | 'tablaComunas';

export type DesignKpiId = DesignWidgetId | `customConfigKpi:${string}`;

export type DesignSectionConfig = {
  id: DesignSectionId;
  label: string;
  visible: boolean;
  order: number;
};

export type DesignWidgetConfig = {
  id: DesignWidgetId;
  title: string;
  description?: string;
  visible: boolean;
  order: number;
  section: DesignSectionId;
  size: DesignWidgetSize;
};

export type DesignKpiConfig = {
  id: DesignKpiId;
  title: string;
  description?: string;
  icon: DesignKpiIcon;
  accent: DesignKpiAccent;
  visible: boolean;
  order: number;
  section: DesignSectionId;
  size: DesignWidgetSize;
  protected: boolean;
  source?: DesignKpiSource;
  field?: string;
  aggregation?: DesignKpiAggregation;
  datasetScope?: DesignKpiDatasetScope;
};

export type DesignTokens = {
  primaryColor: DesignColorOption;
  backgroundColor: DesignColorOption;
  cardColor: DesignColorOption;
  textColor: DesignColorOption;
  borderRadius: DesignRadiusOption;
  spacingMode: DesignSpacingMode;
};

export type DesignTexts = {
  dashboardTitle: string;
  dashboardSubtitle: string;
};

export type DesignPreset = {
  id: 'default-v1';
  name: string;
  protected: true;
  version: typeof DESIGN_CONFIG_VERSION;
  texts: DesignTexts;
  tokens: DesignTokens;
  sections: DesignSectionConfig[];
  widgets: DesignWidgetConfig[];
  kpis: DesignKpiConfig[];
  charts: DesignChartConfig[];
  components: DesignComponentConfig[];
};

export type DesignConfig = {
  version: typeof DESIGN_CONFIG_VERSION;
  texts: DesignTexts;
  tokens: DesignTokens;
  sections: DesignSectionConfig[];
  widgets: DesignWidgetConfig[];
  kpis: DesignKpiConfig[];
  charts: DesignChartConfig[];
  components: DesignComponentConfig[];
};