import type { DesignChartConfig, DesignChartId, DesignChartType, DesignKpiSource } from './designTypes';
import type { useDesignConfig } from './useDesignConfig';
import { chartAccentOptions, chartAggregationOptions, chartDatasetScopeOptions, chartSourceOptions, chartTypeOptions } from './chartRegistry';
import { sectionOptions, widgetSizeOptions } from './safeOptions';
import { ConfigurableChartCard } from './ConfigurableChartCard';
import type { KpiDataSources } from './kpiCalculations';

type ChartSettingsProps = {
  designConfig: ReturnType<typeof useDesignConfig>;
  dataSources: KpiDataSources;
};

function nextCustomChartId(): DesignChartId {
  return `customConfigChart:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` as DesignChartId;
}

function sortedCharts(charts: DesignChartConfig[]) {
  return [...charts].sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order || a.title.localeCompare(b.title));
}

function defaultCustomChart(): DesignChartConfig {
  return {
    id: nextCustomChartId(),
    title: 'Nuevo grafico configurable',
    subtitle: 'Grafico desde fuentes seguras.',
    type: 'bar',
    source: 'dashboard_comunas',
    xField: 'comuna',
    yField: 'reclamos',
    aggregation: 'sum',
    datasetScope: 'all',
    visible: true,
    section: 'bottom',
    order: 100,
    size: 'medium',
    accent: 'blue',
    protected: false,
  };
}

function duplicateChart(chart: DesignChartConfig): DesignChartConfig {
  return {
    ...chart,
    id: nextCustomChartId(),
    title: `${chart.title} copia`,
    protected: false,
    source: chart.source ?? 'dashboard_comunas',
    xField: chart.xField ?? 'comuna',
    yField: chart.yField ?? 'reclamos',
    aggregation: chart.aggregation ?? 'sum',
    datasetScope: chart.datasetScope ?? 'all',
  };
}

function getXFields(source: DesignKpiSource | undefined) {
  const src = chartSourceOptions.find((option) => option.value === source);
  return src?.xFields ?? [];
}

function getYFields(source: DesignKpiSource | undefined) {
  const src = chartSourceOptions.find((option) => option.value === source);
  return src?.yFields ?? [];
}

export function ChartSettings({ designConfig, dataSources }: ChartSettingsProps) {
  const { draftConfig, updateDraft, resetCharts, isPreviewActive } = designConfig;
  const charts = sortedCharts(draftConfig.charts);

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-[#466083]">Manager de Graficos</p>
          <h3 className="text-lg font-black text-[#071b4d]">Graficos configurables</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#172448] shadow-sm hover:bg-slate-50" onClick={resetCharts} type="button">
            Reset Graficos
          </button>
          <button className="h-10 rounded-lg bg-[#073B91] px-3 text-xs font-black text-white shadow-sm hover:bg-blue-800" onClick={() => updateDraft((current) => ({ ...current, charts: [...current.charts, defaultCustomChart()] }))} type="button">
            Crear Grafico
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {charts.map((chart) => {
          const source = chart.source ?? 'dashboard_comunas';
          const xFields = getXFields(source);
          const yFields = getYFields(source);

          return (
            <div key={chart.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-black text-[#071b4d]">
                  <input
                    checked={chart.visible}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700"
                    onChange={(event) => updateDraft((current) => ({
                      ...current,
                      charts: current.charts.map((item) => (item.id === chart.id ? { ...item, visible: event.target.checked } : item)),
                    }))}
                    type="checkbox"
                  />
                  Visible {chart.protected ? '(protegido)' : '(custom)'}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#172448]" onClick={() => updateDraft((current) => ({ ...current, charts: [...current.charts, duplicateChart(chart)] }))} type="button">
                    Duplicar
                  </button>
                  <button className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 disabled:opacity-40" disabled={chart.protected} onClick={() => updateDraft((current) => ({ ...current, charts: current.charts.filter((item) => item.id !== chart.id || item.protected) }))} type="button">
                    Eliminar
                  </button>
                </div>
              </div>

              {isPreviewActive ? (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <ConfigurableChartCard chart={chart} dataSources={dataSources} />
                </div>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Titulo</span>
                  <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" maxLength={90} onChange={(event) => updateDraft((current) => ({ ...current, charts: current.charts.map((item) => (item.id === chart.id ? { ...item, title: event.target.value } : item)) }))} value={chart.title} />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Subtitulo</span>
                  <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-[#071b4d]" maxLength={90} onChange={(event) => updateDraft((current) => ({ ...current, charts: current.charts.map((item) => (item.id === chart.id ? { ...item, subtitle: event.target.value } : item)) }))} value={chart.subtitle ?? ''} />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Tipo</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, charts: current.charts.map((item) => (item.id === chart.id ? { ...item, type: event.target.value as DesignChartType } : item)) }))} value={chart.type}>
                    {chartTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Color</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, charts: current.charts.map((item) => (item.id === chart.id ? { ...item, accent: event.target.value as DesignChartConfig['accent'] } : item)) }))} value={chart.accent}>
                    {chartAccentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Fuente</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => {
                    const nextSource = event.target.value as DesignKpiSource;
                    const nextX = getXFields(nextSource)[0]?.value ?? '';
                    const nextY = getYFields(nextSource)[0]?.value ?? '';
                    updateDraft((current) => ({ ...current, charts: current.charts.map((item) => (item.id === chart.id ? { ...item, source: nextSource, xField: nextX, yField: nextY } : item)) }));
                  }} value={source}>
                    {chartSourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Eje X</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, charts: current.charts.map((item) => (item.id === chart.id ? { ...item, xField: event.target.value } : item)) }))} value={chart.xField}>
                    {xFields.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Eje Y</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, charts: current.charts.map((item) => (item.id === chart.id ? { ...item, yField: event.target.value } : item)) }))} value={chart.yField}>
                    {yFields.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Agregacion</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, charts: current.charts.map((item) => (item.id === chart.id ? { ...item, aggregation: event.target.value as DesignChartConfig['aggregation'] } : item)) }))} value={chart.aggregation}>
                    {chartAggregationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">dataset_scope</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, charts: current.charts.map((item) => (item.id === chart.id ? { ...item, datasetScope: event.target.value as DesignChartConfig['datasetScope'] } : item)) }))} value={chart.datasetScope}>
                    {chartDatasetScopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Seccion</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, charts: current.charts.map((item) => (item.id === chart.id ? { ...item, section: event.target.value as DesignChartConfig['section'] } : item)) }))} value={chart.section}>
                    {sectionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Tamano</span>
                  <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" onChange={(event) => updateDraft((current) => ({ ...current, charts: current.charts.map((item) => (item.id === chart.id ? { ...item, size: event.target.value as DesignChartConfig['size'] } : item)) }))} value={chart.size}>
                    {widgetSizeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-[#466083]">Orden</span>
                  <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]" min={0} onChange={(event) => updateDraft((current) => ({ ...current, charts: current.charts.map((item) => (item.id === chart.id ? { ...item, order: Number(event.target.value) || 0 } : item)) }))} type="number" value={chart.order} />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
