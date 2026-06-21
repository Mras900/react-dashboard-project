import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  CloudDownload,
  Crown,
  Download,
  Eye,
  FileBarChart,
  FileText,
  Grid2X2,
  HelpCircle,
  Landmark,
  MapPin,
  Navigation,
  Plus,
  ShieldCheck,
  Siren,
  Trash2,
  Truck,
  Users,
} from 'lucide-react';
import type { Feature, GeoJsonObject } from 'geojson';
import type { Layer } from 'leaflet';
import { CircleMarker, GeoJSON, LayersControl, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { comunaMetrics, monthlyFacturacion, operationalSummary, sourceSummary, type ComunaMetric } from '../../data/dashboardData';

type ActiveTab = 'dashboard' | 'charts' | 'reports' | 'alerts' | 'map' | 'settings' | 'help';
type TableRow = ComunaMetric & {
  share: number;
  average: number;
  normalizedBilling: number;
};

type MapLayerKey = 'borde' | 'limiteUrbano';
type MapLayers = Record<MapLayerKey, GeoJsonObject | null>;
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

const navItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: Grid2X2 },
  { id: 'charts' as const, label: 'Gráficos', icon: BarChart3 },
  { id: 'reports' as const, label: 'Reportes', icon: FileText },
  { id: 'alerts' as const, label: 'Alertas', icon: AlertTriangle, badge: true },
  { id: 'map' as const, label: 'Mapa', icon: MapPin },
];

const bottomNavItems = [
  { id: 'settings' as const, label: 'Ajustes', icon: ShieldCheck },
  { id: 'help' as const, label: 'Ayuda', icon: HelpCircle },
];

const mapLayerSources: Array<{ key: MapLayerKey; url: string }> = [
  { key: 'borde', url: '/data/map-layers/borde-region-metropolitana.geojson' },
  { key: 'limiteUrbano', url: '/data/map-layers/limite-urbano-v2.geojson' },
];

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

const getMapColor = (value: number, max: number) => {
  const ratio = max > 0 ? value / max : 0;

  if (ratio >= 0.72) return '#0f5fcf';
  if (ratio >= 0.52) return '#2f8fe8';
  if (ratio >= 0.34) return '#8cc8f5';
  return '#d8ebfb';
};

function bindRedZonePopup(feature: Feature | undefined, layer: Layer) {
  const properties = feature?.properties as Record<string, unknown> | null | undefined;
  const comuna = (properties?.Comuna as string | undefined) ?? 'Sin comuna';
  const nombreZona = (properties?.NombreZona as string | undefined) ?? 'Zona roja';

  layer.bindPopup(`
    <strong>Zona roja</strong><br/>
    ${nombreZona}<br/>
    <small>${comuna}</small>
  `);
}

function BaseMapLayers({ children }: { children?: ReactNode }) {
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
  return <section className={`rounded-lg border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.07)] ${className}`}>{children}</section>;
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
      className={`group relative flex h-12 w-12 items-center justify-center rounded-lg transition ${
        active ? 'bg-[#073B91] text-white shadow-lg shadow-blue-900/20' : 'text-[#466083] hover:bg-blue-50 hover:text-[#073B91]'
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
      {badge ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" /> : null}
      <span className="pointer-events-none absolute left-[115%] z-50 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

function FilterControl({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <button className="flex h-14 min-w-[210px] items-center justify-between rounded-lg border border-slate-200 bg-white px-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30" type="button">
      <span className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md text-[#23446f]">{icon}</span>
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
          <span className="block text-sm font-black text-[#071b4d]">{value}</span>
        </span>
      </span>
      <ChevronDown size={16} className="text-[#466083]" />
    </button>
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
    <Panel className="flex min-h-[116px] items-center gap-4 p-4">
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${colors[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-black text-[#172448]">{title}</p>
        <p className="mt-1 truncate text-xl font-black text-[#071b4d]">{value}</p>
        <p className={`mt-3 text-xs font-bold ${tone === 'red' ? 'text-red-500' : tone === 'cyan' ? 'text-slate-600' : 'text-emerald-600'}`}>{delta}</p>
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
    <Panel className="flex min-h-[112px] items-center gap-4 p-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconClass}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-[#466083]">{label}</p>
        <h3 className="mt-1 truncate text-xl font-black text-[#071b4d]">{title}</h3>
        <p className="mt-2 text-xs font-bold text-[#172448]">{detail}</p>
      </div>
      {badge ? <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-500">{badge}</span> : null}
    </Panel>
  );
}

function StatStripItem({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-[#466083]">{label}</p>
        <p className="text-xl font-black leading-tight text-[#071b4d]">{value}</p>
        <p className="truncate text-xs font-semibold text-[#466083]">{detail}</p>
      </div>
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
    <Panel className="flex min-h-[112px] items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700">
          <Calculator size={24} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-wide text-[#466083]">{title}</p>
          <p className="mt-1 truncate text-2xl font-black text-[#071b4d]">{value}</p>
          <p className="mt-1 truncate text-xs font-bold text-[#6b7d98]">{detail}</p>
        </div>
      </div>
      {onRemove ? (
        <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500" onClick={onRemove} type="button">
          <Trash2 size={17} />
        </button>
      ) : null}
    </Panel>
  );
}

function VerticalBars({ items }: { items: Array<{ label: string; value: number; display: string }> }) {
  const max = Math.max(...items.map((item) => item.value));

  return (
    <div className="flex h-44 items-end gap-4 border-l border-b border-slate-200 px-3 pt-4">
      {items.map((item, index) => (
        <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <span className="text-[10px] font-black text-[#172448]">{item.display}</span>
          <div
            className={`w-full max-w-10 rounded-t-md ${index === items.length - 1 ? 'bg-[#0757bd]' : 'bg-[#9fd0fb]'}`}
            style={{ height: `${normalize(item.value, max)}%` }}
          />
          <span className="whitespace-nowrap text-[10px] font-bold text-[#466083]">{item.label}</span>
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
  const max = Math.max(...items.map((item) => item.value));
  const bar = color === 'red' ? 'bg-red-500' : 'bg-blue-600';

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.name} className="grid grid-cols-[88px_1fr_52px] items-center gap-2 text-[11px]">
          <span className="truncate font-bold text-[#172448]">{item.name}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${normalize(item.value, max)}%` }} />
          </div>
          <span className="text-right font-black text-[#172448]">{item.label}</span>
        </div>
      ))}
      {maxLabel ? <div className="flex justify-between pt-1 text-[10px] font-bold text-[#6b7d98]"><span>0</span><span>{maxLabel}</span></div> : null}
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
  const background = `conic-gradient(${segments.map((segment) => `${segment.color} ${segment.from}% ${segment.to}%`).join(', ')})`;

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        <div className="absolute inset-0 rounded-full" style={{ background }} />
        <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
          <span className="text-xl font-black text-[#071b4d]">{center}</span>
          <span className="text-xs font-bold text-[#466083]">{label}</span>
        </div>
      </div>
      <div className="flex-1 space-y-3">
        {segments.map((segment) => (
          <div key={segment.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 font-bold text-[#172448]"><span className="h-3 w-3 rounded" style={{ backgroundColor: segment.color }} />{segment.name}</span>
            <span className="font-black text-[#172448]">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChilePreview() {
  const points = [
    { x: 58, y: 24, color: '#38bdf8' },
    { x: 63, y: 44, color: '#f59e0b' },
    { x: 55, y: 74, color: '#ef4444' },
    { x: 50, y: 94, color: '#22c55e' },
    { x: 59, y: 116, color: '#1d4ed8' },
    { x: 52, y: 142, color: '#ef4444' },
    { x: 47, y: 166, color: '#f59e0b' },
    { x: 50, y: 195, color: '#0ea5e9' },
  ];

  return (
    <div className="relative mx-auto h-[280px] w-[150px]">
      <svg aria-label="Vista previa regiones" className="h-full w-full" viewBox="0 0 150 280">
        <path
          d="M68 8 C84 42 80 70 70 96 C62 118 74 145 63 172 C52 199 65 225 59 254 C55 268 44 274 31 272 C47 240 37 220 43 194 C50 166 38 142 47 116 C56 91 50 62 58 34 C60 24 62 15 68 8Z"
          fill="#b9d8f6"
          opacity="0.9"
        />
        <path
          d="M59 100 C78 126 68 155 62 178 C56 204 73 235 92 264 C69 253 55 232 52 207 C48 180 55 155 49 132 C46 119 49 108 59 100Z"
          fill="#0757bd"
          opacity="0.82"
        />
        {points.map((point) => (
          <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} fill={point.color} r="5" stroke="white" strokeWidth="2" />
        ))}
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mapLayers, setMapLayers] = useState<MapLayers>({
    borde: null,
    limiteUrbano: null,
  });
  const [zonasRojasGeoJson, setZonasRojasGeoJson] = useState<GeoJsonObject | null>(null);
  const [customKpis, setCustomKpis] = useState<CustomKpi[]>(() => {
    const stored = window.localStorage.getItem('dashboard-custom-kpis');

    if (!stored) return [];

    try {
      return JSON.parse(stored) as CustomKpi[];
    } catch {
      return [];
    }
  });
  const [kpiDraft, setKpiDraft] = useState<Omit<CustomKpi, 'id'>>({
    title: 'Nuevo KPI',
    metric: 'visitas',
    aggregation: 'sum',
    format: 'number',
  });
  useEffect(() => {
    let isMounted = true;

    Promise.all(
      mapLayerSources.map(async (layer) => {
        const response = await fetch(layer.url);

        if (!response.ok) {
          throw new Error(`No se pudo cargar ${layer.url}`);
        }

        return [layer.key, (await response.json()) as GeoJsonObject] as const;
      }),
    )
      .then((entries) => {
        if (!isMounted) return;

        setMapLayers((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }));
      })
      .catch((error) => {
        console.error('Error cargando capas geográficas', error);
      });

    return () => {
      isMounted = false;
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
    window.localStorage.setItem('dashboard-custom-kpis', JSON.stringify(customKpis));
  }, [customKpis]);

  const totals = useMemo(
    () =>
      comunaMetrics.reduce(
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
      ),
    [],
  );

  const maxVisitas = Math.max(...comunaMetrics.map((item) => item.visitas));
  const maxFacturacion = Math.max(...comunaMetrics.map((item) => item.facturacion));
  const successfulVisits = Math.max(0, operationalSummary.validVisits - operationalSummary.unsuccessfulVisits);
  const successfulPct = operationalSummary.validVisits > 0 ? Math.round((successfulVisits / operationalSummary.validVisits) * 100) : 0;
  const topClaimComuna = comunaMetrics[0];
  const topBillingComuna = comunaMetrics.reduce((best, item) => (item.facturacion > best.facturacion ? item : best), comunaMetrics[0]);
  const averageBilling = totals.visitas > 0 ? totals.facturacion / totals.visitas : 0;

  const tableRows: TableRow[] = useMemo(
    () =>
      comunaMetrics.map((item) => ({
        ...item,
        share: totals.visitas > 0 ? (item.visitas / totals.visitas) * 100 : 0,
        average: item.visitas > 0 ? item.facturacion / item.visitas : 0,
        normalizedBilling: normalize(item.facturacion, maxFacturacion),
      })),
    [maxFacturacion, totals.visitas],
  );

  const topClaims = tableRows.slice(0, 10).map((item) => ({
    name: item.comuna,
    value: item.visitas,
    label: formatInt(item.visitas),
  }));

  const topBilling = tableRows
    .slice()
    .sort((a, b) => b.facturacion - a.facturacion)
    .slice(0, 10)
    .map((item) => ({
      name: item.comuna,
      value: item.facturacion,
      label: formatCurrencyShort(item.facturacion),
    }));

  const monthlyBars = monthlyFacturacion.map((item) => ({
    label: item.label,
    value: item.value,
    display: formatCurrencyShort(item.value),
  }));

  const altaPct = totals.visitas > 0 ? (totals.alta / totals.visitas) * 100 : 0;
  const mediaPct = totals.visitas > 0 ? (totals.media / totals.visitas) * 100 : 0;
  const bajaPct = Math.max(0, 100 - altaPct - mediaPct);
  const getKpiMetricValue = (row: TableRow, metric: KpiMetricKey) => row[metric];

  const calculateKpiValue = (definition: Omit<CustomKpi, 'id'> | CustomKpi) => {
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

  const previewKpiValue = calculateKpiValue(kpiDraft);
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

  return (
    <div className="flex min-h-screen bg-[#f6f8fc] font-sans text-[#172448]">
      <style>{`
        .leaflet-control-attribution { display: none; }
        .leaflet-popup-content-wrapper {
          border-radius: 10px;
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.18);
        }
        .leaflet-popup-content { margin: 12px 14px; }
      `}</style>

      <aside className="fixed inset-y-0 left-0 z-30 flex w-[88px] flex-col items-center border-r border-slate-200 bg-white py-6">
        <div className="mb-9 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0757bd] text-white shadow-lg shadow-blue-900/20">
          <Navigation size={25} />
        </div>

        <nav className="flex flex-col items-center gap-4">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <SidebarIcon key={item.id} active={activeTab === item.id} badge={item.badge} label={item.label} onClick={() => setActiveTab(item.id)}>
                <Icon size={22} />
              </SidebarIcon>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-4">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <SidebarIcon key={item.id} active={activeTab === item.id} label={item.label} onClick={() => setActiveTab(item.id)}>
                <Icon size={22} />
              </SidebarIcon>
            );
          })}
          <button className="mt-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#073B91] text-white shadow-lg shadow-blue-900/25" type="button">
            <ChevronsLeft size={22} />
          </button>
        </div>
      </aside>

      <main className="ml-[88px] flex min-h-screen min-w-0 flex-1 gap-5 p-6">
        <div className="min-w-0 flex-1">
          <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-[360px]">
              <h1 className="text-3xl font-black tracking-tight text-[#071b4d]">Visor de Reclamos de Consumidores</h1>
              <p className="mt-1 text-sm font-semibold text-[#8190ad]">Gestión, análisis y seguimiento operativo de reclamos</p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button className="flex h-11 items-center gap-2 rounded-lg bg-[#073B91] px-4 text-xs font-black text-white shadow-lg shadow-blue-900/15 2xl:text-sm" type="button">
                <CloudDownload size={17} />
                Descargar RM
              </button>
              <button className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-[#172448] shadow-sm 2xl:text-sm" type="button">
                <CloudDownload size={17} />
                Descargar Regiones
              </button>
              <button className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-[#172448] shadow-sm 2xl:text-sm" type="button">
                <Download size={17} />
                Exportar evidencia
              </button>
              <button className="relative flex h-11 w-11 items-center justify-center rounded-full text-[#172448]" type="button">
                <Bell size={20} />
                <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">3</span>
              </button>
              <button className="flex h-11 items-center gap-2 rounded-full text-[#172448]" type="button">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#073B91] text-sm font-black text-white">AV</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </header>

          {activeTab === 'dashboard' ? (
            <>
              <section className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-3">
                  <FilterControl icon={<CalendarDays size={20} />} label="Meses" value={sourceSummary.periodLabel} />
                  <FilterControl icon={<Siren size={20} />} label="Prioridad" value="Todas" />
                  <FilterControl icon={<MapPin size={20} />} label="Comuna/Región" value="Todas" />
                </div>

                <div className="grid h-14 min-w-[300px] grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <button className="bg-[#073B91] text-sm font-black text-white" type="button">RM</button>
                  <button className="text-sm font-black text-[#172448]" type="button">Regiones</button>
                </div>
              </section>

              <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[310px_minmax(420px,1fr)_340px]">
                <div className="grid gap-4">
                  <PrimaryMetric icon={<FileBarChart size={29} />} tone="blue" title="Facturación total" value={formatCurrency(totals.facturacion)} delta="+12,6% vs. mes anterior" />
                  <PrimaryMetric icon={<AlertTriangle size={30} />} tone="red" title="Reclamos totales" value={formatInt(totals.visitas)} delta="+8,4% vs. mes anterior" />
                  <PrimaryMetric icon={<Users size={30} />} tone="cyan" title="Promedio por reclamo" value={formatCurrency(averageBilling)} delta="-3,1% vs. mes anterior" />
                </div>

                <Panel className="relative min-h-[392px] overflow-hidden">
                  <MapContainer center={[-33.49, -70.67]} className="absolute inset-0" zoom={10} zoomControl={false}>
                    <BaseMapLayers>
                      {mapLayers.borde ? (
                        <LayersControl.Overlay name="Borde RM">
                          <GeoJSON
                            data={mapLayers.borde}
                            interactive={false}
                            style={{
                              color: '#073B91',
                              fillColor: '#0ea5e9',
                              fillOpacity: 0.025,
                              opacity: 0.32,
                              weight: 1.4,
                            }}
                          />
                        </LayersControl.Overlay>
                      ) : null}
                      {mapLayers.limiteUrbano ? (
                        <LayersControl.Overlay name="Límite urbano">
                          <GeoJSON
                            data={mapLayers.limiteUrbano}
                            interactive={false}
                            style={{
                              color: '#f97316',
                              fillColor: '#f59e0b',
                              fillOpacity: 0.04,
                              opacity: 0.45,
                              weight: 1,
                            }}
                          />
                        </LayersControl.Overlay>
                      ) : null}
                      {zonasRojasGeoJson ? (
                        <LayersControl.Overlay checked name="Zonas rojas">
                          <GeoJSON
                            data={zonasRojasGeoJson}
                            style={{
                              color: '#dc2626',
                              fillColor: '#ef4444',
                              fillOpacity: 0.22,
                              opacity: 0.85,
                              weight: 1.5,
                            }}
                            onEachFeature={bindRedZonePopup}
                          />
                        </LayersControl.Overlay>
                      ) : null}
                    </BaseMapLayers>
                    {comunaMetrics.map((item) => {
                      const markerColor = getMapColor(item.visitas, maxVisitas);

                      return (
                        <CircleMarker
                          key={item.comuna}
                          center={[item.lat, item.lng]}
                          fillColor={markerColor}
                          fillOpacity={0.9}
                          pathOptions={{ color: '#ffffff', opacity: 1, weight: 2 }}
                          radius={Math.max(7, Math.round(5 + (item.visitas / maxVisitas) * 20))}
                        >
                          <Popup closeButton={false} offset={[0, -8]}>
                            <div className="min-w-[160px]">
                              <p className="border-b border-slate-200 pb-1 text-sm font-black text-[#071b4d]">{item.comuna}</p>
                              <p className="mt-2 flex justify-between text-xs"><span>Reclamos:</span><strong>{formatInt(item.visitas)}</strong></p>
                              <p className="mt-1 flex justify-between text-xs"><span>Facturación:</span><strong>{formatCurrencyShort(item.facturacion)}</strong></p>
                              <p className="mt-3 text-xs font-black text-[#0757bd]">Ver detalle -&gt;</p>
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>

                  <div className="pointer-events-none absolute left-4 top-4 flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <span className="border-r border-slate-200 px-3 py-2 text-lg font-black text-[#466083]">+</span>
                    <span className="px-3 py-2 text-lg font-black text-[#466083]">-</span>
                  </div>

                  <div className="absolute bottom-4 left-4 w-[230px] rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg">
                    <div className="mb-2 text-[10px] font-black uppercase text-[#466083]">Reclamos por comuna</div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-[#172448]">
                      <span>Menor</span>
                      <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-[#d8ebfb] via-[#78b9ef] to-[#0757bd]" />
                      <span>Mayor</span>
                    </div>
                  </div>
                </Panel>

                <div className="grid gap-4">
                  <InsightCard icon={<Landmark size={28} />} iconClass="bg-orange-100 text-orange-500" label="Comuna más reclamada" title={topClaimComuna.comuna} detail={`${formatInt(topClaimComuna.visitas)} reclamos`} badge={`${asPercent((topClaimComuna.visitas / totals.visitas) * 100)} del total`} />
                  <InsightCard icon={<Crown size={28} />} iconClass="bg-blue-100 text-blue-600" label="Top comuna por facturación" title={topBillingComuna.comuna} detail={formatCurrency(topBillingComuna.facturacion)} badge={`${asPercent((topBillingComuna.facturacion / totals.facturacion) * 100)} del total`} />
                  <InsightCard icon={<ShieldCheck size={28} />} iconClass="bg-emerald-100 text-emerald-600" label="Cobertura comunas" title="100%" detail={`${sourceSummary.comunas} comunas con información`} />
                </div>
              </section>

              <Panel className="mb-4 grid min-h-[86px] grid-cols-1 divide-y divide-slate-200 py-3 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
                <StatStripItem icon={<Building2 size={24} />} label="Total comunas" value={formatInt(sourceSummary.comunas)} detail="RM" />
                <StatStripItem icon={<AlertTriangle size={24} />} label="Alta prioridad" value={formatInt(totals.alta)} detail={`${asPercent(altaPct)} del total`} />
                <StatStripItem icon={<TrendingUpIcon />} label="Variación mensual" value="+12,6%" detail="vs. mes anterior" />
                <StatStripItem icon={<Users size={24} />} label="Tickets únicos" value={formatInt(totals.ticketsUnicos)} detail={`${asPercent((totals.ticketsUnicos / totals.visitas) * 100)} del total`} />
              </Panel>

              {customKpis.length > 0 ? (
                <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {customKpis.map((kpi) => (
                    <CustomKpiCard key={kpi.id} detail={getKpiDetail(kpi)} title={kpi.title} value={formatKpiValue(calculateKpiValue(kpi), kpi.format)} />
                  ))}
                </section>
              ) : null}

              <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-4">
                <Panel className="p-4">
                  <h3 className="mb-3 text-sm font-black text-[#071b4d]">Facturación mensual RM</h3>
                  <VerticalBars items={monthlyBars} />
                </Panel>

                <Panel className="p-4">
                  <h3 className="mb-3 text-sm font-black text-[#071b4d]">Top 10 comunas con más reclamos</h3>
                  <HorizontalBars color="red" items={topClaims} maxLabel={formatInt(topClaims[0].value)} />
                </Panel>

                <Panel className="p-4">
                  <h3 className="mb-3 text-sm font-black text-[#071b4d]">Top 10 comunas con mayor facturación</h3>
                  <HorizontalBars color="blue" items={topBilling} maxLabel={formatCurrencyShort(topBilling[0].value)} />
                </Panel>

                <Panel className="p-4">
                  <h3 className="mb-3 text-sm font-black text-[#071b4d]">Distribución por prioridad</h3>
                  <Donut
                    center={formatInt(totals.visitas)}
                    label="Total"
                    segments={[
                      { color: '#ef4444', from: 0, to: altaPct, name: 'Alta', value: `${formatInt(totals.alta)} (${asPercent(altaPct)})` },
                      { color: '#f59e0b', from: altaPct, to: altaPct + mediaPct, name: 'Media', value: `${formatInt(totals.media)} (${asPercent(mediaPct)})` },
                      { color: '#1d8ff0', from: altaPct + mediaPct, to: 100, name: 'Baja', value: `${formatInt(totals.baja)} (${asPercent(bajaPct)})` },
                    ]}
                  />
                </Panel>
              </section>

              <Panel className="overflow-hidden">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-black text-[#071b4d]">Evidencia por comuna</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] uppercase text-[#466083]">
                      <tr>
                        {['Mes', 'Comuna', 'Reclamos', 'Facturación', 'Promedio', 'Prioridad Alta', '% del total reclamos', 'Ver detalle'].map((head) => (
                          <th key={head} className="px-4 py-2 font-black">{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tableRows.slice(0, 7).map((row) => (
                        <tr key={row.comuna} className="hover:bg-blue-50/40">
                          <td className="px-4 py-2 font-semibold text-[#466083]">{sourceSummary.periodLabel}</td>
                          <td className="px-4 py-2 font-black text-[#172448]">{row.comuna}</td>
                          <td className="px-4 py-2 font-bold">{formatInt(row.visitas)}</td>
                          <td className="px-4 py-2 font-bold">{formatCurrency(row.facturacion)}</td>
                          <td className="px-4 py-2 font-bold">{formatCurrency(row.average)}</td>
                          <td className="px-4 py-2"><span className="rounded-full bg-red-100 px-2 py-1 font-black text-red-500">{formatInt(row.alta)}</span></td>
                          <td className="px-4 py-2 font-bold">{asPercent(row.share)}</td>
                          <td className="px-4 py-2"><button className="text-blue-700" type="button"><Eye size={16} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          ) : activeTab === 'charts' ? (
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
                      value={formatKpiValue(calculateKpiValue(kpi), kpi.format)}
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
          ) : (
            <Panel className="flex min-h-[620px] flex-col items-center justify-center p-10 text-center">
              <AlertTriangle className="mb-4 text-blue-600" size={44} />
              <h2 className="text-2xl font-black text-[#071b4d]">Módulo en construcción</h2>
              <p className="mt-2 max-w-md text-sm font-semibold text-[#6b7d98]">La navegación lateral ya está preparada para conectar nuevas vistas operativas.</p>
              <button className="mt-6 rounded-lg bg-[#073B91] px-5 py-3 text-sm font-black text-white" onClick={() => setActiveTab('dashboard')} type="button">Volver al dashboard</button>
            </Panel>
          )}
        </div>

        <aside className="hidden w-[300px] shrink-0 xl:block">
          <Panel className="sticky top-6 min-h-[calc(100vh-48px)] p-4">
            <h2 className="mb-4 text-base font-black text-[#071b4d]">Vista previa: Regiones</h2>
            <ChilePreview />

            <div className="mt-4 grid gap-3">
              <Panel className="flex items-center gap-3 p-4 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700"><Navigation size={22} /></div>
                <div>
                  <p className="text-xs font-black uppercase text-[#466083]">KM</p>
                  <p className="text-xl font-black text-[#071b4d]">125.430</p>
                  <p className="text-[11px] font-bold text-emerald-600">+9,3% vs. mes anterior</p>
                </div>
              </Panel>

              <Panel className="flex items-center gap-3 p-4 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-[#466083]"><Truck size={22} /></div>
                <div>
                  <p className="text-xs font-black uppercase text-[#466083]">Traslado</p>
                  <p className="text-xl font-black text-[#071b4d]">4.612</p>
                  <p className="text-[11px] font-bold text-slate-500">-4,2% vs. mes anterior</p>
                </div>
              </Panel>

              <Panel className="p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-3">
                  <CheckCircle2 className="text-[#466083]" size={24} />
                  <h3 className="text-sm font-black text-[#071b4d]">Estado visita</h3>
                </div>
                <Donut
                  center={`${successfulPct}%`}
                  label="Completadas"
                  segments={[
                    { color: '#10b981', from: 0, to: successfulPct, name: 'Completadas', value: formatInt(successfulVisits) },
                    { color: '#f59e0b', from: successfulPct, to: 94, name: 'Pendientes', value: formatInt(operationalSummary.visitsFrom13Services) },
                    { color: '#ef4444', from: 94, to: 100, name: 'No realizadas', value: formatInt(operationalSummary.unsuccessfulVisits) },
                  ]}
                />
                <p className="mt-3 text-xs font-bold text-[#466083]">Total: {formatInt(operationalSummary.validVisits)}</p>
              </Panel>

              <button className="mt-1 flex h-16 items-center justify-between rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-[#071b4d] shadow-sm" type="button">
                Ir a vista Regiones
                <span className="text-2xl">-&gt;</span>
              </button>
            </div>
          </Panel>
        </aside>
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
