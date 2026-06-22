import type { Feature } from 'geojson';

const FEATURE_NAME_KEYS = [
  'COMUNA',
  'NOM_COMUNA',
  'NOMBRE_COMUNA',
  'NOM_COM',
  'Comuna',
  'comuna',
  'CIUDAD',
  'Ciudad',
  'NOMBRE',
  'Nombre',
  'nombre',
  'NAME',
  'Name',
  'NOM_REG',
  'REGION',
  'Region',
] as const;

export function normalizeMapJoinKey(value?: string | null): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getRegionalFeatureName(feature?: Feature): string {
  const properties = feature?.properties as Record<string, unknown> | null | undefined;
  if (!properties) return '';

  for (const key of FEATURE_NAME_KEYS) {
    const value = properties[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }

  return '';
}
