import { AlertTriangle, CheckCircle2, Layers3, Loader2, MapPin, Plus, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Feature, GeoJsonObject } from 'geojson';
import L from 'leaflet';
import { CircleMarker, GeoJSON, LayerGroup, LayersControl, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import type { ComunaMetric } from '../../data/dashboardData';
import { ActiveRedZonesLayers } from '../red-zones/ActiveRedZonesLayers';
import { RedZoneEditorPanel } from '../red-zones/RedZoneEditorPanel';
import { createRedZone, deleteRedZone, updateRedZone } from '../red-zones/redZonesApi';
import type { RedZone, RedZoneDraft } from '../red-zones/redZoneTypes';
import { searchAddress, type AddressSuggestion, validateRedZonePoint, type MapValidationResponse } from './mapApi';
import { loadGenericGeoJson } from '../ruta/rutaUtils';

const CHILE_COMUNAS_LAYER_PATH = '/data/map-layers/chile_comunas_simplified.geojson';

const rmComunasStyle = {
  color: '#ffffff',
  fillColor: '#dbeafe',
  fillOpacity: 0.08,
  opacity: 0.95,
  weight: 1.1,
};

const chileComunasStyle = {
  color: '#94a3b8',
  fillColor: '#94a3b8',
  fillOpacity: 0.04,
  opacity: 1,
  weight: 0.6,
};

const historicalRedZonesStyle = {
  color: '#dc2626',
  fillColor: '#ef4444',
  fillOpacity: 0.2,
  opacity: 0.85,
  weight: 1.5,
};

const normalizeName = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

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
    ''
  );
};

const getFeatureZoneName = (feature: Feature | undefined) => {
  const properties = feature?.properties as Record<string, unknown> | null | undefined;
  return (
    (properties?.NombreZona as string | undefined) ||
    (properties?.NOMBRE as string | undefined) ||
    (properties?.Nombre as string | undefined) ||
    (properties?.name as string | undefined) ||
    (properties?.NAME as string | undefined) ||
    'Zona roja histórica'
  );
};

const formatMeters = (value: number) => `${Math.round(value).toLocaleString('es-CL')} m`;

const getMapColor = (value: number, max: number) => {
  const ratio = max > 0 ? value / max : 0;
  if (ratio >= 0.72) return '#0f5fcf';
  if (ratio >= 0.52) return '#2f8fe8';
  if (ratio >= 0.34) return '#8cc8f5';
  return '#d8ebfb';
};

function SearchResultFocus({
  selectedSuggestion,
  validation,
}: {
  selectedSuggestion: AddressSuggestion | null;
  validation: MapValidationResponse | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedSuggestion) return;
    const point = L.latLng(selectedSuggestion.lat, selectedSuggestion.lon);
    const nearest = validation?.nearest_zone;

    if (nearest?.lat != null && nearest?.lon != null && validation && validation.status !== 'safe') {
      map.fitBounds(L.latLngBounds([point, L.latLng(nearest.lat, nearest.lon)]), { padding: [36, 36] });
      return;
    }

    map.setView(point, 14, { animate: true });
  }, [map, selectedSuggestion, validation]);

  return null;
}

function RedZoneMapPicker({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click: (event) => {
      if (enabled) onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

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

function BaseMapLayers({ children }: { children?: ReactNode }) {
  return (
    <LayersControl position="topright">
      <LayersControl.BaseLayer name="Claro">
        <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO" subdomains={['a', 'b', 'c', 'd']} url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer checked name="Calles">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Oscuro">
        <TileLayer attribution="© OpenStreetMap © CARTO" subdomains={['a', 'b', 'c', 'd']} url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Satélite">
        <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
      </LayersControl.BaseLayer>
      {children}
    </LayersControl>
  );
}

export function MapView({
  rmComunasLayer,
  historicalRedZones,
  activeRedZones,
  comunaMetrics,
  maxVisitas,
}: {
  rmComunasLayer: GeoJsonObject | null;
  historicalRedZones: GeoJsonObject | null;
  activeRedZones: RedZone[];
  comunaMetrics: ComunaMetric[];
  maxVisitas: number;
}) {
  const [chileComunasLayer, setChileComunasLayer] = useState<GeoJsonObject | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AddressSuggestion | null>(null);
  const [validation, setValidation] = useState<MapValidationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [managedRedZones, setManagedRedZones] = useState(activeRedZones);
  const [redZoneDraft, setRedZoneDraft] = useState<RedZoneDraft | null>(null);
  const [redZonePicking, setRedZonePicking] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<Array<[number, number]>>([]);
  const [redZoneSaving, setRedZoneSaving] = useState(false);
  const [redZoneError, setRedZoneError] = useState('');

  useEffect(() => {
    setManagedRedZones(Array.isArray(activeRedZones) ? activeRedZones : []);
  }, [activeRedZones]);

  useEffect(() => {
    let mounted = true;
    loadGenericGeoJson(CHILE_COMUNAS_LAYER_PATH).then((state) => {
      if (!mounted) return;
      setChileComunasLayer(state.data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const metricByComuna = useMemo(
    () => new Map((Array.isArray(comunaMetrics) ? comunaMetrics : []).map((item) => [normalizeName(item.comuna), item] as const)),
    [comunaMetrics],
  );

  const selectRedZone = useCallback((zone: RedZone) => {
    setRedZoneDraft({ ...zone });
    setPolygonPoints([]);
    setRedZonePicking(false);
    setRedZoneError('');
  }, []);

  const pickRedZonePoint = useCallback((lat: number, lon: number) => {
    if (!redZoneDraft) return;
    if (redZoneDraft.display_mode === 'polygon') {
      setPolygonPoints((current) => {
        const next = [...current, [lat, lon] as [number, number]];
        if (next.length >= 3) {
          const coordinates = [...next.map(([pointLat, pointLon]) => [pointLon, pointLat]), [next[0][1], next[0][0]]];
          setRedZoneDraft((draft) => draft ? {
            ...draft,
            lat: next.reduce((sum, point) => sum + point[0], 0) / next.length,
            lon: next.reduce((sum, point) => sum + point[1], 0) / next.length,
            polygon_geojson: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coordinates] } },
          } : draft);
        }
        return next;
      });
      return;
    }
    setRedZoneDraft((draft) => draft ? { ...draft, lat, lon } : draft);
    setRedZonePicking(false);
  }, [redZoneDraft]);

  const saveManagedRedZone = useCallback(async () => {
    if (!redZoneDraft?.name.trim()) {
      setRedZoneError('Ingresa un nombre para la zona roja.');
      return;
    }
    if (redZoneDraft.display_mode === 'polygon' && !redZoneDraft.polygon_geojson) {
      setRedZoneError('Marca al menos tres puntos para cerrar el polígono.');
      return;
    }
    if (redZoneDraft.display_mode !== 'polygon' && (redZoneDraft.lat === null || redZoneDraft.lon === null)) {
      setRedZoneError('Selecciona el centro en el mapa.');
      return;
    }
    setRedZoneSaving(true);
    setRedZoneError('');
    try {
      const { id, ...payload } = redZoneDraft;
      const saved = id ? await updateRedZone(id, payload) : await createRedZone(payload);
      setManagedRedZones((current) => id ? current.map((zone) => zone.id === id ? saved : zone) : [...current, saved]);
      setRedZoneDraft({ ...saved });
      setRedZonePicking(false);
      setPolygonPoints([]);
    } catch (nextError) {
      setRedZoneError(nextError instanceof Error ? nextError.message : 'No se pudo guardar la zona roja');
    } finally {
      setRedZoneSaving(false);
    }
  }, [redZoneDraft]);

  const removeManagedRedZone = useCallback(async () => {
    if (!redZoneDraft?.id) return;
    setRedZoneSaving(true);
    try {
      await deleteRedZone(redZoneDraft.id);
      setManagedRedZones((current) => current.filter((zone) => zone.id !== redZoneDraft.id));
      setRedZoneDraft(null);
      setPolygonPoints([]);
    } catch (nextError) {
      setRedZoneError(nextError instanceof Error ? nextError.message : 'No se pudo eliminar la zona roja');
    } finally {
      setRedZoneSaving(false);
    }
  }, [redZoneDraft]);

  const handleSelectSuggestion = useCallback(async (suggestion: AddressSuggestion) => {
    setSelectedSuggestion(suggestion);
    setQuery(suggestion.label);
    setSuggestions([]);
    setError('');
    setLoading(true);

    try {
      const result = await validateRedZonePoint(suggestion.lat, suggestion.lon);
      setValidation(result);
    } catch (nextError) {
      setValidation(null);
      setError(nextError instanceof Error ? nextError.message : 'No se pudo validar la dirección');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleValidateAddress = useCallback(async () => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 4) {
      setError('Ingresa una dirección, comuna o sector más específico.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const nextSuggestions = await searchAddress(normalizedQuery);
      setSuggestions(nextSuggestions);
      if (nextSuggestions[0]) {
        await handleSelectSuggestion(nextSuggestions[0]);
        return;
      }
      setValidation(null);
      setSelectedSuggestion(null);
      setError('No se encontraron sugerencias para esa dirección.');
    } catch (nextError) {
      setValidation(null);
      setSelectedSuggestion(null);
      setError(nextError instanceof Error ? nextError.message : 'No se pudo buscar la dirección');
    } finally {
      setLoading(false);
    }
  }, [handleSelectSuggestion, query]);

  const onEachClaimsFeature = useCallback(
    (feature: Feature, layer: L.Layer) => {
      const metric = metricByComuna.get(normalizeName(getFeatureComunaName(feature)));
      if (!metric) return;

      layer.bindTooltip(`${metric.comuna}: ${metric.visitas.toLocaleString('es-CL')} reclamos`, { direction: 'top', sticky: true });
      layer.bindPopup(
        `<strong>${metric.comuna}</strong><br/>Reclamos: ${metric.visitas.toLocaleString('es-CL')}<br/>Facturación: ${metric.facturacion.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}`,
      );
    },
    [metricByComuna],
  );

  const claimsStyle = useCallback(
    (feature: Feature | undefined) => {
      const metric = metricByComuna.get(normalizeName(getFeatureComunaName(feature)));
      return {
        color: '#ffffff',
        fillColor: metric ? getMapColor(metric.visitas, maxVisitas) : '#cbd5e1',
        fillOpacity: metric ? 0.56 : 0.06,
        opacity: 0.92,
        weight: 1.1,
      };
    },
    [maxVisitas, metricByComuna],
  );

  const onEachHistoricalFeature = useCallback((feature: Feature, layer: L.Layer) => {
    const comuna = getFeatureComunaName(feature) || 'Sin comuna';
    const nombre = getFeatureZoneName(feature);
    layer.bindTooltip(nombre, { direction: 'top', sticky: true });
    layer.bindPopup(`<strong>${nombre}</strong><br/><small>${comuna}</small>`);
  }, []);

  const alertTone =
    validation?.status === 'inside'
      ? 'border-red-200 bg-red-50 text-red-800'
      : validation?.status === 'nearby'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <section className="grid min-w-0 gap-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-black text-[#071b4d]">Mapa operativo</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Análisis geográfico general con validación automática de zonas rojas.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
              <Layers3 size={15} />
              Capas base, comunas, zonas rojas y validación
            </div>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0f5fcf] px-3 text-xs font-bold text-white hover:bg-blue-800"
              onClick={() => {
                setRedZoneDraft(createEmptyRedZoneDraft());
                setPolygonPoints([]);
                setRedZonePicking(true);
                setRedZoneError('');
              }}
              type="button"
            >
              <Plus size={15} /> Nueva zona roja
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-2">
            <label className="text-xs font-black uppercase tracking-wide text-slate-500">Buscar dirección</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="h-11 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar dirección, comuna o sector"
                value={query}
              />
              <button className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0f5fcf] px-4 text-sm font-bold text-white disabled:opacity-60" disabled={loading} onClick={() => void handleValidateAddress()} type="button">
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                Validar dirección
              </button>
            </div>
            {suggestions.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.lat}-${suggestion.lon}`}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    onClick={() => void handleSelectSuggestion(suggestion)}
                    type="button"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            ) : null}
            {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}
          </div>

          <div className={`rounded-xl border p-4 ${alertTone}`}>
            <div className="flex items-start gap-3">
              {validation?.status === 'inside' ? <AlertTriangle size={20} /> : validation?.status === 'nearby' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
              <div>
                <h3 className="text-sm font-black">{validation?.message ?? 'Sin validación todavía'}</h3>
                <p className="mt-1 text-xs font-medium">
                  {validation
                    ? validation.status === 'inside'
                      ? 'La dirección cae dentro de una zona roja activa o histórica.'
                      : validation.status === 'nearby'
                        ? 'La dirección está cerca de una zona roja y conviene revisión operativa.'
                        : 'La dirección se encuentra fuera de zonas rojas y sin proximidad crítica.'
                    : 'Busca una dirección para revisar si está dentro, cerca o fuera de zonas rojas.'}
                </p>
                {validation?.nearest_zone ? (
                  <div className="mt-3 rounded-lg border border-current/15 bg-white/60 p-3 text-xs font-semibold">
                    <p>Zona: {validation.nearest_zone.name}</p>
                    <p>Comuna: {validation.nearest_zone.comuna || 'Sin comuna'}</p>
                    <p>Distancia: {formatMeters(validation.nearest_zone.distance_m)}</p>
                    {validation.nearest_zone.radius_m != null ? <p>Radio: {formatMeters(validation.nearest_zone.radius_m)}</p> : null}
                    {validation.nearest_zone.severity ? <p>Severidad: {validation.nearest_zone.severity}</p> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative h-[72vh] min-h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <MapContainer center={[-33.45, -70.66]} className="h-full w-full" preferCanvas zoom={11} zoomControl={false}>
          <ZoomControl position="topleft" />
          <SearchResultFocus selectedSuggestion={selectedSuggestion} validation={validation} />
          <RedZoneMapPicker enabled={redZonePicking} onPick={pickRedZonePoint} />
          <BaseMapLayers>
            {rmComunasLayer ? (
              <LayersControl.Overlay name="Comunas RM">
                <GeoJSON data={rmComunasLayer} style={rmComunasStyle} />
              </LayersControl.Overlay>
            ) : null}
            {chileComunasLayer ? (
              <LayersControl.Overlay name="Comunas Chile">
                <GeoJSON data={chileComunasLayer} interactive={false} style={chileComunasStyle} />
              </LayersControl.Overlay>
            ) : null}
            {rmComunasLayer && comunaMetrics.length > 0 ? (
              <LayersControl.Overlay name="Reclamos por comuna">
                <GeoJSON data={rmComunasLayer} onEachFeature={onEachClaimsFeature} style={claimsStyle} />
              </LayersControl.Overlay>
            ) : null}
            {historicalRedZones ? (
              <LayersControl.Overlay name="Zonas rojas históricas">
                <GeoJSON data={historicalRedZones} onEachFeature={onEachHistoricalFeature} style={historicalRedZonesStyle} />
              </LayersControl.Overlay>
            ) : null}
            <ActiveRedZonesLayers onSelect={selectRedZone} redZoneMode="manage" selectedZoneId={redZoneDraft?.id ?? null} zones={managedRedZones} />
            {redZoneDraft?.polygon_geojson ? <GeoJSON data={redZoneDraft.polygon_geojson} style={{ color: '#D55E00', fillColor: '#E69F00', fillOpacity: 0.2, weight: 3 }} /> : null}
            {selectedSuggestion ? (
              <LayersControl.Overlay checked name="Marcador dirección buscada">
                <LayerGroup>
                  <CircleMarker
                    center={[selectedSuggestion.lat, selectedSuggestion.lon]}
                    pathOptions={{ color: '#ffffff', fillColor: validation?.status === 'inside' ? '#D55E00' : validation?.status === 'nearby' ? '#E69F00' : '#009E73', fillOpacity: 0.95, weight: 3 }}
                    radius={10}
                  >
                    <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                      {validation?.status === 'inside' ? 'Dentro de zona roja' : validation?.status === 'nearby' ? 'Cerca de zona roja' : 'Fuera de zonas rojas'}
                    </Tooltip>
                    <Popup>
                      <strong>Dirección validada</strong>
                      <br />
                      {selectedSuggestion.label}
                    </Popup>
                  </CircleMarker>
                  {validation?.nearest_zone?.lat != null && validation.nearest_zone.lon != null && validation.status !== 'safe' ? (
                    <Polyline pathOptions={{ color: validation.status === 'inside' ? '#dc2626' : '#f59e0b', dashArray: '6 4', weight: 2 }} positions={[[selectedSuggestion.lat, selectedSuggestion.lon], [validation.nearest_zone.lat, validation.nearest_zone.lon]]} />
                  ) : null}
                </LayerGroup>
              </LayersControl.Overlay>
            ) : null}
          </BaseMapLayers>
        </MapContainer>
        <div className="pointer-events-none absolute bottom-4 left-4 z-[500] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold text-slate-600 shadow-sm">
          {redZonePicking ? (redZoneDraft?.display_mode === 'polygon' ? `Marca puntos del polígono (${polygonPoints.length}; mínimo 3)` : 'Selecciona el centro de la zona en el mapa') : 'Haz clic en una zona roja activa para editarla.'}
        </div>
        {redZoneDraft ? (
          <RedZoneEditorPanel
            draft={redZoneDraft}
            error={redZoneError}
            onCancel={() => {
              setRedZoneDraft(null);
              setRedZonePicking(false);
              setPolygonPoints([]);
            }}
            onChange={(draft) => {
              setRedZoneDraft(draft);
              if (draft.display_mode === 'polygon' && !draft.polygon_geojson) setRedZonePicking(true);
            }}
            onDelete={redZoneDraft.id ? () => void removeManagedRedZone() : undefined}
            onPickCenter={() => {
              setPolygonPoints([]);
              setRedZonePicking(true);
            }}
            onSave={() => void saveManagedRedZone()}
            saving={redZoneSaving}
          />
        ) : null}
      </div>
    </section>
  );
}
