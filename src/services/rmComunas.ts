const _RM_COMUNAS_NORMALIZED = new Set([
  'SANTIAGO', 'CERRILLOS', 'CERRO NAVIA', 'CONCHALI', 'EL BOSQUE',
  'ESTACION CENTRAL', 'HUECHURABA', 'INDEPENDENCIA', 'LA CISTERNA',
  'LA FLORIDA', 'LA GRANJA', 'LA PINTANA', 'LA REINA', 'LAS CONDES',
  'LO BARNECHEA', 'LO ESPEJO', 'LO PRADO', 'MACUL', 'MAIPU',
  'NUNOA', 'PEDRO AGUIRRE CERDA', 'PENALOLEN', 'PROVIDENCIA',
  'PUDAHUEL', 'QUILICURA', 'QUINTA NORMAL', 'RECOLETA', 'RENCA',
  'SAN JOAQUIN', 'SAN MIGUEL', 'SAN RAMON', 'VITACURA',
  'PUENTE ALTO', 'PIRQUE', 'SAN JOSE DE MAIPO',
  'COLINA', 'LAMPA', 'TILTIL',
  'SAN BERNARDO', 'BUIN', 'CALERA DE TANGO', 'PAINE',
  'MELIPILLA', 'ALHUE', 'CURACAVI', 'MARIA PINTO', 'SAN PEDRO',
  'TALAGANTE', 'EL MONTE', 'ISLA DE MAIPO', 'PADRE HURTADO', 'PENAFLOR',
]);

export function normalizeName(value?: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function isRmComuna(comuna?: string | null): boolean {
  return _RM_COMUNAS_NORMALIZED.has(normalizeName(comuna));
}
