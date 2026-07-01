import type { ChartConfig, ChartType, DataScope, DimensionKey, MetricKey } from './chart-types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

type Props = {
  value: ChartConfig;
  onChange: (config: ChartConfig) => void;
  onSave: () => void;
};

const chartTypes: Array<{ label: string; value: ChartType }> = [
  { label: 'Barras verticales', value: 'bar' },
  { label: 'Barras horizontales', value: 'horizontalBar' },
  { label: 'Linea', value: 'line' },
  { label: 'Area', value: 'area' },
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
  { label: 'Tickets unicos', value: 'ticketsUnicos' },
  { label: 'Facturacion', value: 'facturacion' },
  { label: 'Alta prioridad', value: 'alta' },
  { label: 'Media prioridad', value: 'media' },
  { label: 'Baja prioridad', value: 'baja' },
  { label: 'Reiteradas', value: 'reiteradas' },
];

const dimensions: Array<{ label: string; value: DimensionKey }> = [
  { label: 'Comuna', value: 'comuna' },
  { label: 'Region', value: 'region' },
  { label: 'Mes', value: 'mes' },
  { label: 'Prioridad', value: 'prioridad' },
];

export function ChartBuilder({ value, onChange, onSave }: Props) {
  const update = <K extends keyof ChartConfig>(key: K, nextValue: ChartConfig[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <section className="cc-report-builder report-card rounded-xl border p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Constructor de grafico</p>
      <h2 className="mt-1 text-xl font-black text-[#071b4d]">Crear visualizacion reutilizable</h2>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Nombre</span>
          <Input className="h-11 font-bold" value={value.title} onChange={(event) => update('title', event.target.value)} />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Tipo</span>
          <Select value={value.type} onValueChange={(nextValue) => update('type', nextValue as ChartType)}>
            <SelectTrigger className="h-11 w-full rounded-lg font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {chartTypes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Ambito</span>
          <Select value={value.scope} onValueChange={(nextValue) => update('scope', nextValue as DataScope)}>
            <SelectTrigger className="h-11 w-full rounded-lg font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Metrica</span>
          <Select value={value.metric} onValueChange={(nextValue) => update('metric', nextValue as MetricKey)}>
            <SelectTrigger className="h-11 w-full rounded-lg font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {metrics.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Dimension</span>
          <Select value={value.dimension} onValueChange={(nextValue) => update('dimension', nextValue as DimensionKey)}>
            <SelectTrigger className="h-11 w-full rounded-lg font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dimensions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Agregacion</span>
          <Select value={value.aggregation} onValueChange={(nextValue) => update('aggregation', nextValue as ChartConfig['aggregation'])}>
            <SelectTrigger className="h-11 w-full rounded-lg font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sum">Suma</SelectItem>
              <SelectItem value="avg">Promedio</SelectItem>
              <SelectItem value="max">Maximo</SelectItem>
              <SelectItem value="min">Minimo</SelectItem>
              <SelectItem value="count">Conteo</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-slate-500">Top N</span>
          <Input className="h-11 font-bold" type="number" min={1} value={value.topN ?? 10} onChange={(event) => update('topN', Number(event.target.value))} />
        </label>

        <Button className="mt-auto h-11 rounded-lg font-black" onClick={onSave} type="button">
          Guardar grafico
        </Button>
      </div>
    </section>
  );
}
