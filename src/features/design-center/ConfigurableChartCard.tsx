import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DesignChartConfig } from './designTypes';
import type { KpiDataSources } from './kpiCalculations';
import type { PieLabelRenderProps } from 'recharts';
import { extractChartData } from './chartDataAdapters';
import { chartPalette, getChartAccentHex } from './chartRegistry';

type ConfigurableChartCardProps = {
  chart: DesignChartConfig;
  dataSources: KpiDataSources;
};

function SinDatos() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center">
      <p className="text-sm font-bold text-[var(--cc-muted)]">Sin datos</p>
    </div>
  );
}

export function ConfigurableChartCard({ chart, dataSources }: ConfigurableChartCardProps) {
  const data = useMemo(() => extractChartData(chart, dataSources), [chart, dataSources]);

  const content = useMemo(() => {
    if (!data || data.length === 0) return <SinDatos />;

    const primaryColor = getChartAccentHex(chart.accent);
    const tooltipStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-main)' };
    const fmt = (value: number | string) => {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n.toLocaleString('es-CL') : String(value);
    };

    if (chart.type === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="var(--border-main)" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [fmt(value as number), '']} />
            <Bar dataKey="value" fill={primaryColor} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chart.type === 'line') {
      return (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="var(--border-main)" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [fmt(value as number), '']} />
            <Line type="monotone" dataKey="value" stroke={primaryColor} strokeWidth={2} dot={{ fill: primaryColor, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chart.type === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label={({ name, percent }: PieLabelRenderProps) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}>
              {data.map((_, index) => (
                <Cell key={index} fill={chartPalette[index % chartPalette.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [fmt(value as number), '']} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    return <SinDatos />;
  }, [data, chart.type, chart.accent]);

  return (
    <div className="flex h-full flex-col gap-1 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] p-4">
      <div className="flex-shrink-0">
        <h3 className="text-sm font-black text-[var(--text-main)]">{chart.title}</h3>
        {chart.subtitle ? <p className="text-[11px] font-semibold text-[var(--cc-muted)]">{chart.subtitle}</p> : null}
      </div>
      <div className="min-h-0 flex-1">{content}</div>
    </div>
  );
}
