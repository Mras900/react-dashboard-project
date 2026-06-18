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

const palette = ['#10b981', '#f59e0b', '#ef4444', '#2563eb', '#8b5cf6', '#0ea5e9'];

export function DonutChartWidget({ config, data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} label={config.showLabels}>
          {data.map((item, index) => (
            <Cell key={item.name} fill={palette[index % palette.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatChartValue(Number(value), config.metric)} />
      </PieChart>
    </ResponsiveContainer>
  );
}
