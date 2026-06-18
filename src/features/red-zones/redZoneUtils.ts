import type { RedZone } from './redZoneTypes';

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isPointInActiveRedZone(lat: number | undefined, lon: number | undefined, zones: RedZone[]): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

  return zones.some(
    (zone) =>
      zone.status === 'active' &&
      zone.lat !== null &&
      zone.lon !== null &&
      distanceMeters(lat as number, lon as number, zone.lat, zone.lon) <= zone.radius_m,
  );
}

export const severityColor = (severity: RedZone['severity']) => {
  if (severity === 'critica') return '#991b1b';
  if (severity === 'alta') return '#dc2626';
  if (severity === 'media') return '#f59e0b';
  return '#facc15';
};

export const severityWeight = (severity: RedZone['severity']) => {
  if (severity === 'critica') return 1;
  if (severity === 'alta') return 0.8;
  if (severity === 'media') return 0.55;
  return 0.3;
};
