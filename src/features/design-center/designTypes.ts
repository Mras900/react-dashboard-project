export const DESIGN_STORAGE_KEY = 'dashboard-visual-config-v1';
export const DESIGN_CONFIG_VERSION = 1;

export type DesignColorOption = 'default' | 'blue' | 'emerald' | 'slate' | 'white' | 'soft';
export type DesignRadiusOption = 'default' | 'compact' | 'rounded';
export type DesignSpacingMode = 'compact' | 'comfortable';

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

export type DesignWidgetConfig = {
  id: DesignWidgetId;
  label: string;
  visible: boolean;
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
  widgets: DesignWidgetConfig[];
};

export type DesignConfig = {
  version: typeof DESIGN_CONFIG_VERSION;
  texts: DesignTexts;
  tokens: DesignTokens;
  widgets: DesignWidgetConfig[];
};
