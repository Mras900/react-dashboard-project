import type { GeoJsonObject } from 'geojson';
import { Circle, CircleMarker, GeoJSON, LayerGroup, LayersControl, Popup } from 'react-leaflet';
import type { Layer } from 'leaflet';
import type { RedZone } from './redZoneTypes';
import { severityColor, severityWeight } from './redZoneUtils';

type RedZoneMode = 'readonly' | 'manage';

export function ActiveRedZonesLayers({
  zones,
  onSelect,
  redZoneMode = 'readonly',
  selectedZoneId,
}: {
  zones: RedZone[];
  onSelect?: (zone: RedZone) => void;
  redZoneMode?: RedZoneMode;
  selectedZoneId?: number | null;
}) {
  const activeZones = zones.filter((zone) => zone.status === 'active');
  const shapeZones = activeZones.filter((zone) => zone.display_mode !== 'heatpoint');
  const heatZones = activeZones.filter((zone) => zone.lat !== null && zone.lon !== null);
  const handleSelect = (zone: RedZone) => {
    if (redZoneMode === 'manage') onSelect?.(zone);
  };
  const renderZonePopup = (zone: RedZone) => (
    <Popup>
      <strong>{zone.name}</strong>
      <br />
      Comuna: {zone.comuna || 'Sin comuna'}
      <br />
      Radio: {Math.round(zone.radius_m)} m
      <br />
      Severidad: {zone.severity}
      <br />
      Tipo: {zone.display_mode}
    </Popup>
  );
  const bindZonePopup = (zone: RedZone) => (_feature: unknown, layer: Layer) => {
    layer.bindPopup(`
      <strong>${zone.name}</strong><br/>
      Comuna: ${zone.comuna || 'Sin comuna'}<br/>
      Radio: ${Math.round(zone.radius_m)} m<br/>
      Severidad: ${zone.severity}<br/>
      Tipo: ${zone.display_mode}
    `);
  };

  return (
    <>
      <LayersControl.Overlay checked name="Zonas rojas activas">
        <LayerGroup>
          {shapeZones.map((zone) => {
            const color = severityColor(zone.severity);
            const isSelected = zone.id === selectedZoneId;
            if (zone.display_mode === 'polygon' && zone.polygon_geojson) {
              return (
                <GeoJSON
                  data={zone.polygon_geojson as GeoJsonObject}
                  eventHandlers={{ click: () => handleSelect(zone) }}
                  key={zone.id}
                  onEachFeature={bindZonePopup(zone)}
                  style={{ color, fillColor: color, fillOpacity: isSelected ? 0.34 : 0.2, weight: isSelected ? 3.5 : 2 }}
                />
              );
            }
            if (zone.lat === null || zone.lon === null) return null;
            return (
              <Circle
                center={[zone.lat, zone.lon]}
                eventHandlers={{ click: () => handleSelect(zone) }}
                key={zone.id}
                pathOptions={{ color, fillColor: color, fillOpacity: isSelected ? 0.3 : 0.18, weight: isSelected ? 4 : 2 }}
                radius={zone.radius_m}
              >
                {renderZonePopup(zone)}
              </Circle>
            );
          })}
        </LayerGroup>
      </LayersControl.Overlay>
      <LayersControl.Overlay name="Puntos de calor">
        <LayerGroup>
          {heatZones.map((zone) => {
            const intensity = severityWeight(zone.severity);
            const color = severityColor(zone.severity);
            const isSelected = zone.id === selectedZoneId;
            return (
              <CircleMarker
                center={[zone.lat as number, zone.lon as number]}
                eventHandlers={{ click: () => handleSelect(zone) }}
                key={`heat-${zone.id}`}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.12 + intensity * 0.35, opacity: 0.35, weight: isSelected ? 2.5 : 1 }}
                radius={18 + intensity * 20 + (isSelected ? 4 : 0)}
              >
                {renderZonePopup(zone)}
              </CircleMarker>
            );
          })}
        </LayerGroup>
      </LayersControl.Overlay>
    </>
  );
}

// TODO: reemplazar la simulación con una librería heatmap real si se autoriza una dependencia.
