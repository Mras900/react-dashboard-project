export type TerritorialLevel = 'Sin reclamos' | 'Bajo' | 'Medio' | 'Alto' | 'Crítico';
export type TerritorialIntensityLevel = 'Sin reclamos' | 'Baja' | 'Media' | 'Alta' | 'Crítica';

export interface TerritorialComunaMetric {
  codigoComuna: string;
  comuna: string;
  macrozonaRm: string | null;
  reclamosTotales: number;
  ticketsUnicos: number;
  clientesUnicos: number;
  direccionesUnicas: number;
  facturacionTotal: number;
  promedioPorReclamo: number;
  prioridadAlta: number;
  prioridadMedia: number;
  prioridadBaja: number;
  sinPrioridad: number;
  porcentajePrioridadAlta: number;
  poblacion2024: number;
  hogares2024: number;
  viviendas2024: number;
  reclamosPor100kHabitantes: number;
  reclamosPor10kHogares: number;
  facturacionPor100kHabitantes: number;
  facturacionPor10kHogares: number;
  clientesReincidentes: number;
  direccionesReincidentes: number;
  indiceReincidenciaComunal: number;
  criticidadScore: number;
  criticidadNivel: TerritorialLevel;
  intensidadTerritorialScore: number;
  intensidadTerritorialNivel: TerritorialIntensityLevel;
  riesgoOperativoScore: number;
  riesgoOperativoNivel: TerritorialLevel;
  rankingVolumenReclamos: number;
  rankingIntensidad100k: number;
  rankingFacturacion: number;
  rankingCriticidad: number;
  lecturaUsuario: string;
  motivoCriticidad: string;
  recomendacionOperativa: string;
  etiquetaMapa: string;
}

export interface TerritorialSummaryCard {
  id: string;
  titulo: string;
  valor: string;
  nivel: string;
  descripcion: string;
  tooltip: string;
}

export interface TerritorialPeriodSummary {
  periodoTipo: 'dia' | 'semana' | 'mes' | string;
  periodoLabel: string;
  fechaInicio: string;
  fechaFin: string;
  totalReclamos: number;
  totalFacturacion: number;
  ticketsUnicos: number;
  comunasAfectadas: number;
  comunaTopReclamos: string;
  comunaTopIntensidad: string;
  comunaCritica: string;
  zonaRmMasAfectada: string;
  prioridadAltaTotal: number;
  porcentajePrioridadAlta: number;
  concentracionTop3ReclamosPct: number;
  concentracionTop5ReclamosPct: number;
  coberturaComunalPct: number;
  alcanceTerritorialPct: number;
  lecturaUsuarioPeriodo: string;
}

