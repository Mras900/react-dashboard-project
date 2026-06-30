import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Brain, Download, FileText, Sparkles } from 'lucide-react';
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

const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();

const pickNumber = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    const numberValue = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    if (Number.isFinite(numberValue) && numberValue > 0) return numberValue;
  }
  return 0;
};

const isHighPriority = (row: Record<string, unknown>) => {
  const priority = normalizeText(row.prioridad ?? row.priority ?? row.prioridadNormalizada);
  return priority.includes('alta') || priority === 'high' || priority === 'p1';
};

const hasTerritorialAlert = (row: Record<string, unknown>) => {
  const redZone = normalizeText(row.zonaRoja ?? row.isRedZone ?? row.red_zone ?? row.zona_roja);
  const risk = normalizeText(row.riesgo ?? row.riskLevel ?? row.risk_level);
  return redZone === 'true' || redZone === 'si' || redZone === 'sí' || risk.includes('alto');
};

const formatNumber = (value: number) => new Intl.NumberFormat('es-CL').format(value);
const formatCurrency = (value: number) => value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export function ReportsView({ rmRows, regionRows = [] }: Props) {
  const [draft, setDraft] = useState<ChartConfig>(initialConfig);
  const { charts, addChart, duplicateChart, removeChart } = useSavedCharts();

  const sourceRows = draft.scope === 'regiones' ? regionRows : rmRows;
  const previewData = useMemo(() => buildChartData(draft, sourceRows), [draft, sourceRows]);
  const allRows = useMemo(() => [...rmRows, ...regionRows], [regionRows, rmRows]);
  const reportStats = useMemo(() => {
    const rmClaims = rmRows.length;
    const regionClaims = regionRows.length;
    const highPriority = allRows.filter(isHighPriority).length;
    const territorialAlerts = allRows.filter(hasTerritorialAlert).length;
    const totalBilling = allRows.reduce((sum, row) => sum + pickNumber(row, ['facturacionTotal', 'facturacion', 'billing', 'monto']), 0);
    const rmBilling = rmRows.reduce((sum, row) => sum + pickNumber(row, ['facturacionTotal', 'facturacion', 'billing', 'monto']), 0);
    const regionBilling = regionRows.reduce((sum, row) => sum + pickNumber(row, ['facturacionTotal', 'facturacion', 'billing', 'monto']), 0);
    const communes = new Set(allRows.map((row) => normalizeText(row.comuna ?? row.commune ?? row.ciudad)).filter(Boolean)).size;

    return { rmClaims, regionClaims, totalClaims: allRows.length, highPriority, territorialAlerts, totalBilling, rmBilling, regionBilling, communes };
  }, [allRows, regionRows, rmRows]);

  const saveDraft = () => {
    addChart({
      ...draft,
      id: `chart-${Date.now()}`,
    });
  };

  return (
    <div className="reports-ai-premium grid gap-5">
      <style>{`
        .reports-ai-premium { color: #0f172a; }
        .dark .reports-ai-premium { color: #e2e8f0; }
        .reports-ai-premium .report-card,
        .reports-ai-premium > section,
        .reports-ai-premium section.rounded-lg {
          background: #ffffff !important;
          border-color: #e2e8f0 !important;
          color: #0f172a !important;
          border-radius: 16px !important;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
        }
        .dark .reports-ai-premium .report-card,
        .dark .reports-ai-premium > section,
        .dark .reports-ai-premium section.rounded-lg {
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(11, 18, 32, 0.98)) !important;
          border-color: #22304d !important;
          color: #e2e8f0 !important;
          box-shadow: 0 18px 44px rgba(2, 6, 23, 0.24);
        }
        .reports-ai-premium h2,
        .reports-ai-premium h3,
        .reports-ai-premium h4,
        .reports-ai-premium label,
        .reports-ai-premium .text-white,
        .reports-ai-premium .text-slate-100,
        .reports-ai-premium .text-\[\#071b4d\],
        .reports-ai-premium .text-[var(--text-main)] {
          color: #0f172a !important;
        }
        .dark .reports-ai-premium h2,
        .dark .reports-ai-premium h3,
        .dark .reports-ai-premium h4,
        .dark .reports-ai-premium label,
        .dark .reports-ai-premium .text-white,
        .dark .reports-ai-premium .text-slate-100,
        .dark .reports-ai-premium .text-\[\#071b4d\],
        .dark .reports-ai-premium .text-[var(--text-main)] {
          color: #f8fafc !important;
        }
        .reports-ai-premium p,
        .reports-ai-premium .text-[var(--cc-muted)],
        .reports-ai-premium .text-[var(--cc-muted)],
        .reports-ai-premium .text-slate-600,
        .reports-ai-premium .text-\[\#7A90A8\],
        .reports-ai-premium .text-\[\#C8D7EA\] {
          color: #64748b !important;
        }
        .dark .reports-ai-premium p,
        .dark .reports-ai-premium .text-[var(--cc-muted)],
        .dark .reports-ai-premium .text-[var(--cc-muted)],
        .dark .reports-ai-premium .text-slate-600,
        .dark .reports-ai-premium .text-\[\#7A90A8\],
        .dark .reports-ai-premium .text-\[\#C8D7EA\] {
          color: #94a3b8 !important;
        }
        .reports-ai-premium input,
        .reports-ai-premium textarea,
        .reports-ai-premium select {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #0f172a !important;
        }
        .dark .reports-ai-premium input,
        .dark .reports-ai-premium textarea,
        .dark .reports-ai-premium select {
          background: rgba(15, 23, 42, 0.9) !important;
          border-color: #22304d !important;
          color: #f8fafc !important;
        }
        .reports-ai-premium input::placeholder,
        .reports-ai-premium textarea::placeholder { color: #94a3b8 !important; }
        .dark .reports-ai-premium input::placeholder,
        .dark .reports-ai-premium textarea::placeholder { color: #64748b !important; }
        .reports-ai-premium .bg-white,
        .reports-ai-premium .bg-slate-50,
        .reports-ai-premium .bg-slate-950\/60,
        .reports-ai-premium .bg-slate-950\/70 { background-color: #f8fafc !important; }
        .dark .reports-ai-premium .bg-white,
        .dark .reports-ai-premium .bg-slate-50,
        .dark .reports-ai-premium .bg-slate-950\/60,
        .dark .reports-ai-premium .bg-slate-950\/70 { background-color: rgba(15, 23, 42, 0.68) !important; }
        .reports-ai-premium .border-slate-200,
        .reports-ai-premium .border-[var(--border-main)],
        .reports-ai-premium .border-[var(--border-main)] { border-color: #cbd5e1 !important; }
        .dark .reports-ai-premium .border-slate-200,
        .dark .reports-ai-premium .border-[var(--border-main)],
        .dark .reports-ai-premium .border-[var(--border-main)] { border-color: #22304d !important; }
        .reports-ai-premium button { border-radius: 10px; }
        .reports-ai-premium .recharts-wrapper text { fill: #64748b; }
        .dark .reports-ai-premium .recharts-wrapper text { fill: #94a3b8; }
        .reports-ai-premium button.text-white,
        .reports-ai-premium a.text-white { color: #ffffff !important; }
      `}</style>

      <section className="report-card overflow-hidden rounded-xl border p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Reportes</p>
            <h2 className="mt-2 text-3xl font-black text-white">Reportes</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--cc-muted)]">Análisis ejecutivo, informes e inteligencia territorial</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] px-4 text-sm font-black text-[var(--text-main)]" href="#informe-ejecutivo">
              <FileText size={16} /> Generar reporte
            </a>
            <a className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-lg shadow-blue-950/30" href="#informe-ejecutivo">
              <Download size={16} /> Exportar
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="report-card rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Reportes generados</p>
            <FileText className="text-cyan-300" size={18} />
          </div>
          <p className="mt-3 text-3xl font-black text-white">{formatNumber(charts.length)}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">Biblioteca de gráficos guardados</p>
        </article>
        <article className="report-card rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Reclamos analizados</p>
            <BarChart3 className="text-blue-300" size={18} />
          </div>
          <p className="mt-3 text-3xl font-black text-white">{formatNumber(reportStats.totalClaims)}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">RM {formatNumber(reportStats.rmClaims)} · Regiones {formatNumber(reportStats.regionClaims)}</p>
        </article>
        <article className="report-card rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Alertas detectadas</p>
            <AlertTriangle className="text-amber-300" size={18} />
          </div>
          <p className="mt-3 text-3xl font-black text-white">{formatNumber(reportStats.territorialAlerts + reportStats.highPriority)}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">Prioridad alta y riesgo territorial</p>
        </article>
        <article className="report-card rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Recomendaciones IA</p>
            <Sparkles className="text-emerald-300" size={18} />
          </div>
          <p className="mt-3 text-2xl font-black text-white">Bajo demanda</p>
          <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">Usa resumen IA existente</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <article className="report-card rounded-xl border p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-200"><Brain size={21} /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-cyan-300">Resumen IA del periodo</p>
              <h3 className="mt-1 text-xl font-black text-white">Estado de análisis</h3>
              <p className="mt-2 text-sm font-semibold text-[var(--cc-muted)]">La generación IA vive en Informe ejecutivo y Reclamos similares. No se crean respuestas falsas: el resumen aparece al ejecutar endpoints existentes.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] p-3">
              <p className="text-xs font-black uppercase text-[var(--cc-muted)]">Periodo base</p>
              <p className="mt-1 text-lg font-black text-white">Configurable</p>
            </div>
            <div className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] p-3">
              <p className="text-xs font-black uppercase text-[var(--cc-muted)]">Cobertura</p>
              <p className="mt-1 text-lg font-black text-white">{formatNumber(reportStats.communes)} comunas</p>
            </div>
            <div className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] p-3">
              <p className="text-xs font-black uppercase text-[var(--cc-muted)]">Facturación</p>
              <p className="mt-1 text-lg font-black text-white">{formatCurrency(reportStats.totalBilling)}</p>
            </div>
          </div>
        </article>

        <article className="report-card rounded-xl border p-5">
          <p className="text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Comparación RM vs Regiones</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-[var(--text-main)]">RM</span>
                <span className="text-sm font-black text-white">{formatNumber(reportStats.rmClaims)} reclamos</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">{formatCurrency(reportStats.rmBilling)}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-[var(--text-main)]">Regiones</span>
                <span className="text-sm font-black text-white">{formatNumber(reportStats.regionClaims)} reclamos</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">{formatCurrency(reportStats.regionBilling)}</p>
            </div>
          </div>
        </article>
      </section>

      <section id="informe-ejecutivo" className="grid gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-cyan-300">Informe ejecutivo</p>
          <h3 className="text-xl font-black text-white">Generador mensual y exportación</h3>
        </div>
        <MonthlyReportGenerator />
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <article className="report-card rounded-xl border p-4">
          <p className="text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Comunas críticas</p>
          <p className="mt-3 text-3xl font-black text-white">{formatNumber(reportStats.communes)}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">Comunas presentes en datos</p>
        </article>
        <article className="report-card rounded-xl border p-4">
          <p className="text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Alta prioridad</p>
          <p className="mt-3 text-3xl font-black text-amber-200">{formatNumber(reportStats.highPriority)}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">Derivado de prioridad existente</p>
        </article>
        <article className="report-card rounded-xl border p-4">
          <p className="text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Concentración territorial</p>
          <p className="mt-3 text-3xl font-black text-red-200">{formatNumber(reportStats.territorialAlerts)}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">Riesgo o zona roja informada</p>
        </article>
        <article className="report-card rounded-xl border p-4">
          <p className="text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Variación facturación</p>
          <p className="mt-3 text-2xl font-black text-white">{formatCurrency(Math.abs(reportStats.rmBilling - reportStats.regionBilling))}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--cc-muted)]">Diferencia RM / Regiones</p>
        </article>
      </section>

      <section className="grid gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-cyan-300">Reclamos similares</p>
          <h3 className="text-xl font-black text-white">Búsqueda IA y resumen de coincidencias</h3>
        </div>
        <SimilarClaimsPanel />
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="grid gap-4">
          <ChartBuilder value={draft} onChange={setDraft} onSave={saveDraft} />
          <section className="report-card rounded-xl border p-4">
            <div className="mb-3">
              <p className="text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Biblioteca</p>
              <h2 className="text-xl font-black text-white">Gráficos guardados</h2>
            </div>

            <div className="grid gap-3">
              {charts.length ? charts.map((chart) => (
                <article key={chart.id} className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] p-3">
                  <h3 className="font-black text-white">{chart.title}</h3>
                  <p className="mt-1 text-xs font-bold text-[var(--cc-muted)]">
                    {chart.type} · {chart.scope} · {chart.metric}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="rounded-md border border-[var(--border-main)] px-3 py-2 text-xs font-black text-[var(--text-main)]" onClick={() => setDraft(chart)} type="button">
                      Editar
                    </button>
                    <button className="rounded-md border border-[var(--border-main)] px-3 py-2 text-xs font-black text-[var(--text-main)]" onClick={() => duplicateChart(chart.id)} type="button">
                      Duplicar
                    </button>
                    <button className="rounded-md border border-red-400/30 px-3 py-2 text-xs font-black text-red-200" onClick={() => removeChart(chart.id)} type="button">
                      Eliminar
                    </button>
                  </div>
                </article>
              )) : (
                <div className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] p-4 text-sm font-semibold text-[var(--cc-muted)]">Sin gráficos guardados.</div>
              )}
            </div>
          </section>
        </div>

        <section className="report-card rounded-xl border p-4">
          <div className="mb-3">
            <p className="text-xs font-black uppercase tracking-wide text-[var(--cc-muted)]">Vista previa</p>
            <h2 className="text-xl font-black text-white">{draft.title}</h2>
          </div>
          <ChartRenderer config={draft} data={previewData} />
        </section>
      </section>
    </div>
  );
}



