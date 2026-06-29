import { getField, normalizeHeader } from './normalizeImportedRows';
import type { RawImportedRow, TerritoryScope } from './importTypes';

const rmComunas = new Set(
  [
    'Santiago',
    'Cerrillos',
    'Cerro Navia',
    'Conchalí',
    'El Bosque',
    'Estación Central',
    'Huechuraba',
    'Independencia',
    'La Cisterna',
    'La Florida',
    'La Granja',
    'La Pintana',
    'La Reina',
    'Las Condes',
    'Lo Barnechea',
    'Lo Espejo',
    'Lo Prado',
    'Macul',
    'Maipú',
    'Ñuñoa',
    'Pedro Aguirre Cerda',
    'Peñalolén',
    'Providencia',
    'Pudahuel',
    'Quilicura',
    'Quinta Normal',
    'Recoleta',
    'Renca',
    'San Joaquín',
    'San Miguel',
    'San Ramón',
    'Vitacura',
    'Puente Alto',
    'Pirque',
    'San José de Maipo',
    'Colina',
    'Lampa',
    'Tiltil',
    'San Bernardo',
    'Buin',
    'Calera de Tango',
    'Paine',
    'Melipilla',
    'Alhué',
    'Curacaví',
    'María Pinto',
    'San Pedro',
    'Talagante',
    'El Monte',
    'Isla de Maipo',
    'Padre Hurtado',
    'Peñaflor',
  ].map(normalizeHeader),
);

export function classifyTerritory(row: RawImportedRow): TerritoryScope | null {
  const region = normalizeHeader(getField(row, ['REGION_KUT', 'Región', 'Region']));
  const comuna = normalizeHeader(getField(row, ['Comuna', 'COMUNA', 'comuna', 'Descripción Comuna', 'Descripcion Comuna']));
  const hasConsolidadoRmBilling = Boolean(getField(row, ['FACTURA'])) && Boolean(getField(row, ['Comuna']));

  if (hasConsolidadoRmBilling && rmComunas.has(comuna)) return 'rm';
  if (region.includes('metropolitana') || region === 'rm' || region.includes('santiago')) return 'rm';
  if (region) return 'regiones';
  if (rmComunas.has(comuna)) return 'rm';
  if (comuna) return 'regiones';

  return null;
}
