import { AreaChart, BarChart, DonutChart, LineChart } from '@tremor/react';
import type { ChartConfig, ChartDataPoint } from '../../features/reports/chart-types';
import { formatChartValue } from '../../features/reports/chart-utils';
import { BarChartWidget } from './widgets/BarChartWidget';
import { TableChartWidget } from './widgets/TableChartWidget';

type Props = {
  config: ChartConfig;
  data: ChartDataPoint[];
};

const chartColors = ['blue', 'cyan', 'emerald', 'amber', 'rose', 'violet'];

export function ChartRenderer({ config, data }: Props) {
  const safeData = Array.isArray(data) ? data : [];
  const valueFormatter = (value: number) => formatChartValue(value, config.metric);

  if (safeData.length === 0) {
    return (
      <div className="cc-report-empty flex min-h-[280px] items-center justify-center rounded-xl border border-dashed text-center text-sm font-bold">
        Sin datos para mostrar
      </div>
    );
  }

  if (config.type === 'bar') {
    return (
      <div className="cc-report-chart">
        <BarChart
          className="h-80"
          data={safeData}
          index="name"
          categories={['value']}
          colors={chartColors}
          valueFormatter={valueFormatter}
          showAnimation={false}
          showLegend={false}
          showGridLines
          yAxisWidth={72}
        />
      </div>
    );
  }

  if (config.type === 'horizontalBar') {
    return <BarChartWidget config={config} data={safeData} />;
  }

  if (config.type === 'line') {
    return (
      <div className="cc-report-chart">
        <LineChart
          className="h-80"
          data={safeData}
          index="name"
          categories={['value']}
          colors={['blue']}
          valueFormatter={valueFormatter}
          showAnimation={false}
          showLegend={false}
          showGridLines
          yAxisWidth={72}
        />
      </div>
    );
  }

  if (config.type === 'area') {
    return (
      <div className="cc-report-chart">
        <AreaChart
          className="h-80"
          data={safeData}
          index="name"
          categories={['value']}
          colors={['cyan']}
          valueFormatter={valueFormatter}
          showAnimation={false}
          showLegend={false}
          showGridLines
          yAxisWidth={72}
        />
      </div>
    );
  }

  if (config.type === 'pie' || config.type === 'donut') {
    return (
      <div className="cc-report-chart flex min-h-[320px] items-center justify-center">
        <DonutChart
          className="h-80"
          data={safeData}
          category="value"
          index="name"
          colors={chartColors}
          variant={config.type === 'pie' ? 'pie' : 'donut'}
          valueFormatter={valueFormatter}
          showAnimation={false}
          showTooltip
        />
      </div>
    );
  }

  if (config.type === 'table') {
    return <TableChartWidget config={config} data={safeData} />;
  }

  return (
    <div className="cc-report-empty flex min-h-[280px] items-center justify-center rounded-xl border border-dashed text-center text-sm font-bold">
      Tipo de grafico pendiente de implementar: {config.type}
    </div>
  );
}
