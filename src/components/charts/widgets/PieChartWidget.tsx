import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { ChartConfig, ChartDataPoint } from '../../../features/reports/chart-types';
import { formatChartValue } from '../../../features/reports/chart-utils';

type Props = {
  config: ChartConfig;
  data: ChartDataPoint[];
};

const palette = ['#2563eb', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9'];

export function PieChartWidget({ config, data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={95} label={config.showLabels}>
          {data.map((item, index) => (
            <Cell key={item.name} fill={palette[index % palette.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatChartValue(Number(value), config.metric)} />
      </PieChart>
    </ResponsiveContainer>
  );
}
