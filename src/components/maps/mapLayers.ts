export type BaseLayerConfig = {
  label: string;
  url: string;
  attribution: string;
  subdomains?: string[];
};

const baseLayers = {
  light: {
    label: 'Claro',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap © CARTO',
    subdomains: ['a', 'b', 'c', 'd'],
  },
  satellite: {
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri',
  },
  dark: {
    label: 'Oscuro',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap © CARTO',
    subdomains: ['a', 'b', 'c', 'd'],
  },
  osm: {
    label: 'Calles',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
  },
} satisfies Record<string, BaseLayerConfig>;

export type BaseLayerKey = keyof typeof baseLayers;

export const BASE_LAYERS: { [Key in BaseLayerKey]: BaseLayerConfig } = baseLayers;

export const MAP_BASE_LAYER_STORAGE_KEY = 'map-base-layer';

export function isBaseLayerKey(value: string): value is BaseLayerKey {
  return value in BASE_LAYERS;
}

export function getStoredBaseLayer(): BaseLayerKey {
  if (typeof window === 'undefined') return 'light';

  const saved = window.localStorage.getItem(MAP_BASE_LAYER_STORAGE_KEY);
  const initialLayer: BaseLayerKey = isBaseLayerKey(saved ?? '') ? (saved as BaseLayerKey) : 'light';

  if (saved !== initialLayer) {
    window.localStorage.setItem(MAP_BASE_LAYER_STORAGE_KEY, initialLayer);
  }

  return initialLayer;
}

export function persistBaseLayer(layer: BaseLayerKey): void {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(MAP_BASE_LAYER_STORAGE_KEY, layer);
}

// TODO: Agregar overlay de tráfico con proveedor externo.
// Opciones futuras: TomTom, HERE o Mapbox Traffic.
// No implementar tráfico real hasta tener API key.
