import type { RouteWeatherParams, RouteWeatherRisk, RouteWeatherSummary, RouteWeatherCacheEntry, WeatherPresentation } from './routeWeatherTypes';

const CACHE_KEY = 'dashboard-route-weather-cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FORECAST_API = 'https://api.open-meteo.com/v1/forecast';
type BackendRouteWeatherResponse = RouteWeatherSummary & {
  source?: string;
  temperatureCurrent?: number | null;
  humidity?: number | null;
  precipitationCurrent?: number | null;
  windSpeedCurrent?: number | null;
  windGusts?: number | null;
};

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
  const wc = summary.weatherCode;
  const windGust = summary.current?.windGusts10m;

  // Storm codes
  if (wc !== undefined && wc >= 95) reasons.push('Tormenta eléctrica');
  else if (wc !== undefined && wc >= 61 && wc <= 82) reasons.push('Lluvia en la zona');

  // Precipitation
  if ((summary.precipitationSum ?? 0) >= 10) reasons.push('Lluvia acumulada ≥ 10 mm');
  else if ((summary.precipitationSum ?? 0) >= 3) reasons.push('Lluvia acumulada ≥ 3 mm');

  if ((summary.precipitationProbabilityMax ?? 0) >= 70) reasons.push('Probabilidad lluvia ≥ 70%');
  else if ((summary.precipitationProbabilityMax ?? 0) >= 50) reasons.push('Probabilidad lluvia ≥ 50%');

  // Wind from daily
  if ((summary.windSpeedMax ?? 0) >= 45) reasons.push('Viento ≥ 45 km/h');
  else if ((summary.windSpeedMax ?? 0) >= 30) reasons.push('Viento ≥ 30 km/h');

  // Wind gusts from current
  if (windGust !== undefined && windGust >= 55) reasons.push('Ráfagas ≥ 55 km/h');
  else if (windGust !== undefined && windGust >= 40) reasons.push('Ráfagas ≥ 40 km/h');

  // Temperature
  if ((summary.temperatureMax ?? 0) >= 34) reasons.push('Temperatura máxima ≥ 34 °C');

  if ((summary.temperatureMin ?? 0) <= 2 && (summary.temperatureMin ?? 0) > 0) reasons.push('Temperatura mínima ≤ 2 °C');
  if ((summary.temperatureMin ?? 0) <= 0) reasons.push('Temperatura bajo cero / helada');

  const level: RouteWeatherRisk =
    reasons.some((r) => r.includes('≥ 10 mm') || r.includes('≥ 45 km/h') || r.includes('bajo cero') || r.includes('Tormenta') || r.includes('55 km/h'))
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
  sin_datos: 'No hay datos climáticos disponibles.',
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

/** MeteoChile — Servicios Climáticos.
 *  NOTA: El portal visual (PortalDMC-web) no expone API JSON directa.
 *  Si en el futuro hay endpoint JSON/GeoJSON estable, implementar aquí.
 *  Por ahora retorna null y se usa Open-Meteo como fallback. */
async function fetchMeteoChileWeather(_params: RouteWeatherParams): Promise<RouteWeatherSummary | null> {
  // MeteoChile actualmente no expone API JSON pública para pronóstico por comuna.
  // El portal web usa componentes JS dinámicos sin endpoint REST estable.
  // Cuando exista endpoint oficial documentado, implementar aquí.
  return null;
}

export async function fetchRouteWeather(params: RouteWeatherParams): Promise<RouteWeatherSummary> {
  const cacheKey = getCacheKey(params);
  const cache = readCache();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // Try backend proxy first (OpenWeather via FastAPI)
  try {
    const backendUrl = `/api/weather/route?lat=${params.latitude}&lon=${params.longitude}&date=${params.date}`;
    const backendResp = await fetch(backendUrl);
    if (backendResp.ok) {
      const backendData: BackendRouteWeatherResponse = await backendResp.json();
      if (backendData.source === 'openweather') {
        const summary: RouteWeatherSummary = {
          source: 'openweather',
          locationName: backendData.locationName,
          date: params.date,
          temperatureMax: backendData.temperatureMax,
          temperatureMin: backendData.temperatureMin,
          precipitationSum: backendData.precipitationSum,
          precipitationProbabilityMax: backendData.precipitationProbabilityMax,
          windSpeedMax: backendData.windSpeedMax,
          weatherCode: typeof backendData.weatherCode === 'number' ? backendData.weatherCode : undefined,
          current: {
            temperature2m: backendData.temperatureCurrent ?? undefined,
            relativeHumidity2m: backendData.humidity ?? undefined,
            precipitation: backendData.precipitationCurrent ?? undefined,
            windSpeed10m: backendData.windSpeedCurrent ?? undefined,
            windGusts10m: backendData.windGusts ?? undefined,
            isDay: undefined,
          },
          riskLevel: backendData.riskLevel ?? 'normal',
          riskLabel: backendData.riskLabel ?? '',
          riskReasons: backendData.riskReasons ?? [],
        };
        cache.set(cacheKey, { data: summary, cachedAt: Date.now() });
        writeCache(cache);
        return summary;
      }
    }
  } catch {
    // Backend unavailable — fall through to Open-Meteo
  }

  // Try MeteoChile fallback
  const meteochileResult = await fetchMeteoChileWeather(params);
  if (meteochileResult) {
    cache.set(cacheKey, { data: meteochileResult, cachedAt: Date.now() });
    writeCache(cache);
    return meteochileResult;
  }

  // Final fallback: Open-Meteo direct
  const url = `${FORECAST_API}?latitude=${params.latitude}&longitude=${params.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code&timezone=America/Santiago&forecast_days=16`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error clima: ${response.status}`);
  }

  const json: unknown = await response.json();
  const daily = (json as { daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_sum?: number[]; precipitation_probability_max?: number[]; wind_speed_10m_max?: number[]; weather_code?: number[] } })?.daily;
  const currentRaw = (json as { current?: { temperature_2m?: number; relative_humidity_2m?: number; precipitation?: number; rain?: number; weather_code?: number; cloud_cover?: number; wind_speed_10m?: number; wind_gusts_10m?: number; is_day?: number } })?.current;

  if (!daily || !daily.time) {
    throw new Error('Clima: datos no disponibles');
  }

  const dayIndex = daily.time.indexOf(params.date);
  if (dayIndex === -1) {
    return {
      source: 'unavailable',
      date: params.date,
      riskLevel: 'sin_datos',
      riskLabel: 'Pronóstico disponible solo para próximos días. Puedes continuar cargando la ruta.',
      riskReasons: [],
      message: 'Pronóstico no disponible para esta fecha.',
    };
  }

  const partial: Partial<RouteWeatherSummary> = {
    source: 'open-meteo',
    date: params.date,
    temperatureMax: daily.temperature_2m_max?.[dayIndex],
    temperatureMin: daily.temperature_2m_min?.[dayIndex],
    precipitationSum: daily.precipitation_sum?.[dayIndex],
    precipitationProbabilityMax: daily.precipitation_probability_max?.[dayIndex],
    windSpeedMax: daily.wind_speed_10m_max?.[dayIndex],
    weatherCode: daily.weather_code?.[dayIndex],
    current: currentRaw ? {
      temperature2m: currentRaw.temperature_2m,
      relativeHumidity2m: currentRaw.relative_humidity_2m,
      precipitation: currentRaw.precipitation,
      rain: currentRaw.rain,
      weatherCode: currentRaw.weather_code,
      cloudCover: currentRaw.cloud_cover,
      windSpeed10m: currentRaw.wind_speed_10m,
      windGusts10m: currentRaw.wind_gusts_10m,
      isDay: currentRaw.is_day,
    } : undefined,
  };

  const { riskLevel, riskReasons } = determineRisk(partial);

  const summary: RouteWeatherSummary = {
    ...partial,
    source: 'open-meteo',
    date: params.date,
    riskLevel,
    riskLabel: RISK_LABELS[riskLevel] + ' Alerta operativa calculada según condiciones meteorológicas.',
    riskReasons: riskReasons.length > 0 ? riskReasons : ['Sin alertas climáticas significativas.'],
  };

  cache.set(cacheKey, { data: summary, cachedAt: Date.now() });
  writeCache(cache);

  return summary;
}

export function getWeatherPresentation(code: number | undefined, isDay?: number): WeatherPresentation {
  const d = { icon: '☀️', label: 'Despejado', tone: 'normal' as const };
  if (code === undefined || code === null) return { ...d, icon: '🌡️', label: 'Condición no disponible' };
  if (code === 0) return isDay === 0 ? { icon: '🌙', label: 'Despejado', tone: 'normal' } : d;
  if (code === 1 || code === 2) return { icon: '🌤️', label: 'Parcialmente despejado', tone: 'normal' };
  if (code === 3) return { icon: '☁️', label: 'Nublado', tone: 'cloud' };
  if (code === 45 || code === 48) return { icon: '🌫️', label: 'Niebla', tone: 'cloud' };
  if (code === 51 || code === 53 || code === 55) return { icon: '🌦️', label: 'Llovizna', tone: 'rain' };
  if (code === 56 || code === 57) return { icon: '🌧️', label: 'Lluvia helada', tone: 'rain' };
  if (code === 61 || code === 63 || code === 65) return { icon: '🌧️', label: 'Lluvia', tone: 'rain' };
  if (code === 66 || code === 67) return { icon: '🌧️', label: 'Lluvia helada', tone: 'rain' };
  if (code === 71 || code === 73 || code === 75 || code === 77) return { icon: '❄️', label: 'Nieve', tone: 'rain' };
  if (code === 80 || code === 81 || code === 82) return { icon: '🌦️', label: 'Chubascos', tone: 'rain' };
  if (code === 85 || code === 86) return { icon: '❄️', label: 'Chubascos de nieve', tone: 'rain' };
  if (code === 95) return { icon: '⛈️', label: 'Tormenta', tone: 'storm' };
  if (code >= 96) return { icon: '⛈️', label: 'Tormenta fuerte', tone: 'storm' };
  return { ...d, icon: '🌡️', label: 'Condición no disponible' };
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
