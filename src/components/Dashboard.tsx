import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  CloudDownload,
  Crown,
  Download,
  Eye,
  FileBarChart,
  Grid2X2,
  HelpCircle,
  Landmark,
  MapPin,
  Moon,
  Navigation,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Siren,
  Sun,
  Trash2,
  Truck,
  Users,
  UserCog,
} from 'lucide-react';
import type { Feature, FeatureCollection, GeoJsonObject } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GeoJSON, LayerGroup, LayersControl, MapContainer, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import { monthlyFacturacion, operationalSummary, sourceSummary, type ComunaMetric } from '../data/dashboardData';
import { DataImportModal } from '../features/data-import/DataImportModal';
import { aggregateImportedRows, loadRegionImportedRows, loadRmImportedRows } from '../features/data-import/importStorage';
import type { ImportedDashboardRow } from '../features/data-import/importTypes';
import type { DashboardWidget } from '../features/layout/types';
import { MapView } from '../features/mapa/MapView';
import { ReportsView } from '../features/reports/ReportsView';
import { RutaVisitadorView } from '../features/ruta/RutaVisitadorView';
import { ArqueoRutaView } from '../features/ruta/ArqueoRutaView';
import { UserMenu } from '../features/user/UserMenu';
import { ProtectedView } from '../features/auth/ProtectedView';
import type { AppViewKey } from '../features/auth/authTypes';
import { useAuth } from '../features/auth/useAuth';
import { UserManagementView } from '../features/users/UserManagementView';
import { loadRegionalGeoLayer } from '../features/maps/loadRegionalGeoLayer';
import { getRegionalFeatureName, normalizeMapJoinKey } from '../features/maps/normalizeMapJoinKey';
import { RegionClaimsLayer } from '../features/maps/RegionClaimsLayer';
import { ActiveRedZonesLayers } from '../features/red-zones/ActiveRedZonesLayers';
import { fetchRedZones } from '../features/red-zones/redZonesApi';
import { getRouteDailyVisits, getRouteVisitsByDateRange } from '../features/ruta/routeDailyStorage';
import { getRouteDateRange, calculateRouteDailyMetrics } from '../features/ruta/routeDailyMetrics';
import type { RoutePeriod, RouteDailyMetrics } from '../features/ruta/routeDailyMetrics';
import type { RedZone } from '../features/red-zones/redZoneTypes';
import { fetchDashboardDailyVisits, type DashboardDailyResponse } from '../services/dashboardApi';
import { fetchDashboardDatabase, type DashboardClaim, type DashboardDatabaseResponse } from '../services/dashboardDatabaseApi';

type ActiveTab = 'dashboard' | 'ruta' | 'arqueo' | 'alerts' | 'map' | 'settings' | 'reports' | 'users' | 'help';
type PriorityFilter = 'todas' | 'alta' | 'media' | 'baja';
type MonthFilter = 'all' | string;
type LocationFilter = 'all' | string;
type DashboardTheme = 'default' | 'dark-premium';
type DateFilterMode = 'month' | 'week' | 'day' | 'range';
type DashboardFilters = {
  month: MonthFilter;
  priority: PriorityFilter;
  location: LocationFilter;
};
type TableRow = ComunaMetric & {
  share: number;
  average: number;
  normalizedBilling: number;
};

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

const navItems: Array<{ id: ActiveTab; label: string; icon: typeof Grid2X2; permission: AppViewKey; badge?: boolean }> = [
  { id: 'dashboard', label: 'Panel principal', icon: Grid2X2, permission: 'dashboard' },
  { id: 'settings', label: 'Configuraciones', icon: ShieldCheck, permission: 'configuracion' },
  { id: 'reports', label: 'Reportes', icon: FileBarChart, permission: 'reportes' },
  { id: 'ruta', label: 'Ruta visitador', icon: Route, permission: 'ruta' },
  { id: 'arqueo', label: 'Arqueo Ruta', icon: ClipboardCheck, permission: 'ruta' },
  { id: 'alerts', label: 'Alertas', icon: AlertTriangle, permission: 'dashboard', badge: true },
  { id: 'map', label: 'Mapa', icon: MapPin, permission: 'dashboard' },
  { id: 'users', label: 'Usuarios', icon: UserCog, permission: 'usuarios' },
];

const bottomNavItems = [
  { id: 'help' as const, label: 'Ayuda', icon: HelpCircle, permission: 'dashboard' as AppViewKey },
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
  location: 'all',
};
const THEME_STORAGE_KEY = 'dashboard-theme';
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

function getStoredDashboardTheme(): DashboardTheme {
  if (typeof window === 'undefined') return 'default';

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === 'default' ? 'default' : 'dark-premium';
}

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
    scope: isRmRegion(claim.region) ? 'rm' : 'regiones',
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

  if (ratio >= 0.72) return '#0f5fcf';
  if (ratio >= 0.52) return '#2f8fe8';
  if (ratio >= 0.34) return '#8cc8f5';
  return '#d8ebfb';
};

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

const escapePopupValue = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

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
  return <section className={`cc-card rounded-lg border border-slate-200 bg-white ${className}`}>{children}</section>;
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
      className={`cc-nav-item group relative flex h-10 w-10 items-center justify-center rounded-lg transition ${
        active ? 'bg-[#073B91] text-white shadow-lg shadow-blue-900/20' : 'text-[#466083] hover:bg-blue-50 hover:text-[#073B91]'
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
    <label className="cc-filter relative flex h-12 min-w-[190px] items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30 focus-within:border-blue-200 focus-within:ring-2 focus-within:ring-blue-600/25">
      <span className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md text-[#23446f]">{icon}</span>
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
          <select
            aria-label={label}
            className="block max-w-[150px] appearance-none truncate bg-transparent pr-6 text-sm font-black text-[#071b4d] outline-none"
            onChange={(event) => onChange(event.target.value)}
            value={value}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </span>
      </span>
      <ChevronDown className="pointer-events-none absolute right-3 text-[#466083]" size={16} />
    </label>
  );
}

function PrimaryMetric({
  icon,
  tone,
  title,
  value,
  delta,
}: {
  icon: React.ReactNode;
  tone: 'blue' | 'red' | 'cyan';
  title: string;
  value: string;
  delta: string;
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-600',
    cyan: 'bg-cyan-100 text-cyan-700',
  };

  return (
    <Panel className="cc-kpi-card cc-kpi flex h-full min-h-[116px] items-center gap-3 p-3">
      <div data-tone={tone} className={`cc-kpi-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${colors[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="cc-kpi-label text-xs font-black text-[#172448]">{title}</p>
        <p className="cc-kpi-value mt-1 text-lg font-black text-[#071b4d] 2xl:text-xl">{value}</p>
        <p data-tone={tone} className={`cc-metric-trend mt-3 text-xs font-bold ${tone === 'red' ? 'text-red-500' : tone === 'cyan' ? 'text-slate-600' : 'text-emerald-600'}`}>{delta}</p>
      </div>
    </Panel>
  );
}

function InsightCard({
  icon,
  iconClass,
  label,
  title,
  detail,
  badge,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  title: string;
  detail: string;
  badge?: string;
}) {
  return (
    <Panel className="cc-insight-card cc-side-rank cc-card-elevated flex h-full min-h-[112px] flex-wrap items-start gap-3 p-3">
      <div className={`cc-kpi-icon cc-insight-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconClass}`}>{icon}</div>
      <div className="min-w-[150px] flex-1">
        <p className="cc-kpi-label text-xs font-bold text-[#466083]">{label}</p>
        <p className="cc-insight-value mt-1 break-words text-lg font-extrabold leading-tight text-[#071b4d]">{title}</p>
        <p className="cc-insight-detail mt-2 text-xs font-bold text-[#172448]">{detail}</p>
      </div>
      {badge ? <span className="cc-badge cc-badge-info shrink-0 self-start whitespace-nowrap rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-500">{badge}</span> : null}
    </Panel>
  );
}

function StatStripItem({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="cc-stat-strip flex h-full min-w-0 items-center gap-3 px-4 py-2">
      <div className="cc-kpi-icon cc-stat-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">{icon}</div>
      <div className="min-w-0">
        <p className="cc-kpi-label truncate text-xs font-bold text-[#466083]">{label}</p>
        <p className="cc-kpi-value text-lg font-black leading-tight text-[#071b4d]">{value}</p>
        <p className="cc-metric-detail truncate text-xs font-semibold text-[#466083]">{detail}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
      <p className="text-xs font-bold text-slate-500">Sin datos para los filtros seleccionados.</p>
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
    <Panel className="cc-kpi-card cc-custom-kpi flex min-h-[112px] items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="cc-kpi-icon cc-custom-kpi-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700">
          <Calculator size={24} />
        </div>
        <div className="min-w-0">
          <p className="cc-kpi-label truncate text-xs font-black uppercase tracking-wide text-[#466083]">{title}</p>
          <p className="cc-kpi-value mt-1 text-2xl font-black text-[#071b4d]">{value}</p>
          <p className="cc-metric-detail mt-1 truncate text-xs font-bold text-[#6b7d98]">{detail}</p>
        </div>
      </div>
      {onRemove ? (
        <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500" onClick={onRemove} type="button" aria-label="Eliminar KPI">
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
    <div className="cc-vertical-chart flex h-44 items-end gap-4 border-l border-b border-slate-200 px-3 pt-4">
      {safeItems.map((item, index) => (
        <div key={item.label} className="cc-vertical-item flex h-full flex-1 flex-col items-center justify-end gap-2">
          <span className="cc-chart-value text-[10px] font-black text-[#172448]">{item.display}</span>
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
          <span className="cc-chart-label text-[10px] font-bold leading-tight text-[#172448]">{item.name}</span>
          <div className="cc-chart-track h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div aria-label={`${item.name}: ${item.label}`} className={`cc-chart-bar ${color === 'red' ? 'cc-chart-bar-danger' : 'cc-chart-bar-info'} h-full rounded-full ${bar}`} style={{ width: `${normalize(item.value, max)}%` }} title={`${item.name}: ${item.label}`} />
          </div>
          <span className="cc-chart-value text-right font-black text-[#172448]">{item.label}</span>
        </div>
      ))}
      {maxLabel ? <div className="cc-chart-axis flex justify-between pt-1 text-[10px] font-bold text-[#6b7d98]"><span>0</span><span>{maxLabel}</span></div> : null}
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
          <span className="cc-donut-value text-xl font-black text-[#071b4d]">{center}</span>
          <span className="cc-chart-label text-xs font-bold text-[#466083]">{label}</span>
        </div>
      </div>
      <div className="cc-chart-legend flex-1 space-y-3">
        {safeSegments.map((segment) => (
          <div key={segment.name} className="cc-chart-legend-row flex items-center justify-between gap-3 text-xs">
            <span className="cc-chart-label flex items-center gap-2 font-bold text-[#172448]"><span className="cc-chart-swatch h-3 w-3 rounded" style={{ backgroundColor: segment.color }} />{segment.name}</span>
            <span className="cc-chart-value font-black text-[#172448]">{segment.value}</span>
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
        map.setView([-35.6751, -71.543], 4);
        return;
      }

      try {
        const geoLayer = L.geoJSON(data);
        const bounds = geoLayer.getBounds();

        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20] });
        } else {
          map.setView([-35.6751, -71.543], 4);
        }
      } catch {
        map.setView([-35.6751, -71.543], 4);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [data, map, recenterKey]);

  return null;
}

/** Mapa exclusivo de regiones de Chile. NO incluye capas RM, burbujas, cuadrantes ni límite urbano. */
function RegionPreviewMap({
  data,
  hasRegionalData,
  layerError,
  metricsByComuna,
  maxVisitas,
  recenterKey = 0,
  activeRedZones = [],
}: {
  data: FeatureCollection | null;
  hasRegionalData: boolean;
  layerError: string;
  metricsByComuna: Map<string, RegionalMapMetric>;
  maxVisitas: number;
  recenterKey?: number;
  activeRedZones?: RedZone[];
}) {
  const featureJoinKeys = useMemo(() => {
    const keys = new Set<string>();
    data?.features.forEach((feature) => {
      const key = normalizeMapJoinKey(getRegionalFeatureName(feature));
      if (key) keys.add(key);
    });
    return keys;
  }, [data]);
  const unmatchedMetricCount = useMemo(
    () => [...metricsByComuna.keys()].filter((key) => !featureJoinKeys.has(key)).length,
    [featureJoinKeys, metricsByComuna],
  );
  const getMetricForRegionalFeature = useCallback(
    (feature?: Feature) => metricsByComuna.get(normalizeMapJoinKey(getRegionalFeatureName(feature))),
    [metricsByComuna],
  );
  const regionalFeatureStyle = useCallback(
    (feature?: Feature) => {
      const claims = getMetricForRegionalFeature(feature)?.visitas ?? 0;
      if (claims === 0) return { fillColor: '#111827', color: '#334155', fillOpacity: 0.25, opacity: 0.9, weight: 0.8 };
      if (claims <= 5) return { fillColor: '#1E3A8A', color: '#334155', fillOpacity: 0.65, opacity: 1, weight: 1 };
      if (claims <= 10) return { fillColor: '#1B4FD8', color: '#334155', fillOpacity: 0.7, opacity: 1, weight: 1 };
      if (claims <= 20) return { fillColor: '#22D3EE', color: '#334155', fillOpacity: 0.72, opacity: 1, weight: 1 };
      return { fillColor: '#F97316', color: '#334155', fillOpacity: 0.76, opacity: 1, weight: 1 };
    },
    [getMetricForRegionalFeature],
  );
  const onEachRegionalFeature = useCallback(
    (feature: Feature, layer: L.Layer) => {
      const featureName = getRegionalFeatureName(feature) || 'Comuna/ciudad sin nombre';
      const metric = getMetricForRegionalFeature(feature);
      layer.bindTooltip(featureName, { direction: 'top', sticky: true });

      if (metric) {
        const popupTitle = escapePopupValue(metric.comuna || featureName);
        layer.bindPopup([
          '<div style="min-width:210px">',
          '<p style="font-weight:800;font-size:14px;border-bottom:1px solid #22304D;padding-bottom:5px;margin-bottom:7px;color:#F1F5F9">' + popupTitle + '</p>',
          '<div style="font-size:12px;line-height:1.55;color:#CBD5E1">',
          '<p>Reclamos: <strong>' + formatInt(metric.visitas) + '</strong></p>',
          '<p>Tickets únicos: <strong>' + formatInt(metric.ticketsUnicos) + '</strong></p>',
          '<p>Facturación: <strong>' + formatCurrency(metric.facturacion) + '</strong></p>',
          '<p>KM: <strong>' + formatInt(metric.km) + '</strong></p>',
          '<p>Traslado: <strong>' + formatCurrency(metric.traslado) + '</strong></p>',
          '<p>Envío bulto: <strong>' + formatCurrency(metric.valorEnvioBulto) + '</strong></p>',
          '<p>Alta prioridad: <strong>' + formatInt(metric.alta) + '</strong></p>',
          '<p>Media prioridad: <strong>' + formatInt(metric.media) + '</strong></p>',
          '<p>Baja prioridad: <strong>' + formatInt(metric.baja) + '</strong></p>',
          '<p>Completadas: <strong>' + formatInt(metric.completadas) + '</strong></p>',
          '<p>Pendientes: <strong>' + formatInt(metric.pendientes) + '</strong></p>',
          '<p>No realizadas: <strong>' + formatInt(metric.noRealizadas) + '</strong></p>',
          '</div></div>',
        ].join(''));
      } else {
        layer.bindPopup(`<strong>${escapePopupValue(featureName)}</strong><br/>Sin reclamos cargados para esta comuna`);
      }

      const pathLayer = layer as L.Path;
      pathLayer.on({
        mouseover: () => {
          pathLayer.setStyle({ color: '#EAF0F8', weight: 2, fillOpacity: 0.85 });
          pathLayer.bringToFront();
        },
        mouseout: () => pathLayer.setStyle(regionalFeatureStyle(feature)),
      });
    },
    [getMetricForRegionalFeature, regionalFeatureStyle],
  );

  return (
    <div className="cc-map-surface relative h-full w-full overflow-hidden rounded-xl">
      <MapContainer
        center={[-35.6751, -71.543]}
        zoom={4}
        minZoom={3}
        className="h-full w-full"
        zoomControl={false}
        doubleClickZoom
        scrollWheelZoom
        dragging
        attributionControl={false}
        preferCanvas
      >
        <ZoomControl position="topleft" />
        <RegionMapBounds data={data} recenterKey={recenterKey} />
        <BaseMapLayers>
          {data ? (
            <LayersControl.Overlay checked name="Comunas / ciudades Regiones">
              <GeoJSON
                key={`regiones-claims-${metricsByComuna.size}-${maxVisitas}-${data.features.length}`}
                data={data}
                onEachFeature={onEachRegionalFeature}
                style={regionalFeatureStyle}
              />
            </LayersControl.Overlay>
          ) : null}
          <ActiveRedZonesLayers redZoneMode="readonly" zones={activeRedZones} />
        </BaseMapLayers>
      </MapContainer>

      <div className="cc-map-legend pointer-events-none absolute bottom-4 left-4 z-[500] w-[220px] rounded-lg border border-[#22304D] bg-[#0D1324]/95 p-3 text-[#CBD5E1] shadow-lg">
        <p className="mb-2 text-[10px] font-black uppercase">Reclamos por comuna</p>
        <div className="grid grid-cols-5 gap-1 text-center text-[9px] font-bold">
          {[
            ['#111827', '0'],
            ['#1E3A8A', '1-5'],
            ['#1B4FD8', '6-10'],
            ['#22D3EE', '11-20'],
            ['#F97316', '20+'],
          ].map(([color, label]) => (
            <span key={label}><i className="mb-1 block h-2 rounded-sm" style={{ backgroundColor: color }} />{label}</span>
          ))}
        </div>
      </div>

      {!hasRegionalData ? (
        <div className="cc-map-warning cc-map-warning-info pointer-events-none absolute left-14 top-4 z-[500] rounded-lg border border-[#22304D] bg-[#0D1324]/95 px-3 py-2 text-xs font-bold text-[#94A3B8] shadow-lg">
          Sin datos de regiones cargados
        </div>
      ) : null}
      {layerError ? (
        <div className="cc-map-warning cc-map-warning-danger pointer-events-none absolute bottom-4 right-4 z-[500] max-w-[280px] rounded-lg border border-[#22304D] bg-[#0D1324]/95 px-3 py-2 text-xs font-bold text-[#94A3B8] shadow-lg">
          {layerError}
        </div>
      ) : null}
      {data && unmatchedMetricCount > 0 && !layerError ? (
        <div className="cc-map-warning cc-map-warning-warning pointer-events-none absolute right-4 top-4 z-[500] max-w-[280px] rounded-lg border border-orange-500/40 bg-[#0D1324]/95 px-3 py-2 text-xs font-bold text-orange-300 shadow-lg">
          {formatInt(unmatchedMetricCount)} comunas no coinciden con la capa geográfica
        </div>
      ) : null}
    </div>
  );
}
/** Modal exclusivo de regiones de Chile. NO hereda capas RM ni del mapa principal. */
function ModalMap({
  data,
  hasRegionalData,
  layerError,
  metricsByComuna,
  maxVisitas,
  onClose,
}: {
  data: FeatureCollection | null;
  hasRegionalData: boolean;
  layerError: string;
  metricsByComuna: Map<string, RegionalMapMetric>;
  maxVisitas: number;
  onClose: () => void;
}) {
  const [recenterKey, setRecenterKey] = useState(0);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="cc-modal-backdrop fixed inset-0 z-[9999] isolate flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="region-modal-title"
    >
      <div className="cc-modal cc-map-modal relative z-[10000] flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white">
        <div className="cc-map-header flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="region-modal-title" className="cc-section-title text-lg font-black text-[#071b4d]">Vista ampliada: Regiones de Chile</h2>
          <div className="flex items-center gap-2">
            <button
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#073B91] shadow-sm transition hover:bg-blue-50"
              onClick={() => setRecenterKey((k) => k + 1)}
              type="button"
            >
              Centrar Chile
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={onClose}
              type="button"
              aria-label="Cerrar vista ampliada de regiones"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="h-[75vh] w-full">
          <RegionPreviewMap
            data={data}
            hasRegionalData={hasRegionalData}
            layerError={layerError}
            metricsByComuna={metricsByComuna}
            maxVisitas={maxVisitas}
            recenterKey={recenterKey}
          />
        </div>
      </div>
    </div>
  );
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
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#466083]">Constructor de KPI</p>
          <h2 className="mt-1 text-2xl font-black text-[#071b4d]">Crear indicador desde la información cargada</h2>
        </div>

        <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-[#466083]">Nombre KPI</span>
              <input
                className="h-12 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-[#071b4d] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setKpiDraft((current) => ({ ...current, title: event.target.value }))}
                value={kpiDraft.title}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-[#466083]">Métrica base</span>
              <select
                className="h-12 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-[#071b4d] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
                className="h-12 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-[#071b4d] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
                className="h-12 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-[#071b4d] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
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
            <h3 className="text-xl font-black text-[#071b4d]">Aún no hay KPIs personalizados</h3>
            <p className="mt-2 max-w-xl text-sm font-semibold text-[#6b7d98]">Usa el constructor superior para crear indicadores desde visitas, facturación, prioridades, reiteraciones o participación por comuna.</p>
          </Panel>
        )}
      </section>
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
  canViewReports,
}: {
  kpiDraft: Omit<CustomKpi, 'id'>;
  setKpiDraft: React.Dispatch<React.SetStateAction<Omit<CustomKpi, 'id'>>>;
  customKpis: CustomKpi[];
  addCustomKpi: () => void;
  setCustomKpis: React.Dispatch<React.SetStateAction<CustomKpi[]>>;
  tableRows: TableRow[];
  totals: { visitas: number; facturacion: number };
  canViewReports: boolean;
}) {
  return (
    <div className="grid gap-4">
      <Panel className="p-4">
        <h2 className="text-xl font-bold text-[#071b4d]">Configuraciones</h2>
        <p className="mt-1 text-sm font-medium text-slate-600">
          Administra indicadores personalizados y vistas guardadas sin alterar el dashboard principal.
        </p>
      </Panel>

      <KpiBuilder
        kpiDraft={kpiDraft}
        setKpiDraft={setKpiDraft}
        customKpis={customKpis}
        addCustomKpi={addCustomKpi}
        setCustomKpis={setCustomKpis}
        tableRows={tableRows}
        totals={totals}
      />

      {canViewReports ? <ReportsView rmRows={tableRows} /> : null}
    </div>
  );
}

function RegionSidebar({
  regionalLayer,
  hasRegionalData,
  regionalLayerError,
  regionalMapMetrics,
  regionalMaxVisitas,
  setShowRegionModal,
  operationalSummary,
  successfulVisits,
  successfulPct,
}: {
  regionalLayer: FeatureCollection | null;
  hasRegionalData: boolean;
  regionalLayerError: string;
  regionalMapMetrics: Map<string, RegionalMapMetric>;
  regionalMaxVisitas: number;
  setShowRegionModal: (show: boolean) => void;
  operationalSummary: typeof import('../data/dashboardData').operationalSummary;
  successfulVisits: number;
  successfulPct: number;
}) {
  return (
    <aside className="cc-side-panel hidden w-[286px] shrink-0 2xl:block">
      <Panel className="cc-side-shell sticky top-3 h-[calc(100vh-24px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
        <div className="cc-side-header mb-3 flex items-center justify-between gap-2">
          <h2 className="cc-side-title flex min-w-0 items-center gap-2 text-base font-black text-[#071b4d]"><MapPin size={16} />Vista previa: Regiones</h2>
          <button
            className="cc-side-expand cc-button-secondary flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-black text-[#073B91] transition hover:bg-blue-50"
            onClick={() => setShowRegionModal(true)}
            type="button"
          >
            Ampliar
          </button>
        </div>
        <div className="cc-preview-card cc-preview-map cc-side-map h-[250px] min-h-[240px] w-full overflow-hidden rounded-lg bg-blue-50">
          <RegionPreviewMap
            data={regionalLayer}
            hasRegionalData={hasRegionalData}
            layerError={regionalLayerError}
            metricsByComuna={regionalMapMetrics}
            maxVisitas={regionalMaxVisitas}
          />
        </div>

        <div className="cc-side-section mt-3 grid gap-2.5">
          <Panel className="cc-side-card cc-kpi-card cc-region-metric flex items-center gap-3 p-3">
            <div className="cc-kpi-icon cc-region-km flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700"><Navigation size={22} /></div>
            <div>
              <p className="cc-side-label text-xs font-black uppercase text-[#466083]">KM</p>
              <p className="cc-side-value text-xl font-black text-[#071b4d]">{hasRegionalData ? '125.430' : '0'}</p>
              <p className="cc-side-meta text-[11px] font-bold text-emerald-600">{hasRegionalData ? '+9,3% vs. mes anterior' : 'Sin datos de regiones'}</p>
            </div>
          </Panel>

          <Panel className="cc-side-card cc-kpi-card cc-region-metric flex items-center gap-3 p-3">
            <div className="cc-kpi-icon cc-region-transfer flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-[#466083]"><Truck size={22} /></div>
            <div>
              <p className="cc-side-label text-xs font-black uppercase text-[#466083]">Traslado</p>
              <p className="cc-side-value text-xl font-black text-[#071b4d]">{hasRegionalData ? '4.612' : '0'}</p>
              <p className="cc-side-meta text-[11px] font-bold text-slate-500">{hasRegionalData ? '-4,2% vs. mes anterior' : 'Sin datos de regiones'}</p>
            </div>
          </Panel>

          <Panel className="cc-side-card cc-kpi-card cc-status-card p-3">
            <div className="cc-status-heading mb-3 flex items-center gap-2">
              <CheckCircle2 className="cc-status-icon text-[#466083]" size={20} />
              <h3 className="cc-side-title text-sm font-black text-[#071b4d]">Estado visita</h3>
            </div>
            <Donut
              center={hasRegionalData ? `${successfulPct}%` : '0%'}
              label="Completadas"
              segments={[
                { color: '#10b981', from: 0, to: hasRegionalData ? successfulPct : 0, name: 'Completadas', value: formatInt(hasRegionalData ? successfulVisits : 0) },
                { color: '#f59e0b', from: hasRegionalData ? successfulPct : 0, to: hasRegionalData ? 94 : 0, name: 'Pendientes', value: formatInt(hasRegionalData ? operationalSummary.visitsFrom13Services : 0) },
                { color: '#ef4444', from: hasRegionalData ? 94 : 0, to: hasRegionalData ? 100 : 0, name: 'No realizadas', value: formatInt(hasRegionalData ? operationalSummary.unsuccessfulVisits : 0) },
              ]}
            />
            <p className="cc-status-total mt-3 text-xs font-bold text-[#466083]">Total: <strong>{formatInt(hasRegionalData ? operationalSummary.validVisits : 0)}</strong></p>
          </Panel>

          <button className="cc-side-action cc-button-secondary mt-1 flex h-12 items-center justify-between rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-[#071b4d]" type="button">
            Ir a vista Regiones
            <span className="text-2xl">-&gt;</span>
          </button>
        </div>
      </Panel>
    </aside>
  );
}


function DashboardSlot({
  widgets,
  id,
  className = '',
}: {
  widgets: DashboardWidget[];
  id: string;
  className?: string;
}) {
  const widget = widgets.find((item) => item.id === id && item.visible);

  if (!widget) return null;

  return <div className={className}>{widget.content}</div>;
}

function ExecutiveDashboardLayout({ widgets }: { widgets: DashboardWidget[] }) {
  const customWidgets = widgets.filter((widget) => widget.id.startsWith('customKpi:') && widget.visible);

  return (
    <div className="cc-dashboard-layout space-y-3">
      <section className="cc-dashboard-grid grid grid-cols-1 gap-3 2xl:grid-cols-[218px_minmax(0,1fr)_250px]">
        <div className="cc-kpi-rail grid grid-cols-1 gap-3 md:grid-cols-3 2xl:grid-cols-1">
          <DashboardSlot widgets={widgets} id="kpiFacturacion" />
          <DashboardSlot widgets={widgets} id="kpiReclamos" />
          <DashboardSlot widgets={widgets} id="kpiPromedio" />
        </div>

        <DashboardSlot
          widgets={widgets}
          id="mapaReclamos"
          className="cc-main-map-frame h-[430px] lg:h-[470px] xl:h-[500px] 2xl:h-[530px]"
        />

        <div className="cc-insight-rail grid grid-cols-1 gap-3 md:grid-cols-3 2xl:grid-cols-1">
          <DashboardSlot widgets={widgets} id="kpiComunaTop" />
          <DashboardSlot widgets={widgets} id="kpiFacturacionTop" />
          <DashboardSlot widgets={widgets} id="kpiCoberturaComunas" />
        </div>
      </section>

      <section className="cc-stat-grid grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DashboardSlot widgets={widgets} id="statTotalComunas" />
        <DashboardSlot widgets={widgets} id="statAltaPrioridad" />
        <DashboardSlot widgets={widgets} id="statVariacionMensual" />
        <DashboardSlot widgets={widgets} id="statTicketsUnicos" />
      </section>

      <section className="cc-chart-grid grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-4">
        <DashboardSlot widgets={widgets} id="graficoFacturacionMensual" className="min-h-[268px]" />
        <DashboardSlot widgets={widgets} id="topComunasReclamos" className="min-h-[268px]" />
        <DashboardSlot widgets={widgets} id="topComunasFacturacion" className="min-h-[268px]" />
        <DashboardSlot widgets={widgets} id="distribucionPrioridad" className="min-h-[268px]" />
      </section>

      <DashboardSlot widgets={widgets} id="tablaComunas" />

      {customWidgets.length > 0 ? (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {customWidgets.map((widget) => (
            <div key={widget.id}>{widget.content}</div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const { hasPermission } = useAuth();
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>(getStoredDashboardTheme);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedRows, setImportedRows] = useState<{ rm: ImportedDashboardRow[]; regiones: ImportedDashboardRow[] }>(loadImportedDashboardRows);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
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
  const [showEvidenceTable, setShowEvidenceTable] = useState(false);
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
  const shouldShowRegionsPreview = activeTab === 'dashboard' && viewMode === 'rm' && hasPermission('regiones');
  const refreshImportedRows = useCallback(() => {
    setImportedRows(loadImportedDashboardRows());
  }, []);
  const refreshActiveRedZones = useCallback(() => {
    fetchRedZones()
      .then(setActiveRedZones)
      .catch(() => {
        setActiveRedZones([]);
      });
  }, []);

  useEffect(() => {
    refreshActiveRedZones();
  }, [refreshActiveRedZones]);

  useEffect(() => {
    if (viewMode === 'rm' && !hasPermission('rm') && hasPermission('regiones')) setViewMode('regiones');
    if (viewMode === 'regiones' && !hasPermission('regiones') && hasPermission('rm')) setViewMode('rm');
  }, [hasPermission, viewMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = dashboardTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, dashboardTheme);
  }, [dashboardTheme]);

  useEffect(() => {
    if (!shouldShowRegionsPreview) {
      setShowRegionModal(false);
    }
  }, [shouldShowRegionsPreview]);

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
        setDatabaseDashboardData(response.available ? response : null);
        setDatabaseDashboardError(response.errors.join(' · '));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDatabaseDashboardData(null);
        setDatabaseDashboardError(error instanceof Error ? error.message : 'No se pudieron cargar los reclamos');
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
      const scope = item.region ? (isRmRegion(item.region) ? 'rm' : 'regiones') : (scopeByComuna.get(key) ?? 'regiones');
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
    () => (databaseDashboardData ? databaseMetrics.rm : aggregateImportedRows(importedRows.rm)),
    [databaseDashboardData, databaseMetrics.rm, importedRows.rm],
  );
  const regionesData = useMemo(
    () => (databaseDashboardData ? databaseMetrics.regiones : aggregateImportedRows(importedRows.regiones)),
    [databaseDashboardData, databaseMetrics.regiones, importedRows.regiones],
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

    importedRows.regiones
      .filter((row) => {
        if (row.scope !== 'regiones' || row.validationStatus === 'error') return false;

        const comuna = row.ciudad || row.comuna || row.regionNormalizada || row.regionOriginal || 'Sin comuna';
        const matchesLocation = filters.location === 'all' || normalizeMapJoinKey(comuna) === normalizeMapJoinKey(filters.location);
        const matchesPriority = filters.priority === 'todas' || row.prioridad === filters.priority;

        return matchesLocation && matchesPriority;
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
  }, [dailyDashboardData, filters.location, filters.priority, importedRows.regiones, viewMode]);
  const regionalMaxVisitas = useMemo(() => Math.max(0, ...[...regionalMapMetrics.values()].map((item) => item.visitas)), [regionalMapMetrics]);
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
  const totals = useMemo(() => sumComunaMetrics(filteredData), [filteredData]);

  const successfulVisits = Math.max(0, operationalSummary.validVisits - operationalSummary.unsuccessfulVisits);
  const successfulPct = operationalSummary.validVisits > 0 ? Math.round((successfulVisits / operationalSummary.validVisits) * 100) : 0;
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

  const dashboardWidgets: DashboardWidget[] = [
    {
      id: 'kpiFacturacion',
      title: 'Facturación total',
      visible: true,
      content: <PrimaryMetric icon={<FileBarChart size={29} />} tone="blue" title="Facturación total" value={formatCurrency(totals.facturacion)} delta={isEmptyCurrentView ? emptyViewMessage : 'Periodo seleccionado'} />,
    },
    {
      id: 'kpiReclamos',
      title: 'Reclamos totales',
      visible: true,
      content: <PrimaryMetric icon={<AlertTriangle size={30} />} tone="red" title="Reclamos totales" value={formatInt(totals.visitas)} delta={isEmptyCurrentView ? emptyViewMessage : 'Datos actualizados'} />,
    },
    {
      id: 'kpiPromedio',
      title: 'Promedio por reclamo',
      visible: true,
      content: <PrimaryMetric icon={<Users size={30} />} tone="cyan" title="Promedio por reclamo" value={formatCurrency(averageBilling)} delta={isEmptyCurrentView ? emptyViewMessage : 'Promedio del periodo'} />,
    },
    {
      id: 'kpiComunaTop',
      title: 'Top reclamos',
      visible: true,
      content: <InsightCard icon={<Landmark size={28} />} iconClass="bg-orange-100 text-orange-500" label="Top reclamos" title={topClaimComuna?.comuna ?? 'Sin datos'} detail={isEmptyCurrentView ? emptyViewMessage : `${formatInt(topClaimComuna?.visitas ?? 0)} reclamos`} badge={totals.visitas > 0 && topClaimComuna ? `${asPercent((topClaimComuna.visitas / totals.visitas) * 100)} del total` : '0% del total'} />,
    },
    {
      id: 'kpiFacturacionTop',
      title: 'Top facturación',
      visible: true,
      content: <InsightCard icon={<Crown size={28} />} iconClass="bg-blue-100 text-blue-600" label="Top facturación" title={topBillingComuna?.comuna ?? 'Sin datos'} detail={isEmptyCurrentView ? emptyViewMessage : formatCurrency(topBillingComuna?.facturacion ?? 0)} badge={totals.facturacion > 0 && topBillingComuna ? `${asPercent((topBillingComuna.facturacion / totals.facturacion) * 100)} del total` : '0% del total'} />,
    },
    {
      id: 'kpiCoberturaComunas',
      title: 'Cobertura',
      visible: true,
      content: <InsightCard icon={<ShieldCheck size={28} />} iconClass="bg-emerald-100 text-emerald-600" label="Cobertura" title={hasFilteredData ? `${Math.round((filteredMapData.length / Math.max(1, currentData.length)) * 100)}%` : '0%'} detail={isEmptyCurrentView ? emptyViewMessage : `${filteredMapData.length} comunas con información`} />,
    },
    {
      id: 'mapaReclamos',
      title: 'Mapa de reclamos',
      visible: true,
      content: (
        <Panel className="cc-map-panel flex h-full min-h-[420px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="cc-map-header border-b border-slate-200 px-4 py-3">
            <h2 className="cc-section-title text-lg font-black text-blue-900">Mapa de reclamos</h2>
            <p className="cc-muted mt-1 text-xs font-semibold text-slate-600">Distribución geográfica y capas disponibles para revisión territorial.</p>
          </div>
          <div className="cc-map-surface relative min-h-[350px] flex-1 overflow-hidden rounded-xl lg:min-h-[390px]">
            {viewMode === 'rm' ? (
              <MapContainer center={[-33.49, -70.67]} className="absolute inset-0 z-0" preferCanvas zoom={10} zoomControl={false}>
                <ZoomControl position="topleft" />
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
                <BaseMapLayers>
                  <RegionClaimsLayer geoJson={regionalLayer} rows={importedRows.regiones} />
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
              <div className="cc-map-legend absolute bottom-4 left-4 z-[500] w-[230px] rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg">
                <div className="mb-2 text-[10px] font-black uppercase text-[#466083]">Reclamos por comuna</div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-[#172448]">
                  <span>Menor</span>
                  <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-[#d8ebfb] via-[#78b9ef] to-[#0757bd]" />
                  <span>Mayor</span>
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
        <Panel className="h-full">
          <StatStripItem icon={<Building2 size={22} />} label="Total comunas" value={formatInt(filteredMapData.length)} detail={viewMode === 'rm' ? 'RM filtrada' : 'Regiones'} />
        </Panel>
      ),
    },
    {
      id: 'statAltaPrioridad',
      title: 'Alta prioridad',
      visible: true,
      content: (
        <Panel className="h-full">
          <StatStripItem icon={<AlertTriangle size={22} />} label="Alta prioridad" value={formatInt(totals.alta)} detail={`${asPercent(altaPct)} del total`} />
        </Panel>
      ),
    },
    {
      id: 'statVariacionMensual',
      title: 'Variación mensual',
      visible: true,
      content: (
        <Panel className="h-full">
          <StatStripItem icon={<TrendingUpIcon />} label="Periodo analizado" value={dateFilterMode === 'month' ? selectedMonthLabel : dateFilterMode === 'week' ? formatWeekLabel(selectedWeek) : dateFilterMode === 'day' ? selectedDay || 'Día' : 'Rango'} detail="Filtro aplicado a todos los datos" />
        </Panel>
      ),
    },
    {
      id: 'statTicketsUnicos',
      title: 'Tickets únicos',
      visible: true,
      content: (
        <Panel className="h-full">
          <StatStripItem icon={<Users size={22} />} label="Tickets únicos" value={formatInt(totals.ticketsUnicos)} detail={totals.visitas > 0 ? `${asPercent((totals.ticketsUnicos / totals.visitas) * 100)} del total` : '0% del total'} />
        </Panel>
      ),
    },
    {
      id: 'graficoFacturacionMensual',
      title: 'Facturación mensual',
      visible: true,
      content: (
        <Panel className="cc-chart-card h-full p-4">
          <h3 className="cc-chart-title mb-3 text-sm font-black text-[#071b4d]">{viewMode === 'regiones' ? 'Facturación mensual Regiones' : 'Facturación mensual RM'}</h3>
          {filteredCharts.monthlyBars.length > 0 ? <VerticalBars items={filteredCharts.monthlyBars} /> : <EmptyState />}
        </Panel>
      ),
    },
    {
      id: 'topComunasReclamos',
      title: 'Top comunas reclamos',
      visible: true,
      content: (
        <Panel className="cc-chart-card h-full p-4">
          <h3 className="cc-chart-title mb-3 text-sm font-black text-[#071b4d]">Top 10 comunas con más reclamos</h3>
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
          <h3 className="cc-chart-title mb-3 text-sm font-black text-[#071b4d]">Top 10 comunas con mayor facturación</h3>
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
          <h3 className="cc-chart-title mb-3 text-sm font-black text-[#071b4d]">Distribución por prioridad</h3>
          <Donut
            center={formatInt(totals.visitas)}
            label="Total"
            segments={[
              { color: '#EF4444', from: 0, to: altaPct, name: 'Alta', value: `${formatInt(totals.alta)} (${asPercent(altaPct)})` },
              { color: '#F97316', from: altaPct, to: altaPct + mediaPct, name: 'Media', value: `${formatInt(totals.media)} (${asPercent(mediaPct)})` },
              { color: '#00F5A0', from: altaPct + mediaPct, to: 100, name: 'Baja', value: `${formatInt(totals.baja)} (${asPercent(bajaPct)})` },
            ]}
          />
        </Panel>
      ),
    },
    {
      id: 'tablaComunas',
      title: 'Tabla comunas',
      visible: true,
      content: (
        <Panel className="h-full overflow-hidden">
          <div className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${showEvidenceTable ? 'border-b border-slate-200' : ''}`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-blue-900">Evidencia por comuna</h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
                  {formatInt(tableRows.length)} comunas
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-xs font-semibold text-slate-600">
                Detalle operativo por comuna. Tabla detallada con reclamos, facturación, promedio y prioridad alta.
              </p>
            </div>
            <button
              aria-expanded={showEvidenceTable}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-[#073B91] shadow-sm transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-600/25 sm:w-auto"
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
                  Ver evidencia
                </>
              )}
            </button>
          </div>
          {showEvidenceTable ? (
            <>
              <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <label className="relative min-w-0 flex-1 sm:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                      aria-label="Buscar en evidencia"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-[#172448] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      onChange={(event) => setEvidenceSearch(event.target.value)}
                      placeholder="Buscar comuna o región"
                      value={evidenceSearch}
                    />
                  </label>
                  <select
                    aria-label="Filtrar evidencia por región"
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#172448] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    onChange={(event) => setEvidenceRegion(event.target.value)}
                    value={evidenceRegion}
                  >
                    {evidenceRegionOptions.map((region) => <option key={region} value={region}>{region === 'all' ? 'Todas las regiones' : region}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-[#172448] hover:bg-slate-50" onClick={exportEvidenceCsv} type="button">
                    <Download size={15} /> CSV
                  </button>
                  <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#073B91] px-3 text-xs font-bold text-white hover:bg-blue-800" onClick={() => void exportEvidenceExcel()} type="button">
                    <FileBarChart size={15} /> Excel
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase text-[#466083]">
                    <tr>
                      {['Periodo', 'Comuna', 'Región', 'Reclamos', 'Facturación', 'Promedio', 'Prioridad alta', '% del total', 'Ver detalle'].map((head) => (
                        <th key={head} className="px-4 py-2 font-black">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableRows.length > 0 ? (
                      visibleEvidenceRows.map((row) => (
                        <tr key={row.comuna} className="hover:bg-blue-50/40">
                          <td className="px-4 py-2 font-semibold text-[#466083]">{selectedMonthLabel}</td>
                          <td className="px-4 py-2 font-black text-[#172448]">{row.comuna}</td>
                          <td className="px-4 py-2 font-semibold text-[#466083]">{regionByComuna.get(normalizeName(row.comuna)) ?? (viewMode === 'rm' ? 'Región Metropolitana' : 'Sin región')}</td>
                          <td className="px-4 py-2 font-bold">{formatInt(row.visitas)}</td>
                          <td className="px-4 py-2 font-bold">{formatCurrency(row.facturacion)}</td>
                          <td className="px-4 py-2 font-bold">{formatCurrency(row.average)}</td>
                          <td className="px-4 py-2"><span className="rounded-full bg-red-100 px-2 py-1 font-black text-red-500">{formatInt(row.alta)}</span></td>
                          <td className="px-4 py-2 font-bold">{asPercent(row.share)}</td>
                          <td className="px-4 py-2"><button aria-label={`Ver detalle de ${row.comuna}`} className="text-blue-700" type="button"><Eye size={16} /></button></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-8 text-center text-sm font-bold text-slate-500" colSpan={9}>
                          {isEmptyCurrentView ? emptyViewMessage : 'Sin datos para los filtros seleccionados.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
                <button
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black text-[#172448] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
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
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black text-[#172448] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
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
      ),
    },
    ...customKpiWidgets,
  ];

  return (
    <div className="cc-shell flex min-h-screen font-sans text-[#172448]">
      <style>{`
        .leaflet-control-attribution { font-size: 9px; }
        .leaflet-popup-content-wrapper {
          border-radius: 10px;
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.18);
        }
        .leaflet-popup-content { margin: 12px 14px; }
        .leaflet-container { z-index: 0; }
        @media print {
          body { background: #ffffff; }
          .no-print { display: none !important; }
          .print-full { height: auto !important; overflow: visible !important; }
        }
      `}</style>

      <aside className="cc-sidebar no-print fixed inset-y-0 left-0 z-30 flex w-14 flex-col items-center border-r border-slate-200 bg-white py-3">
        <div className="cc-sidebar-logo mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0757bd] text-white shadow-lg shadow-blue-900/20">
          <Navigation size={22} />
        </div>

        <nav className="flex flex-col items-center gap-3">
          {navItems.filter((item) => hasPermission(item.permission)).map((item) => {
            const Icon = item.icon;

            return (
              <SidebarIcon key={item.id} active={activeTab === item.id} badge={item.badge} label={item.label} onClick={() => setActiveTab(item.id)}>
                <Icon size={19} />
              </SidebarIcon>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-3">
          {bottomNavItems.filter((item) => hasPermission(item.permission)).map((item) => {
            const Icon = item.icon;

            return (
              <SidebarIcon key={item.id} active={activeTab === item.id} label={item.label} onClick={() => setActiveTab(item.id)}>
                <Icon size={19} />
              </SidebarIcon>
            );
          })}
          <button className="cc-sidebar-action mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#073B91] text-white shadow-lg shadow-blue-900/25" type="button" title="Contraer menú lateral" aria-label="Contraer menú lateral">
            <ChevronsLeft size={19} />
          </button>
        </div>
      </aside>

      <main className="cc-main cc-page print-full ml-14 flex h-screen min-w-0 flex-1 gap-3 overflow-hidden bg-[#f4f7fb] p-3 print:ml-0 print:h-auto print:overflow-visible">
        <div className="cc-page-content print-full min-w-0 flex-1 overflow-y-auto pr-0.5 print:overflow-visible">
          <header className="cc-header mb-3 flex min-h-[72px] flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h1 className="cc-header-title truncate text-xl font-black tracking-tight text-slate-900 2xl:text-2xl">Visor de Facturación y Reclamos</h1>
              <p className="cc-header-subtitle mt-1 text-xs font-semibold text-[#8190ad] 2xl:text-sm">Inteligencia operativa para decisiones estratégicas</p>
            </div>

            <div className="cc-header-actions flex flex-wrap items-center justify-end gap-2">
              {viewMode === 'rm' ? (
                <button className="cc-button-primary flex h-10 items-center gap-2 rounded-lg bg-[#073B91] px-3 text-xs font-black text-white shadow-lg shadow-blue-900/15 2xl:px-4" onClick={printDashboardView} type="button">
                  <CloudDownload size={17} />
                  Descargar RM
                </button>
              ) : (
                <button
                  className="cc-button-primary flex h-10 items-center gap-2 rounded-lg bg-[#073B91] px-3 text-xs font-black text-white shadow-lg shadow-blue-900/15 disabled:cursor-not-allowed disabled:opacity-50 2xl:px-4"
                  disabled={isEmptyCurrentView}
                  onClick={printDashboardView}
                  title={isEmptyCurrentView ? emptyViewMessage : 'Descargar Regiones'}
                  type="button"
                >
                  <CloudDownload size={17} />
                  Descargar Regiones
                </button>
              )}
              <button
                className="cc-button-secondary flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#172448] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 2xl:px-4"
                disabled={isEmptyCurrentView}
                onClick={exportEvidenceCsv}
                title={isEmptyCurrentView ? emptyViewMessage : 'Exportar evidencia'}
                type="button"
              >
                <Download size={17} />
                Exportar evidencia
              </button>
              <button
                aria-label={dashboardTheme === 'dark-premium' ? 'Cambiar a tema claro' : 'Cambiar a modo oscuro'}
                className="cc-button-secondary theme-toggle flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#172448] shadow-sm transition hover:bg-slate-50 2xl:px-4"
                onClick={() => setDashboardTheme((current) => (current === 'dark-premium' ? 'default' : 'dark-premium'))}
                title={dashboardTheme === 'dark-premium' ? 'Tema claro' : 'Modo oscuro'}
                type="button"
              >
                {dashboardTheme === 'dark-premium' ? <Sun size={17} /> : <Moon size={17} />}
                <span className="hidden sm:inline">{dashboardTheme === 'dark-premium' ? 'Tema claro' : 'Modo oscuro'}</span>
              </button>
              <button className="cc-header-action relative flex h-10 w-10 items-center justify-center rounded-full text-[#172448]" type="button">
                <Bell size={20} />
                <span className="cc-notification-badge absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">3</span>
              </button>
              <UserMenu
                isDarkPremium={dashboardTheme === 'dark-premium'}
                onOpenImport={() => setShowImportModal(true)}
                onOpenSettings={() => setActiveTab('settings')}
                onOpenUsers={() => setActiveTab('users')}
                onToggleTheme={() => setDashboardTheme((current) => (current === 'dark-premium' ? 'default' : 'dark-premium'))}
              />
            </div>
          </header>

          {activeTab === 'dashboard' ? (
            <ProtectedView viewKey="dashboard">
              <ProtectedView viewKey={viewMode}>
                <>
                <section className="mb-4" aria-label="Filtros operativos">
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
                        <label className="cc-filter grid h-12 min-w-[190px] gap-0.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 shadow-sm">
                          Semana
                          <input aria-label="Semana" className="bg-transparent text-sm font-bold normal-case text-[#071b4d] outline-none" onChange={(event) => setSelectedWeek(event.target.value)} type="week" value={selectedWeek} />
                        </label>
                      ) : dateFilterMode === 'day' ? (
                        <label className="cc-filter grid h-12 min-w-[190px] gap-0.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 shadow-sm">
                          Día
                          <input aria-label="Día" className="bg-transparent text-sm font-bold normal-case text-[#071b4d] outline-none" onChange={(event) => setSelectedDay(event.target.value)} type="date" value={selectedDay} />
                        </label>
                      ) : (
                        <div className="flex flex-wrap gap-2" aria-label="Rango de fechas">
                          <label className="cc-filter grid h-12 min-w-[160px] gap-0.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 shadow-sm">
                            Desde
                            <input aria-label="Fecha de inicio" className="bg-transparent text-sm font-bold normal-case text-[#071b4d] outline-none" onChange={(event) => setRangeStart(event.target.value)} type="date" value={rangeStart} />
                          </label>
                          <label className="cc-filter grid h-12 min-w-[160px] gap-0.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 shadow-sm">
                            Hasta
                            <input aria-label="Fecha de fin" className="bg-transparent text-sm font-bold normal-case text-[#071b4d] outline-none" min={rangeStart || undefined} onChange={(event) => setRangeEnd(event.target.value)} type="date" value={rangeEnd} />
                          </label>
                        </div>
                      )}
                      <FilterControl icon={<Siren size={20} />} label="Prioridad" onChange={(value) => setFilters((current) => ({ ...current, priority: value as PriorityFilter }))} options={availablePriorities} value={filters.priority} />
                      <FilterControl icon={<MapPin size={20} />} label="Comuna/Región" onChange={(value) => setFilters((current) => ({ ...current, location: value }))} options={locationOptions} value={filters.location} />
                    </div>

                    <div className={`cc-segmented grid h-12 min-w-[260px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${hasPermission('rm') && hasPermission('regiones') ? 'grid-cols-2' : 'grid-cols-1'}`} role="tablist" aria-label="Selector de vista">
                      {hasPermission('rm') ? (
                        <button aria-selected={viewMode === 'rm' ? 'true' : 'false'} className={`text-sm font-black transition ${viewMode === 'rm' ? 'bg-[#073B91] text-white' : 'text-[#172448] hover:bg-slate-50'}`} onClick={() => setViewMode('rm')} role="tab" type="button">
                          RM
                        </button>
                      ) : null}
                      {hasPermission('regiones') ? (
                        <button aria-selected={viewMode === 'regiones' ? 'true' : 'false'} className={`text-sm font-black transition ${viewMode === 'regiones' ? 'bg-[#073B91] text-white' : 'text-[#172448] hover:bg-slate-50'}`} onClick={() => setViewMode('regiones')} role="tab" type="button">
                          Regiones
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Filtros activos: {dateFilterMode === 'month' ? selectedMonthLabel : dateFilterMode === 'week' ? formatWeekLabel(selectedWeek) : dateFilterMode === 'day' ? selectedDay || 'Día sin seleccionar' : (rangeStart || 'Inicio') + ' — ' + (rangeEnd || 'Fin')} · Prioridad {selectedPriorityLabel} · {selectedLocationLabel}
                  </p>
                  {databaseDashboardLoading ? (
                    <p className="mt-1 text-xs font-semibold text-slate-500" role="status">Cargando reclamos desde PostgreSQL...</p>
                  ) : databaseDashboardError ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800" role="alert">
                      <span>No se pudo conectar con toda la API local. El dashboard continúa con datos disponibles o valores en cero.</span>
                      <button className="rounded-md border border-amber-300 bg-white px-2 py-1 font-bold hover:bg-amber-100" onClick={() => setDatabaseReloadKey((key) => key + 1)} type="button">Reintentar</button>
                    </div>
                  ) : null}

                  {dailyDashboardData ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      Datos incluyen visitas diarias guardadas ({formatInt(dailyDashboardData.kpis.visitas)}).
                    </p>
                  ) : null}
                </section>
                <ExecutiveDashboardLayout widgets={dashboardWidgets} />

                <section className="cc-card rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="cc-section-title text-lg font-black">Ruta Visitador</h2>
                      <p className="cc-muted mt-1 text-xs font-semibold">Resumen operativo seg&uacute;n el periodo seleccionado.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="cc-segmented flex rounded-lg border">
                        {(['dia', 'semana', 'mes'] as const).map((p) => (
                          <button
                            key={p}
                            aria-selected={routePeriod === p}
                            className={`px-3 py-1.5 text-xs font-black transition ${routePeriod === p ? '' : 'cc-text-secondary hover:cc-text'}`}
                            onClick={() => setRoutePeriod(p)}
                            type="button"
                          >
                            {p === 'dia' ? 'Día' : p === 'semana' ? 'Semana' : 'Mes'}
                          </button>
                        ))}
                      </div>
                      <input
                        className="cc-input h-9 rounded-lg border px-3 text-xs font-bold"
                        onChange={(e) => setRouteDateBase(e.target.value)}
                        type="date"
                        value={routeDateBase}
                      />
                    </div>
                  </div>
                  <div className="cc-stat-grid mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                    <div className="cc-kpi-card cc-card rounded-xl border p-3">
                      <p className="cc-kpi-label text-xs font-bold">Tickets ruta</p>
                      <p className="cc-kpi-value mt-1 text-lg font-black">{routeMetrics.ticketsRuta.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="cc-kpi-card cc-card rounded-xl border p-3">
                      <p className="cc-kpi-label text-xs font-bold">Exitosas</p>
                      <p className="cc-kpi-value mt-1 text-lg font-black cc-green">{routeMetrics.exitosas.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="cc-kpi-card cc-card rounded-xl border p-3">
                      <p className="cc-kpi-label text-xs font-bold">No exitosas</p>
                      <p className="cc-kpi-value mt-1 text-lg font-black cc-red">{routeMetrics.noExitosas.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="cc-kpi-card cc-card rounded-xl border p-3">
                      <p className="cc-kpi-label text-xs font-bold">Pendientes</p>
                      <p className="cc-kpi-value mt-1 text-lg font-black" style={{ color: 'var(--cc-orange, #f97316)' }}>{routeMetrics.pendientes.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="cc-kpi-card cc-card rounded-xl border p-3">
                      <p className="cc-kpi-label text-xs font-bold">Zonas rojas</p>
                      <p className="cc-kpi-value mt-1 text-lg font-black cc-red">{routeMetrics.zonasRojas.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="cc-kpi-card cc-card rounded-xl border p-3">
                      <p className="cc-kpi-label text-xs font-bold">Total valorizado</p>
                      <p className="cc-kpi-value mt-1 text-lg font-black cc-green">{routeMetrics.totalValorizado.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="cc-kpi-card cc-card rounded-xl border p-3">
                      <p className="cc-kpi-label text-xs font-bold">Proyectado m&aacute;ximo</p>
                      <p className="cc-kpi-value mt-1 text-lg font-black" style={{ color: 'var(--cc-blue, #2563eb)' }}>{routeMetrics.proyectadoMaximo.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                </section>
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
            <ProtectedView viewKey="ruta"><RutaVisitadorView redZonesGeoJson="/data/map-layers/zonas_rojas.geojson" /></ProtectedView>
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
                canViewReports={hasPermission('reportes')}
              />
            </ProtectedView>
          ) : activeTab === 'reports' ? (
            <ProtectedView viewKey="reportes"><ReportsView rmRows={tableRows} /></ProtectedView>
          ) : activeTab === 'users' ? (
            <ProtectedView viewKey="usuarios"><UserManagementView /></ProtectedView>
          ) : (
            <Panel className="flex min-h-[620px] flex-col items-center justify-center p-10 text-center">
              <AlertTriangle className="mb-4 text-blue-600" size={44} />
              <h2 className="text-2xl font-black text-[#071b4d]">Módulo en construcción</h2>
              <p className="mt-2 max-w-md text-sm font-semibold text-[#6b7d98]">La navegación lateral ya está preparada para conectar nuevas vistas operativas.</p>
              <button className="mt-6 rounded-lg bg-[#073B91] px-5 py-3 text-sm font-black text-white" onClick={() => setActiveTab('dashboard')} type="button">Volver al dashboard</button>
            </Panel>
          )}
        </div>

        {shouldShowRegionsPreview ? (
          <RegionSidebar
            regionalLayer={regionalLayer}
            hasRegionalData={hasRegionalData}
            regionalLayerError={regionalLayerError}
            regionalMapMetrics={regionalMapMetrics}
            regionalMaxVisitas={regionalMaxVisitas}
            setShowRegionModal={setShowRegionModal}
            operationalSummary={operationalSummary}
            successfulVisits={successfulVisits}
            successfulPct={successfulPct}
          />
        ) : null}

        {shouldShowRegionsPreview && showRegionModal && (
          <ModalMap
            data={regionalLayer}
            hasRegionalData={hasRegionalData}
            layerError={regionalLayerError}
            metricsByComuna={regionalMapMetrics}
            maxVisitas={regionalMaxVisitas}
            onClose={() => setShowRegionModal(false)}
          />
        )}
        {showImportModal && hasPermission('importaciones') ? <DataImportModal onClose={() => setShowImportModal(false)} onImported={refreshImportedRows} /> : null}
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
