import type { DesignComponentConfig, DesignSectionId } from './designTypes';
import type { useDesignConfig } from './useDesignConfig';
import { componentSizeOptions } from './safeOptions';
import { sectionOptions } from './safeOptions';
import type { DesignKpiAccent } from './designTypes';

type ComponentSettingsProps = {
  designConfig: ReturnType<typeof useDesignConfig>;
};

const componentLabels: Record<string, { label: string; group: string }> = {
  header: { label: 'Encabezado', group: 'Estructura' },
  filters: { label: 'Filtros', group: 'Estructura' },
  'left-kpi-facturacion': { label: 'KPI Facturacion total', group: 'Indicadores' },
  'left-kpi-reclamos': { label: 'KPI Reclamos totales', group: 'Indicadores' },
  'left-kpi-promedio': { label: 'KPI Promedio por reclamo', group: 'Indicadores' },
  'main-map': { label: 'Mapa de reclamos', group: 'Mapa' },
  'right-summary': { label: 'Panel resumen operativo', group: 'Resumen' },
  'card-total-comunas': { label: 'Card Total comunas', group: 'Stats' },
  'card-alta-prioridad': { label: 'Card Alta prioridad', group: 'Stats' },
  'card-periodo': { label: 'Card Periodo analizado', group: 'Stats' },
  'card-tickets': { label: 'Card Tickets unicos', group: 'Stats' },
  'chart-facturacion-mensual': { label: 'Grafico Facturacion mensual', group: 'Graficos' },
  'chart-top-reclamos': { label: 'Grafico Top reclamos', group: 'Graficos' },
  'chart-top-facturacion': { label: 'Grafico Top facturacion', group: 'Graficos' },
  'chart-prioridad': { label: 'Grafico Distribucion prioridad', group: 'Graficos' },
  'table-evidencia': { label: 'Tabla Evidencia por comuna', group: 'Tabla' },
  'route-visitador': { label: 'Ruta Visitador', group: 'Ruta' },
};

const accentColorOptions: Array<{ value: DesignKpiAccent; label: string }> = [
  { value: 'blue', label: 'Azul' },
  { value: 'red', label: 'Rojo' },
  { value: 'cyan', label: 'Cian' },
  { value: 'green', label: 'Verde' },
  { value: 'amber', label: 'Ambar' },
  { value: 'slate', label: 'Pizarra' },
];

function sortedComponents(components: DesignComponentConfig[]) {
  return [...components].sort((a, b) => a.order - b.order);
}

function moveComponentInList(components: DesignComponentConfig[], compId: string, direction: -1 | 1) {
  const sorted = sortedComponents(components);
  const idx = sorted.findIndex((c) => c.id === compId);
  if (idx < 0) return components;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= sorted.length) return components;
  const a = sorted[idx];
  const b = sorted[targetIdx];
  return components.map((c) => {
    if (c.id === a.id) return { ...c, order: b.order };
    if (c.id === b.id) return { ...c, order: a.order };
    return c;
  });
}

export function ComponentSettings({ designConfig }: ComponentSettingsProps) {
  const { draftConfig, updateDraft } = designConfig;
  const comps = sortedComponents(draftConfig.components);

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-xs font-black uppercase text-[#466083]">Componentes del dashboard</p>
        <h3 className="text-lg font-black text-[#071b4d]">Visibilidad, orden, tamano y color</h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Cada componente real del dashboard. Cambios se ven con Vista previa o al guardar.
        </p>
      </div>

      <div className="grid gap-2">
        {comps.map((comp, index) => {
          const info = componentLabels[comp.id] ?? { label: comp.id, group: 'Otros' };
          return (
            <div key={comp.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm font-black text-[#071b4d]">
                    <input
                      checked={comp.visible}
                      className="h-4 w-4 rounded border-slate-300 text-blue-700"
                      onChange={() => updateDraft((current) => ({
                        ...current,
                        components: current.components.map((c) => (c.id === comp.id ? { ...c, visible: !c.visible } : c)),
                      }))}
                      type="checkbox"
                    />
                  </label>
                  <div>
                    <span className="text-sm font-black text-[#071b4d]">{info.label}</span>
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{info.group}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-black text-[#172448] disabled:opacity-30" disabled={index === 0} onClick={() => updateDraft((current) => ({ ...current, components: moveComponentInList(current.components, comp.id, -1) }))} type="button">
                    Arriba
                  </button>
                  <button className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-black text-[#172448] disabled:opacity-30" disabled={index === comps.length - 1} onClick={() => updateDraft((current) => ({ ...current, components: moveComponentInList(current.components, comp.id, 1) }))} type="button">
                    Abajo
                  </button>
                </div>
              </div>

              <div className="mt-2 grid gap-2 lg:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Titulo</span>
                  <input
                    className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-black text-[#071b4d]"
                    maxLength={90}
                    onChange={(e) => updateDraft((current) => ({ ...current, components: current.components.map((c) => (c.id === comp.id ? { ...c, title: e.target.value } : c)) }))}
                    value={comp.title}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Subtitulo</span>
                  <input
                    className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-[#071b4d]"
                    maxLength={90}
                    onChange={(e) => updateDraft((current) => ({ ...current, components: current.components.map((c) => (c.id === comp.id ? { ...c, subtitle: e.target.value } : c)) }))}
                    value={comp.subtitle ?? ''}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Seccion</span>
                  <select
                    className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-black text-[#071b4d]"
                    onChange={(e) => updateDraft((current) => ({ ...current, components: current.components.map((c) => (c.id === comp.id ? { ...c, section: e.target.value as DesignSectionId } : c)) }))}
                    value={comp.section}
                  >
                    {sectionOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Tamano</span>
                  <select
                    className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-black text-[#071b4d]"
                    onChange={(e) => updateDraft((current) => ({ ...current, components: current.components.map((c) => (c.id === comp.id ? { ...c, size: e.target.value as DesignComponentConfig['size'] } : c)) }))}
                    value={comp.size}
                  >
                    {componentSizeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Color acento</span>
                  <select
                    className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-black text-[#071b4d]"
                    onChange={(e) => updateDraft((current) => ({ ...current, components: current.components.map((c) => (c.id === comp.id ? { ...c, accent: e.target.value as DesignKpiAccent | undefined } : c)) }))}
                    value={comp.accent ?? ''}
                  >
                    <option value="">Ninguno</option>
                    {accentColorOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Orden</span>
                  <input
                    className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-black text-[#071b4d]"
                    min={0}
                    onChange={(e) => updateDraft((current) => ({ ...current, components: current.components.map((c) => (c.id === comp.id ? { ...c, order: Number(e.target.value) || 0 } : c)) }))}
                    type="number"
                    value={comp.order}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
