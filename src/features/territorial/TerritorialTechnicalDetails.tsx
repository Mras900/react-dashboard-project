import type { TerritorialComunaMetric } from './territorial-types';

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('es-CL', { maximumFractionDigits }).format(Number.isFinite(value) ? value : 0);

interface TerritorialTechnicalDetailsProps {
  criticalMetric?: TerritorialComunaMetric;
  intensityMetric?: TerritorialComunaMetric;
  riskMetric?: TerritorialComunaMetric;
}

function TechnicalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 rounded-lg border border-slate-700/70 bg-slate-950/35 px-3 py-2 sm:grid-cols-[170px_1fr]">
      <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-200">{value}</span>
    </div>
  );
}

export function TerritorialTechnicalDetails({ criticalMetric, intensityMetric, riskMetric }: TerritorialTechnicalDetailsProps) {
  const metric = criticalMetric ?? riskMetric ?? intensityMetric;

  if (!metric) return null;

  return (
    <details className="mt-4 rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
      <summary className="cursor-pointer select-none text-xs font-black uppercase tracking-wide text-sky-200">
        Ver detalle técnico
      </summary>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <TechnicalRow label="Comuna" value={metric.comuna} />
        <TechnicalRow label="Código comuna" value={metric.codigoComuna} />
        <TechnicalRow label="Población Censo 2024" value={formatNumber(metric.poblacion2024)} />
        <TechnicalRow label="Hogares Censo 2024" value={formatNumber(metric.hogares2024)} />
        <TechnicalRow label="Reclamos por 100.000 habitantes" value={formatNumber(metric.reclamosPor100kHabitantes, 2)} />
        <TechnicalRow label="Reclamos por 10.000 hogares" value={formatNumber(metric.reclamosPor10kHogares, 2)} />
        <TechnicalRow label="Score de criticidad" value={formatNumber(metric.criticidadScore, 2)} />
        <TechnicalRow label="Score de señal preventiva" value="No disponible" />
      </div>
    </details>
  );
}

