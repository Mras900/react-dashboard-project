import { CalendarDays, ChevronDown, Download, Loader2, MapPin, Route, Save, Search, Settings, Trash2, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L, { type LatLngTuple, type Layer } from 'leaflet';
import type { Feature, GeoJsonObject } from 'geojson';
import { CircleMarker, GeoJSON, LayerGroup, LayersControl, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import type { AddressSuggestion, RutaBackendVisit, RutaOptimizadaResponse, RutaStartPoint, RutaStop, RutaVisitadorViewProps, RutaVisitStatus } from './rutaTypes';
import { ActiveRedZonesLayers } from '../red-zones/ActiveRedZonesLayers';
import { createRedZone, deleteRedZone, fetchRedZones, updateRedZone } from '../red-zones/redZonesApi';
import type { RedZone, RedZoneDraft } from '../red-zones/redZoneTypes';
import { isPointInActiveRedZone } from '../red-zones/redZoneUtils';
import { buscarPorRut, buscarPorTicket, guardarVisitasDiarias, optimizarRuta, searchAddress } from './services/rutaApi';
import { buildRutaCsv, buildRutaSummary, calculateStopValue, downloadCsv, findComunaRegionByPoint, getFareTable, getFeatureComunaName, getFeatureRegionName, isPointInRedZone, loadGenericGeoJson, loadRedZonesGeoJson, normalizeName, parseTicketIds } from './rutaUtils';
import { saveRouteDailyVisits, dispatchRouteDailyUpdate, getRouteDailyVisits } from './routeDailyStorage';
import type { RouteDailyVisit } from './routeDailyStorage';
import { fetchRouteWeather, getWeatherPresentation, KNOWN_COMUNAS } from './routeWeatherService';
import type { RouteWeatherSummary } from './routeWeatherTypes';

type SearchMode = 'ticket' | 'rut';
type RouteSubTab = 'operation' | 'territory';
type RouteVisitDayCount = { total: number; exitosas: number; noExitosas: number; pendientes: number };

const STATUS_LABELS: Record<RutaVisitStatus, string> = {
  pendiente: 'Pendiente',
  exitosa: 'Exitosa',
  no_exitosa: 'No exitosa',
};

const STATUS_CLASSES: Record<RutaVisitStatus, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  exitosa: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  no_exitosa: 'bg-red-50 text-red-700 border-red-200',
};

const RED_ZONE_STYLE = {
  color: '#dc2626',
  fillColor: '#ef4444',
  fillOpacity: 0.22,
  opacity: 0.85,
  weight: 1.5,
};

const createEmptyRedZoneDraft = (): RedZoneDraft => ({
  name: '',
  comuna: '',
  region: '',
  lat: null,
  lon: null,
  radius_m: 350,
  severity: 'alta',
  source: 'manual',
  status: 'active',
  display_mode: 'circle',
  polygon_geojson: null,
  notes: '',
});

const redZoneInputClass =
  'h-9 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--cc-muted)] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-[var(--border-main)] dark:bg-[var(--bg-card)] dark:text-[var(--text-main)] dark:placeholder:text-[var(--cc-muted)]';

const redZoneTextareaClass =
  'min-h-16 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--cc-muted)] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-[var(--border-main)] dark:bg-[var(--bg-card)] dark:text-[var(--text-main)] dark:placeholder:text-[var(--cc-muted)]';

const CHILE_COMUNAS_LAYER_PATH = '/data/map-layers/chile_comunas_simplified.geojson';

function RutaPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`cc-route-card rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm ${className}`}>{children}</section>;
}

function RutaMetricCard({ label, value, subtitle, icon, tone = 'blue' }: { label: string; value: string; subtitle?: string; icon?: ReactNode; tone?: 'blue' | 'green' | 'red' | 'amber' | 'slate' }) {
  const accentRing: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/25 dark:text-blue-300',
    green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-300',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/25 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/25 dark:text-amber-300',
    slate: 'bg-[var(--bg-card)] text-[var(--text-main)]',
  };
  const valueColor: Record<string, string> = {
    blue: 'text-blue-700 dark:text-blue-200',
    green: 'text-emerald-700 dark:text-emerald-200',
    red: 'text-red-700 dark:text-red-200',
    amber: 'text-amber-700 dark:text-amber-200',
    slate: 'text-[var(--text-main)]',
  };

  return (
    <RutaPanel className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] p-4 shadow-sm">
      {icon ? (
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${accentRing[tone]}`}>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[var(--cc-muted)]">{label}</p>
        <p className={`mt-0.5 text-2xl font-black leading-none tracking-tight ${valueColor[tone]}`}>{value}</p>
        {subtitle ? <p className="mt-1 truncate text-[11px] font-medium text-[var(--cc-muted)]">{subtitle}</p> : null}
      </div>
    </RutaPanel>
  );
}

function RouteMapBounds({ points }: { points: LatLngTuple[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    window.setTimeout(() => {
      map.invalidateSize();

      if (points.length === 1) {
        map.setView(points[0], 13);
        return;
      }

      map.fitBounds(points, { padding: [24, 24] });
    }, 120);
  }, [map, points]);

  return null;
}

function StartPointPicker({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function RedZoneMapPicker({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function SelectedRedZoneFocus({ zone }: { zone: RedZoneDraft | null }) {
  const map = useMap();

  useEffect(() => {
    if (!zone || zone.lat === null || zone.lon === null) return;
    map.setView([zone.lat, zone.lon], Math.max(map.getZoom(), 13), { animate: true });
  }, [map, zone]);

  return null;
}

const toRutaStop = (visit: RutaBackendVisit): RutaStop => ({
  id: visit.ticket_id ?? visit.referencia,
  referencia: visit.referencia,
  tickets: visit.tickets,
  customerId: visit.customer_id ?? undefined,
  claimsCount: visit.cantidad_reclamos,
  cleanAddress: visit.direccion_limpia ?? undefined,
  geocodeQueryUsed: visit.geocode_query_used ?? undefined,
  clientName: visit.nombre ?? 'Cliente sin nombre',
  rut: visit.rut ?? undefined,
  address: visit.direccion ?? '',
  phone: visit.telefono ?? undefined,
  email: visit.correo ?? undefined,
  lat: visit.lat ?? undefined,
  lng: visit.lon ?? undefined,
  status: 'pendiente',
  observation: '',
  isRedZone: visit.peligro,
});

const toBackendVisit = (stop: RutaStop): RutaBackendVisit => ({
  referencia: stop.referencia,
  ticket_id: stop.id === stop.referencia ? null : stop.id,
  nombre: stop.clientName,
  rut: stop.rut ?? null,
  direccion: stop.address || null,
  telefono: stop.phone ?? null,
  correo: stop.email ?? null,
  cantidad_reclamos: stop.claimsCount,
  tickets: stop.tickets,
  lat: stop.lat ?? null,
  lon: stop.lng ?? null,
  peligro: stop.isRedZone,
  customer_id: stop.customerId ?? null,
});

const getDuplicateKey = (stop: RutaStop) => [stop.referencia, stop.rut ?? '', stop.address].join('|').toLowerCase();

const formatDistance = (meters: number) => `${(meters / 1000).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

const formatDuration = (seconds: number) => {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
};

const getRouteTravelDuration = (route: RutaOptimizadaResponse) => route.travel_duration_s ?? route.duration_s;

const getRouteServiceDuration = (route: RutaOptimizadaResponse) => route.service_duration_s ?? 0;

function getHistoricalZoneName(feature: Feature | undefined): string {
  const properties = feature?.properties as Record<string, unknown> | null | undefined;
  return (
    (properties?.NombreZona as string | undefined) ??
    (properties?.NOMBRE as string | undefined) ??
    (properties?.Nombre as string | undefined) ??
    (properties?.name as string | undefined) ??
    (properties?.NAME as string | undefined) ??
    ''
  );
}

function createDraftFromHistoricalFeature(feature: Feature): RedZoneDraft | null {
  const bounds = L.geoJSON(feature).getBounds();
  if (!bounds.isValid()) return null;

  const center = bounds.getCenter();
  const comuna = getFeatureComunaName(feature) || 'Sin comuna';
  const region = getFeatureRegionName(feature) || '';
  const historicalName = getHistoricalZoneName(feature);
  const name = historicalName || (comuna ? `Zona roja ${comuna}` : 'Zona roja histórica');

  return {
    name,
    comuna,
    region,
    lat: center.lat,
    lon: center.lng,
    radius_m: 350,
    severity: 'alta',
    source: 'historical_polygon',
    status: 'active',
    display_mode: 'circle',
    polygon_geojson: null,
    notes: 'Convertida desde zona histórica',
  };
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

const formatKilometers = (kilometers: number) => `${kilometers.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

const formatLiters = (liters: number) => { void formatLiters; return `${liters.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`; };

const formatClp = (value: number) => { void formatClp; return value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }); };


const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function RouteMonthCalendar({ selectedDate, onSelectDate, visitsByDate }: {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  visitsByDate: Record<string, RouteVisitDayCount>;
}) {
  const [monthDate, setMonthDate] = useState(() => new Date(selectedDate + 'T12:00:00'));

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const goPrev = () => setMonthDate(new Date(year, month - 1, 1));
  const goNext = () => setMonthDate(new Date(year, month + 1, 1));

  const days: ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={'e' + i} className="cc-route-calendar-day cc-route-calendar-day-other" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const isActive = dateStr === selectedDate;
    const isToday = dateStr === today;
    const dayVisits = visitsByDate[dateStr];
    days.push(
      <button key={dateStr}
        className={'cc-route-calendar-day' + (isActive ? ' cc-route-calendar-day-active' : '') + (isToday ? ' cc-route-calendar-day-today' : '')}
        onClick={() => onSelectDate(dateStr)}
        type="button"
      >
        {d}
        {dayVisits ? <span className="cc-route-calendar-badge">{dayVisits.total > 9 ? '9+' : dayVisits.total}</span> : null}
      </button>
    );
  }
  const remaining = 7 - (days.length % 7 || 7);
  for (let i = 0; i < remaining; i++) {
    days.push(<div key={'l' + i} className="cc-route-calendar-day cc-route-calendar-day-other" />);
  }

  return (
    <div className="cc-route-calendar">
      <div className="cc-route-calendar-header">
        <h4>{MONTHS[month]} {year}</h4>
        <div className="cc-route-calendar-nav">
          <button onClick={goPrev} type="button">&lsaquo;</button>
          <button onClick={() => { const n = new Date(); setMonthDate(new Date(n.getFullYear(), n.getMonth(), 1)); }} type="button">&bull;</button>
          <button onClick={goNext} type="button">&rsaquo;</button>
        </div>
      </div>
      <div className="cc-route-calendar-weekdays">
        {WEEKDAYS.map((wd) => <span key={wd}>{wd}</span>)}
      </div>
      <div className="cc-route-calendar-grid">{days}</div>
      <p className="cc-route-calendar-footer">Hoy destacado en verde. Días con badge tienen visitas guardadas.</p>
    </div>
  );
}
export function RutaVisitadorView({ redZonesGeoJson, importedReclamos = [] }: RutaVisitadorViewProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [visitador, setVisitador] = useState('');
  const [fechaCarga, setFechaCarga] = useState(today);
  const [fechaVisita, setFechaVisita] = useState(today);
  const [startPoint, setStartPoint] = useState('Longitudinal Sur N° 5201, Nos, San Bernardo, Chile');
  const [selectingStartPoint, setSelectingStartPoint] = useState(false);
  const [selectedStartPoint, setSelectedStartPoint] = useState<RutaStartPoint | null>(null);
  const [serviceMinutesPerStop, setServiceMinutesPerStop] = useState(10);
  const [fuelEfficiency, setFuelEfficiency] = useState(12);
  const [fuelPrice, setFuelPrice] = useState(1050);
  const [searchMode, setSearchMode] = useState<SearchMode>('ticket');
  const [activeRouteTab, setActiveRouteTab] = useState<RouteSubTab>('operation');
  const [territorialSearch, setTerritorialSearch] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [bulkTicketIds, setBulkTicketIds] = useState('');
  const [stops, setStops] = useState<RutaStop[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<RutaOptimizadaResponse | null>(null);
  const [addressQueries, setAddressQueries] = useState<Record<string, string>>({});
  const [addressSuggestions, setAddressSuggestions] = useState<Record<string, AddressSuggestion[]>>({});
  const [addressLoading, setAddressLoading] = useState<Record<string, boolean>>({});
  const [addressSearched, setAddressSearched] = useState<Record<string, boolean>>({});
  const [redZones, setRedZones] = useState<GeoJsonObject | null>(null);
  const [chileComunasGeoJson, setChileComunasGeoJson] = useState<GeoJsonObject | null>(null);
  const [activeRedZones, setActiveRedZones] = useState<RedZone[]>([]);
  const [redZonesError, setRedZonesError] = useState('');
  const [redZonePanelOpen, setRedZonePanelOpen] = useState(false);
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [redZoneDraft, setRedZoneDraft] = useState<RedZoneDraft | null>(null);
  const [redZonePicking, setRedZonePicking] = useState(false);
  const [redZoneSaving, setRedZoneSaving] = useState(false);
  const [redZoneManageError, setRedZoneManageError] = useState('');
  void addressSuggestions; void addressLoading; void addressSearched;
  void redZoneInputClass; void redZoneTextareaClass; void redZoneManageError;
  const [redZoneDetectMessage, setRedZoneDetectMessage] = useState(''); void redZoneDetectMessage;
  const [weatherSummary, setWeatherSummary] = useState<RouteWeatherSummary | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [weatherComuna, setWeatherComuna] = useState(KNOWN_COMUNAS[0].name);
  const [focusRedZoneSave, setFocusRedZoneSave] = useState(false);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const redZoneFormRef = useRef<HTMLDivElement | null>(null);
  const redZoneSaveButtonRef = useRef<HTMLButtonElement | null>(null);

  const weatherCoords = KNOWN_COMUNAS.find((k) => k.name === weatherComuna);
  const importedEligibleCount = importedReclamos.length; void importedEligibleCount;

  useEffect(() => {
    if (!weatherCoords) return;
    let mounted = true;
    setWeatherLoading(true);
    setWeatherError('');
    fetchRouteWeather({ latitude: weatherCoords.lat, longitude: weatherCoords.lng, date: fechaVisita })
      .then((data) => { if (mounted) { setWeatherSummary(data); setWeatherLoading(false); } })
      .catch((err: unknown) => { if (mounted) { setWeatherError(err instanceof Error ? err.message : 'Error clima'); setWeatherLoading(false); } });
    return () => { mounted = false; };
  }, [fechaVisita, weatherComuna]);

  const refreshActiveRedZones = useCallback(() => {
    fetchRedZones('active')
      .then((zones) => {
        setActiveRedZones(zones);
      })
      .catch(() => {
        setActiveRedZones([]);
      });
  }, []);

  useEffect(() => {
    let mounted = true;

    loadRedZonesGeoJson(redZonesGeoJson).then((state) => {
      if (!mounted) return;

      setRedZones(state.data);
      setRedZonesError(state.error ?? '');
    });

    return () => {
      mounted = false;
    };
  }, [redZonesGeoJson]);

  useEffect(() => {
    let mounted = true;

    loadGenericGeoJson(CHILE_COMUNAS_LAYER_PATH).then((state) => {
      if (!mounted) return;
      setChileComunasGeoJson(state.data);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    refreshActiveRedZones();
  }, [refreshActiveRedZones]);

  useEffect(() => {
    if (!focusRedZoneSave || !redZoneDraft || !redZonePanelOpen) return;

    redZoneFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    window.setTimeout(() => {
      redZoneSaveButtonRef.current?.focus();
      setFocusRedZoneSave(false);
    }, 120);
  }, [focusRedZoneSave, redZoneDraft, redZonePanelOpen]);

  useEffect(() => {
    setStops((current) =>
      current.map((stop) => ({
        ...stop,
        isRedZone:
          isPointInRedZone(stop.lat, stop.lng, redZones) ||
          isPointInActiveRedZone(stop.lat, stop.lng, activeRedZones),
      })),
    );
  }, [activeRedZones, redZones]);

  const summary = useMemo(() => buildRutaSummary(stops), [stops]);
  const routeCompletionPct = summary.ticketsToday > 0 ? Math.round((summary.successful / summary.ticketsToday) * 100) : 0;
  const routeClaimsToday = useMemo(() => stops.reduce((sum, stop) => sum + stop.claimsCount, 0), [stops]);
  const territorialConcentration = useMemo(() => {
    const grouped = new Map<string, { comuna: string; visitas: number; completadas: number; pendientes: number; zonasRojas: number }>();

    stops.forEach((stop) => {
      const location = Number.isFinite(stop.lat) && Number.isFinite(stop.lng)
        ? findComunaRegionByPoint(stop.lat as number, stop.lng as number, chileComunasGeoJson)
        : null;
      const comuna = location?.comuna || 'Sin comuna';
      const current = grouped.get(comuna) ?? { comuna, visitas: 0, completadas: 0, pendientes: 0, zonasRojas: 0 };

      current.visitas += 1;
      if (stop.status === 'exitosa') current.completadas += 1;
      if (stop.status === 'pendiente') current.pendientes += 1;
      if (stop.isRedZone) current.zonasRojas += 1;
      grouped.set(comuna, current);
    });

    return [...grouped.values()].sort((a, b) => b.visitas - a.visitas);
  }, [chileComunasGeoJson, stops]);
  const visibleTerritorialConcentration = useMemo(() => {
    const search = normalizeName(territorialSearch);
    if (!search) return territorialConcentration;
    return territorialConcentration.filter((item) => normalizeName(item.comuna).includes(search));
  }, [territorialConcentration, territorialSearch]);
  const fares = useMemo(() => getFareTable(stops.length), [stops.length]);
  const visitsByDate = useMemo(() => {
    const grouped: Record<string, RouteVisitDayCount> = {};
    // From current stops
    for (const s of stops) {
      if (!grouped[fechaVisita]) grouped[fechaVisita] = { total: 0, exitosas: 0, noExitosas: 0, pendientes: 0 };
      grouped[fechaVisita].total++;
      if (s.status === 'exitosa') grouped[fechaVisita].exitosas++;
      else if (s.status === 'no_exitosa') grouped[fechaVisita].noExitosas++;
      else grouped[fechaVisita].pendientes++;
      }
    // From localStorage
    const stored = getRouteDailyVisits();
    for (const v of stored) {
      if (!grouped[v.fechaRuta]) grouped[v.fechaRuta] = { total: 0, exitosas: 0, noExitosas: 0, pendientes: 0 };
      grouped[v.fechaRuta].total++;
    }
    return grouped;
  }, [stops, fechaVisita]);
  const stopPoints = useMemo<LatLngTuple[]>(
    () => stops.filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng)).map((stop) => [stop.lat as number, stop.lng as number]),
    [stops],
  );
  const optimizedLine = useMemo<LatLngTuple[]>(
    () => optimizedRoute?.geometry.coordinates.map(([lng, lat]) => [lat, lng]) ?? [],
    [optimizedRoute],
  );
  const routeFuelSummary = useMemo(() => {
    if (!optimizedRoute) return null;

    const totalKm = optimizedRoute.distance_m / 1000;
    const safeFuelEfficiency = Math.max(fuelEfficiency, 1);
    const safeFuelPrice = Math.max(fuelPrice, 0);
    const estimatedLiters = totalKm / safeFuelEfficiency;
    const estimatedFuelCost = estimatedLiters * safeFuelPrice;

    return {
      totalKm,
      estimatedLiters,
      estimatedFuelCost,
      fuelEfficiency: safeFuelEfficiency,
      fuelPrice: safeFuelPrice,
    };
  }, [fuelEfficiency, fuelPrice, optimizedRoute]);
  const selectedStartPointTuple = useMemo<LatLngTuple | null>(
    () => (selectedStartPoint ? [selectedStartPoint.lat, selectedStartPoint.lon] : null),
    [selectedStartPoint],
  );
  const boundsPoints = useMemo(
    () => (optimizedLine.length > 0 ? optimizedLine : selectedStartPointTuple ? [selectedStartPointTuple, ...stopPoints] : stopPoints),
    [optimizedLine, selectedStartPointTuple, stopPoints],
  );
  const selectedRedZoneId = redZoneDraft?.id ?? null;

  const selectRedZone = useCallback((zone: RedZone) => {
    setRedZoneDraft({ ...zone });
    setRedZonePicking(false);
    setRedZoneManageError('');
    setRedZoneDetectMessage('');
    setRedZonePanelOpen(true);
  }, []);

  const pickRedZoneCenter = useCallback(
    async (lat: number, lon: number) => {
      const detectedLocation = findComunaRegionByPoint(lat, lon, chileComunasGeoJson);

      setRedZoneDraft((current) => {
        if (!current) return current;

        const comuna = detectedLocation?.comuna || current.comuna || '';
        const region = detectedLocation?.region || current.region || '';
        const shouldSuggestName = !current.name.trim();
        const suggestedName = comuna ? `Zona roja ${comuna}` : current.name;

        return {
          ...current,
          lat,
          lon,
          comuna,
          region,
          name: shouldSuggestName ? suggestedName : current.name,
        };
      });
      setRedZonePicking(false);
      setRedZoneManageError('');
      setRedZoneDetectMessage(
        detectedLocation?.comuna
          ? `Ubicación detectada: ${detectedLocation.comuna}${detectedLocation.region ? `, ${detectedLocation.region}` : ''}`
          : 'No se pudo detectar comuna automáticamente. Puedes ingresarla manualmente.',
      );
    },
    [chileComunasGeoJson],
  );

  const convertHistoricalZone = useCallback((feature: Feature) => {
    const draft = createDraftFromHistoricalFeature(feature);
    if (!draft) {
      setRedZoneManageError('No se pudo convertir la zona histórica seleccionada.');
      setRedZonePanelOpen(true);
      return;
    }

    setRedZoneDraft(draft);
    setRedZonePicking(false);
    setRedZoneManageError('');
    setRedZoneDetectMessage(
      draft.comuna
        ? `Ubicación detectada: ${draft.comuna}${draft.region ? `, ${draft.region}` : ''}`
        : 'Zona histórica cargada. Completa los datos faltantes si es necesario.',
    );
    setRedZonePanelOpen(true);
    setFocusRedZoneSave(true);
  }, []);

  const onEachHistoricalZone = useCallback(
    (feature: Feature, layer: Layer) => {
      const comuna = getFeatureComunaName(feature) || 'Sin comuna';
      const region = getFeatureRegionName(feature);
      const nombreZona = getHistoricalZoneName(feature) || `Zona roja ${comuna}`;
      const buttonId = `historical-red-zone-${comuna}-${normalizeName(nombreZona)}`.replace(/[^a-zA-Z0-9_-]/g, '-');

      layer.bindPopup(
        [
          '<div style="min-width:180px">',
          `<strong>${nombreZona}</strong><br/>`,
          `<small>${comuna}${region ? ` · ${region}` : ''}</small><br/>`,
          `<button id="${buttonId}" style="margin-top:8px;background:#0f5fcf;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;">Convertir a zona activa</button>`,
          '</div>',
        ].join(''),
      );

      layer.on('popupopen', () => {
        window.setTimeout(() => {
          const button = document.getElementById(buttonId);
          if (!button) return;
          button.onclick = () => convertHistoricalZone(feature);
        }, 0);
      });
    },
    [convertHistoricalZone],
  );

  const saveRedZone = useCallback(async () => {
    if (!redZoneDraft) return;
    if (!redZoneDraft.name.trim()) {
      setRedZoneManageError('Ingresa un nombre para la zona.');
      return;
    }
    if (redZoneDraft.radius_m < 100) {
      setRedZoneManageError('El radio mínimo es 100 m.');
      return;
    }
    if (redZoneDraft.display_mode !== 'polygon' && (redZoneDraft.lat === null || redZoneDraft.lon === null)) {
      setRedZoneManageError('Selecciona el centro de la zona en el mapa.');
      return;
    }

    setRedZoneSaving(true);
    setRedZoneManageError('');
    try {
      const { id, ...payload } = redZoneDraft;
      const savedZone = id
        ? await updateRedZone(id, payload)
        : await createRedZone(payload);
      setRedZoneDraft({ ...savedZone });
      setRedZonePicking(false);
      refreshActiveRedZones();
      setRedZonePanelOpen(true);
      setMessage('Zona roja guardada correctamente');
    } catch (error) {
      setRedZoneManageError(error instanceof Error ? error.message : 'No se pudo guardar la zona roja');
    } finally {
      setRedZoneSaving(false);
    }
  }, [redZoneDraft, refreshActiveRedZones]);

  const removeRedZone = useCallback(async () => { void removeRedZone;
    if (!redZoneDraft?.id) return;

    setRedZoneSaving(true);
    setRedZoneManageError('');
    try {
      await deleteRedZone(redZoneDraft.id);
      setRedZoneDraft(null);
      setRedZonePicking(false);
      refreshActiveRedZones();
      setMessage('Zona roja eliminada correctamente');
    } catch (error) {
      setRedZoneManageError(error instanceof Error ? error.message : 'No se pudo eliminar la zona roja');
    } finally {
      setRedZoneSaving(false);
    }
  }, [redZoneDraft, refreshActiveRedZones]);

  const addStops = (newStops: RutaStop[]) => {
    const duplicateKeys = new Set(stops.map(getDuplicateKey));
    const nextStops: RutaStop[] = [];
    const skipped: string[] = [];

    for (const stop of newStops) {
      const duplicateKey = getDuplicateKey(stop);
      if (duplicateKeys.has(duplicateKey) || nextStops.some((item) => getDuplicateKey(item) === duplicateKey)) {
        skipped.push(stop.referencia);
        continue;
      }

      nextStops.push({
        ...stop,
        isRedZone:
          isPointInRedZone(stop.lat, stop.lng, redZones) ||
          isPointInActiveRedZone(stop.lat, stop.lng, activeRedZones),
      });
    }

    if (nextStops.length > 0) {
      setStops((current) => [...current, ...nextStops]);
      setOptimizedRoute(null);
    }

    return { added: nextStops.length, skipped };
  };

  const handleSearch = async () => {
    const value = searchValue.trim();
    if (!value) return;

    setLoading(true);
    setMessage('');

    try {
      const visit = searchMode === 'ticket' ? await buscarPorTicket(value) : await buscarPorRut(value);
      const result = addStops([toRutaStop(visit)]);
      setSearchValue('');

      const notices = [
        result.added > 0 ? `${result.added} registro agregado` : '',
        result.skipped.length > 0 ? `Duplicado omitido: ${result.skipped.join(', ')}` : '',
      ].filter(Boolean);

      setMessage(notices.join('. ') || 'No se agregaron registros');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo consultar el backend');
    } finally {
      setLoading(false);
    }
  };

  const addTicketIds = async (ids: string[]) => {
    if (ids.length === 0) return;

    setLoading(true);
    setMessage('');

    const nextStops: RutaStop[] = [];
    const failedIds: string[] = [];

    for (const id of ids) {
      try {
        const visit = await buscarPorTicket(id);
        nextStops.push(toRutaStop(visit));
      } catch (error) {
        failedIds.push(`${id}: ${error instanceof Error ? error.message : 'No se pudo cargar'}`);
      }
    }

    const result = addStops(nextStops);
    const notices = [
      result.added > 0 ? `${result.added} ticket(s) agregado(s)` : '',
      result.skipped.length > 0 ? `Duplicados omitidos: ${result.skipped.join(', ')}` : '',
      failedIds.length > 0 ? `Errores: ${failedIds.join(' | ')}` : '',
    ].filter(Boolean);

    setMessage(notices.join('. ') || 'No se agregaron tickets');
    setLoading(false);
  };

  const optimizeRoute = async () => {
    if (!startPoint.trim() || stops.length === 0) return;

    const nextServiceMinutes = Math.max(serviceMinutesPerStop, 10);
    setServiceMinutesPerStop(nextServiceMinutes);
    setOptimizing(true);
    setMessage('');

    try {
      const route = await optimizarRuta(startPoint.trim(), stops.map(toBackendVisit), nextServiceMinutes, selectedStartPoint);
      setOptimizedRoute(route);
      setMessage(`Ruta optimizada: ${formatDistance(route.distance_m)} / ${formatDuration(route.duration_s)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo optimizar la ruta');
    } finally {
      setOptimizing(false);
    }
  };

  const pickStartPoint = (lat: number, lon: number) => {
    const label = `Inicio manual (${lat.toFixed(6)}, ${lon.toFixed(6)})`;

    setSelectedStartPoint({
      label,
      lat,
      lon,
      source: 'manual_map',
    });
    setStartPoint(label);
    setSelectingStartPoint(false);
    setOptimizedRoute(null);
    setMessage('Punto de inicio definido desde el mapa');
  };

  const clearStartPoint = () => {
    setSelectedStartPoint(null);
    setSelectingStartPoint(false);
    setStartPoint('');
    setOptimizedRoute(null);
  };

  const updateAddressQuery = (id: string, value: string) => { void updateAddressQuery;
    setAddressQueries((current) => ({ ...current, [id]: value }));
  };

  const searchStopAddress = async (stop: RutaStop) => { void searchStopAddress;
    const query = (addressQueries[stop.id] ?? stop.address).trim();

    if (query.length < 4) {
      setAddressSuggestions((current) => ({ ...current, [stop.id]: [] }));
      setAddressSearched((current) => ({ ...current, [stop.id]: true }));
      return;
    }

    setAddressLoading((current) => ({ ...current, [stop.id]: true }));
    setAddressSearched((current) => ({ ...current, [stop.id]: false }));

    try {
      const suggestions = await searchAddress(query);
      setAddressSuggestions((current) => ({ ...current, [stop.id]: suggestions }));
      setAddressSearched((current) => ({ ...current, [stop.id]: true }));
    } catch {
      setAddressSuggestions((current) => ({ ...current, [stop.id]: [] }));
      setAddressSearched((current) => ({ ...current, [stop.id]: true }));
    } finally {
      setAddressLoading((current) => ({ ...current, [stop.id]: false }));
    }
  };

  const applyAddressSuggestion = (stopId: string, suggestion: AddressSuggestion) => { void applyAddressSuggestion;
    setStops((current) =>
      current.map((stop) =>
        stop.id === stopId
          ? {
              ...stop,
              address: suggestion.label,
              cleanAddress: suggestion.label,
              geocodeQueryUsed: suggestion.query_used,
              lat: suggestion.lat,
              lng: suggestion.lon,
              isRedZone:
                isPointInRedZone(suggestion.lat, suggestion.lon, redZones) ||
                isPointInActiveRedZone(suggestion.lat, suggestion.lon, activeRedZones),
              error: undefined,
            }
          : stop,
      ),
    );
    setAddressQueries((current) => ({ ...current, [stopId]: suggestion.label }));
    setAddressSuggestions((current) => ({ ...current, [stopId]: [] }));
    setAddressSearched((current) => ({ ...current, [stopId]: false }));
    setOptimizedRoute(null);
  };

  const updateStopStatus = (id: string, status: RutaVisitStatus) => {
    setStops((current) =>
      current.map((stop) =>
        stop.id === id
          ? {
              ...stop,
              status,
              observation: status === 'pendiente' ? '' : stop.observation,
            }
          : stop,
      ),
    );
  };

  const updateStopObservation = (id: string, observation: string) => { void updateStopObservation;
    setStops((current) => current.map((stop) => (stop.id === id ? { ...stop, observation } : stop)));
  };

  const removeStop = (id: string) => {
    setStops((current) => current.filter((stop) => stop.id !== id));
    setOptimizedRoute(null);
  };

  const clearStops = () => {
    setStops([]);
    setOptimizedRoute(null);
    setMessage('');
  };

  const exportCsv = () => {
    downloadCsv(`ruta-visitador-${new Date().toISOString().slice(0, 10)}.csv`, buildRutaCsv(stops, routeFuelSummary ?? undefined));
  };

  const saveDailyVisits = async () => {
    if (!visitador.trim() || !fechaCarga || !fechaVisita || stops.length === 0) {
      setMessage('Completa visitador, fechas y al menos una visita antes de guardar.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const response = await guardarVisitasDiarias({
        fecha_carga: fechaCarga,
        fecha_visita: fechaVisita,
        visitador: visitador.trim(),
        visitas: stops.map((stop) => ({
          ticket_id: stop.id || null,
          referencia: stop.referencia,
          nombre: stop.clientName,
          rut: stop.rut ?? null,
          direccion_original: stop.cleanAddress ?? stop.address ?? null,
          direccion: stop.address || null,
          lat: stop.lat ?? null,
          lon: stop.lng ?? null,
          peligro: stop.isRedZone,
          estado: stop.status,
          observacion: stop.observation,
          cantidad_reclamos: stop.claimsCount,
          tickets: stop.tickets,
          valor_visita: fares.successful,
          valor_no_exitosa: fares.unsuccessful,
          valor_calculado: calculateStopValue(stop.status, stops.length),
        })),
        resumen_ruta:
          optimizedRoute && routeFuelSummary
            ? {
                inicio_label: selectedStartPoint?.label ?? startPoint,
                inicio_lat: selectedStartPoint?.lat ?? null,
                inicio_lon: selectedStartPoint?.lon ?? null,
                geometry: optimizedRoute.geometry,
                distance_m: optimizedRoute.distance_m,
                duration_s: optimizedRoute.duration_s,
                travel_duration_s: getRouteTravelDuration(optimizedRoute),
                service_duration_s: getRouteServiceDuration(optimizedRoute),
                service_minutes_per_stop: optimizedRoute.service_minutes_per_stop ?? serviceMinutesPerStop,
                fuel_efficiency_km_l: routeFuelSummary.fuelEfficiency,
                fuel_price: routeFuelSummary.fuelPrice,
                fuel_liters: routeFuelSummary.estimatedLiters,
                fuel_cost: routeFuelSummary.estimatedFuelCost,
              }
            : null,
      });
      setMessage(`Visitas guardadas: ${response.saved + response.updated} | RM: ${response.rm} | Regiones: ${response.regiones}`);
      // Save to localStorage for dashboard integration
      const now = new Date().toISOString();
      const dailyVisits: RouteDailyVisit[] = stops.map((stop, idx) => ({
        id: stop.id,
        fechaRuta: fechaVisita,
        ticket: stop.referencia,
        rut: stop.rut,
        idTicket: stop.id === stop.referencia ? undefined : stop.id,
        direccion: stop.address,
        comuna: stop.address?.split(',').pop()?.trim(),
        lat: stop.lat,
        lng: stop.lng,
        estadoVisita: stop.status,
        resultado: stop.status,
        observacion: stop.observation,
        zonaRoja: stop.isRedZone,
        tarifaAplicada: calculateStopValue(stop.status, stops.length),
        valorVisita: calculateStopValue(stop.status, stops.length),
        ordenRuta: idx + 1,
        createdAt: now,
        updatedAt: now,
      }));
      saveRouteDailyVisits(fechaVisita, dailyVisits);
      dispatchRouteDailyUpdate(fechaVisita, 'ruta-visitador');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron guardar las visitas del día');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cc-route-page">
      {/* ===== HEADER: title + export + tabs ===== */}
      <div className="cc-route-section">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 style={{fontSize: "22px", fontWeight: 900, color: "var(--cc-route-text)", margin: 0}}>Ruta diaria</h1>
            <p style={{fontSize: "13px", fontWeight: 500, color: "var(--cc-route-muted)", margin: "2px 0 0 0"}}>Planificación operativa, visitas y seguimiento en terreno</p>
          </div>
          <button
            onClick={exportCsv}
            disabled={stops.length === 0}
            style={{height: "38px", padding: "0 20px", borderRadius: "8px", border: "1px solid var(--cc-route-border)", background: "var(--cc-route-panel-bg)", color: "var(--cc-route-text)", fontSize: "13px", fontWeight: 800, cursor: stops.length === 0 ? "not-allowed" : "pointer", opacity: stops.length === 0 ? 0.5 : 1, display: "flex", alignItems: "center", gap: "8px"}}
            type="button"
          >
            <Download size={16} />
            Exportar ruta
          </button>
        </div>
        <div className="flex items-center gap-4 border-b" style={{borderBottom: "1px solid var(--cc-route-border-subtle)", paddingBottom: 0}}>
          <button onClick={() => setActiveRouteTab('operation')} type="button"
            style={{padding: "10px 4px 10px 4px", fontSize: "13px", fontWeight: 700, color: activeRouteTab === 'operation' ? "var(--cc-route-accent)" : "var(--cc-route-muted)", border: "none", background: "none", cursor: "pointer", borderBottom: activeRouteTab === 'operation' ? "2px solid var(--cc-route-accent)" : "2px solid transparent", marginBottom: "-1px"}}>
            Operación diaria
          </button>
          <button onClick={() => setActiveRouteTab('territory')} type="button"
            style={{padding: "10px 4px 10px 4px", fontSize: "13px", fontWeight: 700, color: activeRouteTab === 'territory' ? "var(--cc-route-accent)" : "var(--cc-route-muted)", border: "none", background: "none", cursor: "pointer", borderBottom: activeRouteTab === 'territory' ? "2px solid var(--cc-route-accent)" : "2px solid transparent", marginBottom: "-1px"}}>
            Mapa territorial
          </button>
        </div>
      </div>

      {activeRouteTab === 'operation' ? (
        <>
          {/* ===== KPI ROW: 4 cards, height 96px, gap 16px ===== */}
          <div className="cc-route-kpi-grid">

            <div className="cc-route-kpi-card">
              <div style={{width: "44px", height: "44px", borderRadius: "50%", background: "rgba(14,165,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0}}>
                <CalendarDays size={20} color="var(--cc-route-accent)" />
              </div>
              <div className="min-w-0">
                <p style={{margin: 0, fontSize: "11px", fontWeight: 600, color: "var(--cc-route-muted)", textTransform: "uppercase", letterSpacing: "0.05em"}}>Visitas planificadas</p>
                <p style={{margin: "2px 0 0 0", fontSize: "22px", fontWeight: 900, color: "var(--cc-route-accent)", lineHeight: 1.1}}>{summary.ticketsToday.toLocaleString("es-CL")}</p>
                <p style={{margin: "1px 0 0 0", fontSize: "10px", fontWeight: 500, color: "var(--cc-route-muted)"}}>Total del día</p>
              </div>
            </div>

            <div className="cc-route-kpi-card">
              <div style={{width: "44px", height: "44px", borderRadius: "50%", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0}}>
                <Save size={20} color="#22c55e" />
              </div>
              <div className="min-w-0">
                <p style={{margin: 0, fontSize: "11px", fontWeight: 600, color: "var(--cc-route-muted)", textTransform: "uppercase", letterSpacing: "0.05em"}}>Visitas completadas</p>
                <p style={{margin: "2px 0 0 0", fontSize: "22px", fontWeight: 900, color: "#22c55e", lineHeight: 1.1}}>{summary.successful.toLocaleString("es-CL")}</p>
                <p style={{margin: "1px 0 0 0", fontSize: "10px", fontWeight: 500, color: "var(--cc-route-muted)"}}>Gestionadas</p>
              </div>
            </div>

            <div className="cc-route-kpi-card">
              <div style={{width: "44px", height: "44px", borderRadius: "50%", background: "rgba(14,165,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0}}>
                <Route size={20} color="var(--cc-route-accent)" />
              </div>
              <div className="min-w-0">
                <p style={{margin: 0, fontSize: "11px", fontWeight: 600, color: "var(--cc-route-muted)", textTransform: "uppercase", letterSpacing: "0.05em"}}>% Cumplimiento</p>
                <p style={{margin: "2px 0 0 0", fontSize: "22px", fontWeight: 900, color: "var(--cc-route-accent)", lineHeight: 1.1}}>{routeCompletionPct.toLocaleString("es-CL")}%</p>
                <p style={{margin: "1px 0 0 0", fontSize: "10px", fontWeight: 500, color: "var(--cc-route-muted)"}}>Efectividad</p>
              </div>
            </div>

            <div className="cc-route-kpi-card">
              <div style={{width: "44px", height: "44px", borderRadius: "50%", background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0}}>
                <Search size={20} color="#ef4444" />
              </div>
              <div className="min-w-0">
                <p style={{margin: 0, fontSize: "11px", fontWeight: 600, color: "var(--cc-route-muted)", textTransform: "uppercase", letterSpacing: "0.05em"}}>Reclamos del día</p>
                <p style={{margin: "2px 0 0 0", fontSize: "22px", fontWeight: 900, color: "#ef4444", lineHeight: 1.1}}>{routeClaimsToday.toLocaleString("es-CL")}</p>
                <p style={{margin: "1px 0 0 0", fontSize: "10px", fontWeight: 500, color: "var(--cc-route-muted)"}}>En ruta</p>
              </div>
            </div>

          </div>

          {/* ===== CONTROLS ROW: height 74px, grid 436px 286px 1fr, gap 12px ===== */}
          <div className="cc-route-controls-grid">
            {/* Input + Agregar */}
            <div className="cc-route-control-card">
              <form onSubmit={(e) => { e.preventDefault(); void handleSearch(); }} style={{display: "flex", gap: "8px", flex: 1, alignItems: "center"}}>
                <input
                  style={{flex: 1, height: "36px", borderRadius: "6px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "0 12px", fontSize: "12px", color: "var(--cc-route-text)", outline: "none"}}
                  aria-label={searchMode === "ticket" ? "ID ticket" : "RUT"}
                  placeholder={searchMode === "ticket" ? "Ingresar ticket de visita" : "Ej: 12.345.678-9"}
                  onChange={(e) => setSearchValue(e.target.value)}
                  value={searchValue}
                />
                <button type="submit" disabled={loading} style={{height: "34px", padding: "0 16px", borderRadius: "6px", border: "none", background: "var(--cc-primary-hover)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, display: "flex", alignItems: "center", gap: "6px"}}>
                  {loading ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
                  Agregar
                </button>
              </form>
            </div>

            {/* Por ticket / Por RUT / Carga masiva */}
            <div className="cc-route-mode-tabs">
              <button className="cc-route-mode-tab" data-active={searchMode === "ticket"} onClick={() => setSearchMode("ticket")} type="button">Por Ticket</button>
              <button className="cc-route-mode-tab" data-active={searchMode === "rut"} onClick={() => setSearchMode("rut")} type="button">Por RUT</button>
              <div className="cc-route-mode-divider" />
              <button className="cc-route-mode-tab" data-active={showBulkInput} onClick={() => setShowBulkInput(prev => !prev)} type="button">Carga masiva</button>
            </div>

            {/* Selects: Modo de carga, Territorio, Fecha */}
            <div className="cc-route-control-card">
              <select style={{height: "32px", borderRadius: "6px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "0 10px", fontSize: "11px", fontWeight: 600, color: "var(--cc-route-text)", outline: "none", flex: 1}}>
                <option>Modo de carga</option>
                <option>Individual</option>
                <option>Masivo</option>
              </select>
              <select style={{height: "32px", borderRadius: "6px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "0 10px", fontSize: "11px", fontWeight: 600, color: "var(--cc-route-text)", outline: "none", flex: 1}}>
                <option>RM</option>
                <option>Regiones</option>
              </select>
              <input type="date" value={fechaVisita} onChange={(e) => setFechaVisita(e.target.value)} style={{height: "32px", borderRadius: "6px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "0 10px", fontSize: "11px", fontWeight: 600, color: "var(--cc-route-text)", outline: "none", flex: 1}} />
            </div>
          </div>

          {/* Bulk input (collapsible) */}
          {showBulkInput ? (
            <div className="cc-route-section">
              <form onSubmit={(e) => { e.preventDefault(); const ids = parseTicketIds(bulkTicketIds); setBulkTicketIds(""); void addTicketIds(ids); }} style={{display: "flex", gap: "8px", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--cc-route-border)", background: "var(--cc-route-panel-bg)"}}>
                <textarea value={bulkTicketIds} onChange={(e) => setBulkTicketIds(e.target.value)} placeholder="IDs separados por coma, punto y coma o salto de línea..." style={{flex: 1, height: "60px", borderRadius: "6px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "8px 12px", fontSize: "11px", color: "var(--cc-route-text)", outline: "none", resize: "none"}} />
                <button type="submit" disabled={loading} style={{height: "60px", padding: "0 20px", borderRadius: "6px", border: "none", background: "var(--cc-primary-hover)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1}}>Cargar</button>
              </form>
            </div>
          ) : null}

          {/* ===== MAIN ROUTE ROW: height 332px, grid 571px 1fr, gap 11px ===== */}
          <div className="cc-route-main-grid">
            {/* LEFT: MAP */}
            <div className="cc-route-map-card">
              <div style={{padding: "12px 16px", borderBottom: "1px solid var(--cc-route-border-subtle)"}}>
                <h3 style={{margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--cc-route-text)"}}>Mapa de ruta &mdash; Hoy</h3>
              </div>
              <div style={{flex: 1, position: "relative", minHeight: 0}}>
                <div style={{position: "absolute", inset: 0, margin: "8px", borderRadius: "6px", overflow: "hidden"}}>
                  <MapContainer center={[-33.45, -70.66]} className="h-full w-full" preferCanvas scrollWheelZoom zoom={11} zoomControl={false} style={{height: "245px", width: "100%"}}>
                    <ZoomControl position="topleft" />
                    <StartPointPicker enabled={selectingStartPoint} onPick={pickStartPoint} />
                    <RedZoneMapPicker enabled={redZonePicking} onPick={pickRedZoneCenter} />
                    <RouteMapBounds points={boundsPoints} />
                    <SelectedRedZoneFocus zone={redZoneDraft} />
                    <BaseMapLayers>
                      <ActiveRedZonesLayers onSelect={selectRedZone} redZoneMode="manage" selectedZoneId={selectedRedZoneId} zones={activeRedZones} />
                      {redZones ? (
                        <LayersControl.Overlay name="Zonas rojas históricas">
                          <GeoJSON data={redZones} style={RED_ZONE_STYLE} onEachFeature={onEachHistoricalZone} />
                        </LayersControl.Overlay>
                      ) : null}
                      {optimizedLine.length > 1 || (optimizedLine.length === 0 && stopPoints.length > 1) ? (
                        <LayersControl.Overlay checked name="Ruta optimizada">
                          <LayerGroup>
                            <Polyline positions={optimizedLine.length > 1 ? optimizedLine : stopPoints} pathOptions={{ color: '#0f5fcf', weight: optimizedLine.length > 1 ? 5 : 4, opacity: optimizedLine.length > 1 ? 0.82 : 0.72 }} />
                          </LayerGroup>
                        </LayersControl.Overlay>
                      ) : null}
                      {stops.length > 0 ? (
                        <LayersControl.Overlay checked name="Paradas / tickets">
                          <LayerGroup>
                            {stops.map((stop, index) =>
                              Number.isFinite(stop.lat) && Number.isFinite(stop.lng) ? (
                                <CircleMarker key={stop.id} center={[stop.lat!, stop.lng!]} radius={9}
                                  pathOptions={{ color: '#ffffff', fillColor: stop.isRedZone ? '#ef4444' : stop.status === 'exitosa' ? '#10b981' : stop.status === 'no_exitosa' ? '#ef4444' : '#f59e0b', fillOpacity: 0.85, weight: 2 }}>
                                  <Popup><strong>{index + 1}. {stop.clientName}</strong><br />Ref: {stop.referencia}<br />Estado: {STATUS_LABELS[stop.status]}</Popup>
                                </CircleMarker>
                              ) : null
                            )}
                          </LayerGroup>
                        </LayersControl.Overlay>
                      ) : null}
                    </BaseMapLayers>
                    {selectedStartPoint ? (
                      <CircleMarker center={[selectedStartPoint.lat, selectedStartPoint.lon]} radius={11}
                        pathOptions={{ color: '#ffffff', fillColor: '#10b981', fillOpacity: 0.95, weight: 3 }}>
                        <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>Inicio de ruta</Tooltip>
                        <Popup><strong>Punto de inicio</strong><br />{selectedStartPoint.label}</Popup>
                      </CircleMarker>
                    ) : null}
                  </MapContainer>
                </div>
              </div>
              {/* Map legend */}
              <div style={{padding: "8px 16px", borderTop: "1px solid var(--cc-route-border-subtle)", display: "flex", gap: "16px", fontSize: "10px", fontWeight: 600, color: "var(--cc-route-muted)"}}>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block"}} /> Inicio</span>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block"}} /> Paradas</span>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block"}} /> Zonas rojas</span>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 16, height: 2, background: "#0f5fcf", display: "inline-block"}} /> Ruta optimizada</span>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block"}} /> Exitosa</span>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block"}} /> No exitosa</span>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "var(--cc-route-soft)", display: "inline-block"}} /> Pendiente</span>
              </div>
            </div>

            {/* RIGHT: VISITS TABLE */}
            <div className="cc-route-visits-card">
              <div style={{padding: "12px 16px", borderBottom: "1px solid var(--cc-route-border-subtle)"}}>
                <h3 style={{margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--cc-route-text)"}}>Visitas planificadas</h3>
                <p style={{margin: "2px 0 0 0", fontSize: "11px", fontWeight: 500, color: "var(--cc-route-muted)"}}>Marca resultado de visita, observación y revisión territorial.</p>
              </div>
              <div style={{flex: 1, overflow: "auto", minHeight: 0}}>
                {stops.length === 0 ? (
                  <div style={{display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px 20px"}}>
                    <div style={{textAlign: "center"}}>
                      <p style={{margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--cc-route-text)"}}>Sin tickets cargados</p>
                      <p style={{margin: "4px 0 0 0", fontSize: "12px", fontWeight: 500, color: "var(--cc-route-muted)"}}>Busca por ticket, RUT o usa carga masiva para iniciar la ruta.</p>
                    </div>
                  </div>
                ) : (
                  <table style={{width: "100%", borderCollapse: "collapse", fontSize: "11px"}}>
                    <thead>
                      <tr style={{borderBottom: "1px solid var(--cc-route-border-subtle)"}}>
                        <th style={{padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)", textTransform: "uppercase", letterSpacing: "0.05em"}}>N°</th>
                        <th style={{padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)", textTransform: "uppercase", letterSpacing: "0.05em"}}>Ticket</th>
                        <th style={{padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)", textTransform: "uppercase", letterSpacing: "0.05em"}}>Cliente / Dirección</th>
                        <th style={{padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)", textTransform: "uppercase", letterSpacing: "0.05em"}}>Reclamos</th>
                        <th style={{padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)", textTransform: "uppercase", letterSpacing: "0.05em"}}>Estado</th>
                        <th style={{padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)", textTransform: "uppercase", letterSpacing: "0.05em"}}>Zona roja</th>
                        <th style={{padding: "8px 12px", textAlign: "right", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)", textTransform: "uppercase", letterSpacing: "0.05em"}}>Valor</th>
                        <th style={{padding: "8px 12px", textAlign: "center", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)", textTransform: "uppercase", letterSpacing: "0.05em"}}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stops.map((stop, index) => (
                        <tr key={stop.id} style={{borderBottom: "1px solid rgba(148,163,184,0.06)", transition: "background 0.15s"}}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(148,163,184,0.04)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{padding: "8px 12px", fontWeight: 700, color: "var(--cc-route-text)"}}>{index + 1}</td>
                          <td style={{padding: "8px 12px", fontFamily: "monospace", fontSize: "10px", color: "var(--cc-route-muted)"}}>{stop.referencia}</td>
                          <td style={{padding: "8px 12px", maxWidth: "180px"}}>
                            <p style={{margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: "var(--cc-route-text)", maxWidth: "180px"}} title={stop.clientName}>{stop.clientName}</p>
                            {stop.address ? <p style={{margin: "1px 0 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "10px", color: "var(--cc-route-muted)", maxWidth: "180px"}} title={stop.address}>{stop.address}</p> : null}
                          </td>
                          <td style={{padding: "8px 12px", color: "var(--cc-route-muted)"}}>{stop.claimsCount.toLocaleString('es-CL')}</td>
                          <td style={{padding: "8px 12px"}}>
                            <span style={{display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: 700,
                              background: stop.status === 'exitosa' ? 'rgba(34,197,94,0.12)' : stop.status === 'no_exitosa' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                              color: stop.status === 'exitosa' ? '#22c55e' : stop.status === 'no_exitosa' ? '#ef4444' : '#f59e0b',
                              border: stop.status === 'exitosa' ? '1px solid rgba(34,197,94,0.2)' : stop.status === 'no_exitosa' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(245,158,11,0.2)'}}>
                              <span style={{width: 5, height: 5, borderRadius: "50%",
                                background: stop.status === 'exitosa' ? '#22c55e' : stop.status === 'no_exitosa' ? '#ef4444' : '#f59e0b',
                                display: "inline-block"}} />
                              {STATUS_LABELS[stop.status]}
                            </span>
                          </td>
                          <td style={{padding: "8px 12px"}}>
                            {stop.isRedZone
                              ? <span style={{display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: 700, background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)"}}><span style={{width: 5, height: 5, borderRadius: "50%", background: "#ef4444", display: "inline-block"}} /> Zona roja</span>
                              : <span style={{color: "var(--cc-route-soft)"}}>&mdash;</span>
                            }
                          </td>
                          <td style={{padding: "8px 12px", fontWeight: 700, color: "var(--cc-route-text)", textAlign: "right", whiteSpace: "nowrap"}}>{calculateStopValue(stop.status, stops.length).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</td>
                          <td style={{padding: "8px 12px", textAlign: "center"}}>
                            <div style={{display: "flex", alignItems: "center", gap: "4px", justifyContent: "center"}}>
                              <select value={stop.status} onChange={(e) => updateStopStatus(stop.id, e.target.value as RutaVisitStatus)} style={{height: "26px", borderRadius: "4px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "0 4px", fontSize: "10px", fontWeight: 600, color: "var(--cc-route-text)", outline: "none"}} aria-label="Estado">
                                <option value="pendiente">Pend.</option>
                                <option value="exitosa">Ok</option>
                                <option value="no_exitosa">No</option>
                              </select>
                              <button onClick={() => removeStop(stop.id)} type="button" style={{width: "26px", height: "26px", borderRadius: "4px", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"}} title="Eliminar"><Trash2 size={11} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {/* Paginator placeholder */}
              {stops.length > 0 ? (
                <div style={{padding: "8px 16px", borderTop: "1px solid var(--cc-route-border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--cc-route-muted)"}}>
                  <span>{stops.length} registro(s)</span>
                  <div style={{display: "flex", gap: "4px"}}>
                    <button style={{width: "28px", height: "28px", borderRadius: "4px", border: "1px solid var(--cc-route-input-border)", background: "transparent", color: "var(--cc-route-muted)", cursor: "pointer", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"}} type="button">1</button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* ===== BOTTOM CARDS ROW: height 171px, grid 315px 271px 340px 1fr, gap 12px ===== */}
          <div className="cc-route-summary-grid">
            {/* Valorización del día */}
            <div className="cc-route-summary-card">
              <h3 style={{margin: 0, fontSize: "13px", fontWeight: 800, color: "var(--cc-route-text)"}}>Valorización del día</h3>
              <div style={{marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", flex: 1}}>
                <div style={{display: "flex", justifyContent: "space-between"}}><span style={{color: "var(--cc-route-muted)"}}>Tarifa exitosa</span><span style={{fontWeight: 700, color: "#22c55e"}}>{fares.successful.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</span></div>
                <div style={{display: "flex", justifyContent: "space-between"}}><span style={{color: "var(--cc-route-muted)"}}>Tarifa no exitosa</span><span style={{fontWeight: 700, color: "#ef4444"}}>{fares.unsuccessful.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</span></div>
                <div style={{borderTop: "1px solid var(--cc-route-border)", marginTop: "auto", paddingTop: "6px", display: "flex", justifyContent: "space-between"}}><span style={{fontWeight: 700, color: "var(--cc-route-text)"}}>Total</span><span style={{fontWeight: 900, color: "var(--cc-route-text)"}}>{summary.totalValued.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</span></div>
              </div>
            </div>

            {/* Resultados del día */}
            <div className="cc-route-summary-card">
              <h3 style={{margin: 0, fontSize: "13px", fontWeight: 800, color: "var(--cc-route-text)"}}>Resultados del día</h3>
              <div style={{marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", flex: 1}}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                  <span style={{display: "flex", alignItems: "center", gap: "6px", color: "var(--cc-route-muted)"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block"}} /> Exitosas</span>
                  <span style={{fontWeight: 700, color: "#22c55e"}}>{summary.successful.toLocaleString('es-CL')}</span>
                </div>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                  <span style={{display: "flex", alignItems: "center", gap: "6px", color: "var(--cc-route-muted)"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block"}} /> No exitosas</span>
                  <span style={{fontWeight: 700, color: "#ef4444"}}>{summary.unsuccessful.toLocaleString('es-CL')}</span>
                </div>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                  <span style={{display: "flex", alignItems: "center", gap: "6px", color: "var(--cc-route-muted)"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block"}} /> Pendientes</span>
                  <span style={{fontWeight: 700, color: "var(--cc-route-text)"}}>{summary.pending.toLocaleString('es-CL')}</span>
                </div>
                {summary.ticketsToday > 0 ? (
                  <div style={{marginTop: "auto", display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", background: "var(--cc-route-border)"}}>
                    <div style={{height: "100%", background: "#22c55e", transition: "width 0.3s", width: (summary.successful / summary.ticketsToday) * 100 + "%"}} />
                    <div style={{height: "100%", background: "#ef4444", transition: "width 0.3s", width: (summary.unsuccessful / summary.ticketsToday) * 100 + "%"}} />
                    <div style={{height: "100%", background: "#f59e0b", transition: "width 0.3s", width: (summary.pending / summary.ticketsToday) * 100 + "%"}} />
                  </div>
                ) : null}
              </div>
            </div>

            {/* Clima en ruta */}
            <div className="cc-route-summary-card">
              <h3 style={{margin: 0, fontSize: "13px", fontWeight: 800, color: "var(--cc-route-text)"}}>Clima en ruta</h3>
              {weatherSummary && !weatherLoading ? (
                <div style={{marginTop: "8px", flex: 1, display: "flex", flexDirection: "column"}}>
                  <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                    <span style={{fontSize: "28px"}}>{getWeatherPresentation(weatherSummary.weatherCode, weatherSummary.current?.isDay).icon}</span>
                    <div>
                      <p style={{margin: 0, fontSize: "18px", fontWeight: 900, color: "var(--cc-route-text)"}}>{weatherSummary.current?.temperature2m ?? weatherSummary.temperatureMax ?? "--"}°C</p>
                      <p style={{margin: 0, fontSize: "10px", fontWeight: 500, color: "var(--cc-route-muted)"}}>{getWeatherPresentation(weatherSummary.weatherCode, weatherSummary.current?.isDay).label}</p>
                    </div>
                  </div>
                  <div style={{marginTop: "auto", display: "flex", gap: "12px", fontSize: "10px", color: "var(--cc-route-muted)"}}>
                    {weatherSummary.current?.windSpeed10m != null ? <span>Viento {weatherSummary.current.windSpeed10m} km/h</span> : weatherSummary.windSpeedMax != null ? <span>Viento máx {weatherSummary.windSpeedMax} km/h</span> : null}
                    {weatherSummary.precipitationProbabilityMax != null ? <span>Lluvia {weatherSummary.precipitationProbabilityMax}%</span> : null}
                  </div>
                </div>
              ) : (
                <p style={{marginTop: "12px", fontSize: "12px", fontWeight: 500, color: "var(--cc-route-muted)"}}>{weatherLoading ? "Consultando..." : "Sin datos climáticos"}</p>
              )}
            </div>

            {/* Resumen de reclamos */}
            <div className="cc-route-summary-card">
              <h3 style={{margin: 0, fontSize: "13px", fontWeight: 800, color: "var(--cc-route-text)"}}>Resumen de reclamos</h3>
              <div style={{marginTop: "8px", flex: 1, display: "flex", flexDirection: "column"}}>
                <p style={{margin: 0, fontSize: "24px", fontWeight: 900, color: "var(--cc-route-text)"}}>{routeClaimsToday.toLocaleString('es-CL')}</p>
                <p style={{margin: 0, fontSize: "11px", fontWeight: 500, color: "var(--cc-route-muted)"}}>Reclamos en ruta hoy</p>
                <div style={{marginTop: "auto", display: "flex", flexDirection: "column", gap: "2px", fontSize: "11px"}}>
                  <div style={{display: "flex", justifyContent: "space-between"}}><span style={{color: "var(--cc-route-muted)"}}>Tickets cargados</span><span style={{fontWeight: 700, color: "var(--cc-route-text)"}}>{stops.length}</span></div>
                  <div style={{display: "flex", justifyContent: "space-between"}}><span style={{color: "var(--cc-route-muted)"}}>Con coordenadas</span><span style={{fontWeight: 700, color: "var(--cc-route-text)"}}>{stopPoints.length}</span></div>
                  <div style={{display: "flex", justifyContent: "space-between"}}><span style={{color: "var(--cc-route-muted)"}}>Zonas rojas activas</span><span style={{fontWeight: 700, color: "#ef4444"}}>{activeRedZones.length}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions + Config + Message (compact, below bottom cards) */}
          <div className="cc-route-actions">
            <button onClick={() => void saveDailyVisits()} disabled={saving || stops.length === 0 || !visitador.trim()} type="button"
              className="cc-route-btn-save" style={{cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.5 : 1}}>
              {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} Guardar visitas
            </button>
            <button onClick={optimizeRoute} disabled={stops.length === 0 || optimizing || !startPoint.trim()} type="button"
              style={{cursor: optimizing ? "not-allowed" : "pointer", opacity: optimizing ? 0.5 : 1, background: "var(--cc-primary-hover)", color: "#fff", border: "none"}}>
              {optimizing ? <Loader2 className="animate-spin" size={13} /> : <Route size={13} />} Optimizar ruta
            </button>
            <button onClick={exportCsv} disabled={stops.length === 0} type="button"
              style={{cursor: stops.length === 0 ? "not-allowed" : "pointer", opacity: stops.length === 0 ? 0.5 : 1}}>
              <Download size={13} /> Exportar CSV
            </button>
            <button onClick={clearStops} disabled={stops.length === 0} type="button"
              style={{cursor: stops.length === 0 ? "not-allowed" : "pointer", opacity: stops.length === 0 ? 0.5 : 1, color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.1)"}}>
              <Trash2 size={13} /> Limpiar tickets
            </button>
            <button onClick={() => setConfigPanelOpen(prev => !prev)} type="button"
              style={{cursor: "pointer", color: "var(--cc-route-muted)"}}>
              <Settings size={13} /> Configuración <ChevronDown size={10} style={{transform: configPanelOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s"}} />
            </button>
          </div>

          {configPanelOpen ? (
            <div className="cc-route-config-grid">
              <div className="cc-route-card-base" style={{padding: "12px"}}>
                <RouteMonthCalendar selectedDate={fechaVisita} onSelectDate={(d) => { setFechaVisita(d); }} visitsByDate={visitsByDate} />
              </div>
              <div className="cc-route-card-base" style={{padding: "12px"}}>
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px"}}>
                  <label style={{display: "grid", gap: "2px", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)"}}>Visitador <input value={visitador} onChange={(e) => setVisitador(e.target.value)} style={{height: "30px", borderRadius: "4px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "0 8px", fontSize: "11px", color: "var(--cc-route-text)", outline: "none"}} /></label>
                  <label style={{display: "grid", gap: "2px", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)"}}>Fecha carga <input type="date" value={fechaCarga} onChange={(e) => setFechaCarga(e.target.value)} style={{height: "30px", borderRadius: "4px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "0 8px", fontSize: "11px", color: "var(--cc-route-text)", outline: "none"}} /></label>
                  <label style={{display: "grid", gap: "2px", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)"}}>Fecha visita <input type="date" value={fechaVisita} onChange={(e) => setFechaVisita(e.target.value)} style={{height: "30px", borderRadius: "4px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "0 8px", fontSize: "11px", color: "var(--cc-route-text)", outline: "none"}} /></label>
                  <label style={{display: "grid", gap: "2px", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)"}}>Punto inicio <input value={startPoint} onChange={(e) => { setStartPoint(e.target.value); setSelectedStartPoint(null); setSelectingStartPoint(false); setOptimizedRoute(null); }} style={{height: "30px", borderRadius: "4px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "0 8px", fontSize: "11px", color: "var(--cc-route-text)", outline: "none"}} /></label>
                  <label style={{display: "grid", gap: "2px", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)"}}>Min/visita <input type="number" min={10} value={serviceMinutesPerStop} onChange={(e) => setServiceMinutesPerStop(Math.max(Number(e.target.value) || 10, 10))} style={{height: "30px", borderRadius: "4px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "0 8px", fontSize: "11px", color: "var(--cc-route-text)", outline: "none"}} /></label>
                  <label style={{display: "grid", gap: "2px", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)"}}>Km/L <input type="number" min={1} step="0.1" value={fuelEfficiency} onChange={(e) => setFuelEfficiency(Math.max(Number(e.target.value) || 1, 1))} style={{height: "30px", borderRadius: "4px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "0 8px", fontSize: "11px", color: "var(--cc-route-text)", outline: "none"}} /></label>
                  <label style={{display: "grid", gap: "2px", fontSize: "10px", fontWeight: 700, color: "var(--cc-route-muted)"}}>Precio comb. <input type="number" min={0} step={10} value={fuelPrice} onChange={(e) => setFuelPrice(Math.max(Number(e.target.value) || 0, 0))} style={{height: "30px", borderRadius: "4px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "0 8px", fontSize: "11px", color: "var(--cc-route-text)", outline: "none"}} /></label>
                </div>
                <div style={{marginTop: "8px", display: "flex", gap: "6px"}}>
                  <button onClick={() => { setSelectingStartPoint(true); setMessage("Haz click en el mapa para definir el punto de partida"); }} type="button" style={{height: "28px", padding: "0 10px", borderRadius: "4px", border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.1)", color: "#60a5fa", fontSize: "10px", fontWeight: 700, cursor: "pointer"}}>Seleccionar en mapa</button>
                  <button onClick={clearStartPoint} disabled={!selectedStartPoint && !startPoint} type="button" style={{height: "28px", padding: "0 10px", borderRadius: "4px", border: "1px solid var(--cc-route-border)", background: "transparent", color: "var(--cc-route-muted)", fontSize: "10px", fontWeight: 700, cursor: "pointer"}}>Limpiar</button>
                  <span style={{display: "flex", alignItems: "center", padding: "0 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: selectingStartPoint ? "rgba(245,158,11,0.1)" : selectedStartPoint ? "rgba(34,197,94,0.1)" : "transparent", color: selectingStartPoint ? "#f59e0b" : selectedStartPoint ? "#22c55e" : "var(--cc-route-soft)"}}>{selectingStartPoint ? "Selecciona punto en mapa" : selectedStartPoint ? "Inicio validado" : "Sin validar"}</span>
                </div>
              </div>
              <div className="cc-route-card-base" style={{padding: "12px"}}>
                <p style={{margin: 0, fontSize: "11px", fontWeight: 700, color: "var(--cc-route-text)"}}>Clima de ruta</p>
                <select value={weatherComuna} onChange={(e) => setWeatherComuna(e.target.value)} style={{marginTop: "6px", height: "28px", borderRadius: "4px", border: "1px solid var(--cc-route-input-border)", background: "var(--cc-route-input-bg)", padding: "0 8px", fontSize: "10px", fontWeight: 600, color: "var(--cc-route-text)", outline: "none", width: "100%"}}>
                  {KNOWN_COMUNAS.map((k) => <option key={k.name} value={k.name}>{k.name}</option>)}
                </select>
                {weatherLoading ? <p style={{margin: "6px 0 0 0", fontSize: "10px", color: "var(--cc-route-muted)"}}><span style={{color: "#06b6d4"}}>⟳</span> Consultando...</p> : null}
                {weatherError ? <p style={{margin: "6px 0 0 0", fontSize: "10px", color: "#f97316"}}>⚠ {weatherError}</p> : null}
                {weatherSummary && !weatherLoading ? <div style={{marginTop: "6px", fontSize: "11px", color: "var(--cc-route-text)"}}>{weatherSummary.current?.temperature2m ?? weatherSummary.temperatureMax ?? "--"}°C</div> : null}
              </div>
            </div>
          ) : null}

          {message || redZonesError || optimizedRoute ? (
            <div className="cc-route-card-base" style={{marginTop: "8px", padding: "10px 16px"}}>
              {message ? <p style={{margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--cc-route-text)"}}>{message}</p> : null}
              {optimizedRoute ? <p style={{margin: "4px 0 0 0", fontSize: "11px", fontWeight: 600, color: "#60a5fa"}}>Distancia {formatDistance(optimizedRoute.distance_m)} &middot; Conducción {formatDuration(getRouteTravelDuration(optimizedRoute))} &middot; Atención {formatDuration(getRouteServiceDuration(optimizedRoute))} &middot; Total {formatDuration(optimizedRoute.duration_s)}</p> : null}
              {redZonesError ? <p style={{margin: "4px 0 0 0", fontSize: "11px", fontWeight: 600, color: "#f97316"}}>{redZonesError}</p> : null}
            </div>
          ) : null}
        </>
      ) : (
        /* Territory tab */
        <div className="cc-route-territorial-view">
          <div className="cc-route-map-card cc-route-territorial-map-card">
              <div className="cc-route-territorial-toolbar" style={{padding: "12px 16px", borderBottom: "1px solid var(--cc-route-border-subtle)"}}>
                <h3 style={{margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--cc-route-text)"}}>Mapa territorial</h3>
              </div>
              <div className="cc-route-territorial-map-shell">
                <div className="cc-route-territorial-map">
                  <MapContainer center={[-33.45, -70.66]} className="cc-route-territorial-leaflet h-full w-full" preferCanvas scrollWheelZoom zoom={11} zoomControl={false} style={{height: "100%", width: "100%"}}>
                    <ZoomControl position="topleft" />
                    <StartPointPicker enabled={selectingStartPoint} onPick={pickStartPoint} />
                    <RedZoneMapPicker enabled={redZonePicking} onPick={pickRedZoneCenter} />
                    <RouteMapBounds points={boundsPoints} />
                    <SelectedRedZoneFocus zone={redZoneDraft} />
                    <BaseMapLayers>
                      <ActiveRedZonesLayers onSelect={selectRedZone} redZoneMode="manage" selectedZoneId={selectedRedZoneId} zones={activeRedZones} />
                      {redZones ? (
                        <LayersControl.Overlay name="Zonas rojas históricas">
                          <GeoJSON data={redZones} style={RED_ZONE_STYLE} onEachFeature={onEachHistoricalZone} />
                        </LayersControl.Overlay>
                      ) : null}
                      {optimizedLine.length > 1 || (optimizedLine.length === 0 && stopPoints.length > 1) ? (
                        <LayersControl.Overlay checked name="Ruta optimizada">
                          <LayerGroup>
                            <Polyline positions={optimizedLine.length > 1 ? optimizedLine : stopPoints} pathOptions={{ color: '#0f5fcf', weight: optimizedLine.length > 1 ? 5 : 4, opacity: optimizedLine.length > 1 ? 0.82 : 0.72 }} />
                          </LayerGroup>
                        </LayersControl.Overlay>
                      ) : null}
                      {stops.length > 0 ? (
                        <LayersControl.Overlay checked name="Paradas / tickets">
                          <LayerGroup>
                            {stops.map((stop, index) =>
                              Number.isFinite(stop.lat) && Number.isFinite(stop.lng) ? (
                                <CircleMarker key={stop.id} center={[stop.lat!, stop.lng!]} radius={9}
                                  pathOptions={{ color: '#ffffff', fillColor: stop.isRedZone ? '#ef4444' : stop.status === 'exitosa' ? '#10b981' : stop.status === 'no_exitosa' ? '#ef4444' : '#f59e0b', fillOpacity: 0.85, weight: 2 }}>
                                  <Popup><strong>{index + 1}. {stop.clientName}</strong><br />Ref: {stop.referencia}<br />Estado: {STATUS_LABELS[stop.status]}</Popup>
                                </CircleMarker>
                              ) : null
                            )}
                          </LayerGroup>
                        </LayersControl.Overlay>
                      ) : null}
                    </BaseMapLayers>
                    {selectedStartPoint ? (
                      <CircleMarker center={[selectedStartPoint.lat, selectedStartPoint.lon]} radius={11}
                        pathOptions={{ color: '#ffffff', fillColor: '#10b981', fillOpacity: 0.95, weight: 3 }}>
                        <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>Inicio de ruta</Tooltip>
                        <Popup><strong>Punto de inicio</strong><br />{selectedStartPoint.label}</Popup>
                      </CircleMarker>
                    ) : null}
                  </MapContainer>
                </div>
              </div>
              {/* Map legend */}
              <div style={{padding: "8px 16px", borderTop: "1px solid var(--cc-route-border-subtle)", display: "flex", gap: "16px", fontSize: "10px", fontWeight: 600, color: "var(--cc-route-muted)"}}>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block"}} /> Inicio</span>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block"}} /> Paradas</span>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block"}} /> Zonas rojas</span>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 16, height: 2, background: "#0f5fcf", display: "inline-block"}} /> Ruta optimizada</span>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block"}} /> Exitosa</span>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block"}} /> No exitosa</span>
                <span style={{display: "flex", alignItems: "center", gap: "4px"}}><span style={{width: 8, height: 8, borderRadius: "50%", background: "var(--cc-route-soft)", display: "inline-block"}} /> Pendiente</span>
              </div>
            </div>
        </div>

      )}
    </div>
  );
}







