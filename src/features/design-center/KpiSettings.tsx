import { kpiAccentOptions, kpiAggregationOptions, kpiDatasetScopeOptions, kpiIconOptions, kpiSourceOptions } from './kpiRegistry';
import { sectionOptions, widgetSizeOptions } from './safeOptions';
import type { DesignKpiConfig, DesignKpiId, DesignKpiSource } from './designTypes';
import type { useDesignConfig } from './useDesignConfig';

type KpiSettingsProps = {
  designConfig: ReturnType<typeof useDesignConfig>;
};

function nextCustomId() {
  return `customConfigKpi:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` as DesignKpiId;
}

function sortedKpis(kpis: DesignKpiConfig[]) {
  return [...kpis].sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order || a.title.localeCompare(b.title));
}

function defaultCustomKpi(order: number): DesignKpiConfig {
  return {
    id: nextCustomId(),
    title: 'Nuevo KPI configurable',
    description: 'KPI calculado desde fuentes seguras.',
    icon: 'chart',
    accent: 'blue',
    visible: true,
    order,
    section: 'bottom',
    size: 'small',
    protected: false,
    source: 'dashboard_resumen',
    field: 'reclamos_totales',
    aggregation: 'sum',
    datasetScope: 'all',
  };
}

function duplicateKpi(kpi: DesignKpiConfig, order: number): DesignKpiConfig {
  return {
    ...kpi,
    id: nextCustomId(),
    title: `${kpi.title} copia`,
    protected: false,
    order,
    source: kpi.source ?? 'dashboard_resumen',
    field: kpi.field ?? 'reclamos_totales',
    aggregation: kpi.aggregation ?? 'sum',
    datasetScope: kpi.datasetScope ?? 'all',
  };
}

export function KpiSettings({ designConfig }: KpiSettingsProps) {
  const { draftConfig, updateDraft, resetKpis } = designConfig;
  const kpis = sortedKpis(draftConfig.kpis);

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-[#466083]">Manager de KPIs</p>
          <h3 className="text-lg font-black text-[#071b4d]">KPIs configurables simples</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#172448] shadow-sm hover:bg-slate-50" onClick={resetKpis} type="button">
            Reset KPIs
          </button>
          <button className="h-10 rounded-lg bg-[#073B91] px-3 text-xs font-black text-white shadow-sm hover:bg-blue-800" onClick={() => updateDraft((current) => ({ ...current, kpis: [...current.kpis, defaultCustomKpi(current.kpis.length + 100)] }))} type="button">
            Crear KPI
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {kpis.map((kpi) => {
          const source = kpi.source ?? 'dashboard_resumen';
          const fields = kpiSourceOptions.find((option) => option.value === source)?.fields ?? [];

          return (
            <div key={kpi.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-black text-[#071b4d]">
                  <input
                    checked={kpi.visible}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700"
                    onChange={(event) => updateDraft((current) => ({
                      ...current,
                      kpis: current.kpis.map((item) => (item.id === kpi.id ? { ...item, visible: event.target.checked } : item)),
                    }))}
                    type="checkbox"
                  />
                  Visible {kpi.protected ? '(protegido)' : '(custom)'}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#172448]" onClick={() => updateDraft((current) => ({ ...current, kpis: [...current.kpis, duplicateKpi(kpi, current.kpis.length + 100)] }))} type="button">
                    Duplicar
                  </button>
                  <button className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 disabled:opacity-40" disabled={kpi.protected} onClick={() => updateDraft((current) => ({ ...current, kpis: current.kpis.filter((item) => item.id !== kpi.id || item.protected) }))} type="button">
                    Eliminar
                  </button>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Titulo</span>
                  <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" maxLength={90} onChange={(event) => updateDraft((current) => ({ ...current, kpis: current.kpis.map((item) => (item.id === kpi.id ? { ...item, title: event.target.value } : item)) }))} value={kpi.title} />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Descripcion</span>
                  <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-[#071b4d]" maxLength={90} onChange={(event) => updateDraft((current) => ({ ...current, kpis: current.kpis.map((item) => (item.id === kpi.id ? { ...item, description: event.target.value } : item)) }))} value={kpi.description ?? ''} />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Icono</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, kpis: current.kpis.map((item) => (item.id === kpi.id ? { ...item, icon: event.target.value as DesignKpiConfig['icon'] } : item)) }))} value={kpi.icon}>
                    {kpiIconOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Color</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, kpis: current.kpis.map((item) => (item.id === kpi.id ? { ...item, accent: event.target.value as DesignKpiConfig['accent'] } : item)) }))} value={kpi.accent}>
                    {kpiAccentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Fuente</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => {
                    const nextSource = event.target.value as DesignKpiSource;
                    const nextField = kpiSourceOptions.find((option) => option.value === nextSource)?.fields[0]?.value ?? '';
                    updateDraft((current) => ({ ...current, kpis: current.kpis.map((item) => (item.id === kpi.id ? { ...item, source: nextSource, field: nextField } : item)) }));
                  }} value={source}>
                    {kpiSourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Campo</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, kpis: current.kpis.map((item) => (item.id === kpi.id ? { ...item, field: event.target.value } : item)) }))} value={kpi.field ?? fields[0]?.value ?? ''}>
                    {fields.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Agregacion</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, kpis: current.kpis.map((item) => (item.id === kpi.id ? { ...item, aggregation: event.target.value as DesignKpiConfig['aggregation'] } : item)) }))} value={kpi.aggregation ?? 'sum'}>
                    {kpiAggregationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">dataset_scope</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, kpis: current.kpis.map((item) => (item.id === kpi.id ? { ...item, datasetScope: event.target.value as DesignKpiConfig['datasetScope'] } : item)) }))} value={kpi.datasetScope ?? 'all'}>
                    {kpiDatasetScopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Seccion</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, kpis: current.kpis.map((item) => (item.id === kpi.id ? { ...item, section: event.target.value as DesignKpiConfig['section'] } : item)) }))} value={kpi.section}>
                    {sectionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Tamano</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, kpis: current.kpis.map((item) => (item.id === kpi.id ? { ...item, size: event.target.value as DesignKpiConfig['size'] } : item)) }))} value={kpi.size}>
                    {widgetSizeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Orden</span>
                  <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" min={0} onChange={(event) => updateDraft((current) => ({ ...current, kpis: current.kpis.map((item) => (item.id === kpi.id ? { ...item, order: Number(event.target.value) || 0 } : item)) }))} type="number" value={kpi.order} />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}