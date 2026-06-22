export type RouteWeatherRisk = 'normal' | 'precaucion' | 'alto';

export interface RouteWeatherSummary {
  date: string;
  temperatureMax?: number;
  temperatureMin?: number;
  precipitationSum?: number;
  precipitationProbabilityMax?: number;
  windSpeedMax?: number;
  weatherCode?: number;
  riskLevel: RouteWeatherRisk;
  riskLabel: string;
  riskReasons: string[];
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
