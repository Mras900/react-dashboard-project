import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Brain, Download, FileText, Sparkles } from 'lucide-react';
import { Badge as TremorBadge, Card as TremorCard, Metric, Text, Title } from '@tremor/react';
import { Button } from '../../components/ui/button';
import { ChartRenderer } from '../../components/charts/ChartRenderer';
import type { ChartConfig } from './chart-types';
import { buildChartData } from './chart-utils';
import { ChartBuilder } from './ChartBuilder';
import { useSavedCharts } from './useSavedCharts';
import { MonthlyReportGenerator } from './MonthlyReportGenerator';
import { SimilarClaimsPanel } from '../ai/SimilarClaimsPanel';
import { AiAssistantPanel } from '../ai/AiAssistantPanel';

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
    <div className="cc-reports-shell reports-ai-premium grid gap-5">

      <section className="report-card overflow-hidden rounded-xl border p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Reportes</p>
            <h2 className="mt-2 text-3xl font-black text-white">Reportes</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--cc-muted)]">Análisis ejecutivo, informes e inteligencia territorial</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="h-10 rounded-lg font-black" variant="outline"><a href="#informe-ejecutivo"><FileText size={16} /> Generar reporte</a></Button>
            <Button asChild className="h-10 rounded-lg font-black"><a href="#informe-ejecutivo"><Download size={16} /> Exportar</a></Button>
          </div>
        </div>
      </section>

      <section className="cc-reports-grid grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TremorCard className="cc-report-card report-card rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <Text>Reportes generados</Text>
            <FileText className="text-cyan-300" size={18} />
          </div>
          <Metric className="mt-3">{formatNumber(charts.length)}</Metric>
          <Text className="mt-1">Biblioteca de graficos guardados</Text>
        </TremorCard>
        <TremorCard className="cc-report-card report-card rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <Text>Reclamos analizados</Text>
            <BarChart3 className="text-blue-300" size={18} />
          </div>
          <Metric className="mt-3">{formatNumber(reportStats.totalClaims)}</Metric>
          <Text className="mt-1">RM {formatNumber(reportStats.rmClaims)} - Regiones {formatNumber(reportStats.regionClaims)}</Text>
        </TremorCard>
        <TremorCard className="cc-report-card report-card rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <Text>Alertas detectadas</Text>
            <AlertTriangle className="text-amber-300" size={18} />
          </div>
          <Metric className="mt-3">{formatNumber(reportStats.territorialAlerts + reportStats.highPriority)}</Metric>
          <Text className="mt-1">Prioridad alta y riesgo territorial</Text>
        </TremorCard>
        <TremorCard className="cc-report-card report-card rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <Text>Recomendaciones IA</Text>
            <Sparkles className="text-emerald-300" size={18} />
          </div>
          <Title className="mt-3 text-2xl">Bajo demanda</Title>
          <div className="mt-2"><TremorBadge color="emerald">Resumen IA existente</TremorBadge></div>
        </TremorCard>
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

      <section className="grid gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-cyan-300">Asistente IA</p>
          <h3 className="text-xl font-black text-white">Asistente IA de reportes</h3>
        </div>
        <AiAssistantPanel
          title="Asistente IA de reportes"
          subtitle="Genera análisis, resúmenes e informes usando la información filtrada del dashboard"
          context={`Reportes. Reclamos analizados: ${formatNumber(reportStats.totalClaims)}. RM: ${formatNumber(reportStats.rmClaims)}. Regiones: ${formatNumber(reportStats.regionClaims)}. Alertas: ${formatNumber(reportStats.territorialAlerts + reportStats.highPriority)}. Comunas: ${formatNumber(reportStats.communes)}. Facturación total: ${formatCurrency(reportStats.totalBilling)}.`}
        />
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
                    <Button className="rounded-md font-black" onClick={() => setDraft(chart)} size="xs" type="button" variant="outline">Editar</Button>
                    <Button className="rounded-md font-black" onClick={() => duplicateChart(chart.id)} size="xs" type="button" variant="outline">Duplicar</Button>
                    <Button className="rounded-md font-black" onClick={() => removeChart(chart.id)} size="xs" type="button" variant="destructive">Eliminar</Button>
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





