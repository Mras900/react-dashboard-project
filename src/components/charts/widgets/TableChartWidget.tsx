import type { ChartConfig, ChartDataPoint } from '../../../features/reports/chart-types';
import { formatChartValue } from '../../../features/reports/chart-utils';

type Props = {
  config: ChartConfig;
  data: ChartDataPoint[];
};

export function TableChartWidget({ config, data }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2 font-black">Dimensión</th>
            <th className="px-3 py-2 text-right font-black">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((item) => (
            <tr key={item.name}>
              <td className="px-3 py-2 font-bold">{item.name}</td>
              <td className="px-3 py-2 text-right font-black">{formatChartValue(item.value, config.metric)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
