import type { RouteWeatherParams, RouteWeatherRisk, RouteWeatherSummary, RouteWeatherCacheEntry } from './routeWeatherTypes';

const CACHE_KEY = 'dashboard-route-weather-cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FORECAST_API = 'https://api.open-meteo.com/v1/forecast';

function readCache(): Map<string, RouteWeatherCacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, RouteWeatherCacheEntry>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function writeCache(map: Map<string, RouteWeatherCacheEntry>): void {
  try {
    const obj: Record<string, RouteWeatherCacheEntry> = {};
    map.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    // Silently fail — cache is non-critical
  }
}

function getCacheKey(params: RouteWeatherParams): string {
  return `${params.latitude.toFixed(2)},${params.longitude.toFixed(2)},${params.date}`;
}

function determineRisk(summary: Partial<RouteWeatherSummary>): {
  riskLevel: RouteWeatherRisk;
  riskReasons: string[];
} {
  const reasons: string[] = [];

  if ((summary.precipitationSum ?? 0) >= 10) reasons.push('Lluvia acumulada ≥ 10 mm');
  else if ((summary.precipitationSum ?? 0) >= 3) reasons.push('Lluvia acumulada ≥ 3 mm');

  if ((summary.precipitationProbabilityMax ?? 0) >= 70) reasons.push('Probabilidad lluvia ≥ 70%');
  else if ((summary.precipitationProbabilityMax ?? 0) >= 50) reasons.push('Probabilidad lluvia ≥ 50%');

  if ((summary.windSpeedMax ?? 0) >= 45) reasons.push('Viento ≥ 45 km/h');
  else if ((summary.windSpeedMax ?? 0) >= 30) reasons.push('Viento ≥ 30 km/h');

  if ((summary.temperatureMax ?? 0) >= 34) reasons.push('Temperatura máxima ≥ 34 °C');

  if ((summary.temperatureMin ?? 0) <= 2 && (summary.temperatureMin ?? 0) > 0) reasons.push('Temperatura mínima ≤ 2 °C');
  if ((summary.temperatureMin ?? 0) <= 0) reasons.push('Temperatura bajo cero');

  const level: RouteWeatherRisk =
    reasons.some((r) => r.includes('≥ 10 mm') || r.includes('≥ 45 km/h') || r.includes('bajo cero'))
      ? 'alto'
      : reasons.length > 0
        ? 'precaucion'
        : 'normal';

  return { riskLevel: level, riskReasons: reasons };
}

const RISK_LABELS: Record<RouteWeatherRisk, string> = {
  normal: 'Condiciones normales para ruta.',
  precaucion: 'Precaución: revisar condiciones antes de salir.',
  alto: 'Alerta operativa: clima puede afectar la ruta.',
};

// Weather code to description (WMO codes)
function weatherCodeDescription(code: number | undefined): string {
  if (code === undefined || code === null) return '';
  if (code === 0) return 'Despejado';
  if (code <= 3) return 'Parcialmente nublado';
  if (code <= 19) return 'Niebla';
  if (code <= 29) return 'Tormenta';
  if (code <= 39) return 'Nevada';
  if (code <= 49) return 'Lluvia';
  if (code <= 59) return 'Lluvia';
  if (code <= 69) return 'Nieve';
  if (code <= 79) return 'Lluvia';
  if (code <= 84) return 'Chubascos';
  if (code <= 99) return 'Tormenta';
  return '';
}

export async function fetchRouteWeather(params: RouteWeatherParams): Promise<RouteWeatherSummary> {
  const cacheKey = getCacheKey(params);
  const cache = readCache();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${FORECAST_API}?latitude=${params.latitude}&longitude=${params.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code&timezone=America/Santiago&forecast_days=16`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error clima: ${response.status}`);
  }

  const json: unknown = await response.json();
  const daily = (json as { daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_sum?: number[]; precipitation_probability_max?: number[]; wind_speed_10m_max?: number[]; weather_code?: number[] } })?.daily;

  if (!daily || !daily.time) {
    throw new Error('Clima: datos no disponibles');
  }

  const dayIndex = daily.time.indexOf(params.date);
  if (dayIndex === -1) {
    throw new Error('Pronóstico disponible solo para próximos días.');
  }

  const partial: Partial<RouteWeatherSummary> = {
    date: params.date,
    temperatureMax: daily.temperature_2m_max?.[dayIndex],
    temperatureMin: daily.temperature_2m_min?.[dayIndex],
    precipitationSum: daily.precipitation_sum?.[dayIndex],
    precipitationProbabilityMax: daily.precipitation_probability_max?.[dayIndex],
    windSpeedMax: daily.wind_speed_10m_max?.[dayIndex],
    weatherCode: daily.weather_code?.[dayIndex],
  };

  const { riskLevel, riskReasons } = determineRisk(partial);

  const summary: RouteWeatherSummary = {
    ...partial,
    date: params.date,
    riskLevel,
    riskLabel: RISK_LABELS[riskLevel] + ' Alerta operativa calculada según pronóstico.',
    riskReasons: riskReasons.length > 0 ? riskReasons : ['Sin alertas climáticas significativas.'],
  };

  // Cache
  cache.set(cacheKey, { data: summary, cachedAt: Date.now() });
  writeCache(cache);

  return summary;
}

export function getWeatherEmoji(code: number | undefined): string {
  if (code === undefined || code === null) return '☀️';
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 19) return '🌫️';
  if (code <= 29) return '🌩️';
  if (code <= 49) return '🌧️';
  if (code <= 79) return '🌧️';
  return '⛈️';
}

export const KNOWN_COMUNAS: Array<{ name: string; lat: number; lng: number }> = [
  { name: 'Santiago', lat: -33.4489, lng: -70.6693 },
  { name: 'San Bernardo', lat: -33.5922, lng: -70.6996 },
  { name: 'Puente Alto', lat: -33.6117, lng: -70.5758 },
  { name: 'Maipú', lat: -33.5107, lng: -70.7562 },
  { name: 'Viña del Mar', lat: -33.0245, lng: -71.5518 },
  { name: 'Valparaíso', lat: -33.0472, lng: -71.6127 },
  { name: 'Rancagua', lat: -34.1708, lng: -70.7406 },
  { name: 'Talca', lat: -35.4264, lng: -71.6554 },
  { name: 'Concepción', lat: -36.827, lng: -73.0498 },
  { name: 'Chillán', lat: -36.6066, lng: -72.1034 },
  { name: 'Puerto Montt', lat: -41.4693, lng: -72.9424 },
  { name: 'Temuco', lat: -38.7359, lng: -72.5904 },
  { name: 'Antofagasta', lat: -23.65, lng: -70.4 },
  { name: 'La Serena', lat: -29.9078, lng: -71.2543 },
  { name: 'Iquique', lat: -20.213, lng: -70.1494 },
];

export { weatherCodeDescription, determineRisk };
