import { AlertTriangle } from 'lucide-react';
import type { TerritorialComunaMetric } from './territorial-types';
import { getActionByRisk } from './useTerritorialMetrics';

const formatNumber = (value: number, maximumFractionDigits = 1) =>
  new Intl.NumberFormat('es-CL', { maximumFractionDigits }).format(Number.isFinite(value) ? value : 0);

interface TerritorialSummaryLike {
  totalReclamosRm: number;
}

interface TerritorialInsightCardsProps {
  resumen: TerritorialSummaryLike;
  comunaCritica: TerritorialComunaMetric | null;
  topReclamos: TerritorialComunaMetric | null;
  topFacturacion: TerritorialComunaMetric | null;
  topIntensidad: TerritorialComunaMetric | null;
  isUsingFallback?: boolean;
  hasActiveData?: boolean;
  onOpenExplanation?: () => void;
  onOpenComuna?: (comuna: string) => void;
  onShowEvidence?: (comuna: string) => void;
}

export function TerritorialInsightCards({
  comunaCritica,
  topReclamos,
  isUsingFallback,
  hasActiveData,
  onOpenExplanation,
  onOpenComuna,
}: TerritorialInsightCardsProps) {
  const hasData = Boolean(hasActiveData && comunaCritica);
  const alertComuna = comunaCritica?.comuna ?? '';
  const topVolumeComuna = topReclamos?.comuna ?? '';
  const riskLevel = comunaCritica?.riesgoOperativoNivel ?? 'Sin datos';
  const alertText = !hasData
    ? 'Carga reclamos de Región Metropolitana para calcular prioridades.'
    : topVolumeComuna && topVolumeComuna !== alertComuna
      ? `${alertComuna} presenta mayor intensidad territorial aunque ${topVolumeComuna} lidere en volumen.`
      : `${alertComuna} concentra el mayor volumen o intensidad territorial del periodo analizado.`;
  const actionText = hasData ? getActionByRisk(comunaCritica?.riesgoOperativoNivel) : 'Sin reclamos RM para calcular este análisis.';

  return (
    <article className={`cc-kpi-card-pro flex h-full min-h-[220px] flex-col justify-between gap-4 p-4 ${hasData ? 'border-red-300/30 dark:border-red-300/25' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`cc-kpi-icon-pro shrink-0 ${hasData ? 'text-red-500 dark:text-red-300' : 'text-slate-400'}`}><AlertTriangle size={20} /></div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-[#93a4b8]">Alerta territorial</p>
              <p className="mt-1 break-words text-2xl font-black leading-tight text-slate-950 dark:text-[#e5edf8]">{alertComuna || 'Sin datos'}</p>
            </div>
          </div>
          {hasData ? (
            <span className="shrink-0 rounded-full border border-red-300/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-red-600 dark:text-red-200">
              {riskLevel}
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-sm font-semibold leading-6 text-slate-700 dark:text-[#e5edf8]">{alertText}</p>
        <p className={`mt-2 text-sm font-black leading-6 ${hasData ? 'text-red-600 dark:text-amber-200' : 'text-slate-500 dark:text-slate-400'}`}>{actionText}</p>
        {hasData ? (
          <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-600 dark:border-slate-700/80 dark:bg-slate-950/50 dark:text-[#93a4b8]">
            <p>Métrica principal: {formatNumber(comunaCritica?.reclamosPor100kHabitantes ?? 0, 2)} reclamos aprox. por 100k habitantes.</p>
            <p>Nivel: {riskLevel}. Datos calculados con periodo, prioridad y estado activos; no dependen del filtro de comuna.</p>
          </div>
        ) : null}
        {isUsingFallback ? (
          <p className="mt-2 text-xs font-black text-amber-500 dark:text-amber-300">Datos de respaldo, no corresponden a la carga actual.</p>
        ) : null}
      </div>

      {hasData ? (
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <button
            className="inline-flex h-9 items-center justify-center rounded-lg border border-blue-300/40 bg-blue-500/10 px-3 text-xs font-black text-blue-700 shadow-sm transition hover:bg-blue-500/15 dark:text-blue-200"
            onClick={onOpenExplanation}
            type="button"
          >
            Ver explicación
          </button>
          <button
            className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-blue-500"
            onClick={() => onOpenComuna?.(alertComuna)}
            type="button"
          >
            Ver comuna
          </button>
        </div>
      ) : null}
    </article>
  );
}