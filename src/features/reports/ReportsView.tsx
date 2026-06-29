import { useMemo, useState } from 'react';
import { ChartRenderer } from '../../components/charts/ChartRenderer';
import type { ChartConfig } from './chart-types';
import { buildChartData } from './chart-utils';
import { ChartBuilder } from './ChartBuilder';
import { useSavedCharts } from './useSavedCharts';
import { MonthlyReportGenerator } from './MonthlyReportGenerator';
import { SimilarClaimsPanel } from '../ai/SimilarClaimsPanel';

type Props = {
  rmRows: Record<string, unknown>[];
  regionRows?: Record<string, unknown>[];
};

const initialConfig: ChartConfig = {
  id: `chart-${Date.now()}`,
  title: 'Nuevo gráfico',
  type: 'bar',
  scope: 'rm',
  metric: 'visitas',
  dimension: 'comuna',
  aggregation: 'sum',
  topN: 10,
  sortBy: 'value-desc',
  showLegend: true,
  showLabels: true,
};

export function ReportsView({ rmRows, regionRows = [] }: Props) {
  const [draft, setDraft] = useState<ChartConfig>(initialConfig);
  const { charts, addChart, duplicateChart, removeChart } = useSavedCharts();

  const sourceRows = draft.scope === 'regiones' ? regionRows : rmRows;
  const previewData = useMemo(() => buildChartData(draft, sourceRows), [draft, sourceRows]);

  const saveDraft = () => {
    addChart({
      ...draft,
      id: `chart-${Date.now()}`,
    });
  };

  return (
    <div className="grid gap-4">
      <MonthlyReportGenerator />

      <SimilarClaimsPanel />

      <ChartBuilder value={draft} onChange={setDraft} onSave={saveDraft} />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Vista previa</p>
          <h2 className="text-xl font-black text-[#071b4d]">{draft.title}</h2>
        </div>
        <ChartRenderer config={draft} data={previewData} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Biblioteca</p>
          <h2 className="text-xl font-black text-[#071b4d]">Gráficos guardados</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {charts.map((chart) => (
            <article key={chart.id} className="rounded-lg border border-slate-200 p-3">
              <h3 className="font-black text-[#071b4d]">{chart.title}</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {chart.type} · {chart.scope} · {chart.metric}
              </p>
              <div className="mt-3 flex gap-2">
                <button className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black" onClick={() => setDraft(chart)} type="button">
                  Editar
                </button>
                <button className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black" onClick={() => duplicateChart(chart.id)} type="button">
                  Duplicar
                </button>
                <button className="rounded-md border border-red-200 px-3 py-2 text-xs font-black text-red-600" onClick={() => removeChart(chart.id)} type="button">
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
