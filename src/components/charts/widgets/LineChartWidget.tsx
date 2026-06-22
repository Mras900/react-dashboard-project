import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
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

export function LineChartWidget({ config, data }: Props) {
  const safeData = Array.isArray(data) ? data : [];
  if (config.type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={safeData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={(value) => formatChartValue(Number(value), config.metric)} />
          <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} formatter={(value) => formatChartValue(Number(value), config.metric)} />
          <Area type="monotone" dataKey="value" fill="var(--chart-primary-soft)" stroke="var(--chart-primary)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={safeData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis tickFormatter={(value) => formatChartValue(Number(value), config.metric)} />
        <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} formatter={(value) => formatChartValue(Number(value), config.metric)} />
        <Line type="monotone" dataKey="value" stroke="var(--chart-primary)" strokeWidth={3} />
      </LineChart>
    </ResponsiveContainer>
  );
}
