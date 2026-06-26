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
  const alertText = !hasData
    ? 'Carga reclamos de Región Metropolitana para calcular prioridades.'
    : topVolumeComuna && topVolumeComuna !== alertComuna
      ? `Aunque ${topVolumeComuna} lidera en volumen, ${alertComuna} presenta mayor intensidad proporcional.`
      : `${alertComuna} lidera tanto en volumen como en riesgo territorial.`;
  const actionText = hasData ? getActionByRisk(comunaCritica?.riesgoOperativoNivel) : 'Sin reclamos RM para calcular este análisis.';

  return (
    <article className={`cc-kpi-card-pro flex h-full min-h-[190px] flex-col justify-between gap-4 p-4 ${hasData ? 'border-orange-200' : 'border-slate-200'}`}>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`cc-kpi-icon-pro shrink-0 ${hasData ? 'text-red-500' : 'text-slate-400'}`}><AlertTriangle size={20} /></div>
            <div className="min-w-0">
              <p className="cc-kpi-label-pro">Alerta territorial</p>
              <p className="mt-1 break-words text-xl font-black leading-tight text-[#071b4d] dark:text-white">{alertComuna || 'Sin datos'}</p>
            </div>
          </div>
          {hasData ? (
            <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-black uppercase text-red-600">
              {comunaCritica?.riesgoOperativoNivel}
            </span>
          ) : null}
        </div>

        <p className="mt-3 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">{alertText}</p>
        <p className={`mt-2 text-xs font-black leading-relaxed ${hasData ? 'text-red-600 dark:text-red-200' : 'text-slate-500 dark:text-slate-400'}`}>{actionText}</p>
        {hasData ? (
          <p className="mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {formatNumber(comunaCritica?.reclamosPor100kHabitantes ?? 0, 2)} aprox. · calculado según carga y filtros activos.
          </p>
        ) : null}
        {isUsingFallback ? (
          <p className="mt-2 text-[11px] font-black text-amber-500">Datos de respaldo, no corresponden a la carga actual.</p>
        ) : null}
      </div>

      {hasData ? (
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <button
            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black text-[#073B91] shadow-sm transition hover:bg-blue-50"
            onClick={onOpenExplanation}
            type="button"
          >
            Ver explicación
          </button>
          <button
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[#073B91] px-3 text-[11px] font-black text-white shadow-sm transition hover:bg-blue-800"
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
