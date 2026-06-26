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
    ? `${comunaCritica.comuna} aparece como alerta territorial porque sus reclamos pesan más considerando el tamaño de la comuna y otras señales operativas.`
    : 'Carga tickets para calcular la alerta territorial.';

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4">
      <section className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase text-red-600">Alerta territorial</p>
            <h2 className="mt-1 text-xl font-black text-[#071b4d]">Por qué {titleComuna} requiere revisión</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {isUsingFallback ? 'Usando datos de respaldo hasta cargar nuevos tickets.' : 'Calculado según la carga y filtros activos.'}
            </p>
          </div>
          <button
            aria-label="Cerrar explicación"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-lg border border-red-100 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h3 className="font-black text-red-900">Qué está pasando</h3>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-red-800">
                  {topText} {criticalText}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-black text-[#071b4d]">Por qué importa</h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                La señal permite detectar una comuna que puede escalar aunque no sea la primera en cantidad total.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-black text-[#071b4d]">Acción sugerida</h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                {getActionByRisk(comunaCritica?.riesgoOperativoNivel)}
              </p>
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-[#172448] hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Cerrar
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#073B91] px-4 text-sm font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
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
