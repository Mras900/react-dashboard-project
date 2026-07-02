import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { Metric, Text, Card as TremorCard } from '@tremor/react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  fetchHistoricalSummary,
  fetchHistoricalCompare,
  type HistoricalSummaryResponse,
  type HistoricalCompareResponse,
  type HistoricalAiContextResponse,
} from '../../services/historicalVisitsApi';

// --- helpers ---

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const CHART_COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#1d4ed8', '#1e40af', '#4f46e5', '#6366f1', '#818cf8'];

const YEAR_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
];

// --- KPI Card ---

function KpiCard({ label, value, icon: Icon, trend }: { label: string; value: string | number; icon?: typeof BarChart3; trend?: 'up' | 'down' | 'neutral' }) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : trend === 'neutral' ? Minus : null;
  const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-yellow-500';
  return (
    <TremorCard className="!rounded-2xl !border-[var(--border-main)] !bg-[var(--bg-card)] !p-5 !shadow-none">
      <div className="flex items-start justify-between">
        <div>
          <Text className="!text-xs !font-bold !text-[var(--cc-muted)] uppercase tracking-wider">{label}</Text>
          <Metric className="!mt-1 !text-2xl !font-black !text-[var(--text-main)]">{value}</Metric>
        </div>
        {Icon && <Icon className="size-8 text-[var(--cc-muted)] opacity-40" />}
      </div>
      {TrendIcon && (
        <div className="mt-2 flex items-center gap-1">
          <TrendIcon className={`size-4 ${trendColor}`} />
          <span className={`text-xs font-bold ${trendColor}`}>{trend === 'up' ? 'Aumento' : trend === 'down' ? 'Disminución' : 'Estable'}</span>
        </div>
      )}
    </TremorCard>
  );
}

// --- Mini table ---

function MiniTable({ data, labelKey, valueKey, title }: { data: Array<Record<string, unknown>>; labelKey: string; valueKey: string; title: string }) {
  if (!data?.length) return null;
  return (
    <TremorCard className="!rounded-2xl !border-[var(--border-main)] !bg-[var(--bg-card)] !p-5 !shadow-none">
      <Text className="!mb-3 !text-sm !font-black !text-[var(--text-main)]">{title}</Text>
      <div className="space-y-1.5">
        {data.slice(0, 10).map((item, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-[var(--bg-main)] px-3 py-2 text-sm">
            <span className="font-semibold text-[var(--text-main)] truncate mr-2">{String(item[labelKey] ?? '')}</span>
            <Badge className="shrink-0 !rounded-full !bg-blue-600/10 !px-2.5 !py-0.5 !text-xs !font-bold !text-blue-600">
              {String(item[valueKey] ?? 0)}
            </Badge>
          </div>
        ))}
      </div>
    </TremorCard>
  );
}

// --- Main View ---

export default function HistoricalAnalysisView() {
  const [activeTab, setActiveTab] = useState<'resumen' | 'comparacion'>('resumen');
  const [selectedYear, setSelectedYear] = useState<string>('2025');
  const [yearBase, setYearBase] = useState<string>('2025');
  const [yearCompare, setYearCompare] = useState<string>('2026');

  const [summary, setSummary] = useState<HistoricalSummaryResponse | null>(null);
  const [compare, setCompare] = useState<HistoricalCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch summary
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {};
    if (selectedYear !== 'all') params.year = selectedYear;
    fetchHistoricalSummary(params)
      .then((data) => setSummary(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar resumen'))
      .finally(() => setLoading(false));
  }, [selectedYear]);

  // Fetch compare
  useEffect(() => {
    if (activeTab !== 'comparacion') return;
    setCompareLoading(true);
    fetchHistoricalCompare({ year_a: Number(yearBase), year_b: Number(yearCompare) })
      .then((data) => setCompare(data))
      .catch(() => setCompare(null))
      .finally(() => setCompareLoading(false));
  }, [activeTab, yearBase, yearCompare]);

  // Chart data
  const monthChartData = useMemo(() => {
    if (!summary?.by_month) return [];
    return MONTHS.map((m) => ({
      name: m.slice(0, 3),
      total: summary.by_month[m] ?? 0,
    }));
  }, [summary]);

  const compareChartData = useMemo(() => {
    if (!compare) return [];
    const months = MONTHS.map((m) => m.slice(0, 3));
    const byMesA = compare.year_a.by_mes;
    const byMesB = compare.year_b.by_mes;
    return months.map((_, i) => {
      const key = String(i + 1).padStart(2, '0');
      return {
        name: months[i],
        [String(compare.year_a.year)]: byMesA?.[key] ?? 0,
        [String(compare.year_b.year)]: byMesB?.[key] ?? 0,
      };
    });
  }, [compare]);

  // Disponibilidad años desde summary
  const availableYears = useMemo(() => {
    if (!summary?.by_year) return [2024, 2025, 2026];
    return Object.keys(summary.by_year).map(Number).sort();
  }, [summary]);

  // Comunas list
  const comunaItems = useMemo(() => {
    if (!summary?.by_comuna) return [];
    return summary.by_comuna.map((c) => ({ comuna: c.comuna, total: c.total }));
  }, [summary]);

  // Productos list
  const productItems = useMemo(() => {
    if (!summary?.by_producto) return [];
    return summary.by_producto.map((p) => ({ producto: p.producto, total: p.total }));
  }, [summary]);

  // Categorías
  const categoriaItems = useMemo(() => {
    if (!summary?.by_categoria_incidente) return [];
    return Object.entries(summary.by_categoria_incidente)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([k, v]) => ({ categoria: k, total: v }));
  }, [summary]);

  // Tooltip custom
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] px-4 py-3 shadow-lg text-sm">
        <p className="font-bold text-[var(--text-main)] mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="font-semibold" style={{ color: p.color }}>
            {p.name}: {p.value.toLocaleString('es-CL')}
          </p>
        ))}
      </div>
    );
  };

  const hasCompareData = compare && (compare.year_a.total > 0 || compare.year_b.total > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-main)]">Análisis Histórico</h1>
          <p className="text-sm font-semibold text-[var(--cc-muted)]">Memoria anual de visitas y reclamos</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-blue-600" />
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-[var(--bg-card)] p-1 border border-[var(--border-main)] w-fit">
        <button
          onClick={() => setActiveTab('resumen')}
          className={`rounded-xl px-5 py-2 text-sm font-bold transition-all ${
            activeTab === 'resumen'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-[var(--cc-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Resumen anual
        </button>
        <button
          onClick={() => setActiveTab('comparacion')}
          className={`rounded-xl px-5 py-2 text-sm font-bold transition-all ${
            activeTab === 'comparacion'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-[var(--cc-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Comparación
        </button>
      </div>

      {/* ======== RESUMEN ANUAL ======== */}
      {activeTab === 'resumen' && (
        <div className="space-y-6">
          {/* Filtro año */}
          <div className="flex items-center gap-3">
            <Text className="!text-xs !font-bold !text-[var(--cc-muted)] uppercase">Año:</Text>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32 !rounded-xl !border-[var(--border-main)] !bg-[var(--bg-card)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="size-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="flex min-h-[200px] items-center justify-center gap-2 text-red-500">
              <AlertTriangle className="size-5" />
              <span className="font-bold">{error}</span>
            </div>
          ) : !summary || summary.total === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="text-center">
                <AlertTriangle className="mx-auto mb-2 size-8 text-yellow-500" />
                <p className="font-bold text-[var(--cc-muted)]">No hay datos históricos cargados para el año seleccionado.</p>
              </div>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Total registros" value={summary.total.toLocaleString('es-CL')} icon={BarChart3} />
                <KpiCard label="Comunas" value={summary.by_comuna.length} />
                <KpiCard label="Categorías incidente" value={Object.keys(summary.by_categoria_incidente).length} />
                <KpiCard
                  label="Prom. días respuesta"
                  value={summary.promedio_dias_visita_respuesta != null ? `${summary.promedio_dias_visita_respuesta} días` : 'N/A'}
                />
              </div>

              {/* Prioridad + Estado badges */}
              <div className="grid gap-4 sm:grid-cols-2">
                <TremorCard className="!rounded-2xl !border-[var(--border-main)] !bg-[var(--bg-card)] !p-5 !shadow-none">
                  <Text className="!mb-3 !text-sm !font-black !text-[var(--text-main)]">Por prioridad</Text>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(summary.by_prioridad || {}).map(([k, v]) => (
                      <Badge key={k} className="!rounded-full !bg-amber-600/10 !px-3 !py-1 !text-xs !font-bold !text-amber-600">
                        {k}: {v}
                      </Badge>
                    ))}
                  </div>
                </TremorCard>
                <TremorCard className="!rounded-2xl !border-[var(--border-main)] !bg-[var(--bg-card)] !p-5 !shadow-none">
                  <Text className="!mb-3 !text-sm !font-black !text-[var(--text-main)]">Por estado</Text>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(summary.by_estado || {}).map(([k, v]) => (
                      <Badge key={k} className="!rounded-full !bg-blue-600/10 !px-3 !py-1 !text-xs !font-bold !text-blue-600">
                        {k}: {v}
                      </Badge>
                    ))}
                  </div>
                </TremorCard>
              </div>

              {/* Gráfico mensual */}
              {monthChartData.some((d) => d.total > 0) && (
                <TremorCard className="!rounded-2xl !border-[var(--border-main)] !bg-[var(--bg-card)] !p-5 !shadow-none">
                  <Text className="!mb-4 !text-sm !font-black !text-[var(--text-main)]">Distribución mensual</Text>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--cc-muted)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--cc-muted)' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                          {monthChartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TremorCard>
              )}

              {/* Tablas */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <MiniTable data={comunaItems} labelKey="comuna" valueKey="total" title="Top comunas" />
                <MiniTable data={productItems} labelKey="producto" valueKey="total" title="Top productos reclamados" />
                <MiniTable data={categoriaItems} labelKey="categoria" valueKey="total" title="Categorías de incidente" />
              </div>
            </>
          )}
        </div>
      )}

      {/* ======== COMPARACIÓN ======== */}
      {activeTab === 'comparacion' && (
        <div className="space-y-6">
          {/* Selectores año */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Text className="!text-xs !font-bold !text-[var(--cc-muted)] uppercase">Año base:</Text>
              <Select value={yearBase} onValueChange={setYearBase}>
                <SelectTrigger className="w-28 !rounded-xl !border-[var(--border-main)] !bg-[var(--bg-card)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>{String(y)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Text className="!text-xs !font-bold !text-[var(--cc-muted)] uppercase">Año comparación:</Text>
              <Select value={yearCompare} onValueChange={setYearCompare}>
                <SelectTrigger className="w-28 !rounded-xl !border-[var(--border-main)] !bg-[var(--bg-card)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>{String(y)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {compareLoading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="size-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : !hasCompareData ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="text-center">
                <AlertTriangle className="mx-auto mb-2 size-8 text-yellow-500" />
                <p className="font-bold text-[var(--cc-muted)]">No hay datos históricos cargados para el año seleccionado.</p>
                {compare && compare.year_a.total > 0 && (
                  <p className="mt-1 text-sm text-[var(--cc-muted)]">
                    Resumen año base ({yearBase}): {compare.year_a.total} registros.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* KPIs comparación */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label={`Total ${yearBase}`} value={compare!.year_a.total.toLocaleString('es-CL')} />
                <KpiCard label={`Total ${yearCompare}`} value={compare!.year_b.total.toLocaleString('es-CL')} />
                <KpiCard
                  label="Diferencia"
                  value={(compare!.diferencia_absoluta > 0 ? '+' : '') + compare!.diferencia_absoluta.toLocaleString('es-CL')}
                  trend={compare!.diferencia_absoluta > 0 ? 'up' : compare!.diferencia_absoluta < 0 ? 'down' : 'neutral'}
                />
                <KpiCard
                  label="Variación %"
                  value={compare!.variacion_porcentual != null ? `${compare!.variacion_porcentual > 0 ? '+' : ''}${compare!.variacion_porcentual.toFixed(1)}%` : 'N/A'}
                  trend={compare!.variacion_porcentual != null ? (compare!.variacion_porcentual > 0 ? 'up' : compare!.variacion_porcentual < 0 ? 'down' : 'neutral') : undefined}
                />
              </div>

              {/* Resumen textual */}
              {compare?.resumen_textual_base && (
                <TremorCard className="!rounded-2xl !border-[var(--border-main)] !bg-[var(--bg-card)] !p-5 !shadow-none">
                  <Text className="!mb-2 !text-sm !font-black !text-[var(--text-main)]">Resumen</Text>
                  <pre className="whitespace-pre-wrap text-sm font-semibold text-[var(--cc-muted)] leading-relaxed">
                    {compare.resumen_textual_base}
                  </pre>
                </TremorCard>
              )}

              {/* Gráfico comparativo mensual */}
              {compareChartData.some((d) => d[String(compare!.year_a.year)] > 0 || d[String(compare!.year_b.year)] > 0) && (
                <TremorCard className="!rounded-2xl !border-[var(--border-main)] !bg-[var(--bg-card)] !p-5 !shadow-none">
                  <Text className="!mb-4 !text-sm !font-black !text-[var(--text-main)]">
                    Comparación mensual {yearBase} vs {yearCompare}
                  </Text>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compareChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--cc-muted)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--cc-muted)' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey={String(compare!.year_a.year)} radius={[6, 6, 0, 0]} fill="#3b82f6" />
                        <Bar dataKey={String(compare!.year_b.year)} radius={[6, 6, 0, 0]} fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TremorCard>
              )}

              {/* Top comunas aumento / baja */}
              <div className="grid gap-4 sm:grid-cols-2">
                {compare!.top_comunas_aumento?.length > 0 && (
                  <MiniTable
                    data={compare!.top_comunas_aumento.slice(0, 8)}
                    labelKey="comuna"
                    valueKey="diferencia"
                    title="Comunas con mayor aumento"
                  />
                )}
                {compare!.top_comunas_baja?.length > 0 && (
                  <MiniTable
                    data={compare!.top_comunas_baja.slice(0, 8)}
                    labelKey="comuna"
                    valueKey="diferencia"
                    title="Comunas con mayor disminución"
                  />
                )}
              </div>

              {/* Estados + Prioridades comparativo */}
              <div className="grid gap-4 sm:grid-cols-2">
                <TremorCard className="!rounded-2xl !border-[var(--border-main)] !bg-[var(--bg-card)] !p-5 !shadow-none">
                  <Text className="!mb-3 !text-sm !font-black !text-[var(--text-main)]">Estados comparativo</Text>
                  <div className="space-y-1.5">
                    {Object.entries(compare!.top_estados || {}).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between rounded-xl bg-[var(--bg-main)] px-3 py-2 text-sm">
                        <span className="font-semibold text-[var(--text-main)]">{k}</span>
                        <div className="flex items-center gap-3">
                          <Badge className="!rounded-full !bg-blue-600/10 !px-2 !py-0.5 !text-xs !font-bold !text-blue-600">
                            {yearBase}: {v.year_a}
                          </Badge>
                          <Badge className="!rounded-full !bg-amber-600/10 !px-2 !py-0.5 !text-xs !font-bold !text-amber-600">
                            {yearCompare}: {v.year_b}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </TremorCard>
                <TremorCard className="!rounded-2xl !border-[var(--border-main)] !bg-[var(--bg-card)] !p-5 !shadow-none">
                  <Text className="!mb-3 !text-sm !font-black !text-[var(--text-main)]">Prioridades comparativo</Text>
                  <div className="space-y-1.5">
                    {Object.entries(compare!.top_prioridades || {}).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between rounded-xl bg-[var(--bg-main)] px-3 py-2 text-sm">
                        <span className="font-semibold text-[var(--text-main)]">{k}</span>
                        <div className="flex items-center gap-3">
                          <Badge className="!rounded-full !bg-blue-600/10 !px-2 !py-0.5 !text-xs !font-bold !text-blue-600">
                            {yearBase}: {v.year_a}
                          </Badge>
                          <Badge className="!rounded-full !bg-amber-600/10 !px-2 !py-0.5 !text-xs !font-bold !text-amber-600">
                            {yearCompare}: {v.year_b}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </TremorCard>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
