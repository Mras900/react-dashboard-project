import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartConfig, ChartDataPoint } from '../../../features/reports/chart-types';
import { formatChartValue } from '../../../features/reports/chart-utils';

type Props = {
  config: ChartConfig;
  data: ChartDataPoint[];
};

export function BarChartWidget({ config, data }: Props) {
  const safeData = Array.isArray(data) ? data : [];
  const layout = config.type === 'horizontalBar' ? 'vertical' : 'horizontal';

  if (layout === 'vertical') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={safeData} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={(value) => formatChartValue(Number(value), config.metric)} />
          <YAxis dataKey="name" type="category" width={90} />
          <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} formatter={(value) => formatChartValue(Number(value), config.metric)} />
          <Bar dataKey="value" fill="var(--chart-primary)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={safeData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis tickFormatter={(value) => formatChartValue(Number(value), config.metric)} />
        <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} formatter={(value) => formatChartValue(Number(value), config.metric)} />
        <Bar dataKey="value" fill="var(--chart-primary)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
