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
  sections: [
    { id: 'hero', label: 'Indicadores principales', visible: true, order: 0 },
    { id: 'main', label: 'Mapa principal', visible: true, order: 1 },
    { id: 'side', label: 'Resumen operativo', visible: true, order: 2 },
    { id: 'bottom', label: 'Analisis y evidencia', visible: true, order: 3 },
  ],
  widgets: [
    { id: 'kpiFacturacion', title: 'Facturacion total', description: 'Monto total del periodo seleccionado.', visible: true, order: 0, section: 'hero', size: 'medium' },
    { id: 'kpiReclamos', title: 'Reclamos totales', description: 'Total de reclamos filtrados.', visible: true, order: 1, section: 'hero', size: 'medium' },
    { id: 'kpiPromedio', title: 'Promedio por reclamo', description: 'Facturacion promedio por reclamo.', visible: true, order: 2, section: 'hero', size: 'medium' },
    { id: 'mapaReclamos', title: 'Mapa de reclamos', description: 'Intensidad territorial de reclamos.', visible: true, order: 0, section: 'main', size: 'large' },
    { id: 'kpiComunaTop', title: 'Top reclamos', description: 'Comuna con mayor cantidad de reclamos.', visible: true, order: 0, section: 'side', size: 'medium' },
    { id: 'kpiFacturacionTop', title: 'Top facturacion', description: 'Comuna con mayor facturacion.', visible: true, order: 1, section: 'side', size: 'medium' },
    { id: 'kpiCoberturaComunas', title: 'Cobertura', description: 'Comunas con informacion disponible.', visible: true, order: 2, section: 'side', size: 'medium' },
    { id: 'statTotalComunas', title: 'Total comunas', description: 'Cantidad de comunas filtradas.', visible: true, order: 0, section: 'bottom', size: 'small' },
    { id: 'statAltaPrioridad', title: 'Alta prioridad', description: 'Reclamos de prioridad alta.', visible: true, order: 1, section: 'bottom', size: 'small' },
    { id: 'statVariacionMensual', title: 'Periodo analizado', description: 'Periodo aplicado a datos actuales.', visible: true, order: 2, section: 'bottom', size: 'small' },
    { id: 'statTicketsUnicos', title: 'Tickets unicos', description: 'Tickets distintos en el periodo.', visible: true, order: 3, section: 'bottom', size: 'small' },
    { id: 'graficoFacturacionMensual', title: 'Facturacion mensual', description: 'Evolucion mensual de facturacion.', visible: true, order: 4, section: 'bottom', size: 'medium' },
    { id: 'topComunasReclamos', title: 'Top 10 comunas con mas reclamos', description: 'Ranking por volumen de reclamos.', visible: true, order: 5, section: 'bottom', size: 'medium' },
    { id: 'topComunasFacturacion', title: 'Top 10 comunas con mayor facturacion', description: 'Ranking por facturacion.', visible: true, order: 6, section: 'bottom', size: 'medium' },
    { id: 'distribucionPrioridad', title: 'Distribucion por prioridad', description: 'Composicion por prioridad.', visible: true, order: 7, section: 'bottom', size: 'medium' },
    { id: 'tablaComunas', title: 'Evidencia por comuna', description: 'Tabla de respaldo operacional.', visible: true, order: 8, section: 'bottom', size: 'large' },
  ],
} as const satisfies DesignPreset;