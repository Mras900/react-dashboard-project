import { CalendarDays, Download, Loader2, MapPin, Route, Save, Search, Trash2, UserRound } from 'lucide-react';
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
import { upsertRouteDailyVisit, saveRouteDailyVisits, dispatchRouteDailyUpdate, getRouteDailyVisits } from './routeDailyStorage';
import type { RouteDailyVisit } from './routeDailyStorage';
import { fetchRouteWeather, getWeatherEmoji, getWeatherPresentation, KNOWN_COMUNAS } from './routeWeatherService';
import type { RouteWeatherSummary } from './routeWeatherTypes';

type SearchMode = 'ticket' | 'rut';

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
  'h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30';

const redZoneTextareaClass =
  'min-h-16 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30';

const CHILE_COMUNAS_LAYER_PATH = '/data/map-layers/chile_comunas_simplified.geojson';

function RutaPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`cc-route-card rounded-xl border ${className}`}>{children}</section>;
}

function RutaMetricCard({ label, value, tone = 'blue' }: { label: string; value: string; tone?: 'blue' | 'green' | 'red' | 'amber' | 'slate' }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  }[tone];

  return (
    <RutaPanel className="p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-2 inline-flex rounded-md px-2 py-1 text-lg font-extrabold leading-tight ${toneClass}`}>{value}</p>
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
  visitsByDate: Record<string, { total: number }>;
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
export function RutaVisitadorView({ redZonesGeoJson }: RutaVisitadorViewProps) {
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
  const [redZoneDraft, setRedZoneDraft] = useState<RedZoneDraft | null>(null);
  const [redZonePicking, setRedZonePicking] = useState(false);
  const [redZoneSaving, setRedZoneSaving] = useState(false);
  const [redZoneManageError, setRedZoneManageError] = useState('');
  const [redZoneDetectMessage, setRedZoneDetectMessage] = useState('');
  const [calendarMonthDate, setCalendarMonthDate] = useState(() => new Date(fechaVisita + 'T12:00:00'));
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
  const fares = useMemo(() => getFareTable(stops.length), [stops.length]);
  const visitsByDate = useMemo(() => {
    const grouped: Record<string, { total: number }> = {};
    // From current stops
    for (const s of stops) {
      if (!grouped[fechaVisita]) grouped[fechaVisita] = { total: 0 };
      grouped[fechaVisita].total++;
      if (s.status === 'exitosa') grouped[fechaVisita].exitosas++;
      else if (s.status === 'no_exitosa') grouped[fechaVisita].noExitosas++;
      else grouped[fechaVisita].pendientes++;
      }
    // From localStorage
    const stored = getRouteDailyVisits();
    for (const v of stored) {
      if (!grouped[v.fechaRuta]) grouped[v.fechaRuta] = { total: 0 };
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

  const removeRedZone = useCallback(async () => {
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

  const updateAddressQuery = (id: string, value: string) => {
    setAddressQueries((current) => ({ ...current, [id]: value }));
  };

  const searchStopAddress = async (stop: RutaStop) => {
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

  const applyAddressSuggestion = (stopId: string, suggestion: AddressSuggestion) => {
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

  const updateStopObservation = (id: string, observation: string) => {
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

  const persistNewStops = (newStops: RutaStop[]) => {
    const now = new Date().toISOString();
    for (const stop of newStops) {
      const visit: RouteDailyVisit = {
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
        tarifaAplicada: 0,
        valorVisita: 0,
        createdAt: now,
        updatedAt: now,
      };
      upsertRouteDailyVisit(visit);
    }
    dispatchRouteDailyUpdate(fechaVisita, 'ruta-visitador');
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
    <div className="grid gap-4">
      {/* TOP GRID */}
      <div className="cc-route-top-grid-v2">
        <RutaPanel className="cc-route-calendar-zone rounded-xl border p-4">
          <RouteMonthCalendar
            selectedDate={fechaVisita}
            onSelectDate={(d) => { setFechaVisita(d); }}
            visitsByDate={visitsByDate}
          />
        </RutaPanel>

        <RutaPanel className="cc-route-ticket-primary rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{background:"rgba(34,211,238,0.09)",color:"var(--cc-cyan, #0891b2)"}}>
              <Route size={18} />
            </span>
            <h2 className="cc-route-ticket-header text-base font-black">Carga de ticket del d&iacute;a</h2>
            <span className="cc-route-badge shrink-0">Operaci&oacute;n diaria</span>
          </div>
          <p className="cc-route-subtitle mb-3 text-xs">Busca por ticket, RUT o carga masiva para armar la ruta de la fecha seleccionada. Al cargar, la visita queda pendiente para arqueo.</p>
          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <UserRound size={15} />
              Visitador
            </span>
            <input
              className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setVisitador(event.target.value)}
              placeholder="Nombre del visitador"
              value={visitador}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <CalendarDays size={15} />
                Fecha de carga
              </span>
              <input
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setFechaCarga(event.target.value)}
                type="date"
                value={fechaCarga}
              />
            </label>
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <CalendarDays size={15} />
                Fecha de visita
              </span>
              <input
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setFechaVisita(event.target.value)}
                type="date"
                value={fechaVisita}
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <MapPin size={15} />
              Punto de inicio
            </span>
            <input
              className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => {
                setStartPoint(event.target.value);
                setSelectedStartPoint(null);
                setSelectingStartPoint(false);
                setOptimizedRoute(null);
              }}
              placeholder="Dirección o referencia"
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
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
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
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {selectingStartPoint ? 'Selecciona punto en el mapa' : selectedStartPoint ? 'Inicio validado' : 'Inicio sin validar'}
          </span>

          <label className="grid gap-2">
            <span className="text-xs font-bold text-slate-700">Minutos por visita</span>
            <input
              className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              min={10}
              onChange={(event) => setServiceMinutesPerStop(Math.max(Number(event.target.value) || 10, 10))}
              type="number"
              value={serviceMinutesPerStop}
            />
            <span className="text-xs font-medium text-slate-500">Se suma por cada parada, no incluye el punto de inicio.</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="grid gap-2">
              <span className="text-xs font-bold text-slate-700">Rendimiento km/L</span>
              <input
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                min={1}
                onChange={(event) => setFuelEfficiency(Math.max(Number(event.target.value) || 1, 1))}
                step="0.1"
                type="number"
                value={fuelEfficiency}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold text-slate-700">Precio combustible</span>
              <input
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
        <RutaPanel className="cc-route-weather-hero rounded-xl border p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="cc-route-label text-xs">Clima de ruta</span>
            <span className="cc-route-badge" style={{fontSize:"0.55rem"}}>{weatherSummary?.source === 'open-meteo' ? 'Open-Meteo' : weatherSummary?.source === 'meteochile' ? 'MeteoChile' : 'Sin datos'}</span>
            <select
              className="cc-route-input h-7 w-auto max-w-[160px] px-2 text-[10px] font-bold rounded-lg border"
              value={weatherComuna}
              onChange={(e) => setWeatherComuna(e.target.value)}
            >
              {KNOWN_COMUNAS.map((k) => <option key={k.name} value={k.name}>{k.name}</option>)}
            </select>
          </div>
          {weatherLoading ? <p className="cc-route-stop-meta text-xs"><span style={{color:'var(--cc-cyan,#0891b2)'}}>⟳</span> Consultando clima...</p> : null}
          {weatherError ? <p className="cc-route-stop-meta text-xs leading-tight"><span style={{color:'var(--cc-orange,#f97316)'}}>⚠</span> {weatherError}</p> : null}
          {weatherSummary && !weatherLoading ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="cc-route-weather-avatar" data-tone={getWeatherPresentation(weatherSummary.weatherCode, weatherSummary.current?.isDay).tone}>
                {getWeatherPresentation(weatherSummary.weatherCode, weatherSummary.current?.isDay).icon}
              </div>
              <div className="cc-route-weather-main">
                <div className="cc-route-weather-condition text-lg">
                  {weatherSummary.current?.temperature2m ?? weatherSummary.temperatureMax ?? '--'}°C
                </div>
                <div className="text-xs font-semibold cc-text-secondary">
                  {getWeatherPresentation(weatherSummary.weatherCode, weatherSummary.current?.isDay).label}
                </div>
              </div>
              <div className="cc-route-weather-metrics">
                {weatherSummary.current?.windSpeed10m != null ? <span>Viento {weatherSummary.current.windSpeed10m} km/h</span> : weatherSummary.windSpeedMax != null ? <span>Viento máx {weatherSummary.windSpeedMax} km/h</span> : null}
                {weatherSummary.current?.precipitation != null ? <span>Lluvia {weatherSummary.current.precipitation} mm</span> : weatherSummary.precipitationSum != null ? <span>Lluvia {weatherSummary.precipitationSum} mm</span> : null}
                {weatherSummary.precipitationProbabilityMax != null ? <span>Prob. {weatherSummary.precipitationProbabilityMax}%</span> : null}
              </div>
              <span className={'cc-route-weather-alert ' + (
                weatherSummary.riskLevel === 'alto' ? 'cc-route-weather-alert-high' :
                weatherSummary.riskLevel === 'precaucion' ? 'cc-route-weather-alert-warning' :
                weatherSummary.riskLevel === 'sin_datos' ? 'cc-route-weather-alert-normal' :
                'cc-route-weather-alert-normal'
              )}>
                {weatherSummary.riskLevel === 'alto' ? '⚠️' : weatherSummary.riskLevel === 'precaucion' ? '⚡' : weatherSummary.riskLevel === 'sin_datos' ? 'ℹ️' : '✅'} {weatherSummary.riskLevel === 'alto' ? 'Alto' : weatherSummary.riskLevel === 'precaucion' ? 'Precaución' : weatherSummary.riskLevel === 'sin_datos' ? 'Sin datos' : 'Normal'}
              </span>
            </div>
          ) : null}
        </RutaPanel>

        <RutaPanel className="grid gap-3 p-4">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSearch();
            }}
          >
            <div className="cc-route-segmented flex rounded-lg border">
              <button
                className={`flex-1 h-9 rounded-md text-xs font-bold transition ${searchMode === 'ticket' ? '' : 'text-[#466083] hover:text-[#071b4d]'}`}
                onClick={() => setSearchMode('ticket')}
                type="button"
              >
                Por Ticket
              </button>
              <button
                className={`flex-1 h-9 rounded-md text-xs font-bold transition ${searchMode === 'rut' ? '' : 'text-[#466083] hover:text-[#071b4d]'}`}
                onClick={() => setSearchMode('rut')}
                type="button"
              >
                Por RUT
              </button>
            </div>

            <label className="grid gap-2">
              <span className="cc-route-label text-xs">{searchMode === 'ticket' ? 'Ticket' : 'RUT'}</span>
              <div className="flex gap-2">
                <input
                  className="cc-route-input h-10 min-w-0 flex-1 px-3 text-sm font-medium"
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={searchMode === 'ticket' ? 'ID ticket' : '14276958-1'}
                  value={searchValue}
                />
                <button
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0f5fcf] text-white transition hover:bg-[#0d47a1] disabled:opacity-60"
                  disabled={loading}
                  type="submit"
                  aria-label="Buscar"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                </button>
              </div>
            </label>
          </form>

          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const ids = parseTicketIds(bulkTicketIds);
              setBulkTicketIds('');
              void addTicketIds(ids);
            }}
          >
            <span className="text-xs font-bold text-slate-700">Carga masiva de tickets</span>
            <textarea
              className="min-h-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setBulkTicketIds(event.target.value)}
              placeholder="Separar por salto de línea, coma o punto y coma"
              value={bulkTicketIds}
            />
            <button className="h-10 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60" disabled={loading} type="submit">
              Cargar tickets
            </button>
          </form>
        </RutaPanel>

        </div>{/* END top grid */}

        {/* Actions */}
        <RutaPanel className="cc-route-actions p-4">
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            disabled={saving || stops.length === 0 || !visitador.trim()}
            onClick={() => void saveDailyVisits()}
            type="button"
          >
            {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
            Guardar visitas del día
          </button>
          <button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0f5fcf] px-3 text-sm font-bold text-white transition hover:bg-[#0d47a1] disabled:opacity-60" disabled={stops.length === 0 || optimizing || !startPoint.trim()} onClick={optimizeRoute} type="button">
            {optimizing ? <Loader2 className="animate-spin" size={17} /> : <Route size={17} />}
            Optimizar ruta
          </button>
          <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60" disabled={stops.length === 0} onClick={exportCsv} type="button">
            <Download size={17} />
            Exportar CSV
          </button>
          <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60" disabled={stops.length === 0} onClick={clearStops} type="button">
            <Trash2 size={17} />
            Limpiar tickets
          </button>
        </RutaPanel>
      {/* END aside (removed in restructure) */}

      {/* BOTTOM: KPIs + Map + Stops + Valuation */}
        <section className="cc-route-kpi-grid">
          <RutaMetricCard label="Tickets del día" value={summary.ticketsToday.toLocaleString('es-CL')} />
          <RutaMetricCard label="Exitosas" value={summary.successful.toLocaleString('es-CL')} tone="green" />
          <RutaMetricCard label="No exitosas" value={summary.unsuccessful.toLocaleString('es-CL')} tone="red" />
          <RutaMetricCard label="Pendientes" value={summary.pending.toLocaleString('es-CL')} tone="amber" />
          <RutaMetricCard label="Zonas rojas" value={summary.redZones.toLocaleString('es-CL')} tone="red" />
          <RutaMetricCard label="Total valorizado" value={summary.totalValued.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })} tone="green" />
          <RutaMetricCard label="Proyectado máximo" value={summary.projectedMax.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })} tone="blue" />
        </section>

        {message || redZonesError || optimizedRoute ? (
          <RutaPanel className="p-3">
            {message ? <p className="text-sm font-semibold text-slate-700">{message}</p> : null}
            {optimizedRoute ? (
              <p className="mt-1 text-xs font-semibold text-blue-700">
                Distancia total {formatDistance(optimizedRoute.distance_m)} · Tiempo conducción {formatDuration(getRouteTravelDuration(optimizedRoute))} · Tiempo atención {formatDuration(getRouteServiceDuration(optimizedRoute))} · Tiempo total estimado {formatDuration(optimizedRoute.duration_s)}
              </p>
            ) : null}
            {redZonesError ? <p className="mt-1 text-xs font-semibold cc-orange">{redZonesError}. La vista sigue funcionando con el estado de zona roja informado por backend.</p> : null}
          </RutaPanel>
        ) : null}

        <RutaPanel className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-base font-bold text-[#071b4d]">Mapa de ruta</h3>
          </div>
          <div className="cc-route-map-compact relative overflow-hidden rounded-xl">
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
              <div className="absolute left-4 right-4 top-16 z-[500] max-h-[70%] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/95 shadow-xl md:left-auto md:right-4 md:w-[320px] md:max-h-[85%]">
                <div className="sticky top-0 border-b border-slate-800 bg-slate-950/95 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-300">Zonas rojas</p>
                      <p className="mt-1 text-[11px] font-medium text-slate-400">Activas en PostgreSQL y capa histórica solo de referencia.</p>
                    </div>
                    <button className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800" onClick={() => setRedZonePanelOpen(false)} type="button">
                      Ocultar
                    </button>
                  </div>
                  <button
                    className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-bold text-white transition hover:bg-red-700"
                    onClick={() => {
                      setRedZoneDraft(createEmptyRedZoneDraft());
                      setRedZonePicking(true);
                      setRedZoneManageError('');
                    }}
                    type="button"
                  >
                    <MapPin size={14} />
                    Nueva zona
                  </button>
                </div>

                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Zonas activas ({activeRedZones.length})</p>
                    {activeRedZones.length === 0 ? <p className="text-xs text-slate-400">No hay zonas activas guardadas. Puedes crear una nueva o convertir una zona histórica.</p> : null}
                    {activeRedZones.map((zone) => (
                      <button
                        key={zone.id}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition ${selectedRedZoneId === zone.id ? 'border-red-400 bg-red-950/60' : 'border-slate-800 bg-slate-900/80 hover:bg-slate-900'}`}
                        onClick={() => selectRedZone(zone)}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-100">{zone.name}</span>
                          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">{zone.severity}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">{zone.comuna || 'Sin comuna'} · {Math.round(zone.radius_m)} m</p>
                        <span className="mt-2 inline-flex text-[11px] font-bold text-blue-300">Editar</span>
                      </button>
                    ))}
                    <p className="pt-1 text-[11px] font-medium text-slate-500">Zonas históricas: disponibles como capa de referencia en el selector de capas.</p>
                  </div>

                  {redZoneDraft ? (
                    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3" ref={redZoneFormRef}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-white">{redZoneDraft.id ? 'Editar zona roja' : 'Nueva zona roja'}</h4>
                          <p className="mt-1 text-[11px] text-slate-400">{redZoneDraft.id ? 'Actualiza la zona seleccionada.' : 'Define una nueva zona activa.'}</p>
                        </div>
                        <button
                          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800"
                          onClick={() => {
                            setRedZoneDraft(null);
                            setRedZonePicking(false);
                            setRedZoneManageError('');
                          }}
                          type="button"
                        >
                          Cancelar
                        </button>
                      </div>

                      <input className={redZoneInputClass} onChange={(event) => setRedZoneDraft({ ...redZoneDraft, name: event.target.value })} placeholder="Nombre zona" value={redZoneDraft.name} />
                      <div className="grid grid-cols-2 gap-2">
                        <input className={redZoneInputClass} onChange={(event) => setRedZoneDraft({ ...redZoneDraft, comuna: event.target.value })} placeholder="Comuna" value={redZoneDraft.comuna ?? ''} />
                        <input className={redZoneInputClass} onChange={(event) => setRedZoneDraft({ ...redZoneDraft, region: event.target.value })} placeholder="Región" value={redZoneDraft.region ?? ''} />
                      </div>

                      <button
                        className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 text-xs font-bold text-blue-200 hover:bg-blue-500/20"
                        onClick={() => {
                          setRedZonePicking(true);
                          setRedZoneManageError('');
                        }}
                        type="button"
                      >
                        <MapPin size={14} />
                        Seleccionar o mover centro
                      </button>
                      {redZonePicking ? <p className="text-[11px] font-semibold text-amber-300">Haz click en el mapa para definir el centro.</p> : null}

                      <div className="grid grid-cols-2 gap-2">
                        <input className={redZoneInputClass} onChange={(event) => setRedZoneDraft({ ...redZoneDraft, lat: Number(event.target.value) })} placeholder="Latitud" step="any" type="number" value={redZoneDraft.lat ?? ''} />
                        <input className={redZoneInputClass} onChange={(event) => setRedZoneDraft({ ...redZoneDraft, lon: Number(event.target.value) })} placeholder="Longitud" step="any" type="number" value={redZoneDraft.lon ?? ''} />
                      </div>

                      <label className="grid gap-1 text-xs font-bold text-slate-200">
                        Radio: {Math.round(redZoneDraft.radius_m)} m
                        <input max={3000} min={100} onChange={(event) => setRedZoneDraft({ ...redZoneDraft, radius_m: Number(event.target.value) })} step={50} type="range" value={redZoneDraft.radius_m} />
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <select className={redZoneInputClass} onChange={(event) => setRedZoneDraft({ ...redZoneDraft, severity: event.target.value as RedZoneDraft['severity'] })} value={redZoneDraft.severity}>
                          <option value="baja">Baja</option>
                          <option value="media">Media</option>
                          <option value="alta">Alta</option>
                          <option value="critica">Crítica</option>
                        </select>
                        <select className={redZoneInputClass} onChange={(event) => setRedZoneDraft({ ...redZoneDraft, display_mode: event.target.value as RedZoneDraft['display_mode'] })} value={redZoneDraft.display_mode}>
                          <option value="circle">Círculo</option>
                          <option value="heatpoint">Punto de calor</option>
                          {redZoneDraft.polygon_geojson ? <option value="polygon">Polígono</option> : null}
                        </select>
                      </div>

                      <textarea className={redZoneTextareaClass} onChange={(event) => setRedZoneDraft({ ...redZoneDraft, notes: event.target.value })} placeholder="Notas" value={redZoneDraft.notes ?? ''} />

                      {redZoneManageError ? <p className="text-[11px] font-semibold text-red-300">{redZoneManageError}</p> : null}
                      {redZoneDetectMessage ? <p className="text-[11px] font-semibold text-emerald-300">{redZoneDetectMessage}</p> : null}

                      <div className="flex flex-wrap gap-2">
                        <button className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0f5fcf] px-3 text-xs font-bold text-white disabled:opacity-60" disabled={redZoneSaving} onClick={() => void saveRedZone()} ref={redZoneSaveButtonRef} type="button">
                          {redZoneSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                          {redZoneDraft.id ? 'Actualizar zona' : 'Guardar zona'}
                        </button>
                        {redZoneDraft.id ? (
                          <button className="flex h-9 items-center justify-center gap-2 rounded-lg bg-red-500/15 px-3 text-xs font-bold text-red-200 disabled:opacity-60" disabled={redZoneSaving} onClick={() => void removeRedZone()} type="button">
                            <Trash2 size={14} />
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Selecciona una zona activa, crea una nueva o convierte una zona histórica para editarla.</p>
                  )}
                </div>
              </div>
            ) : (
              <button
                className="absolute right-4 top-16 z-[500] rounded-xl border border-slate-700 bg-slate-950/95 px-4 py-2 text-xs font-black text-slate-100 shadow-xl"
                onClick={() => setRedZonePanelOpen(true)}
                type="button"
              >
                Zonas rojas
              </button>
            )}
          </div>
        </RutaPanel>

        <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <RutaPanel className="overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-base font-bold text-[#071b4d]">Lista de paradas</h3>
              <p className="text-xs font-medium text-slate-500">Marca resultado de visita, observación y revisión territorial.</p>
            </div>

            <div className="divide-y divide-slate-100">
              {stops.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm font-bold text-slate-700">Sin tickets cargados</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">Busca por ticket, RUT o usa carga masiva para iniciar la ruta.</p>
                </div>
              ) : (
                stops.map((stop, index) => (
                  <article key={stop.id} className="cc-route-stop-card grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">#{index + 1}</span>
                        <h4 className="break-words text-sm font-bold text-[#071b4d]">{stop.clientName}</h4>
                        <span className={`rounded-md border px-2 py-1 text-xs font-bold ${STATUS_CLASSES[stop.status]}`}>{STATUS_LABELS[stop.status]}</span>
                        {stop.isRedZone ? <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Zona roja</span> : null}
                        {!Number.isFinite(stop.lat) || !Number.isFinite(stop.lng) ? <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">Sin coordenadas — dirección requiere corrección</span> : null}
                      </div>
                      <p className="cc-route-stop-meta mt-2 text-xs font-semibold">
                        {stop.referencia} · Reclamos {stop.claimsCount.toLocaleString('es-CL')}
                      </p>
                      <p className="cc-route-stop-name mt-1 text-sm font-medium">{stop.address || 'Sin dirección'}</p>
                      <div className="cc-route-stop-meta mt-2 grid gap-1 text-xs font-medium sm:grid-cols-3">
                        <span>RUT: {stop.rut ?? 'No informado'}</span>
                        <span>Tel: {stop.phone ?? 'No informado'}</span>
                        <span>Correo: {stop.email ?? 'No informado'}</span>
                      </div>
                      {stop.error ? <p className="mt-2 text-xs font-semibold text-amber-700">{stop.error}</p> : null}
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-700">Corregir dirección</span>
                          {Number.isFinite(stop.lat) && Number.isFinite(stop.lng) ? <span className="text-xs font-semibold text-slate-500">Ubicación editable</span> : <span className="text-xs font-semibold text-amber-700">Requiere coordenadas</span>}
                        </div>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <input
                            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            onChange={(event) => updateAddressQuery(stop.id, event.target.value)}
                            placeholder="Buscar dirección corregida"
                            value={addressQueries[stop.id] ?? stop.cleanAddress ?? stop.address}
                          />
                          <button
                            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
                            disabled={addressLoading[stop.id]}
                            onClick={() => void searchStopAddress(stop)}
                            type="button"
                          >
                            {addressLoading[stop.id] ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                            Buscar dirección
                          </button>
                        </div>
                        {addressSuggestions[stop.id]?.length ? (
                          <div className="mt-2 grid gap-2">
                            {addressSuggestions[stop.id].map((suggestion) => (
                              <div key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                <p className="text-xs font-medium leading-snug text-slate-700">{suggestion.label}</p>
                                <p className="text-xs font-semibold text-slate-500">Buscado como: {suggestion.query_used}</p>
                                <button
                                  className="h-9 rounded-lg bg-[#0f5fcf] px-3 text-xs font-bold text-white transition hover:bg-[#0d47a1]"
                                  onClick={() => applyAddressSuggestion(stop.id, suggestion)}
                                  type="button"
                                >
                                  Usar esta ubicación
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : addressSearched[stop.id] && !addressLoading[stop.id] ? (
                          <p className="cc-route-stop-meta mt-2 text-xs font-semibold">No se encontraron direcciones</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <select
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        onChange={(event) => updateStopStatus(stop.id, event.target.value as RutaVisitStatus)}
                        value={stop.status}
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="exitosa">Exitosa</option>
                        <option value="no_exitosa">No exitosa</option>
                      </select>
                      <textarea
                        className="min-h-20 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        disabled={stop.status === 'pendiente'}
                        onChange={(event) => updateStopObservation(stop.id, event.target.value)}
                        placeholder={stop.status === 'pendiente' ? 'Disponible al cerrar visita' : 'Observación de la parada'}
                        value={stop.observation}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="cc-route-stop-meta text-xs font-bold">
                          {calculateStopValue(stop.status, stops.length).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
                        </span>
                        <button className="cc-danger-button flex h-9 items-center gap-2 px-3 text-xs font-bold" onClick={() => removeStop(stop.id)} type="button">
                          <Trash2 size={15} />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </RutaPanel>

          <RutaPanel className="self-start p-4">
            <h3 className="text-base font-bold text-[#071b4d]">Totales de valorización</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-medium text-slate-600">Tramo actual</span>
                <span className="font-bold cc-text">{stops.length >= 13 ? '13 o más tickets' : 'Menos de 13 tickets'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-medium text-slate-600">Tarifa exitosa</span>
                <span className="font-bold text-emerald-700">{fares.successful.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-medium text-slate-600">Tarifa no exitosa</span>
                <span className="font-bold text-red-700">{fares.unsuccessful.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</span>
              </div>
              {optimizedRoute ? (
                <div className="cc-route-divider border-t pt-3">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium text-slate-600">Kilómetros totales</span>
                    <span className="font-bold text-blue-700">{routeFuelSummary ? formatKilometers(routeFuelSummary.totalKm) : formatDistance(optimizedRoute.distance_m)}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="font-medium text-slate-600">Tiempo conducción</span>
                    <span className="font-bold text-blue-700">{formatDuration(getRouteTravelDuration(optimizedRoute))}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="font-medium text-slate-600">Tiempo atención</span>
                    <span className="font-bold text-blue-700">{formatDuration(getRouteServiceDuration(optimizedRoute))}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="font-medium text-slate-600">Tiempo total estimado</span>
                    <span className="font-bold text-blue-700">{formatDuration(optimizedRoute.duration_s)}</span>
                  </div>
                  {routeFuelSummary ? (
                    <>
                      <div className="mt-2 flex justify-between gap-3">
                        <span className="font-medium text-slate-600">Litros estimados</span>
                        <span className="font-bold text-blue-700">{formatLiters(routeFuelSummary.estimatedLiters)}</span>
                      </div>
                      <div className="mt-2 flex justify-between gap-3">
                        <span className="font-medium text-slate-600">Costo combustible</span>
                        <span className="font-bold text-blue-700">{formatClp(routeFuelSummary.estimatedFuelCost)}</span>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
              <div className="border-t border-slate-200 pt-3">
                <div className="flex justify-between gap-3">
                  <span className="font-bold text-slate-700">Total valorizado</span>
                  <span className="cc-route-valuation-title font-extrabold">{summary.totalValued.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
          </RutaPanel>
        </section>
      {/* END main (removed in restructure) */}
    </div>
  );
}
