import { CalendarDays, ChevronDown, Download, Loader2, MapPin, Route, Save, Search, Trash2, UserRound } from 'lucide-react';
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

const formatLiters = (liters: number) => `${liters.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;

const formatClp = (value: number) => value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });


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
  const importedEligibleCount = importedReclamos.length;

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
    <div className="cc-route-daily-premium grid gap-4">
      <style>{`
        .cc-route-daily-premium { color: #0f172a; }
        .dark .cc-route-daily-premium { color: #e2e8f0; }
        .cc-route-daily-premium .cc-route-card,
        .cc-route-daily-premium .route-daily-shell-pro,
        .cc-route-daily-premium .route-territory-toolbar-pro,
        .cc-route-daily-premium .route-territory-concentration-pro,
        .cc-route-daily-premium .route-territory-layer-panel-pro {
          background: #ffffff !important;
          border-color: #e2e8f0 !important;
          color: #0f172a !important;
          border-radius: 16px !important;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
        }
        .dark .cc-route-daily-premium .cc-route-card,
        .dark .cc-route-daily-premium .route-daily-shell-pro,
        .dark .cc-route-daily-premium .route-territory-toolbar-pro,
        .dark .cc-route-daily-premium .route-territory-concentration-pro,
        .dark .cc-route-daily-premium .route-territory-layer-panel-pro {
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(13, 19, 36, 0.98)) !important;
          border-color: #22304d !important;
          color: #e2e8f0 !important;
          box-shadow: 0 18px 44px rgba(2, 6, 23, 0.24);
        }
        .cc-route-daily-premium h2,
        .cc-route-daily-premium h3,
        .cc-route-daily-premium h4,
        .cc-route-daily-premium .text-white,
        .cc-route-daily-premium .text-slate-100,
        .cc-route-daily-premium .cc-text,
        .cc-route-daily-premium .cc-route-ticket-header,
        .cc-route-daily-premium .cc-route-weather-condition {
          color: #0f172a !important;
        }
        .dark .cc-route-daily-premium h2,
        .dark .cc-route-daily-premium h3,
        .dark .cc-route-daily-premium h4,
        .dark .cc-route-daily-premium .text-white,
        .dark .cc-route-daily-premium .text-slate-100,
        .dark .cc-route-daily-premium .cc-text,
        .dark .cc-route-daily-premium .cc-route-ticket-header,
        .dark .cc-route-daily-premium .cc-route-weather-condition {
          color: #f8fafc !important;
        }
        .cc-route-daily-premium p,
        .cc-route-daily-premium .text-[var(--text-main)],
        .cc-route-daily-premium .text-[var(--cc-muted)],
        .cc-route-daily-premium .cc-route-subtitle,
        .cc-route-daily-premium .cc-route-stop-meta,
        .cc-route-daily-premium .cc-text-secondary {
          color: #64748b !important;
        }
        .dark .cc-route-daily-premium p,
        .dark .cc-route-daily-premium .text-[var(--text-main)],
        .dark .cc-route-daily-premium .text-[var(--cc-muted)],
        .dark .cc-route-daily-premium .cc-route-subtitle,
        .dark .cc-route-daily-premium .cc-route-stop-meta,
        .dark .cc-route-daily-premium .cc-text-secondary {
          color: #94a3b8 !important;
        }
        .cc-route-daily-premium input,
        .cc-route-daily-premium textarea,
        .cc-route-daily-premium select,
        .cc-route-daily-premium .cc-route-input {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #0f172a !important;
        }
        .dark .cc-route-daily-premium input,
        .dark .cc-route-daily-premium textarea,
        .dark .cc-route-daily-premium select,
        .dark .cc-route-daily-premium .cc-route-input {
          background: rgba(15, 23, 42, 0.86) !important;
          border-color: #22304d !important;
          color: #f8fafc !important;
        }
        .cc-route-daily-premium input::placeholder,
        .cc-route-daily-premium textarea::placeholder { color: #94a3b8 !important; }
        .dark .cc-route-daily-premium input::placeholder,
        .dark .cc-route-daily-premium textarea::placeholder { color: #64748b !important; }
        .cc-route-daily-premium .route-map-section-pro .cc-route-map-compact { min-height: 360px; }
        .cc-route-daily-premium table thead { background: #f1f5f9; }
        .dark .cc-route-daily-premium table thead { background: rgba(2, 6, 23, 0.58); }
        .cc-route-daily-premium .cc-list-card-pro { background: #f8fafc; }
        .dark .cc-route-daily-premium .cc-list-card-pro { background: rgba(15, 23, 42, 0.38); }
        .cc-route-daily-premium .bg-slate-950\/70,
        .cc-route-daily-premium .bg-slate-950\/80,
        .cc-route-daily-premium .bg-slate-950\/95,
        .cc-route-daily-premium .bg-[var(--bg-card)]\/80 { background: #f8fafc !important; }
        .dark .cc-route-daily-premium .bg-slate-950\/70,
        .dark .cc-route-daily-premium .bg-slate-950\/80,
        .dark .cc-route-daily-premium .bg-slate-950\/95,
        .dark .cc-route-daily-premium .bg-[var(--bg-card)]\/80 { background: rgba(15, 23, 42, 0.82) !important; }
        .cc-route-daily-premium .border-[var(--border-main)],
        .cc-route-daily-premium .border-[var(--border-main)],
        .cc-route-daily-premium .divide-slate-800 > :not([hidden]) ~ :not([hidden]) { border-color: #cbd5e1 !important; }
        .dark .cc-route-daily-premium .border-[var(--border-main)],
        .dark .cc-route-daily-premium .border-[var(--border-main)],
        .dark .cc-route-daily-premium .divide-slate-800 > :not([hidden]) ~ :not([hidden]) { border-color: #334155 !important; }
        .cc-route-daily-premium button.text-white,
        .cc-route-daily-premium a.text-white { color: #ffffff !important; }
      `}</style>
      <RutaPanel className="route-daily-shell-pro rounded-xl border p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <p className="cc-route-label text-xs">Ruta diaria</p>
            <h2 className="mt-1 text-2xl font-black text-white">Ruta diaria</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--cc-muted)]">Planificación operativa, visitas y seguimiento en terreno</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[360px]">
            {([
              { id: 'operation' as const, label: 'Operación diaria' },
              { id: 'territory' as const, label: 'Mapa territorial' },
            ]).map((tab) => (
              <button
                key={tab.id}
                aria-pressed={activeRouteTab === tab.id}
                className={`h-11 rounded-lg border px-4 text-sm font-black transition ${activeRouteTab === tab.id ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-950/30' : 'border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--cc-muted)] hover:bg-[var(--bg-main)] hover:text-[var(--text-main)] dark:border-[var(--border-main)] dark:bg-[var(--bg-card)] dark:text-[var(--text-main)] dark:hover:bg-[var(--bg-card)] dark:hover:text-white'}`}
                onClick={() => setActiveRouteTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </RutaPanel>

      {activeRouteTab === 'operation' ? (
        <>
      {/* TOP CONFIG — collapsible */}
      <RutaPanel className="p-3">
        <button
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setConfigPanelOpen(prev => !prev)}
          type="button"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{background:"rgba(34,211,238,0.09)",color:"var(--cc-cyan, #0891b2)"}}>
              <Route size={16} />
            </span>
            <span className="text-sm font-black text-[var(--text-main)]">Configuración de ruta</span>
            <span className="text-[10px] font-bold text-[var(--cc-muted)]">{configPanelOpen ? 'Ocultar' : 'Mostrar'} · Visitador, fechas, inicio, params</span>
          </div>
          <ChevronDown size={16} className={`text-[var(--cc-muted)] transition-transform ${configPanelOpen ? 'rotate-180' : ''}`} />
        </button>
        {configPanelOpen ? (
        <div className="mt-3 grid gap-3 xl:grid-cols-[280px_1fr_280px]">
        <RutaPanel className="route-calendar-card-pro cc-route-calendar-zone rounded-xl border p-4">
          <RouteMonthCalendar
            selectedDate={fechaVisita}
            onSelectDate={(d) => { setFechaVisita(d); }}
            visitsByDate={visitsByDate}
          />
        </RutaPanel>

        <RutaPanel className="route-hero-pro cc-route-ticket-primary rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{background:"rgba(34,211,238,0.09)",color:"var(--cc-cyan, #0891b2)"}}>
              <Route size={18} />
            </span>
            <h2 className="route-hero-header-pro cc-route-ticket-header text-base font-black">Configuraci&oacute;n de ruta</h2>
            <span className="cc-route-badge shrink-0">Operaci&oacute;n diaria</span>
          </div>
          <p className="cc-route-subtitle mb-3 text-xs">Define visitador, fechas, punto de inicio y par&aacute;metros operativos para la jornada seleccionada.</p>
          {importedEligibleCount > 0 ? (
            <p className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
              Reclamos importados elegibles disponibles como contexto: {importedEligibleCount.toLocaleString('es-CL')}. La ruta mantiene búsqueda/CRM como fuente de paradas.
            </p>
          ) : null}
          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-main)]">
              <UserRound size={15} />
              Visitador
            </span>
            <input
              className="h-10 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              aria-label="Nombre del visitador"
              onChange={(event) => setVisitador(event.target.value)}
              value={visitador}
            />
          </label>

          <div className="route-hero-grid-pro grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-main)]">
                <CalendarDays size={15} />
                Fecha de carga
              </span>
              <input
                className="h-10 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setFechaCarga(event.target.value)}
                type="date"
                value={fechaCarga}
              />
            </label>
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-main)]">
                <CalendarDays size={15} />
                Fecha de visita
              </span>
              <input
                className="h-10 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setFechaVisita(event.target.value)}
                type="date"
                value={fechaVisita}
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-main)]">
              <MapPin size={15} />
              Punto de inicio
            </span>
            <input
              className="h-10 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              aria-label="Punto de inicio"
              onChange={(event) => {
                setStartPoint(event.target.value);
                setSelectedStartPoint(null);
                setSelectingStartPoint(false);
                setOptimizedRoute(null);
              }}
              value={startPoint}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`h-9 rounded-lg px-3 text-xs font-bold transition ${
                selectingStartPoint ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
              onClick={() => {
                setSelectingStartPoint(true);
                setMessage('Haz click en el mapa para definir el punto de partida');
              }}
              type="button"
            >
              Seleccionar en mapa
            </button>
            <button
              className="h-9 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-xs font-bold text-[var(--text-main)] transition hover:bg-[var(--bg-main)] disabled:opacity-60"
              disabled={!selectedStartPoint && !startPoint}
              onClick={clearStartPoint}
              type="button"
            >
              Limpiar inicio
            </button>
          </div>
          <span
            className={`w-fit rounded-md px-2 py-1 text-xs font-bold ${
              selectingStartPoint
                ? 'bg-amber-50 text-amber-700'
                : selectedStartPoint
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-[var(--bg-card)] text-[var(--cc-muted)]'
            }`}
          >
            {selectingStartPoint ? 'Selecciona punto en el mapa' : selectedStartPoint ? 'Inicio validado' : 'Inicio sin validar'}
          </span>

          <label className="grid gap-2">
            <span className="text-xs font-bold text-[var(--text-main)]">Minutos por visita</span>
            <input
              className="h-10 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              min={10}
              onChange={(event) => setServiceMinutesPerStop(Math.max(Number(event.target.value) || 10, 10))}
              type="number"
              value={serviceMinutesPerStop}
            />
            <span className="text-xs font-medium text-[var(--cc-muted)]">Se suma por cada parada, no incluye el punto de inicio.</span>
          </label>

          <div className="route-hero-grid-pro grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-bold text-[var(--text-main)]">Rendimiento km/L</span>
              <input
                className="h-10 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                min={1}
                onChange={(event) => setFuelEfficiency(Math.max(Number(event.target.value) || 1, 1))}
                step="0.1"
                type="number"
                value={fuelEfficiency}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold text-[var(--text-main)]">Precio combustible</span>
              <input
                className="h-10 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-sm font-medium text-[var(--text-main)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                min={0}
                onChange={(event) => setFuelPrice(Math.max(Number(event.target.value) || 0, 0))}
                step={10}
                type="number"
                value={fuelPrice}
              />
            </label>
          </div>
        </RutaPanel>
        {/* Weather card - enhanced */}
        <RutaPanel className="route-weather-compact-pro cc-route-weather-hero rounded-xl border p-2">
          <div className="route-weather-header-pro flex items-center gap-2 mb-2">
            <span className="cc-route-label text-[10px] font-bold">Clima de ruta</span>
            <span className="cc-route-badge" style={{fontSize:"0.5rem"}}>{weatherSummary?.source === 'openweather' ? 'OpenWeather' : weatherSummary?.source === 'open-meteo' ? 'Open-Meteo' : weatherSummary?.source === 'meteochile' ? 'MeteoChile' : 'Sin datos'}</span>
            <select className="cc-route-input h-6 w-auto max-w-[120px] px-1 text-[9px] font-bold rounded-lg border" value={weatherComuna} onChange={(e) => setWeatherComuna(e.target.value)}>
              {KNOWN_COMUNAS.map((k) => <option key={k.name} value={k.name}>{k.name}</option>)}
            </select>
          </div>
          {weatherLoading ? <p className="cc-route-stop-meta text-[10px]"><span style={{color:'var(--cc-cyan,#0891b2)'}}>⟳</span> Consultando...</p> : null}
          {weatherError ? <p className="cc-route-stop-meta text-[10px] leading-tight"><span style={{color:'var(--cc-orange,#f97316)'}}>⚠</span> {weatherError}</p> : null}
          {weatherSummary && !weatherLoading ? (
            <div className="route-weather-content-pro flex flex-wrap items-center gap-2">
              <div className="route-weather-icon-pro cc-route-weather-avatar" data-tone={getWeatherPresentation(weatherSummary.weatherCode, weatherSummary.current?.isDay).tone}>
                {getWeatherPresentation(weatherSummary.weatherCode, weatherSummary.current?.isDay).icon}
              </div>
              <div className="cc-route-weather-main">
                <div className="route-weather-temp-pro cc-route-weather-condition text-base">{weatherSummary.current?.temperature2m ?? weatherSummary.temperatureMax ?? '--'}°C</div>
                <div className="text-[10px] font-semibold cc-text-secondary">{getWeatherPresentation(weatherSummary.weatherCode, weatherSummary.current?.isDay).label}</div>
              </div>
              <div className="route-weather-meta-pro cc-route-weather-metrics text-[10px]">
                {weatherSummary.current?.windSpeed10m != null ? <span>Viento {weatherSummary.current.windSpeed10m} km/h</span> : weatherSummary.windSpeedMax != null ? <span>Viento máx {weatherSummary.windSpeedMax} km/h</span> : null}
                {weatherSummary.current?.precipitation != null ? <span> · Lluvia {weatherSummary.current.precipitation} mm</span> : weatherSummary.precipitationSum != null ? <span> · Lluvia {weatherSummary.precipitationSum} mm</span> : null}
              </div>
              <span className={'route-weather-badge-pro cc-route-weather-alert ' + (weatherSummary.riskLevel === 'alto' ? 'cc-route-weather-alert-high' : weatherSummary.riskLevel === 'precaucion' ? 'cc-route-weather-alert-warning' : 'cc-route-weather-alert-normal')}>
                {weatherSummary.riskLevel === 'alto' ? '⚠️ Alto' : weatherSummary.riskLevel === 'precaucion' ? '⚡ Precaución' : '✅ Normal'}
              </span>
            </div>
          ) : null}
        </RutaPanel>
        </div>
        ) : null}
      </RutaPanel>
      {/* END collapsible config */}

      {/* Ticket controls — compact row */}
      <RutaPanel className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="cc-route-segmented flex rounded-lg border">
            <button aria-pressed={searchMode === 'ticket'} className={`px-3 h-8 rounded-md text-xs font-bold transition ${searchMode === 'ticket' ? 'bg-blue-600 text-white' : 'text-[var(--cc-muted)] hover:text-[var(--text-main)]'}`} onClick={() => setSearchMode('ticket')} type="button">Por Ticket</button>
            <button aria-pressed={searchMode === 'rut'} className={`px-3 h-8 rounded-md text-xs font-bold transition ${searchMode === 'rut' ? 'bg-blue-600 text-white' : 'text-[var(--cc-muted)] hover:text-[var(--text-main)]'}`} onClick={() => setSearchMode('rut')} type="button">Por RUT</button>
          </div>
          <form className="flex gap-2 min-w-0 flex-1" onSubmit={(event) => { event.preventDefault(); void handleSearch(); }}>
            <input className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-main)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" aria-label={searchMode === 'ticket' ? 'ID ticket' : 'RUT'} placeholder={searchMode === 'ticket' ? 'Ej: FAC-4821' : 'Ej: 12.345.678-9'} onChange={(event) => setSearchValue(event.target.value)} value={searchValue} />
            <button className="flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg bg-[#0f5fcf] px-3 text-xs font-black text-white transition hover:bg-[#0d47a1] disabled:opacity-60" disabled={loading} type="submit" aria-label="Buscar">{loading ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}<span>Agregar</span></button>
          </form>
          <span className="text-xs font-bold text-[var(--cc-muted)]">|</span>
          <button className="h-8 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-xs font-bold text-[var(--text-main)] transition hover:bg-[var(--bg-main)] disabled:opacity-60" onClick={() => setShowBulkInput(prev => !prev)} type="button">Carga masiva</button>
          <input className="h-8 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-2 text-xs font-bold text-[var(--text-main)] outline-none" type="date" value={fechaVisita} onChange={(e) => setFechaVisita(e.target.value)} />
          <button className="flex h-8 items-center justify-center gap-1 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-2 text-xs font-bold text-[var(--text-main)] transition hover:bg-[var(--bg-main)] disabled:opacity-60" disabled={stops.length === 0} onClick={exportCsv} type="button"><Download size={13} /></button>
          <button className="flex h-8 items-center justify-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60" disabled={stops.length === 0} onClick={clearStops} type="button"><Trash2 size={13} /></button>
        </div>
        {showBulkInput ? (
          <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); const ids = parseTicketIds(bulkTicketIds); setBulkTicketIds(''); void addTicketIds(ids); }}>
            <textarea className="h-16 min-w-0 flex-1 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-2 py-1 text-xs font-medium text-[var(--text-main)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" aria-label="Carga masiva de tickets" placeholder="IDs separados por coma, punto y coma o salto de línea..." onChange={(event) => setBulkTicketIds(event.target.value)} value={bulkTicketIds} />
            <button className="flex h-16 shrink-0 items-center justify-center gap-1 rounded-lg bg-[#0f5fcf] px-3 text-xs font-black text-white transition hover:bg-[#0d47a1] disabled:opacity-60" disabled={loading} type="submit"><span>Cargar</span></button>
          </form>
        ) : null}
      </RutaPanel>

      {/* Actions — compact row */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60" disabled={saving || stops.length === 0 || !visitador.trim()} onClick={() => void saveDailyVisits()} type="button">{saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
            Guardar visitas
          </button>
          <button className="flex h-8 items-center justify-center gap-1 rounded-lg bg-[#0f5fcf] px-3 text-xs font-bold text-white transition hover:bg-[#0d47a1] disabled:opacity-60" disabled={stops.length === 0 || optimizing || !startPoint.trim()} onClick={optimizeRoute} type="button">
            {optimizing ? <Loader2 className="animate-spin" size={13} /> : <Route size={13} />}
            Optimizar ruta
          </button>
          <button className="flex h-8 items-center justify-center gap-1 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-xs font-bold text-[var(--text-main)] transition hover:bg-[var(--bg-main)] disabled:opacity-60" disabled={stops.length === 0} onClick={exportCsv} type="button">
            <Download size={13} />
            Exportar CSV
          </button>
          <button className="flex h-8 items-center justify-center gap-1 rounded-lg border border-red-100 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60" disabled={stops.length === 0} onClick={clearStops} type="button">
            <Trash2 size={13} />
            Limpiar tickets
          </button>
        </div>
      {/* END aside (removed in restructure) */}

      {/* KPI row — 4 cards responsive */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <RutaMetricCard label="Visitas planificadas" value={summary.ticketsToday.toLocaleString('es-CL')} subtitle="Total del día" icon={<CalendarDays size={18} />} tone="blue" />
          <RutaMetricCard label="Visitas completadas" value={summary.successful.toLocaleString('es-CL')} subtitle="Gestionadas" icon={<Save size={18} />} tone="green" />
          <RutaMetricCard label="% Cumplimiento" value={`${routeCompletionPct.toLocaleString('es-CL')}%`} subtitle="Efectividad" icon={<Route size={18} />} tone="blue" />
          <RutaMetricCard label="Reclamos del día" value={routeClaimsToday.toLocaleString('es-CL')} subtitle="En ruta" icon={<Search size={18} />} tone="red" />
        </section>

        {message || redZonesError || optimizedRoute ? (
          <RutaPanel className="p-3">
            {message ? <p className="text-sm font-semibold text-[var(--text-main)]">{message}</p> : null}
            {optimizedRoute ? (
              <p className="mt-1 text-xs font-semibold text-blue-700">
                Distancia total {formatDistance(optimizedRoute.distance_m)} · Tiempo conducción {formatDuration(getRouteTravelDuration(optimizedRoute))} · Tiempo atención {formatDuration(getRouteServiceDuration(optimizedRoute))} · Tiempo total estimado {formatDuration(optimizedRoute.duration_s)}
              </p>
            ) : null}
            {redZonesError ? <p className="mt-1 text-xs font-semibold cc-orange">{redZonesError}. La vista sigue funcionando con el estado de zona roja informado por backend.</p> : null}
          </RutaPanel>        ) : null}
        </>
      ) : (
        <RutaPanel className="route-territory-toolbar-pro rounded-xl border p-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
            <div>
              <p className="cc-route-label text-xs">Mapa territorial</p>
              <h3 className="mt-1 text-xl font-black text-white">Cobertura territorial de visitas</h3>
              <p className="mt-1 text-sm font-semibold text-[var(--cc-muted)]">Busca y revisa concentración por comuna con las visitas cargadas.</p>
              <label className="mt-4 flex h-12 items-center gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] px-4">
                <Search size={18} className="text-[var(--cc-muted)]" />
                <input
                  aria-label="Buscar dirección, ticket o comuna"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-[var(--cc-muted)]"
                  onChange={(event) => setTerritorialSearch(event.target.value)}
                  placeholder="Buscar dirección, ticket o comuna..."
                  value={territorialSearch}
                />
              </label>
            </div>
            <div className="grid gap-3">
              <p className="cc-route-label text-xs">Capas activas</p>
              <div className="grid grid-cols-2 gap-2">
                {['Visitas', 'Heatmap', 'Zonas rojas', 'Comunas'].map((layer) => (
                  <span key={layer} className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-3 py-2 text-xs font-black text-[var(--text-main)]">
                    {layer}
                  </span>
                ))}
              </div>
              <p className="text-xs font-semibold text-[var(--cc-muted)]">Heatmap usa soporte disponible de puntos/capas existentes; sin datos cargados no dibuja puntos.</p>
            </div>
          </div>
        </RutaPanel>
      )}


      <RutaPanel className="route-map-section-pro overflow-hidden">
          <div className="border-b border-[var(--border-main)] px-4 py-3">
            <h3 className="text-base font-bold text-[var(--text-main)]">Mapa de ruta</h3>
          </div>
          <div className="cc-route-map-compact relative overflow-hidden rounded-xl" style={{minHeight:"360px", maxHeight:"420px"}}>
            <MapContainer center={[-33.45, -70.66]} className="h-full w-full" preferCanvas scrollWheelZoom zoom={11} zoomControl={false}>
              <ZoomControl position="topleft" />
              <StartPointPicker enabled={selectingStartPoint} onPick={pickStartPoint} />
              <RedZoneMapPicker enabled={redZonePicking} onPick={pickRedZoneCenter} />
              <RouteMapBounds points={boundsPoints} />
              <SelectedRedZoneFocus zone={redZoneDraft} />
              <BaseMapLayers>
                <ActiveRedZonesLayers onSelect={selectRedZone} redZoneMode="manage" selectedZoneId={selectedRedZoneId} zones={activeRedZones} />
                {redZones ? (
                  <LayersControl.Overlay name="Zonas rojas históricas">
                    <GeoJSON
                      data={redZones}
                      style={RED_ZONE_STYLE}
                      onEachFeature={onEachHistoricalZone}
                    />
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
                          <CircleMarker
                            key={stop.id}
                            center={[stop.lat as number, stop.lng as number]}
                            pathOptions={{
                              color: '#ffffff',
                              fillColor: stop.isRedZone ? '#ef4444' : stop.status === 'exitosa' ? '#10b981' : stop.status === 'no_exitosa' ? '#ef4444' : '#f59e0b',
                              fillOpacity: 0.85,
                              weight: 2,
                            }}
                            radius={9}
                          >
                            <Popup>
                              <strong>
                                {index + 1}. {stop.clientName}
                              </strong>
                              <br />
                              Ref: {stop.referencia}
                              <br />
                              Estado: {STATUS_LABELS[stop.status]}
                            </Popup>
                          </CircleMarker>
                        ) : null,
                      )}
                    </LayerGroup>
                  </LayersControl.Overlay>
                ) : null}
              </BaseMapLayers>
              {selectedStartPoint ? (
                <CircleMarker
                  center={[selectedStartPoint.lat, selectedStartPoint.lon]}
                  pathOptions={{
                    color: '#ffffff',
                    fillColor: '#10b981',
                    fillOpacity: 0.95,
                    weight: 3,
                  }}
                  radius={11}
                >
                  <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                    Inicio de ruta
                  </Tooltip>
                  <Popup>
                    <strong>Punto de inicio</strong>
                    <br />
                    {selectedStartPoint.label}
                  </Popup>
                </CircleMarker>
              ) : null}
            </MapContainer>
            {redZonePanelOpen ? (
              <div className="absolute left-4 right-4 top-16 z-[500] max-h-[70%] overflow-y-auto rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xl md:left-auto md:right-4 md:w-[320px] md:max-h-[85%]">
                <div className="sticky top-0 border-b border-[var(--border-main)] bg-[var(--bg-card)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-[var(--text-main)]">Zonas rojas</p>
                      <p className="mt-1 text-[11px] font-medium text-[var(--cc-muted)]">Activas en PostgreSQL y capa histórica solo de referencia.</p>
                    </div>
                    <button className="rounded-md border border-[var(--border-main)] px-2 py-1 text-[11px] font-bold text-[var(--text-main)] hover:bg-[var(--bg-main)]" onClick={() => setRedZonePanelOpen(false)} type="button">
                      Ocultar
                    </button>
                  </div>
                  <button
                    className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-bold text-white transition hover:bg-red-700"
                    onClick={() => {
                      const newDraft = createEmptyRedZoneDraft();
                      newDraft.lat = activeRedZones.length > 0 ? activeRedZones[0].lat : null;
                      newDraft.lon = activeRedZones.length > 0 ? activeRedZones[0].lon : null;
                      setRedZoneDraft(newDraft);
                      setRedZonePicking(true);
                      setMessage('Haz clic en el mapa para definir el centro de la nueva zona roja');
                    }}
                    type="button"
                  >
                    + Nueva zona roja
                  </button>
                </div>
                <div className="p-4">
                  {activeRedZones.length > 0 ? (
                    <div className="grid gap-2">
                      {activeRedZones.map((zone) => (
                        <button
                          key={zone.id}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition ${selectedRedZoneId === zone.id ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-100' : 'border-[var(--border-main)] bg-[var(--bg-card)] hover:bg-[var(--bg-main)]'}`}
                          onClick={() => selectRedZone(zone)}
                          type="button"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[var(--text-main)]">{zone.name}</span>
                            <span className="rounded-md bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--text-main)]">{zone.severity}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-[var(--cc-muted)]">{zone.comuna || 'Sin comuna'} · {Math.round(zone.radius_m)} m</p>
                          <span className="mt-2 inline-flex text-[11px] font-bold text-blue-300">Editar</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <p className="pt-1 text-[11px] font-medium text-[var(--cc-muted)]">Zonas históricas: disponibles como capa de referencia en el selector de capas.</p>
                  <div className="mt-4 space-y-3 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] p-3" ref={redZoneFormRef}>
                    <p className="text-xs font-bold text-[var(--text-main)]">Nueva zona roja</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1 text-xs font-bold text-[var(--text-main)]">
                        Nombre
                        <input className="rounded-md border border-[var(--border-main)] bg-[var(--bg-card)] px-2 py-1 text-xs font-medium text-[var(--text-main)] outline-none" onChange={(e) => setRedZoneDraft(prev => prev ? {...prev, name: e.target.value} : null)} value={redZoneDraft?.name ?? ''} />
                      </label>
                      <label className="grid gap-1 text-xs font-bold text-[var(--text-main)]">
                        Comuna
                        <input className="rounded-md border border-[var(--border-main)] bg-[var(--bg-card)] px-2 py-1 text-xs font-medium text-[var(--text-main)] outline-none" onChange={(e) => setRedZoneDraft(prev => prev ? {...prev, comuna: e.target.value} : null)} value={redZoneDraft?.comuna ?? ''} />
                      </label>
                    </div>
                    <label className="grid gap-1 text-xs font-bold text-[var(--text-main)]">
                      Radio (m)
                      <input className="rounded-md border border-[var(--border-main)] bg-[var(--bg-card)] px-2 py-1 text-xs font-medium text-[var(--text-main)] outline-none" max={2000} min={50} onChange={(e) => setRedZoneDraft(prev => prev ? {...prev, radius_m: Number(e.target.value)} : null)} type="number" value={redZoneDraft?.radius_m ?? 350} />
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0f5fcf] px-3 text-xs font-bold text-white disabled:opacity-60"
                        disabled={redZoneSaving}
                        onClick={() => void saveRedZone()}
                        type="button"
                      >
                        {redZoneSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                className="absolute right-4 top-16 z-[500] rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] px-4 py-2 text-xs font-black text-[var(--text-main)] shadow-xl"
                onClick={() => setRedZonePanelOpen(true)}
                type="button"
              >
                Zonas rojas
              </button>
            )}
          </div>
        </RutaPanel>

        {/* Map legend */}
        <div className="flex flex-wrap items-center gap-4 px-1 py-2 text-[11px] font-semibold text-[var(--cc-muted)]">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Inicio</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> Paradas</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Zonas rojas</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-blue-500" /> Ruta optimizada</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" /> Exitosa</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> No exitosa</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" /> Pendiente</span>
        </div>

        {activeRouteTab === 'operation' ? (
        <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <RutaPanel className="route-stops-panel-pro overflow-hidden">
            <div className="border-b border-[var(--border-main)] px-4 py-3">
              <h3 className="text-base font-bold text-[var(--text-main)]">Visitas planificadas</h3>
              <p className="text-xs font-medium text-[var(--cc-muted)]">Marca resultado de visita, observación y revisión territorial.</p>
            </div>

            <div className="divide-y divide-slate-100">
              {stops.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm font-bold text-[var(--text-main)]">Sin tickets cargados</p>
                  <p className="mt-1 text-xs font-medium text-[var(--cc-muted)]">Busca por ticket, RUT o usa carga masiva para iniciar la ruta.</p>
                </div>
              ) : (
                stops.map((stop, index) => (
                  <article key={stop.id} className="cc-list-card-pro grid gap-2 p-3 lg:grid-cols-[minmax(0,1fr)_200px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-[var(--bg-card)] px-2 py-1 text-xs font-bold text-[var(--text-main)]">#{index + 1}</span>
                        <h4 className="truncate text-sm font-bold text-[var(--text-main)] max-w-[300px]" title={stop.clientName}>{stop.clientName}</h4>
                        <span className={`rounded-md border px-2 py-1 text-xs font-bold ${STATUS_CLASSES[stop.status]}`}>{STATUS_LABELS[stop.status]}</span>
                        {stop.isRedZone ? <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">Zona roja</span> : null}
                        {!Number.isFinite(stop.lat) || !Number.isFinite(stop.lng) ? <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Sin coord.</span> : null}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">
                        {stop.referencia} · Reclamos {stop.claimsCount.toLocaleString('es-CL')} · {stop.address ? <span className="line-clamp-1" title={stop.address}>{stop.address}</span> : 'Sin dirección'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="h-8 flex-1 min-w-[100px] rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-2 text-xs font-bold text-[var(--text-main)] outline-none"
                        onChange={(event) => updateStopStatus(stop.id, event.target.value as RutaVisitStatus)}
                        value={stop.status}
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="exitosa">Exitosa</option>
                        <option value="no_exitosa">No exitosa</option>
                      </select>
                      <span className="text-xs font-bold text-[var(--cc-muted)] whitespace-nowrap">
                        {calculateStopValue(stop.status, stops.length).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
                      </span>
                      <button className="flex h-8 items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2 text-xs font-bold text-red-700 hover:bg-red-100" onClick={() => removeStop(stop.id)} type="button">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </RutaPanel>

          <RutaPanel className="route-totals-panel-pro self-start p-4">
            <h3 className="text-base font-bold text-[var(--text-main)]">Valorización del día</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-medium text-[var(--cc-muted)]">Tramo actual</span>
                <span className="font-bold text-[var(--text-main)]">{stops.length >= 13 ? '13 o más tickets' : 'Menos de 13 tickets'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-medium text-[var(--cc-muted)]">Tarifa exitosa</span>
                <span className="font-bold text-emerald-700">{fares.successful.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-medium text-[var(--cc-muted)]">Tarifa no exitosa</span>
                <span className="font-bold text-red-700">{fares.unsuccessful.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</span>
              </div>
              {optimizedRoute ? (
                <div className="border-t border-[var(--border-main)] pt-3">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium text-[var(--cc-muted)]">Kilómetros totales</span>
                    <span className="font-bold text-blue-700">{routeFuelSummary ? formatKilometers(routeFuelSummary.totalKm) : formatDistance(optimizedRoute.distance_m)}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="font-medium text-[var(--cc-muted)]">Tiempo conducción</span>
                    <span className="font-bold text-blue-700">{formatDuration(getRouteTravelDuration(optimizedRoute))}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="font-medium text-[var(--cc-muted)]">Tiempo atención</span>
                    <span className="font-bold text-blue-700">{formatDuration(getRouteServiceDuration(optimizedRoute))}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="font-medium text-[var(--cc-muted)]">Tiempo total estimado</span>
                    <span className="font-bold text-blue-700">{formatDuration(optimizedRoute.duration_s)}</span>
                  </div>
                  {routeFuelSummary ? (
                    <>
                      <div className="mt-2 flex justify-between gap-3">
                        <span className="font-medium text-[var(--cc-muted)]">Litros estimados</span>
                        <span className="font-bold text-blue-700">{formatLiters(routeFuelSummary.estimatedLiters)}</span>
                      </div>
                      <div className="mt-2 flex justify-between gap-3">
                        <span className="font-medium text-[var(--cc-muted)]">Costo combustible</span>
                        <span className="font-bold text-blue-700">{formatClp(routeFuelSummary.estimatedFuelCost)}</span>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
              <div className="border-t border-[var(--border-main)] pt-3">
                <div className="flex justify-between gap-3">
                  <span className="font-bold text-[var(--text-main)]">Total valorizado</span>
                  <span className="font-extrabold text-[var(--text-main)]">{summary.totalValued.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
          </RutaPanel>
        </section>
        ) : (
          <section className="route-territory-panels-pro grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <RutaPanel className="route-territory-concentration-pro overflow-hidden rounded-xl border">
              <div className="border-b border-[var(--border-main)] px-4 py-3">
                <h3 className="text-base font-bold text-white">Panel de concentración por comuna</h3>
                <p className="text-xs font-medium text-[var(--cc-muted)]">Derivado desde coordenadas y capa comunal existente.</p>
              </div>
              <div className="divide-y divide-slate-800">
                {visibleTerritorialConcentration.length > 0 ? visibleTerritorialConcentration.map((item) => (
                  <article key={item.comuna} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-black text-white">{item.comuna}</h4>
                      <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">{item.completadas} completadas · {item.pendientes} pendientes · {item.zonasRojas} zonas rojas</p>
                    </div>
                    <span className="rounded-lg bg-blue-500/15 px-3 py-2 text-sm font-black text-blue-200">{item.visitas}</span>
                  </article>
                )) : (
                  <div className="p-6 text-center text-sm font-bold text-[var(--cc-muted)]">Sin visitas georreferenciadas para mostrar concentración.</div>
                )}
              </div>
            </RutaPanel>

            <RutaPanel className="route-territory-layer-panel-pro self-start rounded-xl border p-4">
              <h3 className="text-base font-bold text-white">Panel de capas activas</h3>
              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex justify-between gap-3"><span className="font-medium text-[var(--cc-muted)]">Visitas cargadas</span><span className="font-black text-white">{stops.length.toLocaleString('es-CL')}</span></div>
                <div className="flex justify-between gap-3"><span className="font-medium text-[var(--cc-muted)]">Con coordenadas</span><span className="font-black text-white">{stopPoints.length.toLocaleString('es-CL')}</span></div>
                <div className="flex justify-between gap-3"><span className="font-medium text-[var(--cc-muted)]">Zonas rojas activas</span><span className="font-black text-red-300">{activeRedZones.length.toLocaleString('es-CL')}</span></div>
                <div className="flex justify-between gap-3"><span className="font-medium text-[var(--cc-muted)]">Comunas detectadas</span><span className="font-black text-white">{territorialConcentration.length.toLocaleString('es-CL')}</span></div>
              </div>
            </RutaPanel>
          </section>
        )}
      {/* END main (removed in restructure) */}
    </div>
  );
}





