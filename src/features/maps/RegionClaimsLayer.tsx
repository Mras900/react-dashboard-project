import { useCallback, useMemo } from 'react';
import { GeoJSON } from 'react-leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import type { Layer } from 'leaflet';
import type { ImportedDashboardRow } from '../data-import/importTypes';
import { aggregateClaimsByCommune } from './aggregateClaimsByCommune';
import { getRegionalFeatureName, normalizeMapJoinKey } from './normalizeMapJoinKey';

export interface RegionClaimsLayerProps {
  geoJson: FeatureCollection | null;
  rows: ImportedDashboardRow[];
}

const formatInt = (value: number) => value.toLocaleString('es-CL');
const formatCurrency = (value: number) =>
  value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const escapePopupValue = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

function getFeatureStyle(claims: number) {
  if (claims === 0)
    return { fillColor: '#16213A', color: '#22304D', fillOpacity: 0.18, opacity: 0.9, weight: 0.8 };
  if (claims <= 5)
    return { fillColor: '#2563EB', color: '#334155', fillOpacity: 0.28, opacity: 1, weight: 1 };
  if (claims <= 10)
    return { fillColor: '#0B5CFF', color: '#334155', fillOpacity: 0.38, opacity: 1, weight: 1 };
  if (claims <= 20)
    return { fillColor: '#22D3EE', color: '#334155', fillOpacity: 0.42, opacity: 1, weight: 1 };
  return { fillColor: '#F97316', color: '#334155', fillOpacity: 0.48, opacity: 1, weight: 1 };
}

/** Capa GeoJSON para regiones de Chile dentro de MapContainer.
 *  No crea su propio mapa. Solo renderiza overlay con datos cruzados.
 *  NO usa datos RM. NO usa RM como fallback. */
export function RegionClaimsLayer({ geoJson, rows }: RegionClaimsLayerProps) {
  const aggregates = useMemo(() => aggregateClaimsByCommune(rows), [rows]);

  const getMetricForFeature = useCallback(
    (feature?: Feature) =>
      aggregates.get(normalizeMapJoinKey(getRegionalFeatureName(feature))),
    [aggregates],
  );

  const featureStyle = useCallback(
    (feature?: Feature) => {
      const claims = getMetricForFeature(feature)?.reclamosTotales ?? 0;
      return getFeatureStyle(claims);
    },
    [getMetricForFeature],
  );

  const onEachFeature = useCallback(
    (feature: Feature, layer: Layer) => {
      const featureName = getRegionalFeatureName(feature) || 'Comuna/ciudad sin nombre';
      const metric = getMetricForFeature(feature);

      layer.bindTooltip(featureName, { direction: 'top', sticky: true });

      if (metric) {
        const popupTitle = escapePopupValue(metric.comuna || featureName);
        layer.bindPopup(
          [
            '<div style="min-width:210px">',
            '<p style="font-weight:800;font-size:14px;border-bottom:1px solid #22304D;padding-bottom:5px;margin-bottom:7px;color:#F1F5F9">' +
              popupTitle +
              '</p>',
            '<div style="font-size:12px;line-height:1.55;color:#CBD5E1">',
            '<p>Reclamos: <strong>' + formatInt(metric.reclamosTotales) + '</strong></p>',
            '<p>Tickets únicos: <strong>' + formatInt(metric.ticketsUnicos) + '</strong></p>',
            '<p>Facturación: <strong>' + formatCurrency(metric.facturacionTotal) + '</strong></p>',
            '<p>KM: <strong>' + formatInt(metric.kmTotal) + '</strong></p>',
            '<p>Traslado: <strong>' + formatCurrency(metric.trasladoTotal) + '</strong></p>',
            '<p>Envío bulto: <strong>' + formatCurrency(metric.valorEnvioBultoTotal) + '</strong></p>',
            '<p>Alta prioridad: <strong>' + formatInt(metric.alta) + '</strong></p>',
            '<p>Media prioridad: <strong>' + formatInt(metric.media) + '</strong></p>',
            '<p>Baja prioridad: <strong>' + formatInt(metric.baja) + '</strong></p>',
            '<p>Completadas: <strong>' + formatInt(metric.completadas) + '</strong></p>',
            '<p>Pendientes: <strong>' + formatInt(metric.pendientes) + '</strong></p>',
            '<p>No realizadas: <strong>' + formatInt(metric.noRealizadas) + '</strong></p>',
            '</div></div>',
          ].join(''),
        );
      } else {
        layer.bindPopup(
          '<strong>' + escapePopupValue(featureName) + '</strong><br/>Sin reclamos cargados para esta comuna',
        );
      }

      const pathLayer = layer as unknown as import('leaflet').Path;
      pathLayer.on({
        mouseover: () => {
          pathLayer.setStyle({ color: '#EAF0F8', weight: 2, fillOpacity: 0.85 });
          pathLayer.bringToFront();
        },
        mouseout: () => pathLayer.setStyle(featureStyle(feature) as import('leaflet').PathOptions),
      });
    },
    [featureStyle, getMetricForFeature],
  );

  if (!geoJson || !geoJson.features.length) return null;

  return (
    <GeoJSON
      key={'region-claims-' + aggregates.size + '-' + geoJson.features.length}
      data={geoJson}
      onEachFeature={onEachFeature}
      style={featureStyle}
    />
  );
}
