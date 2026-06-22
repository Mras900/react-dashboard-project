import type { FeatureCollection } from 'geojson';

const CHILE_COMUNAS_GEOJSON_URL = '/data/map-layers/chile_comunas_simplified.geojson';
const CHILE_COMUNAS_GEOJSON_FALLBACK_URL = '/data/map-layers/chile_comunas.geojson';

function isFeatureCollection(value: unknown): value is FeatureCollection {
  return Boolean(
    value
      && typeof value === 'object'
      && (value as { type?: unknown }).type === 'FeatureCollection'
      && Array.isArray((value as { features?: unknown }).features),
  );
}

export async function loadRegionalGeoLayer(signal?: AbortSignal): Promise<FeatureCollection> {
  const urls = [CHILE_COMUNAS_GEOJSON_URL, CHILE_COMUNAS_GEOJSON_FALLBACK_URL];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (import.meta.env.DEV) console.log('[Chile Comunas GeoJSON] selected URL:', url);

    const response = await fetch(url, { signal });

    if (import.meta.env.DEV) {
      console.log('[Chile Comunas GeoJSON] status:', response.status);
      console.log('[Chile Comunas GeoJSON] content-type:', response.headers.get('content-type'));
    }

    if (!response.ok) {
      if (import.meta.env.DEV) console.warn('[Chile Comunas GeoJSON] fetch failed, trying fallback...');
      continue;
    }

    const data: unknown = await response.json();

    if (!isFeatureCollection(data)) {
      if (import.meta.env.DEV) console.warn('[Chile Comunas GeoJSON] not a valid FeatureCollection, trying fallback...');
      continue;
    }

    if (data.features.length === 0) {
      if (import.meta.env.DEV) console.warn('[Chile Comunas GeoJSON] empty features, trying fallback...');
      continue;
    }

    if (import.meta.env.DEV) {
      console.log('[Chile Comunas GeoJSON] features:', data.features.length);
      console.log('[Chile Comunas GeoJSON] first properties:', data.features[0]?.properties);
    }

    return data;
  }

  throw new Error('No se pudo cargar la capa comunal de Chile');
}
