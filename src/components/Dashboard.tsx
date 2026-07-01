import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Calculator,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  Download,
  Eye,
  FileBarChart,
  Grid2X2,
  HelpCircle,
  Landmark,
  MapPin,
  Navigation,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Siren,
  Trash2,
  Pen,
  Users,
  UserCog,
} from 'lucide-react';
import type { Feature, FeatureCollection, GeoJsonObject } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, useReducedMotion } from 'motion/react';
import { GeoJSON, LayersControl, MapContainer, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import { monthlyFacturacion, sourceSummary, type ComunaMetric } from '../data/dashboardData';
import { DataImportModal } from '../features/data-import/DataImportModal';
import { aggregateImportedRows, loadRegionImportedRows, loadRmImportedRows } from '../features/data-import/importStorage';
import type { ImportedDashboardRow, ImportedVisitStatus } from '../features/data-import/importTypes';
import type { DashboardWidget } from '../features/layout/types';
import { MapView } from '../features/mapa/MapView';
import { ReportsView } from '../features/reports/ReportsView';
import { RutaVisitadorView } from '../features/ruta/RutaVisitadorView';
import { UserMenu } from '../features/user/UserMenu';
import { ProtectedView } from '../features/auth/ProtectedView';
import type { AppViewKey } from '../features/auth/authTypes';
import { useAuth } from '../features/auth/useAuth';
import { UserManagementView } from '../features/users/UserManagementView';
import { loadRegionalGeoLayer } from '../features/maps/loadRegionalGeoLayer';
import { normalizeMapJoinKey } from '../features/maps/normalizeMapJoinKey';
import { RegionClaimsLayer } from '../features/maps/RegionClaimsLayer';
import { ActiveRedZonesLayers } from '../features/red-zones/ActiveRedZonesLayers';
import { fetchRedZones } from '../features/red-zones/redZonesApi';
import { TerritorialInsightCards } from '../features/territorial/TerritorialInsightCards';
import { TerritorialExplanationModal } from '../features/territorial/TerritorialExplanationModal';
import { TerritorialComunaDetailModal } from '../features/territorial/TerritorialComunaDetailModal';
import { useTerritorialMetrics } from '../features/territorial/useTerritorialMetrics';
import { getRouteDailyVisits, getRouteVisitsByDateRange } from '../features/ruta/routeDailyStorage';
import { getRouteDateRange, calculateRouteDailyMetrics } from '../features/ruta/routeDailyMetrics';
import type { RoutePeriod, RouteDailyMetrics } from '../features/ruta/routeDailyMetrics';
import type { RedZone } from '../features/red-zones/redZoneTypes';
import { fetchDashboardDailyVisits, type DashboardDailyResponse } from '../services/dashboardApi';
import { fetchDashboardDatabase, type DashboardClaim, type DashboardDatabaseResponse } from '../services/dashboardDatabaseApi';
import { applyDashboardTheme, loadStoredTheme } from '../lib/theme';
import { TailAdminTopbar } from '../features/layout/TailAdminTopbar';
import { TailAdminSidePanel } from '../features/layout/TailAdminSidePanel';
import { TailAdminRightPanel } from '../features/layout/TailAdminRightPanel';
import { TailAdminKpiCard } from '../features/ui-tailadmin/TailAdminKpiCard';
import { DesignCenterView } from '../features/design-center/DesignCenterView';
import { useDesignConfig } from '../features/design-center/useDesignConfig';
import { designTokenValues } from '../features/design-center/safeOptions';
import { ConfigurableKpiCard } from '../features/design-center/ConfigurableKpiCard';
import { ConfigurableChartCard } from '../features/design-center/ConfigurableChartCard';
import { EditableDashboardWrapper } from '../features/design-center/EditableDashboardWrapper';
import { InlineEditToolbar } from '../features/design-center/InlineEditToolbar';
import { ComponentEditPanel } from '../features/design-center/ComponentEditPanel';
import type { KpiDataSources } from '../features/design-center/kpiCalculations';
import type { DesignComponentConfig, DesignComponentId, DesignConfig, DesignKpiConfig, DesignKpiId, DesignSectionConfig, DesignSectionId, DesignWidgetId, DesignWidgetSize } from '../features/design-center/designTypes';
import { isRmComuna } from '../services/rmComunas';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';

type ActiveTab = 'dashboard' | 'ruta' | 'reports' | 'billing' | 'settings' | 'arqueo' | 'alerts' | 'map' | 'users' | 'help';
type PriorityFilter = 'todas' | 'alta' | 'media' | 'baja';
type StatusFilter = 'todos' | ImportedVisitStatus;
type MonthFilter = 'all' | string;
type LocationFilter = 'all' | string;
type DashboardTheme = 'default' | 'dark-premium';
type DateFilterMode = 'month' | 'week' | 'day' | 'range';
type DashboardFilters = {
  month: MonthFilter;
  priority: PriorityFilter;
  status: StatusFilter;
  location: LocationFilter;
};
type TerritorialMetricsResult = ReturnType<typeof useTerritorialMetrics>;
type TableRow = ComunaMetric & {
  share: number;
  average: number;
  normalizedBilling: number;
};

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: 'easeOut' as const },
};

const softHover = {
  whileHover: { y: -2 },
  transition: { duration: 0.18, ease: 'easeOut' as const },
};

function getFadeUpMotion(reduceMotion: boolean | null) {
  return reduceMotion
    ? { initial: false, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
    : fadeUp;
}
type MapLayerKey = 'borde' | 'limiteUrbano' | 'comunasKml' | 'cuadrantesSantiago';
type MapLayers = Record<MapLayerKey, GeoJsonObject | null>;
type RegionalMapMetric = {
  comuna: string;
  visitas: number;
  ticketsUnicos: number;
  facturacion: number;
  km: number;
  traslado: number;
  valorEnvioBulto: number;
  alta: number;
  media: number;
  baja: number;
  completadas: number;
  pendientes: number;
  noRealizadas: number;
};
type KpiMetricKey = 'visitas' | 'ticketsUnicos' | 'facturacion' | 'alta' | 'media' | 'baja' | 'reiteradas' | 'average' | 'share';
type KpiAggregation = 'sum' | 'avg' | 'max' | 'min' | 'count';
type KpiFormat = 'number' | 'currency' | 'percent';

type CustomKpi = {
  id: string;
  title: string;
  metric: KpiMetricKey;
  aggregation: KpiAggregation;
  format: KpiFormat;
};

type ConfiguredDashboardWidget = DashboardWidget & {
  description?: string;
  order?: number;
  section?: DesignSectionId;
  size?: DesignWidgetSize;
};

const navItems: Array<{ id: ActiveTab; label: string; icon: typeof Grid2X2; permission: AppViewKey; badge?: boolean; visible?: boolean }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Grid2X2, permission: 'dashboard' },
  { id: 'ruta', label: 'Ruta diaria', icon: Route, permission: 'ruta' },
  { id: 'reports', label: 'Reportes', icon: FileBarChart, permission: 'reportes' },
  { id: 'billing', label: 'Facturación', icon: Calculator, permission: 'dashboard' },
  { id: 'settings', label: 'Configuraciones', icon: ShieldCheck, permission: 'configuracion' },
  { id: 'arqueo', label: 'Arqueo Ruta', icon: ClipboardCheck, permission: 'ruta', visible: false },
  { id: 'alerts', label: 'Alertas', icon: AlertTriangle, permission: 'dashboard', badge: true, visible: false },
  { id: 'map', label: 'Mapa', icon: MapPin, permission: 'dashboard', visible: false },
  { id: 'users', label: 'Usuarios', icon: UserCog, permission: 'usuarios', visible: false },
];

const bottomNavItems = [
  { id: 'help' as const, label: 'Ayuda', icon: HelpCircle, permission: 'dashboard' as AppViewKey, visible: false },
];

const mapLayerSources: Array<{ key: MapLayerKey; url: string }> = [
  { key: 'borde', url: '/data/map-layers/borde-region-metropolitana.geojson' },
  { key: 'limiteUrbano', url: '/data/map-layers/limite-urbano-v2.geojson' },
  { key: 'comunasKml', url: '/data/map-layers/comunas.kml.geojson' },
  { key: 'cuadrantesSantiago', url: '/data/map-layers/cuadrantes-santiago.geojson' },
];

const DEFAULT_FILTERS: DashboardFilters = {
  month: 'all',
  priority: 'todas',
  status: 'todos',
  location: 'all',
};
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'dashboard-sidebar-collapsed';
// THEME_STORAGE_KEY moved to src/lib/theme.ts as THEME_KEY — import from there
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const MONTH_NUMBER_BY_LABEL: Record<string, number> = {
  Ene: 1,
  Feb: 2,
  Mar: 3,
  Abr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Ago: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dic: 12,
};

const getIsoDate = (date: Date | null | undefined) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return undefined;
  const offset = date.getTimezoneOffset();
  const normalized = new Date(date.getTime() - offset * 60_000);
  return Number.isNaN(normalized.getTime()) ? undefined : normalized.toISOString().slice(0, 10);
};

const formatWeekLabel = (weekValue: string) => {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekValue);
  return match ? `Semana ${Number(match[2])} de ${match[1]}` : 'Semana sin seleccionar';
};

const getWeekDateRange = (weekValue: string) => {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekValue);
  if (!match) return {};
  const year = Number(match[1]);
  const week = Number(match[2]);
  const januaryFourth = new Date(year, 0, 4);
  const januaryFourthDay = januaryFourth.getDay() || 7;
  const monday = new Date(year, 0, 4 - januaryFourthDay + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fechaInicio = getIsoDate(monday);
  const fechaFin = getIsoDate(sunday);
  return fechaInicio && fechaFin ? { fechaInicio, fechaFin } : {};
};

const getDashboardDateRange = (month: string) => {
  const monthNumber = MONTH_NUMBER_BY_LABEL[month];
  if (!monthNumber) return {};

  const year = 2026;
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const paddedMonth = String(monthNumber).padStart(2, '0');
  return {
    fechaDesde: `${year}-${paddedMonth}-01`,
    fechaHasta: `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`,
  };
};

const mergeComunaMetrics = (historical: ComunaMetric[], daily: ComunaMetric[]) => {
  const grouped = new Map<string, ComunaMetric>();

  [...historical, ...daily].forEach((item) => {
    const key = normalizeName(item.comuna);
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { ...item });
      return;
    }

    current.visitas += item.visitas;
    current.ticketsUnicos += item.ticketsUnicos;
    current.facturacion += item.facturacion;
    current.alta += item.alta;
    current.media += item.media;
    current.baja += item.baja;
    current.reiteradas += item.reiteradas;
    if (!current.lat && item.lat) current.lat = item.lat;
    if (!current.lng && item.lng) current.lng = item.lng;
  });

  return [...grouped.values()].sort((a, b) => b.visitas - a.visitas);
};

function loadImportedDashboardRows() {
  return {
    rm: loadRmImportedRows(),
    regiones: loadRegionImportedRows(),
  };
}

function normalizeDatabasePriority(value: string | null): ImportedDashboardRow['prioridad'] {
  const priority = normalizeName(value ?? '');
  if (priority === 'alta' || priority === 'alto' || priority === 'high') return 'alta';
  if (priority === 'media' || priority === 'medio' || priority === 'medium') return 'media';
  if (priority === 'baja' || priority === 'bajo' || priority === 'low') return 'baja';
  return 'sin_prioridad';
}

function isRmRegion(value: string | null) {
  const region = normalizeName(value ?? '');
  return region === 'rm' || region.includes('metropolitana');
}

function databaseClaimToImportedRow(claim: DashboardClaim, index: number): ImportedDashboardRow {
  return {
    importRowId: `postgresql-${claim.ticket ?? index}-${index}`,
    ticket: claim.ticket ?? '',
    mes: claim.mes ?? undefined,
    fechaVisita: claim.fecha_visita ?? undefined,
    fechaRecepcionTicket: claim.fecha_recepcion ?? undefined,
    prioridad: normalizeDatabasePriority(claim.prioridad),
    estadoVisita: claim.estado_visita ?? undefined,
    regionOriginal: claim.region ?? undefined,
    regionNormalizada: claim.region ?? undefined,
    comuna: claim.comuna ?? undefined,
    cliente: claim.cliente ?? undefined,
    facturacionTotal: Number(claim.facturacion ?? 0),
    observacion: claim.observacion ?? undefined,
    scope: (claim.dataset_scope as 'rm' | 'regiones') || (isRmRegion(claim.region) ? 'rm' : 'regiones'),
    datasetScope: (claim.dataset_scope as 'rm' | 'regiones'),
    sourceFileName: 'PostgreSQL',
    validationStatus: 'valid',
  };
}

const BORDE_RM_STYLE = {
  color: '#073B91',
  fillColor: '#0ea5e9',
  fillOpacity: 0.025,
  opacity: 0.32,
  weight: 1.4,
};
const LIMITE_URBANO_STYLE = {
  color: '#f97316',
  fillColor: '#f59e0b',
  fillOpacity: 0.04,
  opacity: 0.45,
  weight: 1,
};
const CUADRANTES_STYLE = {
  color: '#dc2626',
  fillColor: '#ef4444',
  fillOpacity: 0.045,
  opacity: 0.62,
  weight: 0.85,
};
const ZONAS_ROJAS_STYLE = {
  color: '#dc2626',
  fillColor: '#ef4444',
  fillOpacity: 0.22,
  opacity: 0.85,
  weight: 1.5,
};

const kpiMetricOptions: Array<{ label: string; value: KpiMetricKey; recommendedFormat: KpiFormat }> = [
  { label: 'Reclamos / visitas', value: 'visitas', recommendedFormat: 'number' },
  { label: 'Tickets únicos', value: 'ticketsUnicos', recommendedFormat: 'number' },
  { label: 'Facturación', value: 'facturacion', recommendedFormat: 'currency' },
  { label: 'Prioridad alta', value: 'alta', recommendedFormat: 'number' },
  { label: 'Prioridad media', value: 'media', recommendedFormat: 'number' },
  { label: 'Prioridad baja', value: 'baja', recommendedFormat: 'number' },
  { label: 'Visitas reiteradas', value: 'reiteradas', recommendedFormat: 'number' },
  { label: 'Promedio por reclamo', value: 'average', recommendedFormat: 'currency' },
  { label: 'Participación del total', value: 'share', recommendedFormat: 'percent' },
];

const kpiAggregationOptions: Array<{ label: string; value: KpiAggregation }> = [
  { label: 'Suma', value: 'sum' },
  { label: 'Promedio', value: 'avg' },
  { label: 'Máximo', value: 'max' },
  { label: 'Mínimo', value: 'min' },
  { label: 'Conteo', value: 'count' },
];

const kpiFormatOptions: Array<{ label: string; value: KpiFormat }> = [
  { label: 'Número', value: 'number' },
  { label: 'Moneda', value: 'currency' },
  { label: 'Porcentaje', value: 'percent' },
];

const formatInt = (value: number) => value.toLocaleString('es-CL');

const formatCurrency = (value: number) =>
  value.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  });

const formatCurrencyShort = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toLocaleString('es-CL', { maximumFractionDigits: 1 })}M`;
  }

  return formatCurrency(value);
};

const asPercent = (value: number) => `${value.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`;
const normalize = (value: number, max: number) => (max > 0 ? Math.max(7, Math.round((value / max) * 100)) : 0);
const sumComunaMetrics = (items: ComunaMetric[]) =>
  items.reduce(
    (acc, item) => ({
      visitas: acc.visitas + item.visitas,
      ticketsUnicos: acc.ticketsUnicos + item.ticketsUnicos,
      facturacion: acc.facturacion + item.facturacion,
      alta: acc.alta + item.alta,
      media: acc.media + item.media,
      baja: acc.baja + item.baja,
      reiteradas: acc.reiteradas + item.reiteradas,
    }),
    { visitas: 0, ticketsUnicos: 0, facturacion: 0, alta: 0, media: 0, baja: 0, reiteradas: 0 },
  );

const scaleMetric = (value: number, factor: number) => Math.max(0, Math.round(value * factor));

const escapeCsvValue = (value: string | number) => {
  const text = String(value);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const downloadCsv = (filename: string, rows: Array<Array<string | number>>) => {
  const csv = rows.map((row) => row.map(escapeCsvValue).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const getMapColor = (value: number, max: number) => {
  const ratio = max > 0 ? value / max : 0;

  if (ratio >= 0.76) return '#0f5fcf';
  if (ratio >= 0.52) return '#2f8fe8';
  if (ratio >= 0.34) return '#8cc8f5';
  if (ratio >= 0.14) return '#d8ebfb';
  return '#eaf3fb';
};

const MAP_LEGEND_LEVELS = [
  { label: 'Muy alto', color: '#0f5fcf' },
  { label: 'Alto', color: '#2f8fe8' },
  { label: 'Medio', color: '#8cc8f5' },
  { label: 'Bajo', color: '#d8ebfb' },
  { label: 'Muy bajo', color: '#eaf3fb' },
];

const normalizeName = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const normalizeComunaName = normalizeName;

const getFeatureComunaName = (feature: Feature | undefined) => {
  const properties = feature?.properties as Record<string, unknown> | null | undefined;

  return (
    (properties?.COMUNA as string | undefined) ||
    (properties?.Comuna as string | undefined) ||
    (properties?.comuna as string | undefined) ||
    (properties?.NOM_COMUNA as string | undefined) ||
    (properties?.NOM_COM as string | undefined) ||
    (properties?.NOMBRE as string | undefined) ||
    (properties?.name as string | undefined) ||
    (properties?.NAME as string | undefined) ||
    (properties?.Nombre as string | undefined) ||
    (properties?.Name as string | undefined) ||
    ''
  );
};


const emptyRegionalMetric = (comuna: string): RegionalMapMetric => ({
  comuna,
  visitas: 0,
  ticketsUnicos: 0,
  facturacion: 0,
  km: 0,
  traslado: 0,
  valorEnvioBulto: 0,
  alta: 0,
  media: 0,
  baja: 0,
  completadas: 0,
  pendientes: 0,
  noRealizadas: 0,
});

function bindRedZonePopup(feature: Feature | undefined, layer: L.Layer) {
  const properties = feature?.properties as Record<string, unknown> | null | undefined;
  const comuna = (properties?.Comuna as string | undefined) ?? 'Sin comuna';
  const nombreZona = (properties?.NombreZona as string | undefined) ?? 'Zona roja';

  layer.bindPopup(`
    <strong>Zona roja</strong><br/>
    ${nombreZona}<br/>
    <small>${comuna}</small>
  `);
}

function BaseMapLayers({ children }: { children?: React.ReactNode }) {
  return (
    <LayersControl position="topright">
      <LayersControl.BaseLayer name="Claro">
        <TileLayer
          attribution="&copy; OpenStreetMap &copy; CARTO"
          subdomains={['a', 'b', 'c', 'd']}
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer checked name="Calles">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Oscuro">
        <TileLayer
          attribution="© OpenStreetMap © CARTO"
          subdomains={['a', 'b', 'c', 'd']}
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Satélite">
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
      </LayersControl.BaseLayer>
      {children}
    </LayersControl>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`cc-card rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] ${className}`}>{children}</section>;
}

function SidebarIcon({
  active,
  badge,
  children,
  label,
  onClick,
}: {
  active?: boolean;
  badge?: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      data-active={active ? 'true' : 'false'}
      className={`cc-sidebar-item-pro cc-nav-item group relative flex h-10 w-10 items-center justify-center rounded-lg transition ${
        active ? 'cc-sidebar-item-active' : ''
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
      {badge ? <span className="cc-nav-alert absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" /> : null}
      <span className="cc-nav-tooltip pointer-events-none absolute left-[115%] z-50 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100">
        {label}
      </span>
    </button>
  );
}
void SidebarIcon;

function FilterControl({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="cc-filter cc-filter-trigger cc-input-pro relative flex h-11 min-w-[170px] items-center justify-between px-3 text-left">
      <span className="flex items-center gap-3">
        <span className="cc-filter-icon flex h-8 w-8 items-center justify-center rounded-md text-[#23446f]">{icon}</span>
        <span className="min-w-0">
          <span className="cc-label-pro cc-filter-label block">{label}</span>
          <select
            aria-label={label}
            className="cc-filter-native cc-filter-value block max-w-[150px] appearance-none truncate bg-transparent pr-6 text-sm font-black text-[var(--text-main)] outline-none"
            onChange={(event) => onChange(event.target.value)}
            value={value}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </span>
      </span>
      <ChevronDown className="cc-filter-icon pointer-events-none absolute right-3 text-[#466083]" size={16} />
    </label>
  );
}

function ProgressLine({ pct, tone = 'blue' }: { pct?: number; tone?: 'blue' | 'red' | 'green' }) {
  if (!pct || pct <= 0) return null;

  const color = tone === 'red' ? 'from-orange-500 to-red-500' : tone === 'green' ? 'from-emerald-400 to-emerald-600' : 'from-sky-400 to-blue-600';

  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function PrimaryMetric({
  icon,
  tone,
  title,
  value,
  delta,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  tone: 'blue' | 'red' | 'cyan';
  title: string;
  value: string;
  delta: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const fadeMotion = getFadeUpMotion(reduceMotion);

  return (
    <motion.div className="flex h-full flex-col gap-2" {...fadeMotion} {...(!reduceMotion ? softHover : {})}>
      <TailAdminKpiCard
        className="flex-1"
        detail={delta}
        icon={icon}
        title={title}
        tone={tone}
        value={value}
      />
      {actionLabel ? (
        <Button
          className="inline-flex h-8 w-fit items-center justify-center rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-[11px] font-black text-[var(--text-main)] shadow-sm transition hover:border-[#1B4FD8]/60 hover:bg-[var(--bg-card)]"
          onClick={onAction}
          type="button"
          variant="outline"
        >
          {actionLabel}
        </Button>
      ) : null}
    </motion.div>
  );
}

function InsightCard({
  icon,
  iconClass = '',
  label,
  title,
  detail,
  badge,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  iconClass?: string;
  label: string;
  title: string;
  detail: string;
  badge?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  showCrown?: boolean;
  progressPct?: number;
  progressTone?: 'blue' | 'red' | 'green';
}) {
  const reduceMotion = useReducedMotion();
  const fadeMotion = getFadeUpMotion(reduceMotion);
  const tailAdminTone = iconClass.includes('emerald')
    ? 'green'
    : iconClass.includes('blue')
      ? 'blue'
      : iconClass.includes('orange')
        ? 'amber'
        : 'slate';

  return (
    <motion.div className="flex h-full flex-col gap-2" {...fadeMotion} {...(!reduceMotion ? softHover : {})}>
      <TailAdminKpiCard
        className="flex-1"
        detail={detail}
        icon={icon}
        title={label}
        tone={tailAdminTone}
        trendLabel={badge}
        value={title}
      />
      {actionLabel ? (
        <Button
          className="inline-flex h-8 w-fit items-center justify-center rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-[11px] font-black text-[var(--text-main)] shadow-sm transition hover:border-[#1B4FD8]/60 hover:bg-[var(--bg-card)]"
          onClick={onAction}
          type="button"
          variant="outline"
        >
          {actionLabel}
        </Button>
      ) : null}
    </motion.div>
  );
}

function StatStripItem({
  icon,
  label,
  value,
  detail,
  actionLabel,
  onAction,
  progressPct,
  progressTone = 'blue',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
  progressPct?: number;
  progressTone?: 'blue' | 'red' | 'green';
}) {
  const reduceMotion = useReducedMotion();
  const fadeMotion = getFadeUpMotion(reduceMotion);

  return (
    <motion.div className="cc-stat-strip flex h-full min-w-0 items-start gap-3 px-4 py-3" {...fadeMotion}>
      <div className="cc-kpi-icon-pro flex h-9 w-9 shrink-0 items-center justify-center rounded-full">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="cc-kpi-label-pro">{label}</p>
        <p className="cc-kpi-value-pro mt-1">{value}</p>
        <p className="cc-kpi-meta-pro mt-1 leading-relaxed">{detail}</p>
        <ProgressLine pct={progressPct} tone={progressTone} />
        {actionLabel ? (
          <Button
            className="mt-3 inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-[11px] font-black text-[#073B91] shadow-sm transition hover:bg-blue-50"
            onClick={onAction}
            type="button"
            variant="outline"
          >
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="cc-empty-state-pro min-h-[140px]">
      <p className="cc-kpi-label-pro">Sin datos para los filtros seleccionados.</p>
    </div>
  );
}

function CustomKpiCard({
  detail,
  onRemove,
  title,
  value,
}: {
  detail: string;
  onRemove?: () => void;
  title: string;
  value: string;
}) {
  return (
    <Panel className="cc-kpi-card-pro flex min-h-[100px] items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="cc-kpi-icon-pro" style={{background:"rgba(217,70,239,0.08)",color:"var(--cc-magenta)"}}>
          <Calculator size={24} />
        </div>
        <div className="min-w-0">
          <p className="cc-kpi-label-pro">{title}</p>
          <p className="cc-kpi-value-pro mt-1">{value}</p>
          <p className="cc-kpi-meta-pro">{detail}</p>
        </div>
      </div>
      {onRemove ? (
        <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--cc-muted)] transition hover:bg-red-50 hover:text-red-500" onClick={onRemove} type="button" aria-label="Eliminar KPI">
          <Trash2 size={17} />
        </button>
      ) : null}
    </Panel>
  );
}

function VerticalBars({ items }: { items: Array<{ label: string; value: number; display: string }> }) {
  const safeItems = Array.isArray(items) ? items : [];
  const max = Math.max(0, ...safeItems.map((item) => item.value));

  return (
    <div className="cc-vertical-chart flex h-44 items-end gap-4 border-l border-b border-[var(--border-main)] px-3 pt-4">
      {safeItems.map((item, index) => (
        <div key={item.label} className="cc-vertical-item flex h-full flex-1 flex-col items-center justify-end gap-2">
          <span className="cc-chart-value text-[10px] font-black text-[var(--text-main)]">{item.display}</span>
          <div
            className={`cc-chart-bar w-full max-w-10 rounded-t-md ${index === safeItems.length - 1 ? 'cc-chart-bar-accent bg-[#0757bd]' : 'cc-chart-bar-primary bg-[#9fd0fb]'}`}
            style={{ height: `${normalize(item.value, max)}%` }}
          />
          <span className="cc-chart-label whitespace-nowrap text-[10px] font-bold text-[#466083]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function HorizontalBars({
  items,
  color,
  maxLabel,
}: {
  items: Array<{ name: string; value: number; label: string }>;
  color: 'red' | 'blue';
  maxLabel?: string;
}) {
  const safeItems = Array.isArray(items) ? items : [];
  const max = Math.max(0, ...safeItems.map((item) => item.value));
  const bar = color === 'red' ? 'bg-[#D55E00]' : 'bg-[#0072B2]';

  return (
    <div className="cc-horizontal-chart space-y-2">
      {safeItems.map((item) => (
        <div key={item.name} className="cc-chart-row grid grid-cols-[104px_1fr_52px] items-center gap-2 text-[11px]">
          <span className="cc-chart-label text-[10px] font-bold leading-tight text-[var(--text-main)]">{item.name}</span>
          <div className="cc-chart-track h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div aria-label={`${item.name}: ${item.label}`} className={`cc-chart-bar ${color === 'red' ? 'cc-chart-bar-danger' : 'cc-chart-bar-info'} h-full rounded-full ${bar}`} style={{ width: `${normalize(item.value, max)}%` }} title={`${item.name}: ${item.label}`} />
          </div>
          <span className="cc-chart-value text-right font-black text-[var(--text-main)]">{item.label}</span>
        </div>
      ))}
      {maxLabel ? <div className="cc-chart-axis flex justify-between pt-1 text-[10px] font-bold text-[#6b7d98]"><span>0</span><span>{maxLabel}</span></div> : null}
    </div>
  );
}
function MonthlyHorizontalBars({ items }: { items: Array<{ label: string; value: number; display: string }> }) {
  const safeItems = Array.isArray(items) ? items.slice(0, 8) : [];
  const max = Math.max(0, ...safeItems.map((item) => item.value));

  return (
    <div className="cc-monthly-horizontal-chart space-y-3">
      {safeItems.map((item) => (
        <div key={item.label} className="grid grid-cols-[68px_minmax(0,1fr)_74px] items-center gap-3 text-xs sm:grid-cols-[82px_minmax(0,1fr)_92px]">
          <span className="font-black text-[var(--text-main)]">{item.label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/80">
            <div
              aria-label={`${item.label}: ${item.display}`}
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300 shadow-[0_0_18px_rgba(14,165,255,0.28)]"
              style={{ width: `${normalize(item.value, max)}%` }}
              title={`${item.label}: ${item.display}`}
            />
          </div>
          <span className="text-right text-[11px] font-black text-blue-700 dark:text-cyan-200 sm:text-xs">{item.display}</span>
        </div>
      ))}
      {safeItems.length > 0 ? (
        <div className="flex justify-between pt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span>0</span>
          <span>{safeItems[0]?.display ?? ''}</span>
        </div>
      ) : null}
    </div>
  );
}


function Donut({
  center,
  label,
  segments,
}: {
  center: string;
  label: string;
  segments: Array<{ color: string; from: number; to: number; name: string; value: string }>;
}) {
  const safeSegments = Array.isArray(segments) ? segments : [];
  const background = `conic-gradient(${safeSegments.map((segment) => `${segment.color} ${segment.from}% ${segment.to}%`).join(', ')})`;

  return (
    <div className="cc-donut-chart flex items-center gap-5">
      <div className="cc-donut-ring relative h-36 w-36 shrink-0">
        <div aria-label={safeSegments.map((segment) => `${segment.name}: ${segment.value}`).join(", ")} className="cc-donut-segment absolute inset-0 rounded-full" role="img" style={{ background }} title={safeSegments.map((segment) => `${segment.name}: ${segment.value}`).join(" | ")} />
        <div className="cc-donut-center absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
          <span className="cc-donut-value text-xl font-black text-[var(--text-main)]">{center}</span>
          <span className="cc-chart-label text-xs font-bold text-[#466083]">{label}</span>
        </div>
      </div>
      <div className="cc-chart-legend flex-1 space-y-3">
        {safeSegments.map((segment) => (
          <div key={segment.name} className="cc-chart-legend-row flex items-center justify-between gap-3 text-xs">
            <span className="cc-chart-label flex items-center gap-2 font-bold text-[var(--text-main)]"><span className="cc-chart-swatch h-3 w-3 rounded" style={{ backgroundColor: segment.color }} />{segment.name}</span>
            <span className="cc-chart-value font-black text-[var(--text-main)]">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegionMapBounds({
  data,
  recenterKey = 0,
}: {
  data: GeoJsonObject | null;
  recenterKey?: number;
}) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();

      if (!data) {
        map.setView([-33.45, -70.65], 10);
        return;
      }

      try {
        const geoLayer = L.geoJSON(data);
        const bounds = geoLayer.getBounds();

        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20] });
        } else {
          map.setView([-33.45, -70.65], 10);
        }
      } catch {
        map.setView([-33.45, -70.65], 10);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [data, map, recenterKey]);

  return null;
}

function MapResizeHandler({ deps = [] }: { deps?: React.DependencyList }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [map, ...deps]);

  return null;
}

const MapLayers = React.memo(function MapLayers({
  mapLayers,
  zonasRojasGeoJson,
  comunaMetrics,
  maxVisitas,
  activeRedZones,
  onSelectComuna,
}: {
  mapLayers: MapLayers;
  zonasRojasGeoJson: GeoJsonObject | null;
  comunaMetrics: ComunaMetric[];
  maxVisitas: number;
  activeRedZones: RedZone[];
  onSelectComuna?: (comuna: string) => void;
}) {
  const metricByComuna = useMemo(() => {
    const entries = comunaMetrics.map((item) => [normalizeComunaName(item.comuna), item] as const);
    return new Map(entries);
  }, [comunaMetrics]);
  const totalVisitas = useMemo(() => comunaMetrics.reduce((sum, item) => sum + item.visitas, 0), [comunaMetrics]);
  const getMetricForFeature = useCallback(
    (feature: Feature | undefined) => metricByComuna.get(normalizeComunaName(getFeatureComunaName(feature))),
    [metricByComuna],
  );
  const comunaStyle = useCallback(
    (feature: Feature | undefined) => {
      const metric = getMetricForFeature(feature);
      const fillColor = metric ? getMapColor(metric.visitas, maxVisitas) : '#cbd5e1';

      return {
        color: '#ffffff',
        fillColor,
        fillOpacity: metric ? 0.58 : 0.12,
        opacity: 0.95,
        weight: 1.2,
      };
    },
    [getMetricForFeature, maxVisitas],
  );
  const onEachComunaFeature = useCallback(
    (feature: Feature, layer: L.Layer) => {
      const name = getFeatureComunaName(feature);
      const metric = getMetricForFeature(feature);
      const displayName = metric?.comuna || name || 'Comuna sin nombre';
      const share = metric && totalVisitas > 0 ? (metric.visitas / totalVisitas) * 100 : 0;

      layer.bindTooltip(displayName, { direction: 'top', sticky: true });
      layer.bindPopup(
        metric
          ? [
              '<div style="min-width:180px">',
              '<p style="font-weight:800;font-size:14px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:6px;color:#071b4d">' + displayName + '</p>',
              '<div style="font-size:12px;color:#172448">',
              '<p>Reclamos: <strong>' + formatInt(metric.visitas) + '</strong></p>',
              '<p style="margin-top:2px">Tickets únicos: <strong>' + formatInt(metric.ticketsUnicos) + '</strong></p>',
              '<p style="margin-top:2px">Facturación: <strong>' + formatCurrency(metric.facturacion) + '</strong></p>',
              '<p style="margin-top:2px">Alta prioridad: <strong>' + formatInt(metric.alta) + '</strong></p>',
              '<p style="margin-top:2px">Participación: <strong>' + asPercent(share) + '</strong></p>',
              '</div><p style="margin-top:8px;font-size:12px;font-weight:800;color:#0757bd">Ver detalle -&gt;</p></div>',
            ].join('')
          : `<strong>${displayName}</strong><br/>Sin información de reclamos cargada`,
      );

      const pathLayer = layer as L.Path;
      const baseColor = metric ? getMapColor(metric.visitas, maxVisitas) : '#cbd5e1';

      pathLayer.on({
        mouseover: () => {
          pathLayer.setStyle({ color: '#071b4d', fillOpacity: metric ? 0.78 : 0.22, weight: 2.4 });
          pathLayer.bringToFront();
        },
        mouseout: () => {
          pathLayer.setStyle({ color: '#ffffff', fillColor: baseColor, fillOpacity: metric ? 0.58 : 0.12, weight: 1.2 });
        },
        click: () => {
          if (metric) onSelectComuna?.(metric.comuna);
        },
      });
    },
    [getMetricForFeature, maxVisitas, onSelectComuna, totalVisitas],
  );
  const onEachCuadranteFeature = useCallback((feature: Feature, layer: L.Layer) => {
    const properties = feature.properties as { description?: string; name?: string } | null;
    const name = properties?.name;

    if (name) {
      layer.bindPopup(`<strong>${name}</strong>${properties?.description ? `<br/>${properties.description}` : ''}`);
    }
  }, []);

  return (
    <>
      {mapLayers.borde ? (
        <LayersControl.Overlay name="Borde RM">
          <GeoJSON
            data={mapLayers.borde}
            interactive={false}
            style={BORDE_RM_STYLE}
          />
        </LayersControl.Overlay>
      ) : null}
      {mapLayers.limiteUrbano ? (
        <LayersControl.Overlay name="Límite urbano">
          <GeoJSON
            data={mapLayers.limiteUrbano}
            interactive={false}
            style={LIMITE_URBANO_STYLE}
          />
        </LayersControl.Overlay>
      ) : null}
      {mapLayers.comunasKml ? (
        <LayersControl.Overlay checked name="Comunas KML">
          <GeoJSON
            data={mapLayers.comunasKml}
            onEachFeature={onEachComunaFeature}
            style={comunaStyle}
          />
        </LayersControl.Overlay>
      ) : null}
      {mapLayers.cuadrantesSantiago ? (
        <LayersControl.Overlay name="Cuadrantes Santiago">
          <GeoJSON
            data={mapLayers.cuadrantesSantiago}
            onEachFeature={onEachCuadranteFeature}
            style={CUADRANTES_STYLE}
          />
        </LayersControl.Overlay>
      ) : null}
      {zonasRojasGeoJson ? (
        <LayersControl.Overlay name="Zonas rojas históricas">
          <GeoJSON
            data={zonasRojasGeoJson}
            style={ZONAS_ROJAS_STYLE}
            onEachFeature={bindRedZonePopup}
          />
        </LayersControl.Overlay>
      ) : null}
      <ActiveRedZonesLayers redZoneMode="readonly" zones={activeRedZones} />
      {/* Las burbujas se desactivan: la métrica ahora se representa pintando el polígono de cada comuna. */}
    </>
  );
});

const getKpiMetricValue = (row: TableRow, metric: KpiMetricKey): number => {
  const value = row[metric];
  return typeof value === 'number' ? value : 0;
};

const calculateKpiValue = (tableRows: TableRow[], definition: Omit<CustomKpi, 'id'> | CustomKpi) => {
  const values = tableRows.map((row) => getKpiMetricValue(row, definition.metric)).filter((value) => Number.isFinite(value));

  if (definition.aggregation === 'count') return values.length;
  if (values.length === 0) return 0;
  if (definition.aggregation === 'avg') return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (definition.aggregation === 'max') return Math.max(...values);
  if (definition.aggregation === 'min') return Math.min(...values);

  return values.reduce((sum, value) => sum + value, 0);
};

const formatKpiValue = (value: number, format: KpiFormat) => {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') return asPercent(value);

  return formatInt(Math.round(value));
};

const getKpiDetail = (definition: Omit<CustomKpi, 'id'> | CustomKpi) => {
  const metricLabel = kpiMetricOptions.find((option) => option.value === definition.metric)?.label ?? definition.metric;
  const aggregationLabel = kpiAggregationOptions.find((option) => option.value === definition.aggregation)?.label ?? definition.aggregation;

  return `${aggregationLabel} de ${metricLabel}`;
};

function KpiBuilder({
  kpiDraft,
  setKpiDraft,
  customKpis,
  addCustomKpi,
  setCustomKpis,
  tableRows,
  totals,
}: {
  kpiDraft: Omit<CustomKpi, 'id'>;
  setKpiDraft: React.Dispatch<React.SetStateAction<Omit<CustomKpi, 'id'>>>;
  customKpis: CustomKpi[];
  addCustomKpi: () => void;
  setCustomKpis: React.Dispatch<React.SetStateAction<CustomKpi[]>>;
  tableRows: TableRow[];
  totals: { visitas: number; facturacion: number };
}) {
  const previewKpiValue = calculateKpiValue(tableRows, kpiDraft);

  return (
    <div className="grid gap-4">
      <Panel className="overflow-hidden">
        <div className="border-b border-[var(--border-main)] px-5 py-4">
          <p className="cc-label-pro">Constructor de KPI</p>
          <h2 className="cc-page-title-pro mt-1">Crear indicador desde la información cargada</h2>
        </div>

        <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-[#466083]">Nombre KPI</span>
              <input
                className="h-12 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-sm font-black text-[var(--text-main)] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setKpiDraft((current) => ({ ...current, title: event.target.value }))}
                value={kpiDraft.title}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-[#466083]">Métrica base</span>
              <select
                className="h-12 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-sm font-black text-[var(--text-main)] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => {
                  const metric = event.target.value as KpiMetricKey;
                  const recommendedFormat = kpiMetricOptions.find((option) => option.value === metric)?.recommendedFormat ?? kpiDraft.format;

                  setKpiDraft((current) => ({ ...current, metric, format: recommendedFormat }));
                }}
                value={kpiDraft.metric}
              >
                {kpiMetricOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-[#466083]">Cálculo</span>
              <select
                className="h-12 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-sm font-black text-[var(--text-main)] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setKpiDraft((current) => ({ ...current, aggregation: event.target.value as KpiAggregation }))}
                value={kpiDraft.aggregation}
              >
                {kpiAggregationOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-[#466083]">Formato</span>
              <select
                className="h-12 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-sm font-black text-[var(--text-main)] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setKpiDraft((current) => ({ ...current, format: event.target.value as KpiFormat }))}
                value={kpiDraft.format}
              >
                {kpiFormatOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <CustomKpiCard detail={getKpiDetail(kpiDraft)} title={kpiDraft.title || 'KPI personalizado'} value={formatKpiValue(previewKpiValue, kpiDraft.format)} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-main)] px-5 py-4">
          <p className="text-xs font-bold text-[#6b7d98]">Base actual: {formatInt(tableRows.length)} comunas, {formatInt(totals.visitas)} reclamos y {formatCurrency(totals.facturacion)} de facturación.</p>
          <button className="flex h-11 items-center gap-2 rounded-lg bg-[#073B91] px-5 text-sm font-black text-white shadow-lg shadow-blue-900/15" onClick={addCustomKpi} type="button">
            <Plus size={17} />
            Agregar KPI
          </button>
        </div>
      </Panel>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {customKpis.length > 0 ? (
          customKpis.map((kpi) => (
            <CustomKpiCard
              key={kpi.id}
              detail={getKpiDetail(kpi)}
              onRemove={() => setCustomKpis((current) => current.filter((item) => item.id !== kpi.id))}
              title={kpi.title}
              value={formatKpiValue(calculateKpiValue(tableRows, kpi), kpi.format)}
            />
          ))
        ) : (
          <Panel className="col-span-full flex min-h-[180px] flex-col items-center justify-center p-8 text-center">
            <Calculator className="mb-3 text-blue-600" size={38} />
            <h3 className="text-xl font-black text-[var(--text-main)]">Aún no hay KPIs personalizados</h3>
            <p className="mt-2 max-w-xl text-sm font-semibold text-[#6b7d98]">Usa el constructor superior para crear indicadores desde visitas, facturación, prioridades, reiteraciones o participación por comuna.</p>
          </Panel>
        )}
      </section>
    </div>
  );
}

function BillingView({
  tableRows,
  claims,
  totals,
  regionByComuna,
}: {
  tableRows: TableRow[];
  claims: DashboardClaim[];
  totals: { visitas: number; facturacion: number; ticketsUnicos: number };
  regionByComuna: Map<string, string>;
}) {
  type BillingReviewRow = {
    id: string;
    ticket: string;
    cliente: string;
    comuna: string;
    region: string;
    facturacion: number;
    estado: string;
    prioridad: string;
    observacion: string;
    fecha: string;
    source: 'detalle' | 'agregado';
  };

  const [billingSearch, setBillingSearch] = useState('');
  const [billingPeriod, setBillingPeriod] = useState('all');
  const [billingRegion, setBillingRegion] = useState('all');
  const [billingComuna, setBillingComuna] = useState('all');
  const [billingEstado, setBillingEstado] = useState('all');
  const [billingPriority, setBillingPriority] = useState('all');
  const [billingOnlyErrors, setBillingOnlyErrors] = useState(false);
  const [selectedBillingRow, setSelectedBillingRow] = useState<BillingReviewRow | null>(null);
  const reduceMotion = useReducedMotion();
  const fadeMotion = getFadeUpMotion(reduceMotion);

  const billingRows = useMemo<BillingReviewRow[]>(() => {
    if (claims.length > 0) {
      return claims.map((claim, index) => ({
        id: `${claim.ticket ?? 'sin-ticket'}-${index}`,
        ticket: claim.ticket?.trim() || `SIN-TICKET-${index + 1}`,
        cliente: claim.cliente?.trim() || 'Sin cliente',
        comuna: claim.comuna?.trim() || claim.ciudad?.trim() || '',
        region: claim.region?.trim() || '',
        facturacion: Number(claim.facturacion ?? 0),
        estado: claim.estado_visita?.trim() || '',
        prioridad: claim.prioridad?.trim() || '',
        observacion: claim.observacion?.trim() || '',
        fecha: claim.fecha_visita?.trim() || claim.fecha_recepcion?.trim() || claim.mes?.trim() || '',
        source: 'detalle',
      }));
    }

    return tableRows.map((row, index) => ({
      id: `agregado-${row.comuna}-${index}`,
      ticket: `AGREGADO-${index + 1}`,
      cliente: 'Agregado comunal',
      comuna: row.comuna,
      region: regionByComuna.get(normalizeName(row.comuna)) ?? 'Sin región',
      facturacion: row.facturacion,
      estado: 'Agregado',
      prioridad: row.alta > 0 ? 'Alta' : row.media > 0 ? 'Media' : row.baja > 0 ? 'Baja' : '',
      observacion: `${formatInt(row.visitas)} reclamos agregados`,
      fecha: 'Periodo filtrado',
      source: 'agregado',
    }));
  }, [claims, regionByComuna, tableRows]);

  const ticketCounts = useMemo(() => {
    const counts = new Map<string, number>();
    billingRows.forEach((row) => {
      const key = normalizeName(row.ticket);
      if (key && !key.startsWith('agregado-')) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [billingRows]);

  const positiveBillingValues = billingRows.map((row) => row.facturacion).filter((value) => value > 0);
  const averagePositiveBilling = positiveBillingValues.length > 0
    ? positiveBillingValues.reduce((sum, value) => sum + value, 0) / positiveBillingValues.length
    : 0;

  const getBillingIssues = useCallback((row: BillingReviewRow) => {
    const issues: Array<{ label: string; tone: 'critical' | 'warning' | 'ok' }> = [];
    const normalizedStatus = normalizeName(row.estado);
    const knownStatus = ['pendiente', 'exitosa', 'no_exitosa', 'no exitosa', 'completada', 'completado', 'cerrado', 'cerrada', 'abierto', 'abierta', 'agregado'];

    if (!row.comuna.trim()) issues.push({ label: 'Comuna faltante', tone: 'critical' });
    if (!row.region.trim() || normalizeName(row.region) === 'sin region' || normalizeName(row.region) === 'sin región') issues.push({ label: 'Región faltante', tone: 'critical' });
    if (row.facturacion <= 0) issues.push({ label: 'Facturación cero', tone: 'warning' });
    if (averagePositiveBilling > 0 && row.facturacion > averagePositiveBilling * 5) issues.push({ label: 'Facturación sospechosa', tone: 'warning' });
    if ((ticketCounts.get(normalizeName(row.ticket)) ?? 0) > 1) issues.push({ label: 'Ticket duplicado', tone: 'critical' });
    if (!row.prioridad.trim()) issues.push({ label: 'Prioridad faltante', tone: 'warning' });
    if (row.estado.trim() && !knownStatus.some((status) => normalizedStatus.includes(status))) issues.push({ label: 'Estado inconsistente', tone: 'warning' });
    if (!row.fecha.trim()) issues.push({ label: 'Registro sin fecha', tone: 'warning' });

    return issues;
  }, [averagePositiveBilling, ticketCounts]);

  const enrichedRows = useMemo(() => billingRows.map((row) => ({ ...row, issues: getBillingIssues(row) })), [billingRows, getBillingIssues]);

  const filterOptions = useMemo(() => ({
    periods: ['all', ...new Set(billingRows.map((row) => row.fecha).filter(Boolean))],
    regions: ['all', ...new Set(billingRows.map((row) => row.region).filter(Boolean))],
    comunas: ['all', ...new Set(billingRows.map((row) => row.comuna).filter(Boolean))],
    estados: ['all', ...new Set(billingRows.map((row) => row.estado).filter(Boolean))],
    prioridades: ['all', ...new Set(billingRows.map((row) => row.prioridad).filter(Boolean))],
  }), [billingRows]);

  const filteredBillingRows = useMemo(() => {
    const search = normalizeName(billingSearch);
    return enrichedRows.filter((row) => {
      const matchesSearch = !search || [row.ticket, row.cliente, row.comuna, row.region, String(row.facturacion), row.observacion].some((value) => normalizeName(value).includes(search));
      const matchesPeriod = billingPeriod === 'all' || row.fecha === billingPeriod;
      const matchesRegion = billingRegion === 'all' || row.region === billingRegion;
      const matchesComuna = billingComuna === 'all' || row.comuna === billingComuna;
      const matchesEstado = billingEstado === 'all' || row.estado === billingEstado;
      const matchesPriority = billingPriority === 'all' || row.prioridad === billingPriority;
      const matchesErrors = !billingOnlyErrors || row.issues.length > 0;
      return matchesSearch && matchesPeriod && matchesRegion && matchesComuna && matchesEstado && matchesPriority && matchesErrors;
    });
  }, [billingComuna, billingEstado, billingOnlyErrors, billingPeriod, billingPriority, billingRegion, billingSearch, enrichedRows]);

  const qualitySummary = useMemo(() => {
    const rowsWithWarnings = enrichedRows.filter((row) => row.issues.some((issue) => issue.tone === 'warning')).length;
    const rowsCritical = enrichedRows.filter((row) => row.issues.some((issue) => issue.tone === 'critical')).length;
    const duplicateCount = enrichedRows.filter((row) => row.issues.some((issue) => issue.label === 'Ticket duplicado')).length;
    const missingFields = enrichedRows.reduce((sum, row) => sum + row.issues.filter((issue) => issue.label.includes('faltante') || issue.label === 'Registro sin fecha').length, 0);
    return {
      reviewed: enrichedRows.length,
      ok: enrichedRows.filter((row) => row.issues.length === 0).length,
      warnings: rowsWithWarnings,
      critical: rowsCritical,
      duplicates: duplicateCount,
      missingFields,
    };
  }, [enrichedRows]);

  const billingWithAmount = billingRows.filter((row) => row.facturacion > 0).length;
  const rowsWithObservation = billingRows.filter((row) => row.observacion.trim()).length;
  const uniqueTickets = new Set(billingRows.map((row) => normalizeName(row.ticket)).filter(Boolean)).size || totals.ticketsUnicos;
  const totalBilling = billingRows.reduce((sum, row) => sum + row.facturacion, 0) || totals.facturacion;

  const issueBadgeClass = (tone: 'critical' | 'warning' | 'ok') => {
    if (tone === 'critical') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200';
    if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200';
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200';
  };

  return (
    <div className="billing-review-premium grid gap-5">
      <style>{`
        .billing-review-premium { color: #0f172a; }
        .dark .billing-review-premium { color: #e2e8f0; }
        .billing-review-premium .billing-card {
          background: #ffffff;
          border-color: #e2e8f0;
          color: #0f172a;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
        }
        .dark .billing-review-premium .billing-card {
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(11, 18, 32, 0.98));
          border-color: #22304d;
          color: #e2e8f0;
          box-shadow: 0 18px 44px rgba(2, 6, 23, 0.22);
        }
        .billing-review-premium input,
        .billing-review-premium select {
          background: #ffffff;
          border-color: #cbd5e1;
          color: #0f172a;
        }
        .dark .billing-review-premium input,
        .dark .billing-review-premium select {
          background: rgba(15, 23, 42, 0.9);
          border-color: #22304d;
          color: #f8fafc;
        }
        .billing-review-premium input::placeholder { color: #94a3b8; }
        .dark .billing-review-premium input::placeholder { color: #64748b; }
        .billing-review-premium table thead { background: #f1f5f9; }
        .dark .billing-review-premium table thead { background: rgba(2, 6, 23, 0.58); }
        .billing-review-premium table tbody tr:hover { background: #f8fafc; }
        .dark .billing-review-premium table tbody tr:hover { background: rgba(30, 41, 59, 0.56); }
        .billing-review-premium .text-white,
        .billing-review-premium .text-slate-100 { color: #0f172a !important; }
        .billing-review-premium .text-[var(--text-main)],
        .billing-review-premium .text-[var(--cc-muted)],
        .billing-review-premium .text-[var(--cc-muted)] { color: #64748b !important; }
        .dark .billing-review-premium .text-white,
        .dark .billing-review-premium .text-slate-100 { color: #f8fafc !important; }
        .dark .billing-review-premium .text-[var(--text-main)] { color: #cbd5e1 !important; }
        .dark .billing-review-premium .text-[var(--cc-muted)] { color: #94a3b8 !important; }
        .dark .billing-review-premium .text-[var(--cc-muted)] { color: #64748b !important; }
        .billing-review-premium .bg-slate-950\/60,
        .billing-review-premium .bg-slate-950\/70,
        .billing-review-premium .bg-slate-950\/80 { background: #f8fafc !important; }
        .dark .billing-review-premium .bg-slate-950\/60,
        .dark .billing-review-premium .bg-slate-950\/70,
        .dark .billing-review-premium .bg-slate-950\/80 { background: rgba(15, 23, 42, 0.7) !important; }
        .billing-review-premium .border-[var(--border-main)],
        .billing-review-premium .border-[var(--border-main)] { border-color: #cbd5e1 !important; }
        .dark .billing-review-premium .border-[var(--border-main)],
        .dark .billing-review-premium .border-[var(--border-main)] { border-color: #334155 !important; }
        .billing-review-premium button.text-white,
        .billing-review-premium a.text-white { color: #ffffff !important; }
      `}</style>

      <section className="billing-card rounded-xl border p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Facturación</p>
            <h2 className="mt-2 text-3xl font-black text-white">Facturación</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--cc-muted)]">Revisión, validación y corrección de datos cargados</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-4 text-sm font-black text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-55" disabled title="Corrección persistente pendiente de endpoint seguro" type="button" variant="outline"><Download size={16} /> Exportar revisión</Button>
            <Button className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100" onClick={() => setBillingOnlyErrors(true)} type="button" variant="outline"><AlertTriangle size={16} /> Ver inconsistencias</Button>
            <Button className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-55" disabled title="Corrección persistente pendiente de endpoint seguro" type="button"><Pen size={16} /> Actualizar datos</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          ['Facturación total', formatCurrency(totalBilling), Calculator],
          ['Reclamos con facturación', formatInt(billingWithAmount), FileBarChart],
          ['Registros con observación', formatInt(rowsWithObservation), Eye],
          ['Posibles inconsistencias', formatInt(qualitySummary.warnings + qualitySummary.critical), AlertTriangle],
          ['Tickets únicos', formatInt(uniqueTickets), Users],
        ].map(([label, value, Icon]) => (
          <motion.div key={String(label)} {...fadeMotion} {...(!reduceMotion ? softHover : {})}>
            <Card className="billing-card rounded-xl border p-4">
              <CardContent className="p-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">{String(label)}</p>
                  {React.createElement(Icon as typeof Calculator, { className: 'text-cyan-300', size: 18 })}
                </div>
                <p className="mt-3 text-2xl font-black text-white">{String(value)}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>

      <section className="billing-card rounded-xl border p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.4fr)_repeat(6,minmax(140px,1fr))]">
          <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">
            Buscar
            <Input className="h-10 rounded-lg border px-3 text-sm font-semibold" onChange={(event) => setBillingSearch(event.target.value)} placeholder="Ticket, cliente, comuna, región o monto" value={billingSearch} />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Periodo<select className="h-10 rounded-lg border px-3 text-sm font-bold" onChange={(event) => setBillingPeriod(event.target.value)} value={billingPeriod}>{filterOptions.periods.map((option) => <option key={option} value={option}>{option === 'all' ? 'Todos' : option}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Región<select className="h-10 rounded-lg border px-3 text-sm font-bold" onChange={(event) => setBillingRegion(event.target.value)} value={billingRegion}>{filterOptions.regions.map((option) => <option key={option} value={option}>{option === 'all' ? 'Todas' : option}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Comuna<select className="h-10 rounded-lg border px-3 text-sm font-bold" onChange={(event) => setBillingComuna(event.target.value)} value={billingComuna}>{filterOptions.comunas.map((option) => <option key={option} value={option}>{option === 'all' ? 'Todas' : option}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Estado<select className="h-10 rounded-lg border px-3 text-sm font-bold" onChange={(event) => setBillingEstado(event.target.value)} value={billingEstado}>{filterOptions.estados.map((option) => <option key={option} value={option}>{option === 'all' ? 'Todos' : option}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Prioridad<select className="h-10 rounded-lg border px-3 text-sm font-bold" onChange={(event) => setBillingPriority(event.target.value)} value={billingPriority}>{filterOptions.prioridades.map((option) => <option key={option} value={option}>{option === 'all' ? 'Todas' : option}</option>)}</select></label>
          <label className="flex items-end gap-2 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 py-2 text-xs font-black uppercase tracking-wide text-[var(--text-main)]"><input checked={billingOnlyErrors} onChange={(event) => setBillingOnlyErrors(event.target.checked)} type="checkbox" /> Solo con errores</label>
        </div>
      </section>

      {billingRows.length === 0 ? (
        <section className="billing-card flex min-h-[320px] flex-col items-center justify-center rounded-xl border p-10 text-center">
          <Calculator className="mb-4 text-cyan-300" size={44} />
          <h3 className="text-2xl font-black text-white">No hay datos cargados para revisar</h3>
          <p className="mt-2 max-w-md text-sm font-semibold text-[var(--cc-muted)]">Importa datos desde el menú de usuario para habilitar la revisión de facturación</p>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="billing-card overflow-hidden rounded-xl border">
            <div className="border-b border-[var(--border-main)] px-4 py-3">
              <h3 className="text-lg font-black text-white">Registros de facturación</h3>
              <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">Vista segura: no guarda cambios ni llama endpoints de escritura.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-xs">
                <thead className="bg-[var(--bg-card)] text-[11px] uppercase text-[var(--cc-muted)]">
                  <tr>{['Ticket', 'Cliente', 'Comuna', 'Región', 'Facturación', 'Estado', 'Prioridad', 'Observación', 'Validación', 'Acción'].map((head) => <th key={head} className="px-4 py-3 font-black">{head}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredBillingRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-black text-white">{row.ticket}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-main)]">{row.cliente}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-main)]">{row.comuna || 'Sin comuna'}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-main)]">{row.region || 'Sin región'}</td>
                      <td className="px-4 py-3 font-black text-cyan-100">{formatCurrency(row.facturacion)}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-main)]">{row.estado || 'Sin estado'}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-main)]">{row.prioridad || 'Sin prioridad'}</td>
                      <td className="max-w-[220px] truncate px-4 py-3 font-semibold text-[var(--cc-muted)]">{row.observacion || 'Sin observación'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {row.issues.length > 0 ? row.issues.map((issue) => <Badge key={issue.label} variant="outline" className={`rounded-full border px-2 py-1 text-[10px] font-black ${issueBadgeClass(issue.tone)}`}>{issue.label}</Badge>) : <Badge variant="outline" className={`rounded-full border px-2 py-1 text-[10px] font-black ${issueBadgeClass('ok')}`}>OK</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button className="h-auto rounded-md border border-[var(--border-main)] px-2 py-1 text-[11px] font-black text-[var(--text-main)]" onClick={() => setSelectedBillingRow(row)} type="button" variant="outline">Revisar</Button>
                          <Button className="h-auto rounded-md border border-[var(--border-main)] px-2 py-1 text-[11px] font-black text-[var(--cc-muted)]" disabled title="Corrección persistente pendiente de endpoint seguro" type="button" variant="outline">Ver dashboard</Button>
                          <Button className="h-auto rounded-md border border-[var(--border-main)] px-2 py-1 text-[11px] font-black text-[var(--cc-muted)]" disabled title="Corrección persistente pendiente de endpoint seguro" type="button" variant="outline">Ver mapa</Button>
                          <Button className="h-auto rounded-md border border-[var(--border-main)] px-2 py-1 text-[11px] font-black text-[var(--cc-muted)]" disabled title="Corrección persistente pendiente de endpoint seguro" type="button" variant="outline">Pendiente</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredBillingRows.length === 0 ? <div className="p-8 text-center text-sm font-bold text-[var(--cc-muted)]">Sin registros para filtros actuales.</div> : null}
            </div>
          </div>

          <aside className="grid gap-4 self-start">
            <section className="billing-card rounded-xl border p-4">
              <h3 className="text-lg font-black text-white">Calidad de datos</h3>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between gap-3"><span className="font-semibold text-[var(--cc-muted)]">Total revisados</span><span className="font-black text-white">{formatInt(qualitySummary.reviewed)}</span></div>
                <div className="flex justify-between gap-3"><span className="font-semibold text-[var(--cc-muted)]">Registros OK</span><span className="font-black text-emerald-200">{formatInt(qualitySummary.ok)}</span></div>
                <div className="flex justify-between gap-3"><span className="font-semibold text-[var(--cc-muted)]">Advertencias</span><span className="font-black text-amber-200">{formatInt(qualitySummary.warnings)}</span></div>
                <div className="flex justify-between gap-3"><span className="font-semibold text-[var(--cc-muted)]">Críticos</span><span className="font-black text-red-200">{formatInt(qualitySummary.critical)}</span></div>
                <div className="flex justify-between gap-3"><span className="font-semibold text-[var(--cc-muted)]">Duplicados</span><span className="font-black text-red-200">{formatInt(qualitySummary.duplicates)}</span></div>
                <div className="flex justify-between gap-3"><span className="font-semibold text-[var(--cc-muted)]">Campos faltantes</span><span className="font-black text-amber-200">{formatInt(qualitySummary.missingFields)}</span></div>
              </div>
            </section>

            <section className="billing-card rounded-xl border p-4">
              <h3 className="text-lg font-black text-white">Detalle seguro</h3>
              {selectedBillingRow ? (
                <div className="mt-3 grid gap-2 text-sm font-semibold text-[var(--text-main)]">
                  <p><span className="text-[var(--cc-muted)]">Ticket:</span> {selectedBillingRow.ticket}</p>
                  <p><span className="text-[var(--cc-muted)]">Cliente:</span> {selectedBillingRow.cliente}</p>
                  <p><span className="text-[var(--cc-muted)]">Ubicación:</span> {selectedBillingRow.comuna || 'Sin comuna'} · {selectedBillingRow.region || 'Sin región'}</p>
                  <p><span className="text-[var(--cc-muted)]">Facturación:</span> {formatCurrency(selectedBillingRow.facturacion)}</p>
                  <p className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-3 text-xs font-black text-blue-100">Corrección persistente pendiente de endpoint seguro</p>
                </div>
              ) : (
                <p className="mt-3 text-sm font-semibold text-[var(--cc-muted)]">Selecciona Revisar en una fila para ver detalle visual.</p>
              )}
            </section>
          </aside>
        </section>
      )}
    </div>
  );
}
function SettingsView({
  kpiDraft,
  setKpiDraft,
  customKpis,
  addCustomKpi,
  setCustomKpis,
  tableRows,
  totals,
  designConfig,
  configurableKpiDataSources,
  onOpenImport,
  canOpenImport,
  canManageUsers,
}: {
  kpiDraft: Omit<CustomKpi, 'id'>;
  setKpiDraft: React.Dispatch<React.SetStateAction<Omit<CustomKpi, 'id'>>>;
  customKpis: CustomKpi[];
  addCustomKpi: () => void;
  setCustomKpis: React.Dispatch<React.SetStateAction<CustomKpi[]>>;
  tableRows: TableRow[];
  totals: { visitas: number; facturacion: number };
  designConfig: ReturnType<typeof useDesignConfig>;
  configurableKpiDataSources?: KpiDataSources;
  onOpenImport: () => void;
  canOpenImport: boolean;
  canManageUsers: boolean;
}) {
  type SettingsSection = 'home' | 'design' | 'kpis' | 'charts' | 'import' | 'users' | 'preferences';
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>('home');
  const openSection = (section: SettingsSection) => setActiveSettingsSection(section);

  const settingsPremiumStyles = (
    <style>{`
      .settings-control-premium { color: #0f172a; }
      .dark .settings-control-premium { color: #e2e8f0; }
      .settings-control-premium .settings-control-card,
      .settings-control-premium > section,
      .settings-control-premium section.rounded-lg {
        background: #ffffff !important;
        border-color: #e2e8f0 !important;
        color: #0f172a !important;
        box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
      }
      .dark .settings-control-premium .settings-control-card,
      .dark .settings-control-premium > section,
      .dark .settings-control-premium section.rounded-lg {
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(11, 18, 32, 0.98)) !important;
        border-color: rgba(148, 163, 184, 0.14) !important;
        color: #e2e8f0 !important;
        box-shadow: 0 18px 44px rgba(2, 6, 23, 0.22);
      }
      .settings-control-premium h2,
      .settings-control-premium h3,
      .settings-control-premium .text-white,
      .settings-control-premium .text-slate-100,
      .settings-control-premium .text-\[\#071b4d\] { color: #0f172a !important; }
      .dark .settings-control-premium h2,
      .dark .settings-control-premium h3,
      .dark .settings-control-premium .text-white,
      .dark .settings-control-premium .text-slate-100,
      .dark .settings-control-premium .text-\[\#071b4d\] { color: #f8fafc !important; }
      .settings-control-premium p,
      .settings-control-premium .text-[var(--text-main)],
      .settings-control-premium .text-[var(--cc-muted)],
      .settings-control-premium .text-[var(--cc-muted)],
      .settings-control-premium .text-\[\#6b7d98\] { color: #64748b !important; }
      .dark .settings-control-premium p,
      .dark .settings-control-premium .text-[var(--text-main)],
      .dark .settings-control-premium .text-[var(--cc-muted)],
      .dark .settings-control-premium .text-[var(--cc-muted)],
      .dark .settings-control-premium .text-\[\#6b7d98\] { color: #94a3b8 !important; }
      .settings-control-premium .bg-slate-950\/60,
      .settings-control-premium .bg-slate-950\/70 { background: #f8fafc !important; }
      .dark .settings-control-premium .bg-slate-950\/60,
      .dark .settings-control-premium .bg-slate-950\/70 { background: rgba(15, 23, 42, 0.7) !important; }
      .settings-control-premium .border-[var(--border-main)],
      .settings-control-premium .border-[var(--border-main)] { border-color: #cbd5e1 !important; }
      .dark .settings-control-premium .border-[var(--border-main)],
      .dark .settings-control-premium .border-[var(--border-main)] { border-color: #334155 !important; }
      .settings-control-premium button.text-white,
      .settings-control-premium a.text-white { color: #ffffff !important; }
    `}</style>
  );

  const BackButton = ({ label = 'Volver a Configuraciones' }: { label?: string }) => (
    <button
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-4 text-sm font-black text-[var(--text-main)] transition hover:bg-[var(--bg-main)] dark:border-[var(--border-main)] dark:bg-slate-950/70 dark:text-slate-100 dark:hover:bg-slate-900"
      onClick={() => setActiveSettingsSection('home')}
      type="button"
    >
      <ChevronsLeft size={16} />
      {label}
    </button>
  );

  const settingsCards: Array<{ id: SettingsSection; title: string; description: string; icon: typeof Grid2X2; accent: string; enabled: boolean; badge?: string }> = [
    { id: 'design', title: 'Centro de diseño', description: 'Apariencia, textos y layout del dashboard', icon: Grid2X2, accent: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20', enabled: true },
    { id: 'kpis', title: 'KPIs personalizados', description: 'Crear, editar y ordenar indicadores', icon: Calculator, accent: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20', enabled: true },
    { id: 'charts', title: 'Gráficos personalizados', description: 'Constructor y biblioteca de gráficos', icon: FileBarChart, accent: 'text-blue-300 bg-blue-400/10 border-blue-400/20', enabled: true, badge: 'Centro de diseño' },
    { id: 'import', title: 'Importador de datos', description: 'Carga Excel / CSV para RM y Regiones', icon: Download, accent: 'text-amber-300 bg-amber-400/10 border-amber-400/20', enabled: canOpenImport, badge: canOpenImport ? undefined : 'Sin permiso' },
    { id: 'users', title: 'Usuarios y permisos', description: 'Administración de accesos del sistema', icon: UserCog, accent: 'text-violet-300 bg-violet-400/10 border-violet-400/20', enabled: canManageUsers, badge: canManageUsers ? undefined : 'Sin permiso' },
    { id: 'preferences', title: 'Preferencias del sistema', description: 'Configuración visual y comportamiento general', icon: ShieldCheck, accent: 'text-slate-200 bg-slate-400/10 border-slate-400/20', enabled: true },
  ];

  const renderSectionHeader = (title: string, description: string) => (
    <Panel className="settings-control-card rounded-xl border p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Configuraciones</p>
          <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--cc-muted)]">{description}</p>
        </div>
        <BackButton />
      </div>
    </Panel>
  );

  if (activeSettingsSection === 'design') {
    return (
      <div className="settings-control-premium grid gap-4">
        {settingsPremiumStyles}
        {renderSectionHeader('Centro de diseño', 'Apariencia, textos y layout del dashboard')}
        <DesignCenterView designConfig={designConfig} configurableKpiDataSources={configurableKpiDataSources} />
      </div>
    );
  }

  if (activeSettingsSection === 'kpis') {
    return (
      <div className="settings-control-premium grid gap-4">
        {settingsPremiumStyles}
        {renderSectionHeader('KPIs personalizados', 'Crear, editar y ordenar indicadores')}
        <KpiBuilder
          kpiDraft={kpiDraft}
          setKpiDraft={setKpiDraft}
          customKpis={customKpis}
          addCustomKpi={addCustomKpi}
          setCustomKpis={setCustomKpis}
          tableRows={tableRows}
          totals={totals}
        />
      </div>
    );
  }

  if (activeSettingsSection === 'charts') {
    return (
      <div className="settings-control-premium grid gap-4">
        {settingsPremiumStyles}
        {renderSectionHeader('Gráficos personalizados', 'Constructor y biblioteca de gráficos disponibles desde configuración visual')}
        <Panel className="settings-control-card rounded-xl border p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/10 text-blue-300"><FileBarChart size={24} /></span>
            <div>
              <h3 className="text-xl font-black text-white">Configuración de gráficos</h3>
              <p className="mt-2 max-w-2xl text-sm font-semibold text-[var(--cc-muted)]">Los gráficos configurables existentes se administran desde Centro de diseño. No se crea constructor nuevo ni se mueve Reportes a Configuraciones.</p>
              <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white" onClick={() => openSection('design')} type="button">Abrir Centro de diseño</button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  if (activeSettingsSection === 'import') {
    return (
      <div className="settings-control-premium grid gap-4">
        {settingsPremiumStyles}
        {renderSectionHeader('Importador de datos', 'Carga Excel / CSV para RM y Regiones')}
        <Panel className="settings-control-card rounded-xl border p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <h3 className="text-xl font-black text-white">Importador existente</h3>
              <p className="mt-2 max-w-2xl text-sm font-semibold text-[var(--cc-muted)]">La carga sigue usando el modal actual del menú de usuario. No se toca DataImportModal ni normalizadores.</p>
            </div>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canOpenImport} onClick={onOpenImport} type="button">
              <Download size={16} /> Abrir importador
            </button>
          </div>
        </Panel>
      </div>
    );
  }

  if (activeSettingsSection === 'users' && canManageUsers) {
    return (
      <div className="settings-control-premium grid gap-4">
        {settingsPremiumStyles}
        {renderSectionHeader('Usuarios y permisos', 'Administración de accesos del sistema')}
        <UserManagementView />
      </div>
    );
  }

  if (activeSettingsSection === 'preferences') {
    return (
      <div className="settings-control-premium grid gap-4">
        {settingsPremiumStyles}
        {renderSectionHeader('Preferencias del sistema', 'Configuración visual y comportamiento general')}
        <Panel className="settings-control-card rounded-xl border p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] p-4">
              <h3 className="text-lg font-black text-[var(--text-main)]">Apariencia</h3>
              <p className="mt-2 text-sm font-semibold text-[var(--cc-muted)]">Tema, textos, widgets y layout se gestionan en Centro de diseño.</p>
              <button className="mt-4 rounded-lg border border-[var(--border-main)] px-4 py-2 text-sm font-black text-[var(--text-main)]" onClick={() => openSection('design')} type="button">Abrir diseño</button>
            </article>
            <article className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] p-4">
              <h3 className="text-lg font-black text-[var(--text-main)]">Indicadores</h3>
              <p className="mt-2 text-sm font-semibold text-[var(--cc-muted)]">KPIs personalizados se mantienen en su constructor actual.</p>
              <button className="mt-4 rounded-lg border border-[var(--border-main)] px-4 py-2 text-sm font-black text-[var(--text-main)]" onClick={() => openSection('kpis')} type="button">Abrir KPIs</button>
            </article>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="settings-control-premium grid gap-5">
      {settingsPremiumStyles}
      <Panel className="settings-control-card rounded-xl border p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Centro de control</p>
          <h2 className="mt-2 text-3xl font-black text-white">Configuraciones</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--cc-muted)]">Centro de control del sistema</p>
          <p className="mt-2 max-w-4xl text-sm font-medium text-[var(--cc-muted)]">Administra apariencia, KPIs, gráficos, importación y preferencias del dashboard.</p>
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settingsCards.filter((card) => card.enabled || card.id === 'import' || card.id === 'users').map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              className={`settings-control-card min-h-[190px] rounded-xl border p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-500/60 disabled:cursor-not-allowed disabled:opacity-60 ${card.enabled ? '' : 'grayscale'}`}
              disabled={!card.enabled}
              onClick={() => openSection(card.id)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl border ${card.accent}`}><Icon size={23} /></span>
                {card.badge ? <span className="rounded-full border border-[var(--border-main)] bg-[var(--bg-card)] px-2.5 py-1 text-[10px] font-black uppercase text-[var(--cc-muted)]">{card.badge}</span> : null}
              </div>
              <h3 className="mt-5 text-xl font-black text-white">{card.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--cc-muted)]">{card.description}</p>
            </button>
          );
        })}
      </section>
    </div>
  );
}
function DashboardSlot({
  widgets,
  id,
  className = '',
  domId,
}: {
  widgets: ConfiguredDashboardWidget[];
  id: string;
  className?: string;
  domId?: string;
}) {
  const widget = widgets.find((item) => item.id === id && item.visible);

  if (!widget) return null;

  return <div id={domId} className={className}>{widget.content}</div>;
}
function _RouteMiniMap({ hasRouteTickets }: { hasRouteTickets: boolean }) {
  return (
    <div className="relative h-32 min-w-[150px] flex-1 overflow-hidden rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)]">
      <div className="absolute inset-0 opacity-80" style={{ backgroundImage: 'linear-gradient(90deg, rgba(148,163,184,.18) 1px, transparent 1px), linear-gradient(rgba(148,163,184,.18) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
      <div className="absolute left-8 top-8 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-blue-100" />
      <div className={`absolute bottom-8 right-8 h-3 w-3 rounded-full ${hasRouteTickets ? 'bg-red-500 ring-red-100' : 'bg-slate-400 ring-slate-200'} ring-4`} />
      <div className="absolute left-11 top-11 h-[2px] w-[96px] origin-left rotate-[24deg] rounded-full border-t-2 border-dashed border-blue-500" />
      <span className="absolute bottom-2 left-3 text-[10px] font-black uppercase text-[var(--cc-muted)]">Ruta</span>
    </div>
  );
}

const getDesignWidgetSizeClass = (size?: DesignWidgetSize) => {
  if (size === 'large') return 'md:col-span-2 xl:col-span-4 min-h-[260px]';
  if (size === 'medium') return 'md:col-span-1 xl:col-span-2 min-h-[220px]';
  return 'min-h-[160px]';
};

const sortDesignSections = (sections: DesignSectionConfig[]) => [...sections].sort((a, b) => a.order - b.order);
const sortDesignWidgets = (widgets: ConfiguredDashboardWidget[]) => [...widgets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

function DailyOperationSummary({
  routeMetrics,
  routePeriod,
  setRoutePeriod,
  routeDateBase,
  setRouteDateBase,
  onGoToRouteView,
}: {
  routeMetrics: RouteDailyMetrics;
  routePeriod: RoutePeriod;
  setRoutePeriod: (period: RoutePeriod) => void;
  routeDateBase: string;
  setRouteDateBase: (date: string) => void;
  onGoToRouteView?: () => void;
}) {
  void routePeriod; void setRoutePeriod; void routeDateBase; void setRouteDateBase;
  const reduceMotion = useReducedMotion();
  const fadeMotion = getFadeUpMotion(reduceMotion);
  const hasData = routeMetrics.ticketsRuta > 0;
  const pct = routeMetrics.ticketsRuta > 0 ? Math.round((routeMetrics.exitosas / routeMetrics.ticketsRuta) * 100) : 0;
  const formatRouteMoney = (value: number) => value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  const routeKpis = [
    { label: 'Visitas hoy', value: routeMetrics.ticketsRuta.toLocaleString('es-CL'), tone: 'text-[var(--text-main)]', action: onGoToRouteView },
    { label: 'Exitosas', value: routeMetrics.exitosas.toLocaleString('es-CL'), tone: 'cc-green' },
    { label: 'No exitosas', value: routeMetrics.noExitosas.toLocaleString('es-CL'), tone: 'cc-red' },
    { label: 'Pendientes', value: routeMetrics.pendientes.toLocaleString('es-CL'), tone: 'text-orange-500 dark:text-orange-300' },
    { label: 'En zona roja', value: routeMetrics.zonasRojas.toLocaleString('es-CL'), tone: 'cc-red' },
    { label: 'Cumplimiento', value: `${pct}%`, tone: 'text-blue-600 dark:text-blue-300' },
    { label: 'Total valorizado', value: formatRouteMoney(routeMetrics.totalValorizado), tone: 'text-[var(--text-main)]' },
    { label: 'Proyectado máximo', value: formatRouteMoney(routeMetrics.proyectadoMaximo), tone: 'text-blue-600 dark:text-blue-300' },
  ];

  return (
    <Panel className="h-full rounded-xl border p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="cc-section-title text-lg font-black">Operaci&oacute;n diaria</h2>
          <p className="cc-muted mt-1 text-xs font-semibold">Resumen de visitas cargadas para el d&iacute;a seleccionado</p>
        </div>
        <Button className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#073B91] px-3 text-xs font-black text-white hover:bg-blue-800" onClick={onGoToRouteView} type="button">
          Ir a Ruta diaria
        </Button>
      </div>

      <div className="cc-stat-grid grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
        {routeKpis.map((item) => {
          const content = (
            <>
              <p className="cc-kpi-label text-xs font-bold">{item.label}</p>
              <p className={`cc-kpi-value mt-1 text-lg font-black ${item.tone}`}>{item.value}</p>
            </>
          );
          return item.action ? (
            <motion.button
              className="cc-daily-kpi-card cc-kpi-card cc-card min-h-[82px] rounded-xl border p-4 text-left transition hover:border-blue-400/60"
              key={item.label}
              onClick={item.action}
              type="button"
              {...fadeMotion}
              {...(!reduceMotion ? softHover : {})}
            >
              {content}
            </motion.button>
          ) : (
            <motion.div className="cc-daily-kpi-card cc-kpi-card cc-card min-h-[82px] rounded-xl border p-4" key={item.label} {...fadeMotion} {...(!reduceMotion ? softHover : {})}>
              {content}
            </motion.div>
          );
        })}
      </div>

      {!hasData ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border-main)] bg-[var(--bg-card-soft)] px-4 py-3 text-center">
          <p className="text-sm font-bold text-[var(--text-main)]">Sin visitas cargadas para el d&iacute;a seleccionado</p>
          <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">Usa la pesta&ntilde;a Ruta diaria para cargar tickets y visitas.</p>
        </div>
      ) : null}
    </Panel>
  );
}
function ExecutiveDashboardLayout({
  widgets,
  routeMetrics,
  routePeriod,
  setRoutePeriod,
  routeDateBase,
  setRouteDateBase,
  showTerritorialInsights,
  territorialMetrics,
  onOpenTerritorialExplanation,
  onOpenTerritorialComuna,
  onShowTerritorialEvidence,
  onOptimizeRoute,
  onViewRoutePending,
  onGoToRouteView,
  designSections,
}: {
  widgets: ConfiguredDashboardWidget[];
  routeMetrics: RouteDailyMetrics;
  routePeriod: RoutePeriod;
  setRoutePeriod: (period: RoutePeriod) => void;
  routeDateBase: string;
  setRouteDateBase: (date: string) => void;
  onOpenRegions?: () => void;
  showTerritorialInsights?: boolean;
  territorialMetrics: TerritorialMetricsResult;
  onOpenTerritorialExplanation?: () => void;
  onOpenTerritorialComuna?: (comuna: string) => void;
  onShowTerritorialEvidence?: (comuna: string) => void;
  onOptimizeRoute?: () => void;
  onViewRoutePending?: () => void;
  onGoToRouteView?: () => void;
  designSections?: DesignSectionConfig[];
}) {
  if (designSections) {
    const visibleSections = sortDesignSections(designSections).filter((section) => section.visible);

    return (
      <div className="cc-dashboard-layout cc-executive-dashboard cc-dashboard-premium flex flex-col min-h-0 gap-5 pb-4">
        {visibleSections.map((section) => {
          const sectionWidgets = sortDesignWidgets(widgets.filter((widget) => widget.visible && widget.section === section.id));
          const hasRouteSummary = section.id === 'bottom';
          const hasTerritorialInsights = section.id === 'side' && showTerritorialInsights;

          if (sectionWidgets.length === 0 && !hasRouteSummary && !hasTerritorialInsights) return null;

          return (
            <section key={section.id} className="grid gap-3">
              <h2 className="text-sm font-black uppercase text-[#466083]">{section.label}</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {sectionWidgets.map((widget) => (
                  <DashboardSlot
                    key={widget.id}
                    widgets={sectionWidgets}
                    id={widget.id}
                    domId={widget.id === 'mapaReclamos' ? 'dashboard-map-section' : widget.id === 'tablaComunas' ? 'dashboard-evidence-section' : undefined}
                    className={getDesignWidgetSizeClass(widget.size) + (widget.id === 'mapaReclamos' ? ' h-[520px]' : '')}
                  />
                ))}
                {hasTerritorialInsights ? (
                  <div className="md:col-span-2 xl:col-span-4">
                    <TerritorialInsightCards
                      resumen={territorialMetrics.resumen}
                      comunaCritica={territorialMetrics.comunaCritica}
                      topReclamos={territorialMetrics.topReclamos}
                      topFacturacion={territorialMetrics.topFacturacion}
                      topIntensidad={territorialMetrics.topIntensidad}
                      isUsingFallback={territorialMetrics.isUsingFallback}
                      hasActiveData={territorialMetrics.hasActiveData}
                      onOpenComuna={onOpenTerritorialComuna}
                      onOpenExplanation={onOpenTerritorialExplanation}
                      onShowEvidence={onShowTerritorialEvidence}
                    />
                  </div>
                ) : null}
                {hasRouteSummary ? (
                  <div id="dashboard-route-section" className="md:col-span-2 xl:col-span-4">
                    <DailyOperationSummary
            routeMetrics={routeMetrics}
            routePeriod={routePeriod}
            setRoutePeriod={setRoutePeriod}
            routeDateBase={routeDateBase}
            setRouteDateBase={setRouteDateBase}
            onGoToRouteView={onGoToRouteView}
          />
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="cc-dashboard-layout cc-executive-dashboard cc-dashboard-premium flex flex-col min-h-0 gap-5 pb-4">
      <div className="flex-1 min-h-[620px] min-w-0">
        <section className="cc-exec-map-row grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          <aside className="cc-kpi-left-column flex min-h-0 flex-col gap-3 overflow-y-auto">
            <DashboardSlot widgets={widgets} id="kpiFacturacion" />
            <DashboardSlot widgets={widgets} id="kpiReclamos" />
            <DashboardSlot widgets={widgets} id="kpiPromedio" />
          </aside>

          <div className="min-w-0 min-h-0 flex flex-col">
            <DashboardSlot
              widgets={widgets}
              id="mapaReclamos"
              domId="dashboard-map-section"
              className="flex-1 min-h-[560px]"
            />
          </div>

          <TailAdminRightPanel className="cc-insights-right-column min-h-0" compact subtitle="Resumen territorial del periodo actual" title="Resumen operativo">
          <DashboardSlot widgets={widgets} id="kpiComunaTop" />
          <DashboardSlot widgets={widgets} id="kpiFacturacionTop" />
          <DashboardSlot widgets={widgets} id="kpiCoberturaComunas" />
          {showTerritorialInsights ? (
            <TerritorialInsightCards
              resumen={territorialMetrics.resumen}
              comunaCritica={territorialMetrics.comunaCritica}
              topReclamos={territorialMetrics.topReclamos}
              topFacturacion={territorialMetrics.topFacturacion}
              topIntensidad={territorialMetrics.topIntensidad}
              isUsingFallback={territorialMetrics.isUsingFallback}
              hasActiveData={territorialMetrics.hasActiveData}
              onOpenComuna={onOpenTerritorialComuna}
              onOpenExplanation={onOpenTerritorialExplanation}
              onShowEvidence={onShowTerritorialEvidence}
            />
          ) : null}
        </TailAdminRightPanel>      {/* close right column */}
      </section>      {/* close map row grid */}
      </div>          {/* close flex-1 map row wrapper */}

      <section className="flex-shrink-0 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardSlot widgets={widgets} id="statTotalComunas" />
        <DashboardSlot widgets={widgets} id="statAltaPrioridad" />
        <DashboardSlot widgets={widgets} id="statVariacionMensual" />
        <DashboardSlot widgets={widgets} id="statTicketsUnicos" />
      </section>

      <section id="dashboard-charts-section" className="flex-shrink-0 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <DashboardSlot widgets={widgets} id="graficoFacturacionMensual" className="min-h-[280px]" />
        <DashboardSlot widgets={widgets} id="topComunasReclamos" className="min-h-[280px]" />
        <DashboardSlot widgets={widgets} id="topComunasFacturacion" className="min-h-[280px]" />
        <DashboardSlot widgets={widgets} id="distribucionPrioridad" className="min-h-[280px]" />
      </section>

      <section className="flex-shrink-0 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]">
        <DashboardSlot widgets={widgets} id="tablaComunas" domId="dashboard-evidence-section" />
        <div id="dashboard-route-section">
          <DailyOperationSummary
            routeMetrics={routeMetrics}
            routePeriod={routePeriod}
            setRoutePeriod={setRoutePeriod}
            routeDateBase={routeDateBase}
            setRouteDateBase={setRouteDateBase}
            onGoToRouteView={onGoToRouteView}
          />
        </div>
      </section>
    </div>
  );
}
export default function Dashboard() {
  const { hasPermission, isAdmin } = useAuth();
  const reduceMotion = useReducedMotion();
  const fadeMotion = getFadeUpMotion(reduceMotion);
  const designConfig = useDesignConfig();
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>(loadStoredTheme);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedRows, setImportedRows] = useState<{ rm: ImportedDashboardRow[]; regiones: ImportedDashboardRow[] }>(loadImportedDashboardRows);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  });
  const [viewMode, setViewMode] = useState<'rm' | 'regiones'>('rm');
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('month');
  const [selectedWeek, setSelectedWeek] = useState('2026-W23');
  const [selectedDay, setSelectedDay] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [evidenceRegion, setEvidenceRegion] = useState('all');
  const [tablePage, setTablePage] = useState(0);
  const PAGE_SIZE = 10;
  const [showEvidenceTable, setShowEvidenceTable] = useState(true);
  const [showTerritorialExplanation, setShowTerritorialExplanation] = useState(false);
  const [territorialComunaDetail, setTerritorialComunaDetail] = useState<string | null>(null);
  const [mapLayers, setMapLayers] = useState<MapLayers>({
    borde: null,
    limiteUrbano: null,
    comunasKml: null,
    cuadrantesSantiago: null,
  });
  const [zonasRojasGeoJson, setZonasRojasGeoJson] = useState<GeoJsonObject | null>(null);
  const [regionalLayer, setRegionalLayer] = useState<FeatureCollection | null>(null);
  const [regionalLayerError, setRegionalLayerError] = useState('');
  const [dailyDashboardData, setDailyDashboardData] = useState<DashboardDailyResponse | null>(null);
  const [, setDailyDashboardError] = useState('');
  const [databaseDashboardData, setDatabaseDashboardData] = useState<DashboardDatabaseResponse | null>(null);
  const [databaseDashboardLoading, setDatabaseDashboardLoading] = useState(true);
  const [databaseDashboardError, setDatabaseDashboardError] = useState('');
  const [databaseReloadKey, setDatabaseReloadKey] = useState(0);
  const [activeRedZones, setActiveRedZones] = useState<RedZone[]>([]);
  const [routePeriod, setRoutePeriod] = useState<RoutePeriod>('dia');
  const [routeDateBase, setRouteDateBase] = useState(() => new Date().toISOString().slice(0, 10));
  const [routeDailyVisits, setRouteDailyVisits] = useState(() => getRouteDailyVisits());
  const [routeRefreshKey, setRouteRefreshKey] = useState(0);
  const [customKpis, setCustomKpis] = useState<CustomKpi[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem('dashboard-custom-kpis');
        if (stored) {
          return JSON.parse(stored) as CustomKpi[];
        }
      } catch {
        return [];
      }
    }
    return [];
  });
  const [kpiDraft, setKpiDraft] = useState<Omit<CustomKpi, 'id'>>({
    title: 'Nuevo KPI',
    metric: 'visitas',
    aggregation: 'sum',
    format: 'number',
  });

  const refreshImportedRows = useCallback(() => {
    const fresh = loadImportedDashboardRows();
    setImportedRows(fresh);
    // Keep backend as main source if it's already available.
    // Trigger re-fetch so backend picks up newly imported data.
    setDatabaseDashboardLoading(true);
    setDatabaseReloadKey((key) => key + 1);
    // Switch view to match import target based on what was saved to localStorage
    if (fresh.rm.length > 0 && fresh.regiones.length === 0) {
      setViewMode('rm');
    } else if (fresh.regiones.length > 0 && fresh.rm.length === 0) {
      setViewMode('regiones');
    }
  }, []);
  const refreshActiveRedZones = useCallback(() => {
    fetchRedZones()
      .then(setActiveRedZones)
      .catch(() => {
        setActiveRedZones([]);
      });
  }, []);


  const scrollToDashboardSection = useCallback((sectionId: string) => {
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, []);

  const showEvidenceForComuna = useCallback((comuna: string) => {
    setActiveTab('dashboard');
    setViewMode('rm');
    setFilters((current) => ({ ...current, location: comuna }));
    setEvidenceSearch(comuna);
    setShowEvidenceTable(true);
    setTablePage(0);
    scrollToDashboardSection('dashboard-evidence-section');
  }, [scrollToDashboardSection]);

  const filterComunaFromModal = useCallback((comuna: string) => {
    setTerritorialComunaDetail(null);
    showEvidenceForComuna(comuna);
  }, [showEvidenceForComuna]);

  const showComunaOnMap = useCallback((comuna: string) => {
    setTerritorialComunaDetail(null);
    setActiveTab('dashboard');
    setViewMode('rm');
    setFilters((current) => ({ ...current, location: comuna }));
    scrollToDashboardSection('dashboard-map-section');
  }, [scrollToDashboardSection]);

  const showEvidencePanel = useCallback(() => {
    setActiveTab('dashboard');
    setShowEvidenceTable(true);
    setTablePage(0);
    scrollToDashboardSection('dashboard-evidence-section');
  }, [scrollToDashboardSection]);

  const filterHighPriority = useCallback(() => {
    setActiveTab('dashboard');
    setFilters((current) => ({ ...current, priority: 'alta' }));
    setShowEvidenceTable(true);
    setTablePage(0);
    scrollToDashboardSection('dashboard-evidence-section');
  }, [scrollToDashboardSection]);

  const showDuplicates = useCallback(() => {
    setActiveTab('dashboard');
    setEvidenceSearch('');
    setShowEvidenceTable(true);
    setTablePage(0);
    console.info('Revisar posibles duplicados desde tickets únicos');
    scrollToDashboardSection('dashboard-evidence-section');
  }, [scrollToDashboardSection]);

  const openRouteView = useCallback(() => setActiveTab("ruta"), []);
  const openRouteOptimization = useCallback(() => {
    setActiveTab('ruta');
    console.info('Abrir optimización de Ruta Visitador');
  }, []);

  const openRoutePending = useCallback(() => {
    setActiveTab('ruta');
    console.info('Abrir pendientes de Ruta Visitador');
  }, []);

  useEffect(() => {
    refreshActiveRedZones();
  }, [refreshActiveRedZones]);

  useEffect(() => {
    if (viewMode === 'rm' && !hasPermission('rm') && hasPermission('regiones')) setViewMode('regiones');
    if (viewMode === 'regiones' && !hasPermission('regiones') && hasPermission('rm')) setViewMode('rm');
  }, [hasPermission, viewMode]);

  useEffect(() => {
    applyDashboardTheme(dashboardTheme);
  }, [dashboardTheme]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all(
      mapLayerSources.map(async (layer) => {
        const response = await fetch(layer.url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`No se pudo cargar ${layer.url}`);
        }

        return [layer.key, (await response.json()) as GeoJsonObject] as const;
      }),
    )
      .then((entries) => {
        setMapLayers((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }));
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        console.error('Error cargando capas geográficas', error);
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    fetch('/data/map-layers/zonas_rojas.geojson')
      .then((response) => {
        if (!response.ok) throw new Error('No se pudo cargar zonas rojas');
        return response.json();
      })
      .then((data) => {
        if (mounted) setZonasRojasGeoJson(data as GeoJsonObject);
      })
      .catch(() => {
        if (mounted) setZonasRojasGeoJson(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (viewMode !== 'regiones') return;

    const controller = new AbortController();
    let mounted = true;

    setRegionalLayerError('');

    loadRegionalGeoLayer(controller.signal)
      .then((data) => {
        if (!mounted) return;
        setRegionalLayer(data);
        setRegionalLayerError('');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (!mounted) return;
        console.warn('[Regiones GeoJSON] No se pudo cargar la capa:', error);
        setRegionalLayer(null);
        setRegionalLayerError('Capa geográfica de regiones no disponible');
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [viewMode]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('dashboard-custom-kpis', JSON.stringify(customKpis));
    }
  }, [customKpis]);

  useEffect(() => {
    const handler = () => {
      setRouteDailyVisits(getRouteDailyVisits());
      setRouteRefreshKey((k) => k + 1);
    };
    window.addEventListener('dashboard-route-daily-updated', handler);
    return () => window.removeEventListener('dashboard-route-daily-updated', handler);
  }, []);

const dateFilterError = useMemo(() => {
    if (dateFilterMode === 'range' && rangeStart && rangeEnd && rangeStart > rangeEnd) {
      return 'La fecha de inicio no puede ser posterior a la fecha de fin.';
    }
    if (dateFilterMode === 'day' && selectedDay && !/^\d{4}-\d{2}-\d{2}$/.test(selectedDay)) return 'Selecciona un día válido.';
    if (dateFilterMode === 'week' && selectedWeek && !/^\d{4}-W\d{2}$/.test(selectedWeek)) return 'Selecciona una semana válida.';
    return '';
  }, [dateFilterMode, rangeEnd, rangeStart, selectedDay, selectedWeek]);

  const databaseRequestFilters = useMemo(() => {
    const monthRange = getDashboardDateRange(filters.month);
    const dateRange =
      dateFilterMode === 'month' && filters.month !== 'all'
        ? { fechaInicio: monthRange.fechaDesde, fechaFin: monthRange.fechaHasta }
        : dateFilterMode === 'week'
          ? getWeekDateRange(selectedWeek)
          : dateFilterMode === 'day'
            ? { fechaInicio: selectedDay || undefined, fechaFin: selectedDay || undefined }
            : dateFilterMode === 'range'
              ? { fechaInicio: rangeStart || undefined, fechaFin: rangeEnd || undefined }
              : {};

    return dateRange;
  }, [dateFilterMode, filters.month, rangeEnd, rangeStart, selectedDay, selectedWeek]);

  useEffect(() => {
    const controller = new AbortController();

    if (dateFilterError) {
      setDatabaseDashboardLoading(false);
      setDatabaseDashboardError(dateFilterError);
      return () => controller.abort();
    }

    setDatabaseDashboardLoading(true);
    setDatabaseDashboardError('');

    fetchDashboardDatabase(databaseRequestFilters, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        if (import.meta.env.DEV) {
          console.log('[dashboard] resumen recibido:', response.resumen);
          console.log('[dashboard] comunas recibidas:', response.comunas?.length ?? 0);
          console.log('[dashboard] reclamos recibidos:', response.reclamos?.length ?? 0);
          console.log('[dashboard] disponible:', response.available);
        }
        setDatabaseDashboardData(response.available ? response : null);
        setDatabaseDashboardError(response.errors.join(' · '));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDatabaseDashboardData(null);
        setDatabaseDashboardError(error instanceof Error ? error.message.includes('fetch') ? 'Sin conexión con el servidor de datos.' : error.message : 'No se pudieron cargar los reclamos');
      })
      .finally(() => {
        if (!controller.signal.aborted) setDatabaseDashboardLoading(false);
      });

    return () => controller.abort();
  }, [databaseReloadKey, databaseRequestFilters, dateFilterError]);

  useEffect(() => {
    const controller = new AbortController();
    const dateRange = getDashboardDateRange(filters.month);

    setDailyDashboardData(null);
    setDailyDashboardError('');

    fetchDashboardDailyVisits({
      territorio: viewMode,
      ...dateRange,
    })
      .then((response) => {
        if (!controller.signal.aborted) setDailyDashboardData(response);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDailyDashboardError(error instanceof Error ? error.message : 'No se pudieron cargar las visitas diarias');
      });

    return () => controller.abort();
  }, [filters.month, viewMode]);

  useEffect(() => {
    setTablePage(0);
  }, [evidenceRegion, evidenceSearch, filters, viewMode]);

  const databaseRows = useMemo(
    () => (databaseDashboardData?.reclamos ?? []).map(databaseClaimToImportedRow),
    [databaseDashboardData],
  );
  const currentDetailRows = useMemo(
    () => (databaseDashboardData ? databaseRows : [...importedRows.rm, ...importedRows.regiones]),
    [databaseDashboardData, databaseRows, importedRows.regiones, importedRows.rm],
  );
  const currentRegionalDetailRows = useMemo(
    () => currentDetailRows.filter((row) => row.scope === 'regiones'),
    [currentDetailRows],
  );
  const localRowsByStatus = useMemo(
    () => {
      const matchesStatus = (row: ImportedDashboardRow) => filters.status === 'todos' || row.estadoVisitaNormalizado === filters.status;
      return {
        rm: importedRows.rm.filter(matchesStatus),
        regiones: importedRows.regiones.filter(matchesStatus),
      };
    },
    [filters.status, importedRows.regiones, importedRows.rm],
  );
  const eligibleRouteReclamos = useMemo(
    () => currentDetailRows.filter((row) => row.ticket && row.validationStatus !== 'error' && (row.comuna || row.ciudad || row.calle)),
    [currentDetailRows],
  );
  const databaseMetrics = useMemo(() => {
    const detailByScope = {
      rm: aggregateImportedRows(databaseRows.filter((row) => row.scope === 'rm')),
      regiones: aggregateImportedRows(databaseRows.filter((row) => row.scope === 'regiones')),
    };
    const scopeByComuna = new Map(
      databaseRows.map((row) => [normalizeName(row.comuna ?? ''), row.scope] as const),
    );
    const details = {
      rm: new Map(detailByScope.rm.map((item) => [normalizeName(item.comuna), item] as const)),
      regiones: new Map(detailByScope.regiones.map((item) => [normalizeName(item.comuna), item] as const)),
    };
    const result: { rm: ComunaMetric[]; regiones: ComunaMetric[] } = { rm: [], regiones: [] };

    (databaseDashboardData?.comunas ?? []).forEach((item) => {
      const key = normalizeName(item.comuna);
      const scope = (item.dataset_scope as 'rm' | 'regiones' | undefined) || (item.region ? (isRmRegion(item.region) ? 'rm' : 'regiones') : (scopeByComuna.get(key) ?? (isRmComuna(item.comuna) ? 'rm' : 'regiones')));
      const detail = details[scope].get(key);
      result[scope].push({
        comuna: item.comuna,
        visitas: item.reclamos,
        ticketsUnicos: detail?.ticketsUnicos ?? 0,
        facturacion: item.facturacion,
        alta: item.prioridad_alta,
        media: detail?.media ?? 0,
        baja: detail?.baja ?? 0,
        reiteradas: detail?.reiteradas ?? 0,
        lat: detail?.lat ?? 0,
        lng: detail?.lng ?? 0,
      });
    });

    return result;
  }, [databaseDashboardData, databaseRows]);
  const rmData = useMemo(
    () => {
      const source = databaseDashboardData ? 'backend' : 'localStorage';
      const data = databaseDashboardData ? databaseMetrics.rm : aggregateImportedRows(localRowsByStatus.rm);
      if (import.meta.env.DEV) console.log('[dashboard] fuente activa RM:', source, 'filas:', data.length);
      return data;
    },
    [databaseDashboardData, databaseMetrics.rm, localRowsByStatus.rm],
  );
  const regionesData = useMemo(
    () => {
      const source = databaseDashboardData ? 'backend' : 'localStorage';
      const data = databaseDashboardData ? databaseMetrics.regiones : aggregateImportedRows(localRowsByStatus.regiones);
      if (import.meta.env.DEV) console.log('[dashboard] fuente activa Regiones:', source, 'filas:', data.length);
      return data;
    },
    [databaseDashboardData, databaseMetrics.regiones, localRowsByStatus.regiones],
  );
  const dailyComunaData = useMemo<ComunaMetric[]>(
    () =>
      (dailyDashboardData?.por_comuna ?? []).map((item) => ({
        comuna: item.nombre,
        visitas: item.visitas,
        ticketsUnicos: item.tickets,
        facturacion: item.facturacion,
        alta: 0,
        media: 0,
        baja: 0,
        reiteradas: 0,
        lat: item.lat ?? 0,
        lng: item.lon ?? 0,
      })),
    [dailyDashboardData],
  );
  const historicalCurrentData = viewMode === 'regiones' ? regionesData : rmData;
  const currentData = useMemo(
    () => (databaseDashboardData ? historicalCurrentData : mergeComunaMetrics(historicalCurrentData, dailyComunaData)),
    [dailyComunaData, databaseDashboardData, historicalCurrentData],
  );
  const hasRegionalData = viewMode === 'regiones' ? currentData.length > 0 : regionesData.length > 0;
  const hasRmData = viewMode === 'rm' ? currentData.length > 0 : rmData.length > 0;
  const hasCurrentData = currentData.length > 0;
  const isEmptyRegionsView = viewMode === 'regiones' && !hasRegionalData;
  const isEmptyRmView = viewMode === 'rm' && !hasRmData;
  const isEmptyCurrentView = isEmptyRegionsView || isEmptyRmView;
  const emptyViewMessage = viewMode === 'regiones' ? 'Sin datos de regiones cargados' : 'Sin datos de Región Metropolitana cargados';
  const regionalMapMetrics = useMemo(() => {
    const grouped = new Map<string, RegionalMapMetric>();
    const ticketsByComuna = new Map<string, Set<string>>();
    const addRowToComuna = (row: ImportedDashboardRow, comuna: string) => {
      const key = normalizeMapJoinKey(comuna);
      if (!key) return;

      const current = grouped.get(key) ?? emptyRegionalMetric(comuna);
      const tickets = ticketsByComuna.get(key) ?? new Set<string>();

      current.visitas += 1;
      current.facturacion += row.facturacionTotal ?? 0;
      current.km += row.km ?? 0;
      current.traslado += row.traslado ?? 0;
      current.valorEnvioBulto += row.valorEnvioBulto ?? 0;
      if (row.ticket) tickets.add(row.ticket);
      current.ticketsUnicos = tickets.size;

      if (row.prioridad === 'alta') current.alta += 1;
      if (row.prioridad === 'media') current.media += 1;
      if (row.prioridad === 'baja') current.baja += 1;

      if (row.estadoVisitaNormalizado === 'completada') current.completadas += 1;
      if (row.estadoVisitaNormalizado === 'pendiente') current.pendientes += 1;
      if (row.estadoVisitaNormalizado === 'no_realizada') current.noRealizadas += 1;

      grouped.set(key, current);
      ticketsByComuna.set(key, tickets);
    };

    currentRegionalDetailRows
      .filter((row) => {
        if (row.scope !== 'regiones' || row.validationStatus === 'error') return false;

        const comuna = row.ciudad || row.comuna || row.regionNormalizada || row.regionOriginal || 'Sin comuna';
        const matchesLocation = filters.location === 'all' || normalizeMapJoinKey(comuna) === normalizeMapJoinKey(filters.location);
        const matchesPriority = filters.priority === 'todas' || row.prioridad === filters.priority;
        const matchesStatus = filters.status === 'todos' || row.estadoVisitaNormalizado === filters.status;

        return matchesLocation && matchesPriority && matchesStatus;
      })
      .forEach((row) => {
        const comuna = row.ciudad || row.comuna || row.regionNormalizada || row.regionOriginal || 'Sin comuna';
        addRowToComuna(row, comuna);
      });

    if (viewMode === 'regiones' && filters.priority === 'todas') {
      (dailyDashboardData?.por_comuna ?? []).forEach((item) => {
        if (filters.location !== 'all' && normalizeName(item.nombre) !== normalizeName(filters.location)) return;

        const key = normalizeMapJoinKey(item.nombre);
        const current = grouped.get(key) ?? emptyRegionalMetric(item.nombre);
        current.visitas += item.visitas;
        current.ticketsUnicos += item.tickets;
        current.facturacion += item.facturacion;
        current.km += item.km;
        current.completadas += item.exitosas;
        current.noRealizadas += item.no_exitosas;
        current.pendientes += item.pendientes;
        grouped.set(key, current);
      });
    }

    return grouped;
  }, [currentRegionalDetailRows, dailyDashboardData, filters.location, filters.priority, filters.status, viewMode]);
  void regionalMapMetrics;
  const routeDateRange = useMemo(() => getRouteDateRange(routePeriod, routeDateBase), [routePeriod, routeDateBase, routeRefreshKey]);
  const filteredRouteVisits = useMemo(
    () => getRouteVisitsByDateRange(routeDateRange.startDate, routeDateRange.endDate),
    [routeDateRange.startDate, routeDateRange.endDate, routeDailyVisits, routeRefreshKey],
  );
  const routeMetrics = useMemo(() => calculateRouteDailyMetrics(filteredRouteVisits), [filteredRouteVisits]);
  const availableMonths = useMemo(
    () =>
      !hasCurrentData
        ? [{ label: emptyViewMessage, value: 'all' }]
        : [
            { label: databaseDashboardData ? 'Todo 2026' : sourceSummary.periodLabel, value: 'all' },
            ...(databaseDashboardData ? MONTH_LABELS : monthlyFacturacion.map((item) => item.label)).map((label) => ({ label, value: label })),
          ],
    [databaseDashboardData, emptyViewMessage, hasCurrentData, viewMode],
  );

  const availablePriorities = useMemo(
    () => [
      { label: 'Todas', value: 'todas' },
      { label: 'Alta', value: 'alta' },
      { label: 'Media', value: 'media' },
      { label: 'Baja', value: 'baja' },
    ],
    [],
  );

  const availableStatuses = useMemo(
    () => [
      { label: 'Todos', value: 'todos' },
      { label: 'Completada', value: 'completada' },
      { label: 'Pendiente', value: 'pendiente' },
      { label: 'No realizada', value: 'no_realizada' },
      { label: 'Sin estado', value: 'sin_estado' },
    ],
    [],
  );

  const availableLocations = useMemo(
    () => [
      { label: 'Todas', value: 'all' },
      ...currentData.map((item) => ({ label: item.comuna, value: item.comuna })),
    ],
    [currentData],
  );

  const locationOptions = useMemo(
    () => availableLocations,
    [availableLocations, viewMode],
  );

  useEffect(() => {
    if (!locationOptions.some((option) => option.value === filters.location)) {
      setFilters((current) => ({ ...current, location: 'all' }));
    }
  }, [filters.location, locationOptions]);

  const selectedMonthLabel = availableMonths.find((option) => option.value === filters.month)?.label ?? (viewMode === 'regiones' ? 'Sin datos de regiones' : sourceSummary.periodLabel);
  const selectedPriorityLabel = availablePriorities.find((option) => option.value === filters.priority)?.label ?? 'Todas';
  const selectedStatusLabel = availableStatuses.find((option) => option.value === filters.status)?.label ?? 'Todos';
  const selectedLocationLabel = locationOptions.find((option) => option.value === filters.location)?.label ?? 'Todas';
  const baseTotals = useMemo(() => sumComunaMetrics(currentData), [currentData]);
  const databaseMonthlyFacturacion = useMemo(() => {
    const grouped = new Map<string, number>();
    databaseRows.forEach((row) => {
      const rawDate = row.fechaVisita || row.fechaRecepcionTicket;
      const parsedMonth = rawDate ? MONTH_LABELS[new Date(`${rawDate}T12:00:00`).getMonth()] : undefined;
      const label = row.mes || parsedMonth;
      if (!label) return;
      grouped.set(label, (grouped.get(label) ?? 0) + (row.facturacionTotal ?? 0));
    });
    return [...grouped.entries()].map(([label, value]) => ({ label, value }));
  }, [databaseRows]);
  const currentMonthlyFacturacion = useMemo<Array<{ label: string; value: number }>>(
    () => databaseDashboardData ? databaseMonthlyFacturacion : (viewMode === 'regiones' || !hasCurrentData ? [] : monthlyFacturacion),
    [databaseDashboardData, databaseMonthlyFacturacion, hasCurrentData, viewMode],
  );
  const monthTotalFacturacion = useMemo(() => currentMonthlyFacturacion.reduce((sum, item) => sum + item.value, 0), [currentMonthlyFacturacion]);
  const monthFactor = useMemo(() => {
    if (databaseDashboardData || filters.month === 'all') return 1;

    const month = currentMonthlyFacturacion.find((item) => item.label === filters.month);
    return month && monthTotalFacturacion > 0 ? month.value / monthTotalFacturacion : 0;
  }, [currentMonthlyFacturacion, databaseDashboardData, filters.month, monthTotalFacturacion]);

  const filteredData = useMemo<ComunaMetric[]>(() => {
    const locationFiltered = currentData.filter((item) => {
      if (filters.location === 'all') return true;
      return item.comuna === filters.location;
    });

    return locationFiltered
      .map((item) => {
        const priorityCount = filters.priority === 'todas' ? item.visitas : item[filters.priority];
        const priorityFactor = item.visitas > 0 ? priorityCount / item.visitas : 0;
        const factor = monthFactor * priorityFactor;

        return {
          ...item,
          visitas: scaleMetric(item.visitas, factor),
          ticketsUnicos: Math.min(scaleMetric(item.ticketsUnicos, factor), scaleMetric(item.visitas, factor)),
          facturacion: scaleMetric(item.facturacion, factor),
          alta: filters.priority === 'todas' || filters.priority === 'alta' ? scaleMetric(item.alta, monthFactor) : 0,
          media: filters.priority === 'todas' || filters.priority === 'media' ? scaleMetric(item.media, monthFactor) : 0,
          baja: filters.priority === 'todas' || filters.priority === 'baja' ? scaleMetric(item.baja, monthFactor) : 0,
          reiteradas: scaleMetric(item.reiteradas, factor),
        };
      })
      .filter((item) => item.visitas > 0 || item.facturacion > 0 || item.alta > 0 || item.media > 0 || item.baja > 0);
  }, [currentData, filters.location, filters.priority, monthFactor]);

  const filteredMapData = filteredData;
  const territorialAlertRows = useMemo<ComunaMetric[]>(() =>
    currentData
      .map((item) => {
        const priorityCount = filters.priority === 'todas' ? item.visitas : item[filters.priority];
        const priorityFactor = item.visitas > 0 ? priorityCount / item.visitas : 0;
        const factor = monthFactor * priorityFactor;

        return {
          ...item,
          visitas: scaleMetric(item.visitas, factor),
          ticketsUnicos: Math.min(scaleMetric(item.ticketsUnicos, factor), scaleMetric(item.visitas, factor)),
          facturacion: scaleMetric(item.facturacion, factor),
          alta: filters.priority === 'todas' || filters.priority === 'alta' ? scaleMetric(item.alta, monthFactor) : 0,
          media: filters.priority === 'todas' || filters.priority === 'media' ? scaleMetric(item.media, monthFactor) : 0,
          baja: filters.priority === 'todas' || filters.priority === 'baja' ? scaleMetric(item.baja, monthFactor) : 0,
          reiteradas: scaleMetric(item.reiteradas, factor),
        };
      })
      .filter((item) => item.visitas > 0 || item.facturacion > 0 || item.alta > 0 || item.media > 0 || item.baja > 0),
    [currentData, filters.priority, monthFactor],
  );
  const territorialMetrics = useTerritorialMetrics({
    rows: viewMode === 'rm' ? territorialAlertRows : [],
    hasActiveSource: viewMode === 'rm' && currentData.length > 0,
  });
  const selectedTerritorialMetric = useMemo(
    () => territorialComunaDetail ? territorialMetrics.dataComunal.find((item) => item.comuna === territorialComunaDetail) ?? null : null,
    [territorialComunaDetail, territorialMetrics.dataComunal],
  );
  const totals = useMemo(() => sumComunaMetrics(filteredData), [filteredData]);

  const filteredKpis = useMemo(() => {
    const topClaimComuna = filteredData[0] ?? null;
    const topBillingComuna = filteredData.reduce<ComunaMetric | null>((best, item) => (!best || item.facturacion > best.facturacion ? item : best), null);
    const averageBilling = totals.visitas > 0 ? totals.facturacion / totals.visitas : 0;
    const altaPct = totals.visitas > 0 ? (totals.alta / totals.visitas) * 100 : 0;
    const mediaPct = totals.visitas > 0 ? (totals.media / totals.visitas) * 100 : 0;
    const bajaPct = Math.max(0, 100 - altaPct - mediaPct);
    const maxVisitas = Math.max(0, ...filteredData.map((item) => item.visitas));

    return {
      topClaimComuna,
      topBillingComuna,
      averageBilling,
      altaPct,
      mediaPct,
      bajaPct,
      maxVisitas,
      hasFilteredData: filteredData.length > 0,
    };
  }, [filteredData, totals.alta, totals.baja, totals.facturacion, totals.media, totals.visitas]);
  const { topClaimComuna, topBillingComuna, averageBilling, altaPct, mediaPct, bajaPct, maxVisitas, hasFilteredData } = filteredKpis;

  const filteredEvidenceRows: TableRow[] = useMemo(
    () => {
      const maxFacturacion = Math.max(0, ...filteredData.map((item) => item.facturacion));
      return filteredData.map((item) => ({
        ...item,
        share: totals.visitas > 0 ? (item.visitas / totals.visitas) * 100 : 0,
        average: item.visitas > 0 ? item.facturacion / item.visitas : 0,
        normalizedBilling: normalize(item.facturacion, maxFacturacion),
      }));
    },
    [filteredData, totals.visitas],
  );
  const regionByComuna = useMemo(
    () => new Map((databaseDashboardData?.comunas ?? []).map((item) => [normalizeName(item.comuna), item.region ?? 'Sin región'] as const)),
    [databaseDashboardData],
  );
  const evidenceRegionOptions = useMemo(
    () => ['all', ...new Set([...regionByComuna.values()].filter(Boolean))],
    [regionByComuna],
  );
  const tableRows = useMemo(() => {
    const search = normalizeName(evidenceSearch);
    return filteredEvidenceRows.filter((row) => {
      const region = regionByComuna.get(normalizeName(row.comuna)) ?? (viewMode === 'rm' ? 'Región Metropolitana' : 'Sin región');
      const matchesSearch = !search || normalizeName(row.comuna).includes(search) || normalizeName(region).includes(search);
      const matchesRegion = evidenceRegion === 'all' || region === evidenceRegion;
      return matchesSearch && matchesRegion;
    });
  }, [evidenceRegion, evidenceSearch, filteredEvidenceRows, regionByComuna, viewMode]);
  const visibleEvidenceRows = useMemo(
    () => (showEvidenceTable ? tableRows.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE) : []),
    [showEvidenceTable, tablePage, tableRows],
  );

  const topClaims = useMemo(
    () =>
      tableRows.slice(0, 10).map((item) => ({
        name: item.comuna,
        value: item.visitas,
        label: formatInt(item.visitas),
      })),
    [tableRows]
  );

  const topBilling = useMemo(
    () =>
      [...tableRows]
        .sort((a, b) => b.facturacion - a.facturacion)
        .slice(0, 10)
        .map((item) => ({
          name: item.comuna,
          value: item.facturacion,
          label: formatCurrencyShort(item.facturacion),
        })),
    [tableRows]
  );

  const monthlyBars = useMemo(() => {
    const filterFactor = baseTotals.facturacion > 0 && filters.month === 'all' ? totals.facturacion / baseTotals.facturacion : 1;
    const months = filters.month === 'all' ? currentMonthlyFacturacion : currentMonthlyFacturacion.filter((item) => item.label === filters.month);

    return months.map((item) => {
      const value = filters.month === 'all' ? Math.round(item.value * filterFactor) : totals.facturacion;

      return {
        label: item.label,
        value,
        display: formatCurrencyShort(value),
      };
    });
  }, [baseTotals.facturacion, currentMonthlyFacturacion, filters.month, totals.facturacion]);
  const filteredCharts = useMemo(
    () => ({
      topClaims,
      topBilling,
      monthlyBars,
    }),
    [monthlyBars, topBilling, topClaims],
  );
  const addCustomKpi = () => {
    const title = kpiDraft.title.trim() || 'KPI personalizado';

    setCustomKpis((current) => [
      ...current,
      {
        ...kpiDraft,
        id: `${Date.now()}-${kpiDraft.metric}-${kpiDraft.aggregation}`,
        title,
      },
    ]);
  };
  const exportEvidenceCsv = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const rows: Array<Array<string | number>> = [
      ['Mes', 'Comuna', 'Región', 'Reclamos', 'Facturación', 'Promedio', 'Prioridad alta', 'Prioridad media', 'Prioridad baja', '% del total reclamos'],
      ...tableRows.map((row) => [
        selectedMonthLabel,
        row.comuna,
        viewMode === 'regiones' ? 'Regiones' : 'Región Metropolitana',
        row.visitas,
        row.facturacion,
        Math.round(row.average),
        row.alta,
        row.media,
        row.baja,
        row.share.toFixed(1),
      ]),
    ];

    downloadCsv(`evidencia-dashboard-${today}.csv`, rows);
  }, [selectedMonthLabel, tableRows, viewMode]);
  const exportEvidenceExcel = useCallback(async () => {
    const XLSX = await import('xlsx');
    const rows = tableRows.map((row) => ({
      Periodo: selectedMonthLabel,
      Comuna: row.comuna,
      Región: regionByComuna.get(normalizeName(row.comuna)) ?? (viewMode === 'rm' ? 'Región Metropolitana' : 'Sin región'),
      Reclamos: row.visitas,
      Facturación: row.facturacion,
      Promedio: Math.round(row.average),
      'Prioridad alta': row.alta,
      'Prioridad media': row.media,
      'Prioridad baja': row.baja,
      'Participación (%)': Number(row.share.toFixed(1)),
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Evidencia');
    XLSX.writeFile(workbook, `evidencia-dashboard-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [regionByComuna, selectedMonthLabel, tableRows, viewMode]);

  const printDashboardView = useCallback(() => {
    if (isEmptyCurrentView) return;
    window.print();
  }, [isEmptyCurrentView]);
  const customKpiWidgets: DashboardWidget[] = customKpis.map((kpi) => ({
    id: `customKpi:${kpi.id}`,
    title: kpi.title,
    visible: true,
    content: (
      <CustomKpiCard
        detail={getKpiDetail(kpi)}
        onRemove={() => {
          setCustomKpis((current) => current.filter((item) => item.id !== kpi.id));
        }}
        title={kpi.title}
        value={formatKpiValue(calculateKpiValue(tableRows, kpi), kpi.format)}
      />
    ),
  }));

  const activeDesignConfig = designConfig.activeConfig;
  const hasActiveDesignConfig = designConfig.hasActiveConfig && Boolean(activeDesignConfig);
  const designWidgetById = useMemo(() => {
    if (!activeDesignConfig) return new Map<DesignWidgetId, DesignConfig['widgets'][number]>();
    return new Map(activeDesignConfig.widgets.map((widget) => [widget.id, widget]));
  }, [activeDesignConfig]);
  const designKpiById = useMemo(() => {
    if (!activeDesignConfig) return new Map<DesignKpiId, DesignKpiConfig>();
    return new Map(activeDesignConfig.kpis.map((kpi) => [kpi.id, kpi]));
  }, [activeDesignConfig]);
  const getDesignWidgetLabel = (id: DesignWidgetId, fallback: string) =>
    hasActiveDesignConfig ? (designKpiById.get(id)?.title || designWidgetById.get(id)?.title || fallback) : fallback;
  const designComponentById = useMemo(() => {
    if (!activeDesignConfig) return new Map<DesignComponentId, DesignComponentConfig>();
    return new Map(activeDesignConfig.components.map((c) => [c.id, c]));
  }, [activeDesignConfig]);
  const isComponentVisible = (id: DesignComponentId, defaultVisible = true) =>
    hasActiveDesignConfig ? (designComponentById.get(id)?.visible ?? defaultVisible) : defaultVisible;
  const getComponentTitle = (id: DesignComponentId, fallback: string) =>
    hasActiveDesignConfig ? (designComponentById.get(id)?.title || fallback) : fallback;

  const widgetToComponentId: Record<string, DesignComponentId> = {
    kpiFacturacion: 'left-kpi-facturacion',
    kpiReclamos: 'left-kpi-reclamos',
    kpiPromedio: 'left-kpi-promedio',
    mapaReclamos: 'main-map',
    kpiComunaTop: 'right-summary',
    kpiFacturacionTop: 'right-summary',
    kpiCoberturaComunas: 'right-summary',
    statTotalComunas: 'card-total-comunas',
    statAltaPrioridad: 'card-alta-prioridad',
    statVariacionMensual: 'card-periodo',
    statTicketsUnicos: 'card-tickets',
    graficoFacturacionMensual: 'chart-facturacion-mensual',
    topComunasReclamos: 'chart-top-reclamos',
    topComunasFacturacion: 'chart-top-facturacion',
    distribucionPrioridad: 'chart-prioridad',
    tablaComunas: 'table-evidencia',
  };

  const { editMode, enterEditMode, exitEditMode, selectedComponentId, setSelectedComponentId, updateComponentInDraft } = designConfig; void enterEditMode;
  const designCssVariables = useMemo<React.CSSProperties | undefined>(() => {
    if (!activeDesignConfig || !hasActiveDesignConfig) return undefined;
    const tokens = activeDesignConfig.tokens;

    return {
      '--dc-primary': designTokenValues.primaryColor[tokens.primaryColor],
      '--dc-background': designTokenValues.backgroundColor[tokens.backgroundColor],
      '--dc-card': designTokenValues.cardColor[tokens.cardColor],
      '--dc-text': designTokenValues.textColor[tokens.textColor],
      '--dc-radius': designTokenValues.borderRadius[tokens.borderRadius],
      '--dc-spacing': designTokenValues.spacingMode[tokens.spacingMode],
    } as React.CSSProperties;
  }, [activeDesignConfig, hasActiveDesignConfig]);
  const configurableKpiDataSources = useMemo<KpiDataSources>(() => ({
    dashboard_resumen: databaseDashboardData?.resumen,
    dashboard_comunas: databaseDashboardData?.comunas ?? [],
    dashboard_reclamos: databaseDashboardData?.reclamos ?? [],
    dashboard_visitas: dailyDashboardData,
  }), [dailyDashboardData, databaseDashboardData]);

  const designCustomKpiWidgets: ConfiguredDashboardWidget[] = hasActiveDesignConfig && activeDesignConfig
    ? activeDesignConfig.kpis
      .filter((kpi) => !kpi.protected && kpi.visible)
      .map((kpi) => ({
        id: kpi.id,
        title: kpi.title,
        visible: kpi.visible,
        description: kpi.description,
        order: kpi.order,
        section: kpi.section,
        size: kpi.size,
        content: <ConfigurableKpiCard kpi={kpi} dataSources={configurableKpiDataSources} />,
      }))
    : [];

  const designCustomChartWidgets: ConfiguredDashboardWidget[] = hasActiveDesignConfig && activeDesignConfig
    ? activeDesignConfig.charts
      .filter((chart) => chart.visible)
      .map((chart) => ({
        id: chart.id,
        title: chart.title,
        visible: chart.visible,
        description: chart.subtitle,
        order: 500 + chart.order,
        section: chart.section,
        size: chart.size,
        content: <ConfigurableChartCard chart={chart} dataSources={configurableKpiDataSources} />,
      }))
    : [];
  const dashboardWidgets: DashboardWidget[] = [
    {
      id: 'kpiFacturacion',
      title: 'Facturación total',
      visible: true,
      content: <PrimaryMetric actionLabel={totals.facturacion > 0 ? "Ver desglose" : undefined} onAction={() => scrollToDashboardSection('dashboard-charts-section')} icon={<FileBarChart size={29} />} tone="blue" title={getDesignWidgetLabel('kpiFacturacion', 'Facturación total')} value={formatCurrency(totals.facturacion)} delta={isEmptyCurrentView ? emptyViewMessage : 'Periodo seleccionado'} />,
    },
    {
      id: 'kpiReclamos',
      title: 'Reclamos totales',
      visible: true,
      content: <PrimaryMetric actionLabel={totals.visitas > 0 ? "Ver comunas" : undefined} onAction={showEvidencePanel} icon={<AlertTriangle size={30} />} tone="red" title={getDesignWidgetLabel('kpiReclamos', 'Reclamos totales')} value={formatInt(totals.visitas)} delta={isEmptyCurrentView ? emptyViewMessage : 'Datos actualizados'} />,
    },
    {
      id: 'kpiPromedio',
      title: 'Promedio por reclamo',
      visible: true,
      content: <PrimaryMetric actionLabel={totals.visitas > 0 ? "Comparar" : undefined} onAction={showEvidencePanel} icon={<Users size={30} />} tone="cyan" title={getDesignWidgetLabel('kpiPromedio', 'Promedio por reclamo')} value={formatCurrency(averageBilling)} delta={isEmptyCurrentView ? emptyViewMessage : 'Promedio del periodo'} />,
    },
    {
      id: 'kpiComunaTop',
      title: 'Top reclamos',
      visible: true,
      content: <InsightCard actionLabel={topClaimComuna ? "Ver detalle" : undefined} onAction={() => topClaimComuna ? setTerritorialComunaDetail(topClaimComuna.comuna) : console.info('Sin comuna top')} icon={<Landmark size={28} />} iconClass="bg-orange-100 text-orange-500" label={getDesignWidgetLabel('kpiComunaTop', 'Top reclamos')} title={topClaimComuna?.comuna ?? 'Sin datos'} detail={topClaimComuna ? `${formatInt(topClaimComuna.visitas)} reclamos` : 'Carga reclamos para identificar comuna líder.'} badge={totals.visitas > 0 && topClaimComuna ? `${asPercent((topClaimComuna.visitas / totals.visitas) * 100)} del total` : undefined} showCrown={Boolean(topClaimComuna)} progressPct={totals.visitas > 0 && topClaimComuna ? (topClaimComuna.visitas / totals.visitas) * 100 : 0} progressTone="red" />,
    },
    {
      id: 'kpiFacturacionTop',
      title: 'Top facturación',
      visible: true,
      content: <InsightCard actionLabel={topBillingComuna ? "Ver facturación" : undefined} onAction={() => scrollToDashboardSection('dashboard-charts-section')} icon={<FileBarChart size={28} />} iconClass="bg-blue-100 text-blue-600" label={getDesignWidgetLabel('kpiFacturacionTop', 'Top facturación')} title={topBillingComuna?.comuna ?? 'Sin datos'} detail={topBillingComuna ? formatCurrency(topBillingComuna.facturacion) : 'Carga reclamos para calcular facturación por comuna.'} badge={totals.facturacion > 0 && topBillingComuna ? `${asPercent((topBillingComuna.facturacion / totals.facturacion) * 100)} del total` : undefined} showCrown={Boolean(topBillingComuna)} progressPct={totals.facturacion > 0 && topBillingComuna ? (topBillingComuna.facturacion / totals.facturacion) * 100 : 0} progressTone="blue" />,
    },
    {
      id: 'kpiCoberturaComunas',
      title: 'Cobertura',
      visible: true,
      content: <InsightCard actionLabel={filteredMapData.length > 0 ? "Ver cobertura" : undefined} onAction={showEvidencePanel} icon={<ShieldCheck size={28} />} iconClass="bg-emerald-100 text-emerald-600" label={getDesignWidgetLabel('kpiCoberturaComunas', 'Cobertura')} title={hasFilteredData ? `${Math.round((filteredMapData.length / Math.max(1, currentData.length)) * 100)}%` : '0%'} detail={filteredMapData.length > 0 ? `${filteredMapData.length} comunas con información` : 'Sin comunas con información cargada.'} progressPct={hasFilteredData ? Math.round((filteredMapData.length / Math.max(1, currentData.length)) * 100) : 0} progressTone="green" />,
    },
    {
      id: 'mapaReclamos',
      title: 'Mapa de reclamos',
      visible: true,
      content: (
        <Panel className="cc-map-panel flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)]">
          <div className="cc-map-header flex-shrink-0 border-b border-[var(--border-main)] px-4 py-2">
            <h2 className="cc-section-title text-base font-black text-blue-900">{getDesignWidgetLabel('mapaReclamos', viewMode === 'regiones' ? 'Mapa de reclamos Regiones' : 'Mapa de reclamos RM')}</h2>
            <p className="cc-muted mt-0.5 text-[11px] font-semibold text-[var(--cc-muted)]">Intensidad territorial de reclamos en {viewMode === 'regiones' ? 'Regiones' : 'Región Metropolitana'}</p>
          </div>
          <div className="cc-map-surface relative min-h-0 flex-1 overflow-hidden rounded-xl">
            {viewMode === 'rm' ? (
              <MapContainer center={[-33.45, -70.65]} className="absolute inset-0 z-0" preferCanvas zoom={10} zoomControl={false}>
                <ZoomControl position="topleft" />
                <RegionMapBounds data={mapLayers.comunasKml} />
                <MapResizeHandler deps={[viewMode, dashboardTheme, mapLayers.comunasKml, filteredMapData.length]} />
                <BaseMapLayers>
                  <MapLayers
                    activeRedZones={activeRedZones}
                    mapLayers={mapLayers}
                    zonasRojasGeoJson={zonasRojasGeoJson}
                    comunaMetrics={filteredMapData}
                    maxVisitas={maxVisitas}
                    onSelectComuna={(comuna) => {
                      setFilters((current) => ({ ...current, location: comuna }));
                      setEvidenceSearch(comuna);
                      setShowEvidenceTable(true);
                    }}
                  />
                </BaseMapLayers>
              </MapContainer>
            ) : (
              <MapContainer center={[-35.6751, -71.543]} zoom={4} minZoom={3} className="absolute inset-0 z-0" preferCanvas zoomControl={false}>
                <ZoomControl position="topleft" />
                <MapResizeHandler deps={[viewMode, dashboardTheme, regionalLayer]} />
                <BaseMapLayers>
                  <RegionClaimsLayer geoJson={regionalLayer} rows={currentRegionalDetailRows} />
                  <ActiveRedZonesLayers redZoneMode="readonly" zones={activeRedZones} />
                </BaseMapLayers>
                {regionalLayerError ? (
                  <div className="cc-map-warning cc-map-warning-danger pointer-events-none absolute bottom-4 right-4 z-[500] max-w-[280px] rounded-lg border border-[#22304D] bg-[#0D1324]/95 px-3 py-2 text-xs font-bold text-[#94A3B8] shadow-lg">
                    {regionalLayerError}
                  </div>
                ) : null}
              </MapContainer>
            )}

            {viewMode === 'regiones' ? (
              <div className="cc-map-legend pointer-events-none absolute bottom-4 left-4 z-[500] w-[220px] rounded-lg border border-[#22304D] bg-[#0D1324]/95 p-3 text-[#CBD5E1] shadow-lg">
                <p className="mb-2 text-[10px] font-black uppercase">Reclamos por comuna</p>
                <div className="grid grid-cols-5 gap-1 text-center text-[9px] font-bold">
                  {[
                    ['#16213A', '0'],
                    ['#2563EB', '1-5'],
                    ['#0B5CFF', '6-10'],
                    ['#22D3EE', '11-20'],
                    ['#F97316', '20+'],
                  ].map(([color, label]) => (
                    <span key={label}><i className="mb-1 block h-2 rounded-sm" style={{ backgroundColor: color }} />{label}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="cc-map-legend absolute bottom-4 left-4 z-[500] w-[200px] rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)]/95 p-3 shadow-lg">
                <div className="mb-2 text-[10px] font-black uppercase text-[#466083]">Reclamos por comuna</div>
                <div className="space-y-1.5">
                  {MAP_LEGEND_LEVELS.map((level) => (
                    <div key={level.label} className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-main)]">
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: level.color }} />
                      <span>{level.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>
      ),
    },
    {
      id: 'statTotalComunas',
      title: 'Total comunas',
      visible: true,
      content: (
        <Panel className="cc-kpi-card-pro h-full">
          <StatStripItem icon={<Building2 size={22} />} label={getDesignWidgetLabel('statTotalComunas', 'Total comunas')} value={formatInt(filteredMapData.length)} detail={filteredMapData.length > 0 ? (viewMode === 'rm' ? 'RM incluida' : 'Regiones') : 'Sin comunas filtradas.'} />
        </Panel>
      ),
    },
    {
      id: 'statAltaPrioridad',
      title: 'Alta prioridad',
      visible: true,
      content: (
        <Panel className="h-full">
          <StatStripItem actionLabel={totals.alta > 0 ? "Filtrar alta prioridad" : undefined} onAction={filterHighPriority} icon={<AlertTriangle size={22} />} label={getDesignWidgetLabel('statAltaPrioridad', 'Alta prioridad')} value={formatInt(totals.alta)} detail={totals.alta > 0 ? `${asPercent(altaPct)} del total` : 'Sin reclamos de alta prioridad.'} progressPct={totals.alta > 0 ? altaPct : 0} progressTone="red" />
        </Panel>
      ),
    },
    {
      id: 'statVariacionMensual',
      title: 'Variación mensual',
      visible: true,
      content: (
        <Panel className="h-full">
          <StatStripItem icon={<TrendingUpIcon />} label={getDesignWidgetLabel('statVariacionMensual', 'Periodo analizado')} value={dateFilterMode === 'month' ? selectedMonthLabel : dateFilterMode === 'week' ? formatWeekLabel(selectedWeek) : dateFilterMode === 'day' ? selectedDay || 'Día' : 'Rango'} detail="Filtro aplicado a todos los datos" />
        </Panel>
      ),
    },
    {
      id: 'statTicketsUnicos',
      title: 'Tickets únicos',
      visible: true,
      content: (
        <Panel className="h-full">
          <StatStripItem actionLabel={totals.ticketsUnicos > 0 ? "Ver duplicados" : undefined} onAction={showDuplicates} icon={<Users size={22} />} label={getDesignWidgetLabel('statTicketsUnicos', 'Tickets únicos')} value={formatInt(totals.ticketsUnicos)} detail={totals.visitas > 0 ? `${asPercent((totals.ticketsUnicos / totals.visitas) * 100)} del total` : 'Sin tickets cargados.'} />
        </Panel>
      ),
    },
    {
      id: 'graficoFacturacionMensual',
      title: 'Facturación mensual',
      visible: true,
      content: (
        <Panel className="cc-chart-card h-full p-4">
          <h3 className="cc-chart-title mb-3 text-sm font-black text-[var(--text-main)]">{getDesignWidgetLabel('graficoFacturacionMensual', viewMode === 'regiones' ? 'Facturación mensual Regiones' : 'Facturación mensual RM')}</h3>
          {filteredCharts.monthlyBars.length > 0 ? <MonthlyHorizontalBars items={filteredCharts.monthlyBars} /> : <EmptyState />}
        </Panel>
      ),
    },
    {
      id: 'topComunasReclamos',
      title: 'Top comunas reclamos',
      visible: true,
      content: (
        <Panel className="cc-chart-card h-full p-4">
          <h3 className="cc-chart-title mb-3 text-sm font-black text-[var(--text-main)]">{getDesignWidgetLabel('topComunasReclamos', 'Top 10 comunas con más reclamos')}</h3>
          {filteredCharts.topClaims.length > 0 ? <HorizontalBars color="red" items={filteredCharts.topClaims} maxLabel={formatInt(filteredCharts.topClaims[0]?.value ?? 0)} /> : <EmptyState />}
        </Panel>
      ),
    },
    {
      id: 'topComunasFacturacion',
      title: 'Top comunas facturación',
      visible: true,
      content: (
        <Panel className="cc-chart-card h-full p-4">
          <h3 className="cc-chart-title mb-3 text-sm font-black text-[var(--text-main)]">{getDesignWidgetLabel('topComunasFacturacion', 'Top 10 comunas con mayor facturación')}</h3>
          {filteredCharts.topBilling.length > 0 ? <HorizontalBars color="blue" items={filteredCharts.topBilling} maxLabel={formatCurrencyShort(filteredCharts.topBilling[0]?.value ?? 0)} /> : <EmptyState />}
        </Panel>
      ),
    },
    {
      id: 'distribucionPrioridad',
      title: 'Distribución por prioridad',
      visible: true,
      content: (
        <Panel className="cc-chart-card h-full p-4">
          <h3 className="cc-chart-title mb-3 text-sm font-black text-[var(--text-main)]">{getDesignWidgetLabel('distribucionPrioridad', 'Distribución por prioridad')}</h3>
          {totals.visitas > 0 ? (
            <Donut
              center={formatInt(totals.visitas)}
              label="Total"
              segments={[
                { color: '#EF4444', from: 0, to: altaPct, name: 'Alta', value: `${formatInt(totals.alta)} (${asPercent(altaPct)})` },
                { color: '#F97316', from: altaPct, to: altaPct + mediaPct, name: 'Media', value: `${formatInt(totals.media)} (${asPercent(mediaPct)})` },
                { color: '#00F5A0', from: altaPct + mediaPct, to: 100, name: 'Baja', value: `${formatInt(totals.baja)} (${asPercent(bajaPct)})` },
              ]}
            />
          ) : <EmptyState />}
        </Panel>
      ),
    },
    {
      id: 'tablaComunas',
      title: 'Tabla comunas',
      visible: true,
      content: (
        <motion.div className="h-full" {...fadeMotion}>
          <Panel className="h-full overflow-hidden">
          <div className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${showEvidenceTable ? 'border-b border-[var(--border-main)]' : ''}`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-blue-900">{getDesignWidgetLabel('tablaComunas', 'Evidencia por comuna')}</h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
                  {formatInt(tableRows.length)} comunas
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-xs font-semibold text-[var(--cc-muted)]">
                Accede a respaldos, visitas y registros asociados a cada comuna.
              </p>
            </div>
            <button
              aria-expanded={showEvidenceTable}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-4 text-xs font-black text-[#073B91] shadow-sm transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-600/25 sm:w-auto"
              onClick={() => setShowEvidenceTable((current) => !current)}
              type="button"
            >
              {showEvidenceTable ? (
                <>
                  <ChevronUp size={16} />
                  Ocultar evidencia
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  Ver todas →
                </>
              )}
            </button>
          </div>
          {showEvidenceTable ? (
            <>
              <div className="flex flex-col gap-2 border-b border-[var(--border-main)] bg-[var(--bg-card)]/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <label className="relative min-w-0 flex-1 sm:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cc-muted)]" size={16} />
                    <Input
                      aria-label="Buscar en evidencia"
                      className="h-10 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] pl-9 pr-3 text-sm text-[var(--text-main)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      onChange={(event) => setEvidenceSearch(event.target.value)}
                      placeholder="Buscar comuna o región"
                      value={evidenceSearch}
                    />
                  </label>
                  <select
                    aria-label="Filtrar evidencia por región"
                    className="h-10 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    onChange={(event) => setEvidenceRegion(event.target.value)}
                    value={evidenceRegion}
                  >
                    {evidenceRegionOptions.map((region) => <option key={region} value={region}>{region === 'all' ? 'Todas las regiones' : region}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-xs font-bold text-[var(--text-main)] hover:bg-[var(--bg-main)]" onClick={exportEvidenceCsv} type="button" variant="outline">
                    <Download size={15} /> CSV
                  </Button>
                  <Button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#073B91] px-3 text-xs font-bold text-white hover:bg-blue-800" onClick={() => void exportEvidenceExcel()} type="button">
                    <FileBarChart size={15} /> Excel
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-[var(--bg-card)] text-[11px] uppercase text-[#466083]">
                    <tr>
                      {['Comuna', 'Reclamos', 'Facturación', 'Alta prioridad', 'Última visita', 'Evidencia'].map((head) => (
                        <th key={head} className="px-4 py-2 font-black">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableRows.length > 0 ? (
                      visibleEvidenceRows.map((row) => (
                        <tr key={row.comuna} className="hover:bg-blue-50/40">
                          <td className="px-4 py-2 font-black text-[var(--text-main)]">{row.comuna}</td>
                          <td className="px-4 py-2 font-bold">{formatInt(row.visitas)}</td>
                          <td className="px-4 py-2 font-bold">{formatCurrency(row.facturacion)}</td>
                          <td className="px-4 py-2"><span className="rounded-full bg-red-100 px-2 py-1 font-black text-red-500">{formatInt(row.alta)}</span></td>
                          <td className="px-4 py-2 font-semibold text-[#466083]">{selectedMonthLabel}</td>
                          <td className="px-4 py-2"><div className="flex items-center gap-2 text-blue-700"><button aria-label={`Ver detalle de ${row.comuna}`} className="rounded-md p-1 hover:bg-blue-50" onClick={() => setTerritorialComunaDetail(row.comuna)} type="button"><Eye size={15} /></button><FileBarChart size={15} /><ClipboardCheck size={15} /><Grid2X2 size={15} /></div></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-8 text-center text-sm font-bold text-[var(--cc-muted)]" colSpan={6}>
                          {isEmptyCurrentView ? emptyViewMessage : 'Sin datos para los filtros seleccionados.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border-main)] px-4 py-3">
                <button
                  className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-4 py-2 text-xs font-black text-[var(--text-main)] shadow-sm transition hover:bg-[var(--bg-main)] disabled:opacity-50"
                  disabled={tablePage === 0}
                  onClick={() => setTablePage((p) => p - 1)}
                  type="button"
                >
                  Anterior
                </button>
                <span className="text-xs font-bold text-[#6b7d98]">
                  Página {Math.min(tablePage + 1, Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE)))} de {Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE))}
                </span>
                <button
                  className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-4 py-2 text-xs font-black text-[var(--text-main)] shadow-sm transition hover:bg-[var(--bg-main)] disabled:opacity-50"
                  disabled={(tablePage + 1) * PAGE_SIZE >= tableRows.length}
                  onClick={() => setTablePage((p) => p + 1)}
                  type="button"
                >
                  Siguiente
                </button>
              </div>
            </>
          ) : null}
          </Panel>
        </motion.div>
      ),
    },
    ...customKpiWidgets,
  ];

  const configuredDashboardWidgets = hasActiveDesignConfig
    ? [
      ...dashboardWidgets.map((widget) => {
        const designWidget = designWidgetById.get(widget.id as DesignWidgetId);
        const designKpi = designKpiById.get(widget.id as DesignKpiId);
        if (designWidget || designKpi) {
          return {
            ...widget,
            description: designKpi?.description ?? designWidget?.description,
            order: designKpi?.order ?? designWidget?.order,
            section: designKpi?.section ?? designWidget?.section,
            size: designKpi?.size ?? designWidget?.size,
            title: designKpi?.title ?? designWidget?.title ?? widget.title,
            visible: (designWidget?.visible ?? widget.visible) && (designKpi?.visible ?? true),
          };
        }
        return widget.id.startsWith('customKpi:') ? { ...widget, order: 100, section: 'bottom' as const, size: 'small' as const } : widget;
      }),
      ...designCustomKpiWidgets,
      ...designCustomChartWidgets,
    ]
    : dashboardWidgets;

  const editModeWidgets = editMode
    ? configuredDashboardWidgets.map((widget: Record<string, unknown>) => {
        const compId = widgetToComponentId[widget.id as string] ?? null;
        if (!compId) return widget as typeof configuredDashboardWidgets[number];
        const compConfig = designComponentById.get(compId);
        const safeOrder = (widget.order as number) ?? 0;
        return {
          ...widget,
          content: (
            <EditableDashboardWrapper
              componentId={compId}
              componentConfig={compConfig}
              onMoveUp={() => {
                const sorted = [...configuredDashboardWidgets].filter((w: Record<string, unknown>) => widgetToComponentId[w.id as string]).sort((a, b) => (((a as Record<string, unknown>).order as number) ?? 0) - (((b as Record<string, unknown>).order as number) ?? 0));
                const idx = sorted.findIndex((w: Record<string, unknown>) => w.id === widget.id);
                if (idx <= 0) return;
                const prev = sorted[idx - 1];
                const prevCompId = widgetToComponentId[prev.id as string];
                if (!prevCompId) return;
                const prevOrder = designComponentById.get(prevCompId)?.order ?? ((prev as Record<string, unknown>).order as number) ?? 0;
                const curOrder = compConfig?.order ?? safeOrder;
                updateComponentInDraft(compId, (c) => ({ ...c, order: prevOrder }));
                updateComponentInDraft(prevCompId, (c) => ({ ...c, order: curOrder }));
              }}
              onMoveDown={() => {
                const sorted = [...configuredDashboardWidgets].filter((w: Record<string, unknown>) => widgetToComponentId[w.id as string]).sort((a, b) => (((a as Record<string, unknown>).order as number) ?? 0) - (((b as Record<string, unknown>).order as number) ?? 0));
                const idx = sorted.findIndex((w: Record<string, unknown>) => w.id === widget.id);
                if (idx < 0 || idx >= sorted.length - 1) return;
                const next = sorted[idx + 1];
                const nextCompId = widgetToComponentId[next.id as string];
                if (!nextCompId) return;
                const nextOrder = designComponentById.get(nextCompId)?.order ?? ((next as Record<string, unknown>).order as number) ?? 0;
                const curOrder = compConfig?.order ?? safeOrder;
                updateComponentInDraft(compId, (c) => ({ ...c, order: nextOrder }));
                updateComponentInDraft(nextCompId, (c) => ({ ...c, order: curOrder }));
              }}
              onToggleVisibility={() => updateComponentInDraft(compId, (c) => ({ ...c, visible: !c.visible }))}
              onChangeSize={(size) => updateComponentInDraft(compId, (c) => ({ ...c, size }))}
              onOpenEdit={() => setSelectedComponentId(compId)}
            >
              {(widget as any).content}
            </EditableDashboardWrapper>
          ),
        } as typeof configuredDashboardWidgets[number];
      })
    : configuredDashboardWidgets;

  const sidebarWidthClass = isSidebarCollapsed ? 'w-20' : 'w-64';
  const mainOffsetClass = isSidebarCollapsed ? 'ml-20' : 'ml-64';

  return (
    <div className={`cc-shell flex h-screen font-sans text-[var(--text-main)] ${hasActiveDesignConfig ? 'cc-design-active' : ''}`} style={designCssVariables}>
      <style>{`
        .leaflet-control-attribution { font-size: 9px; }
        .leaflet-popup-content-wrapper {
          border-radius: 10px;
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.18);
        }
        .leaflet-popup-content { margin: 12px 14px; }
        .leaflet-container { width: 100%; height: 100%; z-index: 0; }
        .cc-design-active .cc-main { background: var(--dc-background) !important; color: var(--dc-text); }
        .cc-design-active .cc-card { background-color: var(--dc-card) !important; border-radius: var(--dc-radius) !important; }
        .cc-design-active .cc-page-content { gap: var(--dc-spacing); }
        .cc-design-active .cc-sidebar-logo,
        .cc-design-active .cc-sidebar-action,
        .cc-design-active .cc-primary-tabs [aria-selected="true"] { background: var(--dc-primary) !important; }
        .cc-sidebar-item-pro {
          border: 1px solid transparent;
          color: #64748b;
        }
        .cc-sidebar-item-pro:hover,
        .cc-sidebar-item-pro:focus-visible {
          background: rgba(37, 99, 235, 0.08);
          border-color: #bfdbfe;
          color: #1d4ed8;
          outline: none;
        }
        .dark .cc-sidebar-item-pro { color: #94a3b8; }
        .dark .cc-sidebar-item-pro:hover,
        .dark .cc-sidebar-item-pro:focus-visible {
          background: rgba(37, 99, 235, 0.12);
          border-color: #22304d;
          color: #f8fafc;
        }
        .cc-sidebar-item-active {
          background: #2563eb;
          border-color: #60a5fa;
          color: #ffffff;
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.32);
        }
        .cc-dashboard-filter-panel {
          background: #ffffff !important;
          border-color: #e2e8f0 !important;
          color: #0f172a !important;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
        }
        .dark .cc-dashboard-filter-panel {
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(13, 19, 36, 0.98)) !important;
          border-color: rgba(148, 163, 184, 0.14) !important;
          color: #e2e8f0 !important;
          box-shadow: 0 18px 44px rgba(2, 6, 23, 0.18);
        }
        .cc-dashboard-filter-panel h2,
        .cc-dashboard-filter-panel h3 {
          color: #0f172a !important;
        }
        .dark .cc-dashboard-filter-panel h2,
        .dark .cc-dashboard-filter-panel h3 {
          color: #f8fafc !important;
        }
        .cc-dashboard-filter-panel p,
        .cc-dashboard-filter-panel .cc-muted {
          color: #64748b !important;
        }
        .dark .cc-dashboard-filter-panel p,
        .dark .cc-dashboard-filter-panel .cc-muted {
          color: #94a3b8 !important;
        }
        .cc-dashboard-filter-panel .cc-filter,
        .cc-dashboard-filter-panel label {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
          color: #64748b !important;
        }
        .dark .cc-dashboard-filter-panel .cc-filter,
        .dark .cc-dashboard-filter-panel label {
          background: rgba(15, 23, 42, 0.86) !important;
          border-color: rgba(148, 163, 184, 0.14) !important;
          color: #94a3b8 !important;
        }
        .cc-dashboard-filter-panel select,
        .cc-dashboard-filter-panel input {
          color: #0f172a !important;
        }
        .dark .cc-dashboard-filter-panel select,
        .dark .cc-dashboard-filter-panel input {
          color: #f8fafc !important;
        }
        .cc-dashboard-premium {
          color: #0f172a;
        }
        .dark .cc-dashboard-premium {
          color: #e2e8f0;
        }
        .cc-dashboard-premium .cc-map-panel,
        .cc-dashboard-premium .cc-chart-card,
        .cc-dashboard-premium .cc-route-summary-card,
        .cc-dashboard-premium #dashboard-evidence-section > section,
        .cc-dashboard-premium .cc-kpi-card-pro,
        .cc-dashboard-premium .cc-card {
          background: #ffffff !important;
          border-color: #e2e8f0 !important;
          color: #0f172a !important;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
        }
        .dark .cc-dashboard-premium .cc-map-panel,
        .dark .cc-dashboard-premium .cc-chart-card,
        .dark .cc-dashboard-premium .cc-route-summary-card,
        .dark .cc-dashboard-premium #dashboard-evidence-section > section,
        .dark .cc-dashboard-premium .cc-kpi-card-pro,
        .dark .cc-dashboard-premium .cc-card {
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(13, 19, 36, 0.98)) !important;
          border-color: rgba(148, 163, 184, 0.14) !important;
          color: #e2e8f0 !important;
          box-shadow: 0 18px 44px rgba(2, 6, 23, 0.24);
        }
        .cc-dashboard-premium .cc-map-header,
        .cc-dashboard-premium #dashboard-evidence-section .border-b,
        .cc-dashboard-premium #dashboard-evidence-section .border-t {
          border-color: #e2e8f0 !important;
        }
        .dark .cc-dashboard-premium .cc-map-header,
        .dark .cc-dashboard-premium #dashboard-evidence-section .border-b,
        .dark .cc-dashboard-premium #dashboard-evidence-section .border-t {
          border-color: rgba(148, 163, 184, 0.14) !important;
        }
        .cc-dashboard-premium .cc-section-title,
        .cc-dashboard-premium .cc-chart-title,
        .cc-dashboard-premium h2,
        .cc-dashboard-premium h3,
        .cc-dashboard-premium .cc-kpi-value-pro,
        .cc-dashboard-premium .cc-text {
          color: #0f172a !important;
        }
        .dark .cc-dashboard-premium .cc-section-title,
        .dark .cc-dashboard-premium .cc-chart-title,
        .dark .cc-dashboard-premium h2,
        .dark .cc-dashboard-premium h3,
        .dark .cc-dashboard-premium .cc-kpi-value-pro,
        .dark .cc-dashboard-premium .cc-text {
          color: #f8fafc !important;
        }
        .cc-dashboard-premium .cc-muted,
        .cc-dashboard-premium .cc-kpi-label-pro,
        .cc-dashboard-premium .cc-kpi-meta-pro,
        .cc-dashboard-premium .cc-text-secondary {
          color: #64748b !important;
        }
        .dark .cc-dashboard-premium .cc-muted,
        .dark .cc-dashboard-premium .cc-kpi-label-pro,
        .dark .cc-dashboard-premium .cc-kpi-meta-pro,
        .dark .cc-dashboard-premium .cc-text-secondary {
          color: #94a3b8 !important;
        }
        .cc-dashboard-premium .cc-chart-card,
        .cc-dashboard-premium .cc-map-panel {
          border-radius: 16px;
        }
        .dark .cc-shell,
        .dark .cc-main {
          background: #07111f !important;
        }
        .cc-dashboard-premium .cc-daily-kpi-card {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
        }
        .dark .cc-dashboard-premium .cc-daily-kpi-card {
          background: rgba(15, 23, 42, 0.82) !important;
          border-color: rgba(148, 163, 184, 0.14) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 14px 30px rgba(2, 6, 23, 0.18) !important;
        }
        .cc-dashboard-premium .cc-daily-kpi-card .cc-kpi-label {
          color: #64748b !important;
          line-height: 1.2;
          white-space: normal;
        }
        .dark .cc-dashboard-premium .cc-daily-kpi-card .cc-kpi-label {
          color: #93a4b8 !important;
        }
        .cc-dashboard-premium .cc-daily-kpi-card .cc-kpi-value {
          font-size: clamp(1.05rem, 1.4vw, 1.35rem);
          line-height: 1.15;
          word-break: break-word;
        }
        @media print {
          body { background: #ffffff; }
          .no-print { display: none !important; }
          .print-full { height: auto !important; overflow: visible !important; }
        }
      `}</style>

      <aside className={`cc-sidebar no-print fixed inset-y-0 left-0 z-30 flex ${sidebarWidthClass} flex-col border-r border-[rgba(148,163,184,0.14)] bg-[var(--bg-sidebar)] py-4 text-[var(--cc-text)] shadow-sm transition-[width] duration-300 ease-out`}>
        <div className={`mb-6 flex items-center gap-3 px-4 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-lg shadow-blue-950/35">
            <Navigation size={22} />
          </div>
          {!isSidebarCollapsed ? (
            <div className="min-w-0">
              <p className="text-sm font-black text-[var(--cc-text)]">Visor</p>
              <p className="truncate text-[10px] font-semibold text-[#93a4b8]">Facturacion y Reclamos</p>
            </div>
          ) : null}
        </div>

        <nav className="flex flex-col gap-1 px-3">
          {navItems.filter((item) => item.visible !== false && hasPermission(item.permission)).map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                aria-label={item.label}
                title={isSidebarCollapsed ? item.label : undefined}
                data-active={activeTab === item.id ? "true" : "false"}
                className={`relative flex h-10 items-center rounded-lg text-sm font-bold transition ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${
                  activeTab === item.id
                    ? 'bg-blue-600/20 text-[var(--cc-text)] ring-1 ring-blue-400/35 shadow-lg shadow-blue-950/20'
                    : 'text-[#93a4b8] hover:bg-white/[0.06] hover:text-[var(--cc-text)]'
                }`}
                onClick={() => setActiveTab(item.id)}
                type="button"
              >
                <Icon size={19} className="shrink-0" />
                {!isSidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                {!isSidebarCollapsed && item.badge ? <span className="ml-auto h-2 w-2 rounded-full bg-red-500" /> : null}
                {isSidebarCollapsed && item.badge ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" /> : null}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1 px-3 pt-4">
          {bottomNavItems.filter((item) => item.visible !== false && hasPermission(item.permission)).map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                aria-label={item.label}
                title={isSidebarCollapsed ? item.label : undefined}
                data-active={activeTab === item.id ? "true" : "false"}
                className={`flex h-10 items-center rounded-lg text-sm font-bold transition ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${
                  activeTab === item.id
                    ? 'bg-blue-600/20 text-[var(--cc-text)] ring-1 ring-blue-400/35'
                    : 'text-[#93a4b8] hover:bg-white/[0.06] hover:text-[var(--cc-text)]'
                }`}
                onClick={() => setActiveTab(item.id)}
                type="button"
              >
                <Icon size={19} className="shrink-0" />
                {!isSidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
              </button>
            );
          })}
          <button
            aria-label={isSidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            className={`mt-2 flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-black text-[#93a4b8] transition hover:border-blue-400/35 hover:bg-blue-500/10 hover:text-[var(--cc-text)] ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'}`}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            title={isSidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            type="button"
          >
            <ChevronsLeft className={`shrink-0 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} size={19} />
            {!isSidebarCollapsed ? <span>Colapsar</span> : null}
          </button>
          {isAdmin ? (
            <button
              className={`mt-1 flex h-10 items-center rounded-lg border border-white/10 text-sm font-bold transition ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${
                activeTab === 'settings'
                  ? 'bg-blue-600/20 text-[var(--cc-text)] ring-1 ring-blue-400/35'
                  : 'bg-white/[0.04] text-[#93a4b8] hover:bg-white/[0.06] hover:text-[var(--cc-text)]'
              }`}
              onClick={() => setActiveTab('settings')}
              type="button"
              aria-label="Configuracion"
              title={isSidebarCollapsed ? 'Configuracion' : undefined}
            >
              <UserCog size={19} className="shrink-0" />
              {!isSidebarCollapsed ? <span>Configuracion</span> : null}
            </button>
          ) : null}
        </div>
      </aside>
      <main className={`cc-main cc-page print-full ${mainOffsetClass} flex min-w-0 flex-1 flex-col h-screen overflow-hidden bg-[var(--bg-main)] p-4 text-[var(--text-main)] transition-[margin-left] duration-300 ease-out dark:bg-[#07111f] dark:text-slate-100 print:ml-0 print:h-auto print:overflow-visible`}>
        <div className="cc-page-content print-full flex flex-col h-full min-h-0">
          {activeTab !== 'ruta' && isComponentVisible('header') ? (
          <TailAdminTopbar
            emptyViewMessage={emptyViewMessage}
            isDarkPremium={dashboardTheme === 'dark-premium'}
            isEmptyCurrentView={isEmptyCurrentView}
            onExportEvidence={exportEvidenceCsv}
            onPrintDashboard={printDashboardView}
            onToggleTheme={() => setDashboardTheme((current) => (current === 'dark-premium' ? 'default' : 'dark-premium'))}
            subtitle={activeTab === 'dashboard' && hasActiveDesignConfig ? activeDesignConfig?.texts.dashboardSubtitle ?? 'Inteligencia operativa para decisiones estratégicas' : activeTab === 'dashboard' ? 'Inteligencia operativa para decisiones estratégicas' : 'Gestión del módulo activo'}
            title={activeTab === 'dashboard' && hasActiveDesignConfig ? (getComponentTitle('header', activeDesignConfig?.texts.dashboardTitle ?? '') || `Visor de Facturación y Reclamos - ${viewMode === 'rm' ? 'RM' : 'Regiones'}`) : activeTab === 'dashboard' ? `Visor de Facturación y Reclamos - ${viewMode === 'rm' ? 'RM' : 'Regiones'}` : (navItems.find((item) => item.id === activeTab)?.label ?? 'Visor de Facturación y Reclamos')}
            userMenu={(
              <UserMenu
                isDarkPremium={dashboardTheme === 'dark-premium'}
                onOpenImport={() => setShowImportModal(true)}
                onOpenSettings={() => setActiveTab('settings')}
                onOpenUsers={() => setActiveTab('users')}
                onToggleTheme={() => setDashboardTheme((current) => (current === 'dark-premium' ? 'default' : 'dark-premium'))}
              />
            )}
            viewMode={viewMode}
          />
          ) : null}

          <div className="flex-1 overflow-y-auto min-h-0 pr-0.5">
          {activeTab === 'dashboard' ? (
            <ProtectedView viewKey="dashboard">
              <ProtectedView viewKey={viewMode}>
                <>
                <TailAdminSidePanel
                  className="cc-dashboard-filter-panel mb-3"
                  subtitle="Vista, periodo, prioridad, estado y comuna conservan la lógica actual."
                  title="Dashboard territorial"
                >
                <section className="cc-primary-tabs mb-2" role="tablist" aria-label="Vista principal">
                  <div className="flex gap-1 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] p-1 shadow-sm dark:border-[#22304D] dark:bg-[#0B1020]">
                    {hasPermission('rm') ? (
                      <Button
                        aria-selected={viewMode === 'rm'}
                        className={`h-auto flex-1 rounded-lg px-4 py-2 text-center text-sm font-black transition-all ${viewMode === 'rm' ? 'bg-[#2563EB] text-white shadow-sm shadow-blue-950/40' : 'text-[var(--cc-muted)] hover:bg-slate-100 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:bg-white/5 dark:hover:text-white'}`}
                        onClick={() => setViewMode('rm')}
                        role="tab"
                        type="button"
                        variant={viewMode === 'rm' ? 'default' : 'ghost'}
                      >
                        Región Metropolitana
                      </Button>
                    ) : null}
                    {hasPermission('regiones') ? (
                      <Button
                        aria-selected={viewMode === 'regiones'}
                        className={`h-auto flex-1 rounded-lg px-4 py-2 text-center text-sm font-black transition-all ${viewMode === 'regiones' ? 'bg-[#2563EB] text-white shadow-sm shadow-blue-950/40' : 'text-[var(--cc-muted)] hover:bg-slate-100 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:bg-white/5 dark:hover:text-white'}`}
                        onClick={() => setViewMode('regiones')}
                        role="tab"
                        type="button"
                        variant={viewMode === 'regiones' ? 'default' : 'ghost'}
                      >
                        Regiones
                      </Button>
                    ) : null}
                  </div>
                </section>
                <section className="cc-dashboard-filters mb-2" aria-label="Filtros operativos">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap gap-3">
                      <FilterControl
                        icon={<CalendarDays size={20} />}
                        label="Periodo"
                        onChange={(value) => setDateFilterMode(value as DateFilterMode)}
                        options={[
                          { label: 'Mes', value: 'month' },
                          { label: 'Semana', value: 'week' },
                          { label: 'Día', value: 'day' },
                          { label: 'Rango', value: 'range' },
                        ]}
                        value={dateFilterMode}
                      />
                      {dateFilterMode === 'month' ? (
                        <FilterControl icon={<CalendarDays size={20} />} label="Mes" onChange={(value) => setFilters((current) => ({ ...current, month: value }))} options={availableMonths} value={filters.month} />
                      ) : dateFilterMode === 'week' ? (
                        <label className="cc-filter grid h-10 min-w-[170px] gap-0 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--cc-muted)] shadow-sm">
                          Semana
                          <input aria-label="Semana" className="bg-transparent text-sm font-bold normal-case text-[var(--text-main)] outline-none" onChange={(event) => setSelectedWeek(event.target.value)} type="week" value={selectedWeek} />
                        </label>
                      ) : dateFilterMode === 'day' ? (
                        <label className="cc-filter grid h-10 min-w-[170px] gap-0 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--cc-muted)] shadow-sm">
                          Día
                          <input aria-label="Día" className="bg-transparent text-sm font-bold normal-case text-[var(--text-main)] outline-none" onChange={(event) => setSelectedDay(event.target.value)} type="date" value={selectedDay} />
                        </label>
                      ) : (
                        <div className="flex flex-wrap gap-2" aria-label="Rango de fechas">
                          <label className="cc-filter grid h-10 min-w-[150px] gap-0 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--cc-muted)] shadow-sm">
                            Desde
                            <input aria-label="Fecha de inicio" className="bg-transparent text-sm font-bold normal-case text-[var(--text-main)] outline-none" onChange={(event) => setRangeStart(event.target.value)} type="date" value={rangeStart} />
                          </label>
                          <label className="cc-filter grid h-10 min-w-[150px] gap-0 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--cc-muted)] shadow-sm">
                            Hasta
                            <input aria-label="Fecha de fin" className="bg-transparent text-sm font-bold normal-case text-[var(--text-main)] outline-none" min={rangeStart || undefined} onChange={(event) => setRangeEnd(event.target.value)} type="date" value={rangeEnd} />
                          </label>
                        </div>
                      )}
                      <FilterControl icon={<Siren size={20} />} label="Prioridad" onChange={(value) => setFilters((current) => ({ ...current, priority: value as PriorityFilter }))} options={availablePriorities} value={filters.priority} />
                      <FilterControl icon={<ClipboardCheck size={20} />} label="Estado" onChange={(value) => setFilters((current) => ({ ...current, status: value as StatusFilter }))} options={availableStatuses} value={filters.status} />
                      <FilterControl icon={<MapPin size={20} />} label="Comuna/Región" onChange={(value) => setFilters((current) => ({ ...current, location: value }))} options={locationOptions} value={filters.location} />
                    </div>

                  </div>
                  <p className="mt-2 text-xs font-semibold text-[var(--cc-muted)]">
                    Filtros activos: {dateFilterMode === 'month' ? selectedMonthLabel : dateFilterMode === 'week' ? formatWeekLabel(selectedWeek) : dateFilterMode === 'day' ? selectedDay || 'Día sin seleccionar' : (rangeStart || 'Inicio') + ' — ' + (rangeEnd || 'Fin')} · Prioridad {selectedPriorityLabel} · Estado {selectedStatusLabel} · {selectedLocationLabel}
                  </p>
                  {databaseDashboardLoading ? (
                    <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]" role="status">Actualizando datos...</p>
                  ) : databaseDashboardError ? (
                    <div className="cc-api-alert mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800" role="alert">
                      <span>Algunos datos no se pudieron actualizar. Mostrando la última información disponible.</span>
                      <button className="cc-api-retry rounded-md border border-amber-300 bg-white px-2 py-1 font-bold hover:bg-amber-100" onClick={() => setDatabaseReloadKey((key) => key + 1)} type="button">Reintentar</button>
                    </div>
                  ) : null}

                  {dailyDashboardData ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      Datos incluyen visitas diarias guardadas ({formatInt(dailyDashboardData.kpis.visitas)}).
                    </p>
                  ) : null}
                </section>
                </TailAdminSidePanel>
                {editMode ? (
                  <InlineEditToolbar
                    onSaveDraft={() => designConfig.saveDraftToBackend()}
                    onPublish={() => designConfig.publishToBackend()}
                    onCancel={exitEditMode}
                    onReset={() => { designConfig.resetConfig(); exitEditMode(); }}
                    hasUnsavedChanges={designConfig.isPreviewActive}
                  />
                ) : null}
                <ExecutiveDashboardLayout
                  widgets={editModeWidgets}
                  routeMetrics={routeMetrics}
                  routePeriod={routePeriod}
                  setRoutePeriod={setRoutePeriod}
                  routeDateBase={routeDateBase}
                  setRouteDateBase={setRouteDateBase}
                  onOpenRegions={() => setViewMode('regiones')}
                  showTerritorialInsights={viewMode === 'rm'}
                  territorialMetrics={territorialMetrics}
                  onOpenTerritorialExplanation={() => setShowTerritorialExplanation(true)}
                  onOpenTerritorialComuna={(comuna) => setTerritorialComunaDetail(comuna)}
                  onShowTerritorialEvidence={showEvidenceForComuna}
                  onGoToRouteView={openRouteView}
                  onOptimizeRoute={openRouteOptimization}
                  onViewRoutePending={openRoutePending}
                  designSections={hasActiveDesignConfig ? activeDesignConfig?.sections : undefined}
                />
                {showTerritorialExplanation ? (
                  <TerritorialExplanationModal
                    comunaCritica={territorialMetrics.comunaCritica}
                    topReclamos={territorialMetrics.topReclamos}
                    hasActiveData={territorialMetrics.hasActiveData}
                    isUsingFallback={territorialMetrics.isUsingFallback}
                    onClose={() => setShowTerritorialExplanation(false)}
                    onOpenComuna={() => {
                      const comuna = territorialMetrics.comunaCritica?.comuna;
                      if (!comuna) return;
                      setShowTerritorialExplanation(false);
                      setTerritorialComunaDetail(comuna);
                    }}
                  />
                ) : null}
                {territorialComunaDetail ? (
                  <TerritorialComunaDetailModal
                    comuna={territorialComunaDetail}
                    metric={selectedTerritorialMetric}
                    onClose={() => setTerritorialComunaDetail(null)}
                    onFilterComuna={filterComunaFromModal}
                    onShowEvidence={(comuna) => {
                      setTerritorialComunaDetail(null);
                      showEvidenceForComuna(comuna);
                    }}
                    onShowMap={showComunaOnMap}
                  />
                ) : null}
                </>
              </ProtectedView>
            </ProtectedView>
          ) : activeTab === 'map' ? (
            <ProtectedView viewKey="dashboard">
              <MapView
                activeRedZones={activeRedZones}
                comunaMetrics={filteredMapData}
                historicalRedZones={zonasRojasGeoJson}
                maxVisitas={maxVisitas}
                rmComunasLayer={mapLayers.comunasKml}
              />
            </ProtectedView>
          ) : activeTab === 'ruta' ? (
            <ProtectedView viewKey="ruta"><RutaVisitadorView redZonesGeoJson="/data/map-layers/zonas_rojas.geojson" importedReclamos={eligibleRouteReclamos} /></ProtectedView>
          ) : activeTab === 'billing' ? (
            <ProtectedView viewKey="dashboard"><BillingView tableRows={tableRows} claims={databaseDashboardData?.reclamos ?? []} totals={totals} regionByComuna={regionByComuna} /></ProtectedView>
          ) : activeTab === 'settings' ? (
            <ProtectedView viewKey="configuracion">
              <SettingsView
                kpiDraft={kpiDraft}
                setKpiDraft={setKpiDraft}
                customKpis={customKpis}
                addCustomKpi={addCustomKpi}
                setCustomKpis={setCustomKpis}
                tableRows={tableRows}
                totals={totals}
                designConfig={designConfig}
                configurableKpiDataSources={configurableKpiDataSources}
                onOpenImport={() => setShowImportModal(true)}
                canOpenImport={hasPermission('importaciones')}
                canManageUsers={hasPermission('usuarios')}
              />
            </ProtectedView>
          ) : activeTab === 'reports' ? (
            <ProtectedView viewKey="reportes"><ReportsView rmRows={tableRows} /></ProtectedView>
          ) : activeTab === 'users' ? (
            <ProtectedView viewKey="usuarios"><UserManagementView /></ProtectedView>
          ) : (
            <Panel className="flex min-h-[620px] flex-col items-center justify-center p-10 text-center">
              <AlertTriangle className="mb-4 text-blue-600" size={44} />
              <h2 className="text-2xl font-black text-[var(--text-main)]">Módulo en construcción</h2>
              <p className="mt-2 max-w-md text-sm font-semibold text-[#6b7d98]">La navegación lateral ya está preparada para conectar nuevas vistas operativas.</p>
              <button className="mt-6 rounded-lg bg-[#073B91] px-5 py-3 text-sm font-black text-white" onClick={() => setActiveTab('dashboard')} type="button">Volver al dashboard</button>
            </Panel>
          )}
          </div> {/* close scroll-wrapper */}
        </div>

        {showImportModal && hasPermission('importaciones') ? <DataImportModal onClose={() => setShowImportModal(false)} onImported={refreshImportedRows} /> : null}
        {editMode && selectedComponentId ? (
          <ComponentEditPanel
            component={activeDesignConfig?.components.find((c) => c.id === selectedComponentId) ?? activeDesignConfig?.components[0]!}
            onUpdate={(updater) => updateComponentInDraft(selectedComponentId, updater)}
            onClose={() => setSelectedComponentId(null)}
          />
        ) : null}
      </main>
    </div>
  );
}

function TrendingUpIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
      <path d="M4 17L10 11L14 15L21 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
      <path d="M16 8H21V13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
    </svg>
  );
}

