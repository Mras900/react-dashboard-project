import type { ChartConfig, ChartType, DataScope, DimensionKey, MetricKey } from './chart-types';

type Props = {
  value: ChartConfig;
  onChange: (config: ChartConfig) => void;
  onSave: () => void;
};

const chartTypes: Array<{ label: string; value: ChartType }> = [
  { label: 'Barras verticales', value: 'bar' },
  { label: 'Barras horizontales', value: 'horizontalBar' },
  { label: 'Línea', value: 'line' },
  { label: 'Área', value: 'area' },
  { label: 'Torta', value: 'pie' },
  { label: 'Donut', value: 'donut' },
  { label: 'Tabla', value: 'table' },
];

const scopes: Array<{ label: string; value: DataScope }> = [
  { label: 'RM', value: 'rm' },
  { label: 'Regiones', value: 'regiones' },
  { label: 'Ambos', value: 'ambos' },
];

const metrics: Array<{ label: string; value: MetricKey }> = [
  { label: 'Reclamos / visitas', value: 'visitas' },
  { label: 'Tickets únicos', value: 'ticketsUnicos' },
  { label: 'Facturación', value: 'facturacion' },
  { label: 'Alta prioridad', value: 'alta' },
  { label: 'Media prioridad', value: 'media' },
  { label: 'Baja prioridad', value: 'baja' },
  { label: 'Reiteradas', value: 'reiteradas' },
];

const dimensions: Array<{ label: string; value: DimensionKey }> = [
  { label: 'Comuna', value: 'comuna' },
  { label: 'Región', value: 'region' },
  { label: 'Mes', value: 'mes' },
  { label: 'Prioridad', value: 'prioridad' },
];

export function ChartBuilder({ value, onChange, onSave }: Props) {
  const update = <K extends keyof ChartConfig>(key: K, nextValue: ChartConfig[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Constructor de gráfico</p>
      <h2 className="mt-1 text-xl font-black text-[#071b4d]">Crear visualización reutilizable</h2>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Nombre</span>
          <input className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" value={value.title} onChange={(event) => update('title', event.target.value)} />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Tipo</span>
          <select className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" value={value.type} onChange={(event) => update('type', event.target.value as ChartType)}>
            {chartTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Ámbito</span>
          <select className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" value={value.scope} onChange={(event) => update('scope', event.target.value as DataScope)}>
            {scopes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Métrica</span>
          <select className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" value={value.metric} onChange={(event) => update('metric', event.target.value as MetricKey)}>
            {metrics.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Dimensión</span>
          <select className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" value={value.dimension} onChange={(event) => update('dimension', event.target.value as DimensionKey)}>
            {dimensions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Agregación</span>
          <select className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" value={value.aggregation} onChange={(event) => update('aggregation', event.target.value as ChartConfig['aggregation'])}>
            <option value="sum">Suma</option>
            <option value="avg">Promedio</option>
            <option value="max">Máximo</option>
            <option value="min">Mínimo</option>
            <option value="count">Conteo</option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Top N</span>
          <input className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" type="number" min={1} value={value.topN ?? 10} onChange={(event) => update('topN', Number(event.target.value))} />
        </label>

        <button className="mt-auto h-11 rounded-lg bg-[#073B91] px-4 text-sm font-black text-white shadow-sm" onClick={onSave} type="button">
          Guardar gráfico
        </button>
      </div>
    </section>
  );
}
