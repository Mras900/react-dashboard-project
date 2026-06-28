import { useMemo } from 'react';
import { censoComunasRM2024 } from '../../data/censoComunasRM2024';
import {
  reclamosCensoRM2026,
  resumenDiarioTerritorialRM2026,
  resumenMensualTerritorialRM2026,
  resumenSemanalTerritorialRM2026,
  resumenTerritorialRM2026,
} from '../../data/reclamosCensoRM2026';
import type { TerritorialComunaMetric, TerritorialPeriodSummary } from './territorial-types';

type CensoComuna = (typeof censoComunasRM2024)[number];

export interface ActiveTerritorialRow {
  comuna: string;
  visitas: number;
  ticketsUnicos?: number;
  facturacion?: number;
  alta?: number;
  media?: number;
  baja?: number;
  reiteradas?: number;
}

interface TerritorialSummary {
  totalReclamosRm: number;
  totalFacturacionRm: number;
  totalTicketsUnicos: number;
  totalClientesUnicos: number;
  totalDireccionesUnicas: number;
  totalComunasConReclamos: number;
  totalComunasRm: number;
  coberturaComunalPct: number;
  alcanceTerritorialPct: number;
  coberturaPoblacionalPct: number;
  prioridadAltaTotal: number;
  prioridadMediaTotal: number;
  prioridadBajaTotal: number;
  sinPrioridadTotal: number;
  porcentajePrioridadAlta: number;
  topComunaReclamos: string;
  topComunaFacturacion: string;
  topComunaIntensidad: string;
  topComunaCriticidad: string;
  zonaRmMasAfectada: string;
  concentracionTop3ReclamosPct: number;
  concentracionTop5ReclamosPct: number;
  concentracionTop5FacturacionPct: number;
  comunasSinMatch: string[];
  macrozona: string;
}

export interface UseTerritorialMetricsParams {
  rows?: readonly ActiveTerritorialRow[];
  hasActiveSource?: boolean;
  censoComunas?: readonly CensoComuna[];
  fallbackTerritorialData?: readonly TerritorialComunaMetric[];
  fallbackResumen?: TerritorialSummary;
  allowFallback?: boolean;
}

const normalizeKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const safeNumber = (value: number | undefined) => (Number.isFinite(value) ? Number(value) : 0);
const pct = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);
const normalize = (value: number, max: number) => (max > 0 ? (value / max) * 100 : 0);

const riskLevel = (score: number): TerritorialComunaMetric['riesgoOperativoNivel'] => {
  if (score <= 0) return 'Sin reclamos';
  if (score >= 75) return 'Crítico';
  if (score >= 50) return 'Alto';
  if (score >= 25) return 'Medio';
  return 'Bajo';
};

const intensityLevel = (score: number): TerritorialComunaMetric['intensidadTerritorialNivel'] => {
  if (score <= 0) return 'Sin reclamos';
  if (score >= 75) return 'Crítica';
  if (score >= 50) return 'Alta';
  if (score >= 25) return 'Media';
  return 'Baja';
};

const createEmptySummary = (totalComunasRm: number): TerritorialSummary => ({
  totalReclamosRm: 0,
  totalFacturacionRm: 0,
  totalTicketsUnicos: 0,
  totalClientesUnicos: 0,
  totalDireccionesUnicas: 0,
  totalComunasConReclamos: 0,
  totalComunasRm,
  coberturaComunalPct: 0,
  alcanceTerritorialPct: 0,
  coberturaPoblacionalPct: 0,
  prioridadAltaTotal: 0,
  prioridadMediaTotal: 0,
  prioridadBajaTotal: 0,
  sinPrioridadTotal: 0,
  porcentajePrioridadAlta: 0,
  topComunaReclamos: '',
  topComunaFacturacion: '',
  topComunaIntensidad: '',
  topComunaCriticidad: '',
  zonaRmMasAfectada: '',
  concentracionTop3ReclamosPct: 0,
  concentracionTop5ReclamosPct: 0,
  concentracionTop5FacturacionPct: 0,
  comunasSinMatch: [],
  macrozona: '',
});

function buildTerritorialMetrics(rows: readonly ActiveTerritorialRow[], censoComunas: readonly CensoComuna[]) {
  const censoByName = new Map(censoComunas.map((item) => [normalizeKey(item.comuna), item] as const));
  const grouped = new Map<string, ActiveTerritorialRow>();
  const comunasSinMatch = new Set<string>();

  rows.forEach((row) => {
    const key = normalizeKey(row.comuna || '');
    if (!key) return;

    const current = grouped.get(key) ?? { comuna: row.comuna, visitas: 0, ticketsUnicos: 0, facturacion: 0, alta: 0, media: 0, baja: 0, reiteradas: 0 };
    current.visitas += safeNumber(row.visitas);
    current.ticketsUnicos = safeNumber(current.ticketsUnicos) + safeNumber(row.ticketsUnicos);
    current.facturacion = safeNumber(current.facturacion) + safeNumber(row.facturacion);
    current.alta = safeNumber(current.alta) + safeNumber(row.alta);
    current.media = safeNumber(current.media) + safeNumber(row.media);
    current.baja = safeNumber(current.baja) + safeNumber(row.baja);
    current.reiteradas = safeNumber(current.reiteradas) + safeNumber(row.reiteradas);
    grouped.set(key, current);

    if (!censoByName.has(key)) comunasSinMatch.add(row.comuna);
  });

  const activeRows = [...grouped.entries()]
    .map(([key, row]) => ({ key, row, censo: censoByName.get(key) }))
    .filter(({ row }) => safeNumber(row.visitas) > 0 || safeNumber(row.facturacion) > 0 || safeNumber(row.alta) > 0 || safeNumber(row.media) > 0 || safeNumber(row.baja) > 0);

  const totalReclamos = activeRows.reduce((sum, { row }) => sum + safeNumber(row.visitas), 0);
  const totalFacturacion = activeRows.reduce((sum, { row }) => sum + safeNumber(row.facturacion), 0);
  const totalTickets = activeRows.reduce((sum, { row }) => sum + safeNumber(row.ticketsUnicos), 0);
  const prioridadAltaTotal = activeRows.reduce((sum, { row }) => sum + safeNumber(row.alta), 0);
  const prioridadMediaTotal = activeRows.reduce((sum, { row }) => sum + safeNumber(row.media), 0);
  const prioridadBajaTotal = activeRows.reduce((sum, { row }) => sum + safeNumber(row.baja), 0);
  const poblacionCubierta = activeRows.reduce((sum, { censo }) => sum + safeNumber(censo?.poblacion2024), 0);
  const poblacionTotal = censoComunas.reduce((sum, item) => sum + safeNumber(item.poblacion2024), 0);
  const maxReclamos = Math.max(0, ...activeRows.map(({ row }) => safeNumber(row.visitas)));
  const maxIntensidad = Math.max(
    0,
    ...activeRows.map(({ row, censo }) => pct(safeNumber(row.visitas) * 100000, safeNumber(censo?.poblacion2024))),
  );
  const maxReincidencia = Math.max(0, ...activeRows.map(({ row }) => safeNumber(row.reiteradas)));

  const dataComunal = activeRows.map<TerritorialComunaMetric>(({ row, censo }) => {
    const reclamos = safeNumber(row.visitas);
    const poblacion = safeNumber(censo?.poblacion2024);
    const hogares = safeNumber(censo?.hogares2024);
    const intensidad100k = poblacion > 0 ? (reclamos / poblacion) * 100000 : 0;
    const intensidad10kHogares = hogares > 0 ? (reclamos / hogares) * 10000 : 0;
    const intensidadScore = normalize(intensidad100k, maxIntensidad);
    const prioridadAltaPct = pct(safeNumber(row.alta), reclamos);
    const volumenScore = normalize(reclamos, maxReclamos);
    const reincidenciaScore = normalize(safeNumber(row.reiteradas), maxReincidencia);
    const criticidadScore = Math.round((volumenScore * 0.45 + prioridadAltaPct * 0.35 + reincidenciaScore * 0.2) * 100) / 100;
    const riesgoOperativoScore = Math.round((volumenScore * 0.35 + intensidadScore * 0.35 + prioridadAltaPct * 0.2 + reincidenciaScore * 0.1) * 100) / 100;

    return {
      codigoComuna: censo?.codigoComuna ?? '',
      comuna: row.comuna,
      macrozonaRm: censo?.macrozonaRm ?? null,
      reclamosTotales: reclamos,
      ticketsUnicos: safeNumber(row.ticketsUnicos),
      clientesUnicos: safeNumber(row.ticketsUnicos),
      direccionesUnicas: safeNumber(row.ticketsUnicos),
      facturacionTotal: safeNumber(row.facturacion),
      promedioPorReclamo: reclamos > 0 ? safeNumber(row.facturacion) / reclamos : 0,
      prioridadAlta: safeNumber(row.alta),
      prioridadMedia: safeNumber(row.media),
      prioridadBaja: safeNumber(row.baja),
      sinPrioridad: Math.max(0, reclamos - safeNumber(row.alta) - safeNumber(row.media) - safeNumber(row.baja)),
      porcentajePrioridadAlta: prioridadAltaPct,
      poblacion2024: poblacion,
      hogares2024: hogares,
      viviendas2024: safeNumber(censo?.viviendas2024),
      reclamosPor100kHabitantes: intensidad100k,
      reclamosPor10kHogares: intensidad10kHogares,
      facturacionPor100kHabitantes: poblacion > 0 ? (safeNumber(row.facturacion) / poblacion) * 100000 : 0,
      facturacionPor10kHogares: hogares > 0 ? (safeNumber(row.facturacion) / hogares) * 10000 : 0,
      clientesReincidentes: safeNumber(row.reiteradas),
      direccionesReincidentes: safeNumber(row.reiteradas),
      indiceReincidenciaComunal: pct(safeNumber(row.reiteradas), reclamos),
      criticidadScore,
      criticidadNivel: riskLevel(criticidadScore),
      intensidadTerritorialScore: Math.round(intensidadScore * 100) / 100,
      intensidadTerritorialNivel: intensityLevel(intensidadScore),
      riesgoOperativoScore,
      riesgoOperativoNivel: riskLevel(riesgoOperativoScore),
      rankingVolumenReclamos: 0,
      rankingIntensidad100k: 0,
      rankingFacturacion: 0,
      rankingCriticidad: 0,
      lecturaUsuario: `${row.comuna} registra ${reclamos.toLocaleString('es-CL')} reclamos en la muestra actual.`,
      motivoCriticidad: 'Calculado según reclamos, prioridad alta e intensidad territorial de la muestra actual.',
      recomendacionOperativa: getActionByRisk(riskLevel(riesgoOperativoScore)),
      etiquetaMapa: `${row.comuna}: ${reclamos.toLocaleString('es-CL')} reclamos`,
    };
  });

  assignRanking(dataComunal, 'reclamosTotales', 'rankingVolumenReclamos');
  assignRanking(dataComunal, 'reclamosPor100kHabitantes', 'rankingIntensidad100k');
  assignRanking(dataComunal, 'facturacionTotal', 'rankingFacturacion');
  assignRanking(dataComunal, 'riesgoOperativoScore', 'rankingCriticidad');

  const byReclamos = [...dataComunal].sort((a, b) => b.reclamosTotales - a.reclamosTotales);
  const byFacturacion = [...dataComunal].sort((a, b) => b.facturacionTotal - a.facturacionTotal);
  const byIntensidad = [...dataComunal].sort((a, b) => b.reclamosPor100kHabitantes - a.reclamosPor100kHabitantes);
  const byRiesgo = [...dataComunal].sort((a, b) => b.riesgoOperativoScore - a.riesgoOperativoScore);
  const macrozonaRows = [...dataComunal.reduce((map, item) => {
    const zona = item.macrozonaRm || 'Sin zona';
    const current = map.get(zona) ?? 0;
    map.set(zona, current + item.reclamosTotales);
    return map;
  }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);

  const resumen: TerritorialSummary = {
    totalReclamosRm: totalReclamos,
    totalFacturacionRm: totalFacturacion,
    totalTicketsUnicos: totalTickets,
    totalClientesUnicos: totalTickets,
    totalDireccionesUnicas: totalTickets,
    totalComunasConReclamos: dataComunal.length,
    totalComunasRm: censoComunas.length,
    coberturaComunalPct: pct(dataComunal.length, censoComunas.length),
    alcanceTerritorialPct: pct(dataComunal.length, censoComunas.length),
    coberturaPoblacionalPct: pct(poblacionCubierta, poblacionTotal),
    prioridadAltaTotal,
    prioridadMediaTotal,
    prioridadBajaTotal,
    sinPrioridadTotal: Math.max(0, totalReclamos - prioridadAltaTotal - prioridadMediaTotal - prioridadBajaTotal),
    porcentajePrioridadAlta: pct(prioridadAltaTotal, totalReclamos),
    topComunaReclamos: byReclamos[0]?.comuna ?? '',
    topComunaFacturacion: byFacturacion[0]?.comuna ?? '',
    topComunaIntensidad: byIntensidad[0]?.comuna ?? '',
    topComunaCriticidad: byRiesgo[0]?.comuna ?? '',
    zonaRmMasAfectada: macrozonaRows[0]?.[0] ?? '',
    concentracionTop3ReclamosPct: pct(byReclamos.slice(0, 3).reduce((sum, item) => sum + item.reclamosTotales, 0), totalReclamos),
    concentracionTop5ReclamosPct: pct(byReclamos.slice(0, 5).reduce((sum, item) => sum + item.reclamosTotales, 0), totalReclamos),
    concentracionTop5FacturacionPct: pct(byFacturacion.slice(0, 5).reduce((sum, item) => sum + item.facturacionTotal, 0), totalFacturacion),
    comunasSinMatch: [...comunasSinMatch],
    macrozona: macrozonaRows[0]?.[0] ?? '',
  };

  return { dataComunal, resumen };
}

function assignRanking(
  rows: TerritorialComunaMetric[],
  metric: keyof Pick<TerritorialComunaMetric, 'reclamosTotales' | 'reclamosPor100kHabitantes' | 'facturacionTotal' | 'riesgoOperativoScore'>,
  rankingKey: keyof Pick<TerritorialComunaMetric, 'rankingVolumenReclamos' | 'rankingIntensidad100k' | 'rankingFacturacion' | 'rankingCriticidad'>,
) {
  [...rows]
    .sort((a, b) => Number(b[metric]) - Number(a[metric]))
    .forEach((item, index) => {
      item[rankingKey] = index + 1;
    });
}

export function getActionByRisk(level?: string) {
  if (level === 'Crítico') return 'Priorizar seguimiento inmediato.';
  if (level === 'Alto') return 'Revisar evidencia y mantener seguimiento.';
  if (level === 'Medio') return 'Monitorear evolución en próximos días.';
  if (level === 'Bajo') return 'Sin acción urgente.';
  return 'Carga un archivo de reclamos.';
}

export function useTerritorialMetrics({
  rows = [],
  hasActiveSource = false,
  censoComunas = censoComunasRM2024,
  fallbackTerritorialData = reclamosCensoRM2026 as readonly TerritorialComunaMetric[],
  fallbackResumen = resumenTerritorialRM2026 as unknown as TerritorialSummary,
  allowFallback = false,
}: UseTerritorialMetricsParams = {}) {
  return useMemo(() => {
    if (hasActiveSource) {
      const built = buildTerritorialMetrics(rows, censoComunas);
      const hasActiveData = built.resumen.totalReclamosRm > 0;
      return {
        dataComunal: built.dataComunal,
        comunas: built.dataComunal,
        resumen: built.resumen,
        cards: [],
        topReclamos: built.dataComunal.find((item) => item.comuna === built.resumen.topComunaReclamos) ?? null,
        topFacturacion: built.dataComunal.find((item) => item.comuna === built.resumen.topComunaFacturacion) ?? null,
        topIntensidad: built.dataComunal.find((item) => item.comuna === built.resumen.topComunaIntensidad) ?? null,
        comunaCritica: built.dataComunal.find((item) => item.comuna === built.resumen.topComunaIntensidad) ?? null,
        zonaRmMasAfectada: built.resumen.zonaRmMasAfectada,
        concentracionTop5: built.resumen.concentracionTop5ReclamosPct,
        alcanceTerritorial: built.resumen.alcanceTerritorialPct,
        isUsingFallback: false,
        hasActiveData,
        warnings: built.resumen.comunasSinMatch.length > 0 ? [`${built.resumen.comunasSinMatch.length} comunas sin match censal`] : [],
        diario: [] as readonly TerritorialPeriodSummary[],
        semanal: [] as readonly TerritorialPeriodSummary[],
        mensual: [] as readonly TerritorialPeriodSummary[],
      };
    }

    if (allowFallback) {
      const fallbackData = [...fallbackTerritorialData];
      return {
        dataComunal: fallbackData,
        comunas: fallbackData,
        resumen: fallbackResumen,
        cards: [],
        topReclamos: fallbackData.find((item) => item.comuna === fallbackResumen.topComunaReclamos) ?? null,
        topFacturacion: fallbackData.find((item) => item.comuna === fallbackResumen.topComunaFacturacion) ?? null,
        topIntensidad: fallbackData.find((item) => item.comuna === fallbackResumen.topComunaIntensidad) ?? null,
        comunaCritica: fallbackData.find((item) => item.comuna === fallbackResumen.topComunaIntensidad) ?? null,
        zonaRmMasAfectada: fallbackResumen.zonaRmMasAfectada,
        concentracionTop5: fallbackResumen.concentracionTop5ReclamosPct,
        alcanceTerritorial: fallbackResumen.alcanceTerritorialPct,
        isUsingFallback: true,
        hasActiveData: fallbackData.length > 0 && fallbackResumen.totalReclamosRm > 0,
        warnings: ['Usando archivo generado de respaldo'],
        diario: resumenDiarioTerritorialRM2026 as readonly TerritorialPeriodSummary[],
        semanal: resumenSemanalTerritorialRM2026 as readonly TerritorialPeriodSummary[],
        mensual: resumenMensualTerritorialRM2026 as readonly TerritorialPeriodSummary[],
      };
    }

    const resumen = createEmptySummary(censoComunas.length);
    return {
      dataComunal: [] as TerritorialComunaMetric[],
      comunas: [] as TerritorialComunaMetric[],
      resumen,
      cards: [],
      topReclamos: null,
      topFacturacion: null,
      topIntensidad: null,
      comunaCritica: null,
      zonaRmMasAfectada: '',
      concentracionTop5: 0,
      alcanceTerritorial: 0,
      isUsingFallback: false,
      hasActiveData: false,
      warnings: [] as string[],
      diario: [] as readonly TerritorialPeriodSummary[],
      semanal: [] as readonly TerritorialPeriodSummary[],
      mensual: [] as readonly TerritorialPeriodSummary[],
    };
  }, [allowFallback, censoComunas, fallbackResumen, fallbackTerritorialData, hasActiveSource, rows]);
}

