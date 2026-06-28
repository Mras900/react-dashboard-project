import type { DesignPreset } from './designTypes';

export const DEFAULT_DESIGN_PRESET = {
  id: 'default-v1',
  name: 'Diseno actual protegido',
  protected: true,
  version: 1,
  texts: {
    dashboardTitle: 'Visor de Facturacion y Reclamos - RM/Regiones',
    dashboardSubtitle: 'Inteligencia operativa para decisiones estrategicas',
  },
  tokens: {
    primaryColor: 'default',
    backgroundColor: 'default',
    cardColor: 'default',
    textColor: 'default',
    borderRadius: 'default',
    spacingMode: 'comfortable',
  },
  widgets: [
    { id: 'kpiFacturacion', label: 'Facturacion total', visible: true },
    { id: 'kpiReclamos', label: 'Reclamos totales', visible: true },
    { id: 'kpiPromedio', label: 'Promedio por reclamo', visible: true },
    { id: 'kpiComunaTop', label: 'Top reclamos', visible: true },
    { id: 'kpiFacturacionTop', label: 'Top facturacion', visible: true },
    { id: 'kpiCoberturaComunas', label: 'Cobertura', visible: true },
    { id: 'mapaReclamos', label: 'Mapa de reclamos', visible: true },
    { id: 'statTotalComunas', label: 'Total comunas', visible: true },
    { id: 'statAltaPrioridad', label: 'Alta prioridad', visible: true },
    { id: 'statVariacionMensual', label: 'Periodo analizado', visible: true },
    { id: 'statTicketsUnicos', label: 'Tickets unicos', visible: true },
    { id: 'graficoFacturacionMensual', label: 'Facturacion mensual', visible: true },
    { id: 'topComunasReclamos', label: 'Top 10 comunas con mas reclamos', visible: true },
    { id: 'topComunasFacturacion', label: 'Top 10 comunas con mayor facturacion', visible: true },
    { id: 'distribucionPrioridad', label: 'Distribucion por prioridad', visible: true },
    { id: 'tablaComunas', label: 'Evidencia por comuna', visible: true },
  ],
} as const satisfies DesignPreset;
