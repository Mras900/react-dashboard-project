import type { DashboardWidgetId, GridLayoutItem, GridLayouts, StoredDashboardLayout } from './types';

const LEGACY_STORAGE_KEYS = ['dashboard-layout-v1', 'dashboard-layout-v2', 'dashboard-layout-v3'];

export const STORAGE_KEY = 'dashboard-layout-v4';

const cloneLayoutItem = (item: GridLayoutItem): GridLayoutItem => ({ ...item });

const cloneLayouts = (layouts: GridLayouts): GridLayouts =>
  Object.fromEntries(
    Object.entries(layouts).map(([breakpoint, items]) => [
      breakpoint,
      items.map(cloneLayoutItem),
    ]),
  ) as GridLayouts;

export const defaultLayouts: GridLayouts = {
  xxl: [
    { i: 'kpiFacturacion', x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { i: 'kpiReclamos', x: 0, y: 2, w: 2, h: 2, minW: 2, minH: 2 },
    { i: 'kpiPromedio', x: 0, y: 4, w: 2, h: 2, minW: 2, minH: 2 },
    { i: 'mapaReclamos', x: 2, y: 0, w: 7, h: 6, minW: 5, minH: 5 },
    { i: 'kpiComunaTop', x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'kpiFacturacionTop', x: 9, y: 2, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'kpiCoberturaComunas', x: 9, y: 4, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'statTotalComunas', x: 0, y: 6, w: 3, h: 1, minW: 2, minH: 1 },
    { i: 'statAltaPrioridad', x: 3, y: 6, w: 3, h: 1, minW: 2, minH: 1 },
    { i: 'statVariacionMensual', x: 6, y: 6, w: 3, h: 1, minW: 2, minH: 1 },
    { i: 'statTicketsUnicos', x: 9, y: 6, w: 3, h: 1, minW: 2, minH: 1 },
    { i: 'graficoFacturacionMensual', x: 0, y: 7, w: 3, h: 3, minW: 3, minH: 3 },
    { i: 'topComunasReclamos', x: 3, y: 7, w: 3, h: 3, minW: 3, minH: 3 },
    { i: 'topComunasFacturacion', x: 6, y: 7, w: 3, h: 3, minW: 3, minH: 3 },
    { i: 'distribucionPrioridad', x: 9, y: 7, w: 3, h: 3, minW: 3, minH: 3 },
    { i: 'tablaComunas', x: 0, y: 10, w: 12, h: 5, minW: 6, minH: 4 },
  ],
  lg: [
    { i: 'kpiFacturacion', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
    { i: 'kpiReclamos', x: 4, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
    { i: 'kpiPromedio', x: 8, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
    { i: 'mapaReclamos', x: 0, y: 2, w: 12, h: 6, minW: 7, minH: 5 },
    { i: 'kpiComunaTop', x: 0, y: 8, w: 4, h: 2, minW: 3, minH: 2 },
    { i: 'kpiFacturacionTop', x: 4, y: 8, w: 4, h: 2, minW: 3, minH: 2 },
    { i: 'kpiCoberturaComunas', x: 8, y: 8, w: 4, h: 2, minW: 3, minH: 2 },
    { i: 'statTotalComunas', x: 0, y: 10, w: 3, h: 1, minW: 2, minH: 1 },
    { i: 'statAltaPrioridad', x: 3, y: 10, w: 3, h: 1, minW: 2, minH: 1 },
    { i: 'statVariacionMensual', x: 6, y: 10, w: 3, h: 1, minW: 2, minH: 1 },
    { i: 'statTicketsUnicos', x: 9, y: 10, w: 3, h: 1, minW: 2, minH: 1 },
    { i: 'graficoFacturacionMensual', x: 0, y: 11, w: 3, h: 3, minW: 3, minH: 3 },
    { i: 'topComunasReclamos', x: 3, y: 11, w: 3, h: 3, minW: 3, minH: 3 },
    { i: 'topComunasFacturacion', x: 6, y: 11, w: 3, h: 3, minW: 3, minH: 3 },
    { i: 'distribucionPrioridad', x: 9, y: 11, w: 3, h: 3, minW: 3, minH: 3 },
    { i: 'tablaComunas', x: 0, y: 14, w: 12, h: 5, minW: 6, minH: 4 },
  ],
  md: [
    { i: 'kpiFacturacion', x: 0, y: 0, w: 3, h: 2 },
    { i: 'kpiReclamos', x: 3, y: 0, w: 3, h: 2 },
    { i: 'kpiPromedio', x: 6, y: 0, w: 4, h: 2 },
    { i: 'mapaReclamos', x: 0, y: 2, w: 7, h: 6 },
    { i: 'kpiComunaTop', x: 7, y: 2, w: 3, h: 2 },
    { i: 'kpiFacturacionTop', x: 7, y: 4, w: 3, h: 2 },
    { i: 'kpiCoberturaComunas', x: 7, y: 6, w: 3, h: 2 },
    { i: 'statTotalComunas', x: 0, y: 8, w: 2, h: 1 },
    { i: 'statAltaPrioridad', x: 2, y: 8, w: 3, h: 1 },
    { i: 'statVariacionMensual', x: 5, y: 8, w: 2, h: 1 },
    { i: 'statTicketsUnicos', x: 7, y: 8, w: 3, h: 1 },
    { i: 'graficoFacturacionMensual', x: 0, y: 9, w: 5, h: 3 },
    { i: 'topComunasReclamos', x: 5, y: 9, w: 5, h: 3 },
    { i: 'topComunasFacturacion', x: 0, y: 12, w: 5, h: 3 },
    { i: 'distribucionPrioridad', x: 5, y: 12, w: 5, h: 3 },
    { i: 'tablaComunas', x: 0, y: 15, w: 10, h: 5 },
  ],
  sm: [
    { i: 'kpiFacturacion', x: 0, y: 0, w: 6, h: 2 },
    { i: 'kpiReclamos', x: 0, y: 2, w: 6, h: 2 },
    { i: 'kpiPromedio', x: 0, y: 4, w: 6, h: 2 },
    { i: 'mapaReclamos', x: 0, y: 6, w: 6, h: 6 },
    { i: 'kpiComunaTop', x: 0, y: 12, w: 6, h: 2 },
    { i: 'kpiFacturacionTop', x: 0, y: 14, w: 6, h: 2 },
    { i: 'kpiCoberturaComunas', x: 0, y: 16, w: 6, h: 2 },
    { i: 'statTotalComunas', x: 0, y: 18, w: 3, h: 1 },
    { i: 'statAltaPrioridad', x: 3, y: 18, w: 3, h: 1 },
    { i: 'statVariacionMensual', x: 0, y: 19, w: 3, h: 1 },
    { i: 'statTicketsUnicos', x: 3, y: 19, w: 3, h: 1 },
    { i: 'graficoFacturacionMensual', x: 0, y: 20, w: 6, h: 3 },
    { i: 'topComunasReclamos', x: 0, y: 23, w: 6, h: 3 },
    { i: 'topComunasFacturacion', x: 0, y: 26, w: 6, h: 3 },
    { i: 'distribucionPrioridad', x: 0, y: 29, w: 6, h: 3 },
    { i: 'tablaComunas', x: 0, y: 32, w: 6, h: 5 },
  ],
  xs: [
    { i: 'kpiFacturacion', x: 0, y: 0, w: 4, h: 2 },
    { i: 'kpiReclamos', x: 0, y: 2, w: 4, h: 2 },
    { i: 'kpiPromedio', x: 0, y: 4, w: 4, h: 2 },
    { i: 'mapaReclamos', x: 0, y: 6, w: 4, h: 6 },
    { i: 'kpiComunaTop', x: 0, y: 12, w: 4, h: 2 },
    { i: 'kpiFacturacionTop', x: 0, y: 14, w: 4, h: 2 },
    { i: 'kpiCoberturaComunas', x: 0, y: 16, w: 4, h: 2 },
    { i: 'statTotalComunas', x: 0, y: 18, w: 2, h: 1 },
    { i: 'statAltaPrioridad', x: 2, y: 18, w: 2, h: 1 },
    { i: 'statVariacionMensual', x: 0, y: 19, w: 2, h: 1 },
    { i: 'statTicketsUnicos', x: 2, y: 19, w: 2, h: 1 },
    { i: 'graficoFacturacionMensual', x: 0, y: 20, w: 4, h: 3 },
    { i: 'topComunasReclamos', x: 0, y: 23, w: 4, h: 3 },
    { i: 'topComunasFacturacion', x: 0, y: 26, w: 4, h: 3 },
    { i: 'distribucionPrioridad', x: 0, y: 29, w: 4, h: 3 },
    { i: 'tablaComunas', x: 0, y: 32, w: 4, h: 5 },
  ],
  xxs: [
    { i: 'kpiFacturacion', x: 0, y: 0, w: 2, h: 2 },
    { i: 'kpiReclamos', x: 0, y: 2, w: 2, h: 2 },
    { i: 'kpiPromedio', x: 0, y: 4, w: 2, h: 2 },
    { i: 'mapaReclamos', x: 0, y: 6, w: 2, h: 6 },
    { i: 'kpiComunaTop', x: 0, y: 12, w: 2, h: 2 },
    { i: 'kpiFacturacionTop', x: 0, y: 14, w: 2, h: 2 },
    { i: 'kpiCoberturaComunas', x: 0, y: 16, w: 2, h: 2 },
    { i: 'statTotalComunas', x: 0, y: 18, w: 2, h: 1 },
    { i: 'statAltaPrioridad', x: 0, y: 19, w: 2, h: 1 },
    { i: 'statVariacionMensual', x: 0, y: 20, w: 2, h: 1 },
    { i: 'statTicketsUnicos', x: 0, y: 21, w: 2, h: 1 },
    { i: 'graficoFacturacionMensual', x: 0, y: 22, w: 2, h: 3 },
    { i: 'topComunasReclamos', x: 0, y: 25, w: 2, h: 3 },
    { i: 'topComunasFacturacion', x: 0, y: 28, w: 2, h: 3 },
    { i: 'distribucionPrioridad', x: 0, y: 31, w: 2, h: 3 },
    { i: 'tablaComunas', x: 0, y: 34, w: 2, h: 5 },
  ],
};
export function loadDashboardLayout(): StoredDashboardLayout {
  if (typeof window === 'undefined') {
    return {
      layouts: cloneLayouts(defaultLayouts),
      hiddenWidgetIds: [],
    };
  }

  try {
    LEGACY_STORAGE_KEYS.forEach((key) => {
      window.localStorage.removeItem(key);
    });

    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return {
        layouts: cloneLayouts(defaultLayouts),
        hiddenWidgetIds: [],
      };
    }

    const parsed = JSON.parse(raw) as StoredDashboardLayout;

    return {
      layouts: parsed.layouts ? cloneLayouts(parsed.layouts) : cloneLayouts(defaultLayouts),
      hiddenWidgetIds: Array.isArray(parsed.hiddenWidgetIds) ? parsed.hiddenWidgetIds : [],
    };
  } catch {
    return {
      layouts: cloneLayouts(defaultLayouts),
      hiddenWidgetIds: [],
    };
  }
}

export function saveDashboardLayout(value: StoredDashboardLayout): void {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function resetDashboardLayout(): void {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(STORAGE_KEY);
}

export function toggleHiddenWidget(
  hiddenWidgetIds: DashboardWidgetId[],
  widgetId: DashboardWidgetId,
): DashboardWidgetId[] {
  if (hiddenWidgetIds.includes(widgetId)) {
    return hiddenWidgetIds.filter((id) => id !== widgetId);
  }

  return [...hiddenWidgetIds, widgetId];
}
