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

const palette = ['#0072B2', '#E69F00', '#009E73', '#D55E00', '#CC79A7', '#56B4E9'];

export function DonutChartWidget({ config, data }: Props) {
  const safeData = Array.isArray(data) ? data : [];
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={safeData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} label={config.showLabels}>
          {safeData.map((item, index) => (
            <Cell key={item.name} fill={palette[index % palette.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} formatter={(value) => formatChartValue(Number(value), config.metric)} />
      </PieChart>
    </ResponsiveContainer>
  );
}
