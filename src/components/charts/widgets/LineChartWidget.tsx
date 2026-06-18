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
  if (config.type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={(value) => formatChartValue(Number(value), config.metric)} />
          <Tooltip formatter={(value) => formatChartValue(Number(value), config.metric)} />
          <Area type="monotone" dataKey="value" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis tickFormatter={(value) => formatChartValue(Number(value), config.metric)} />
        <Tooltip formatter={(value) => formatChartValue(Number(value), config.metric)} />
        <Line type="monotone" dataKey="value" strokeWidth={3} />
      </LineChart>
    </ResponsiveContainer>
  );
}
