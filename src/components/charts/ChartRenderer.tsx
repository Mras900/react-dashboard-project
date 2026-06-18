import type { ChartConfig, ChartDataPoint } from '../../features/reports/chart-types';
import { BarChartWidget } from './widgets/BarChartWidget';
import { DonutChartWidget } from './widgets/DonutChartWidget';
import { LineChartWidget } from './widgets/LineChartWidget';
import { PieChartWidget } from './widgets/PieChartWidget';
import { TableChartWidget } from './widgets/TableChartWidget';

type Props = {
  config: ChartConfig;
  data: ChartDataPoint[];
};

export function ChartRenderer({ config, data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm font-bold text-slate-500">
        Sin datos para mostrar
      </div>
    );
  }

  if (config.type === 'bar' || config.type === 'horizontalBar') {
    return <BarChartWidget config={config} data={data} />;
  }

  if (config.type === 'line' || config.type === 'area') {
    return <LineChartWidget config={config} data={data} />;
  }

  if (config.type === 'pie') {
    return <PieChartWidget config={config} data={data} />;
  }

  if (config.type === 'donut') {
    return <DonutChartWidget config={config} data={data} />;
  }

  if (config.type === 'table') {
    return <TableChartWidget config={config} data={data} />;
  }

  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-sm font-bold text-slate-500">
      Tipo de gráfico pendiente de implementar: {config.type}
    </div>
  );
}
