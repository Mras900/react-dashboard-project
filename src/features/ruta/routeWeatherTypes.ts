export type RouteWeatherRisk = 'normal' | 'precaucion' | 'alto' | 'sin_datos';

export interface RouteWeatherCurrent {
  temperature2m?: number;
  relativeHumidity2m?: number;
  precipitation?: number;
  rain?: number;
  weatherCode?: number;
  cloudCover?: number;
  windSpeed10m?: number;
  windGusts10m?: number;
  isDay?: number;
}

export interface RouteWeatherSummary {
  source?: 'openweather' | 'meteochile' | 'open-meteo' | 'unavailable';
  locationName?: string;
  date: string;
  temperatureMax?: number;
  temperatureMin?: number;
  precipitationSum?: number;
  precipitationProbabilityMax?: number;
  windSpeedMax?: number;
  weatherCode?: number;
  current?: RouteWeatherCurrent;
  riskLevel: RouteWeatherRisk;
  riskLabel: string;
  riskReasons: string[];
  message?: string;
}

export interface RouteWeatherParams {
  latitude: number;
  longitude: number;
  date: string;
}

export interface RouteWeatherCacheEntry {
  data: RouteWeatherSummary;
  cachedAt: number;
}

export interface WeatherPresentation {
  icon: string;
  label: string;
  tone: 'normal' | 'rain' | 'wind' | 'storm' | 'cloud';
}
