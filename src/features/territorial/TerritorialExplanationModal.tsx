import { AlertTriangle, X } from 'lucide-react';
import type { TerritorialComunaMetric } from './territorial-types';
import { getActionByRisk } from './useTerritorialMetrics';

interface TerritorialExplanationModalProps {
  comunaCritica: TerritorialComunaMetric | null;
  topReclamos: TerritorialComunaMetric | null;
  hasActiveData?: boolean;
  isUsingFallback?: boolean;
  onClose: () => void;
  onOpenComuna: () => void;
}

export function TerritorialExplanationModal({
  comunaCritica,
  topReclamos,
  hasActiveData,
  isUsingFallback,
  onClose,
  onOpenComuna,
}: TerritorialExplanationModalProps) {
  const canOpenComuna = Boolean(hasActiveData && comunaCritica);
  const titleComuna = comunaCritica?.comuna ?? 'Sin comuna crítica disponible';
  const topText = topReclamos
    ? `${topReclamos.comuna} tiene más reclamos en total, con ${topReclamos.reclamosTotales.toLocaleString('es-CL')} casos.`
    : 'Aún no hay una comuna líder en volumen para esta muestra.';
  const criticalText = comunaCritica
    ? `${comunaCritica.comuna} se marca como alerta porque combina volumen, intensidad territorial y prioridad alta dentro del periodo analizado.`
    : 'Carga tickets para calcular la alerta territorial.';
  const metricText = comunaCritica
    ? `${comunaCritica.reclamosTotales.toLocaleString('es-CL')} reclamos · ${comunaCritica.prioridadAlta.toLocaleString('es-CL')} prioridad alta · ${comunaCritica.reclamosPor100kHabitantes.toLocaleString('es-CL', { maximumFractionDigits: 2 })} aprox. por 100k habitantes.`
    : 'Sin datos territoriales activos.';

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <section className="w-full max-w-2xl overflow-hidden rounded-[14px] border border-slate-400/20 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(13,19,36,0.98))] text-[#e5edf8] shadow-[0_28px_80px_rgba(2,6,23,0.55)]">
        <header className="flex items-start justify-between gap-3 border-b border-slate-400/20 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-red-300">Alerta territorial</p>
            <h2 className="mt-1 text-xl font-black text-[#e5edf8]">Por qué {titleComuna} requiere revisión</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#93a4b8]">
              {isUsingFallback ? 'Usando datos de respaldo hasta cargar nuevos tickets.' : 'Calculado con periodo, prioridad y estado activos. El filtro de comuna no fuerza esta alerta.'}
            </p>
          </div>
          <button
            aria-label="Cerrar explicación"
            className="rounded-lg border border-slate-400/15 p-2 text-slate-300 transition hover:bg-slate-700/50 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <section className="rounded-xl border border-red-300/20 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-400/15 text-red-200">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h3 className="font-black text-red-100">Por qué se generó esta alerta</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-[#e5edf8]">
                  {topText} {criticalText}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-xl border border-slate-400/20 bg-slate-950/55 p-4">
              <h3 className="text-sm font-black text-[#e5edf8]">Datos usados</h3>
              <p className="mt-2 text-sm font-semibold leading-7 text-[#93a4b8]">
                {metricText}
              </p>
            </section>
            <section className="rounded-xl border border-slate-400/20 bg-slate-950/55 p-4">
              <h3 className="text-sm font-black text-[#e5edf8]">Recomendación operativa</h3>
              <p className="mt-2 text-sm font-semibold leading-7 text-[#93a4b8]">
                {getActionByRisk(comunaCritica?.riesgoOperativoNivel)} Revisar visitas pendientes, prioridad alta y cobertura territorial.
              </p>
            </section>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-slate-400/20 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-400/20 bg-slate-800/70 px-4 text-sm font-black text-slate-100 transition hover:bg-slate-700"
            onClick={onClose}
            type="button"
          >
            Cerrar
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canOpenComuna}
            onClick={onOpenComuna}
            title={canOpenComuna ? undefined : 'Disponible al cargar reclamos'}
            type="button"
          >
            Ver comuna
          </button>
        </footer>
      </section>
    </div>
  );
}