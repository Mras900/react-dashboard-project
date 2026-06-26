import { MapPinned, X } from 'lucide-react';
import type { TerritorialComunaMetric } from './territorial-types';
import { formatTerritorialMoney, formatTerritorialNumber } from './territorial-utils';
import { getActionByRisk } from './useTerritorialMetrics';

interface TerritorialComunaDetailModalProps {
  comuna: string;
  metric?: TerritorialComunaMetric | null;
  onClose: () => void;
  onFilterComuna: (comuna: string) => void;
  onShowEvidence: (comuna: string) => void;
  onShowMap: (comuna: string) => void;
}

export function TerritorialComunaDetailModal({
  comuna,
  metric,
  onClose,
  onFilterComuna,
  onShowEvidence,
  onShowMap,
}: TerritorialComunaDetailModalProps) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4">
      <section className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase text-blue-700">Análisis de comuna</p>
            <h2 className="mt-1 text-xl font-black text-[#071b4d]">Análisis de comuna: {comuna}</h2>
          </div>
          <button
            aria-label="Cerrar análisis de comuna"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        {metric ? (
          <div className="space-y-4 px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Reclamos" value={formatTerritorialNumber(metric.reclamosTotales, 0)} />
              <Metric label="Facturación" value={formatTerritorialMoney(metric.facturacionTotal)} />
              <Metric label="Prioridad alta" value={formatTerritorialNumber(metric.prioridadAlta, 0)} />
              <Metric label="Zona RM" value={metric.macrozonaRm ?? 'Sin zona'} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="Intensidad"
                value={`${formatTerritorialNumber(metric.reclamosPor100kHabitantes, 2)} aprox.`}
                detail={metric.intensidadTerritorialNivel}
              />
              <Metric
                label="Riesgo"
                value={metric.riesgoOperativoNivel}
                detail={`Ranking intensidad ${metric.rankingIntensidad100k} · ranking cantidad ${metric.rankingVolumenReclamos}`}
              />
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <MapPinned size={18} />
                </span>
                <div>
                  <h3 className="font-black text-blue-950">Recomendación</h3>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-blue-900">
                    {metric.recomendacionOperativa || getActionByRisk(metric.riesgoOperativoNivel)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 py-8 text-sm font-bold text-slate-600">No se encontró información territorial para esta comuna en la muestra actual.</div>
        )}

        <footer className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-[#172448] hover:bg-slate-50"
            onClick={() => onShowEvidence(comuna)}
            type="button"
          >
            Ver evidencia
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-[#172448] hover:bg-slate-50"
            onClick={() => onFilterComuna(comuna)}
            type="button"
          >
            Filtrar comuna
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#073B91] px-4 text-sm font-black text-white hover:bg-blue-800"
            onClick={() => onShowMap(comuna)}
            type="button"
          >
            Ver en mapa
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-[#172448] hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Cerrar
          </button>
        </footer>
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-lg font-black text-[#071b4d]">{value}</p>
      {detail ? <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p> : null}
    </div>
  );
}
