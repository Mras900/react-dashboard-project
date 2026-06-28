import { AlertTriangle, FileBarChart, MapPin, ShieldCheck, Users } from 'lucide-react';
import type { DesignKpiConfig } from './designTypes';
import type { KpiDataSources } from './kpiCalculations';
import { calculateConfigurableKpi } from './kpiCalculations';
import { TailAdminKpiCard } from '../ui-tailadmin/TailAdminKpiCard';

type ConfigurableKpiCardProps = {
  kpi: DesignKpiConfig;
  dataSources: KpiDataSources;
};

const icons = {
  file: FileBarChart,
  alert: AlertTriangle,
  users: Users,
  map: MapPin,
  shield: ShieldCheck,
  chart: FileBarChart,
};

export function ConfigurableKpiCard({ kpi, dataSources }: ConfigurableKpiCardProps) {
  const Icon = icons[kpi.icon] ?? FileBarChart;
  const result = calculateConfigurableKpi(kpi, dataSources);

  return (
    <div className="flex h-full flex-col gap-2">
      <TailAdminKpiCard
        className="flex-1"
        detail={kpi.description || result.detail}
        icon={<Icon size={28} />}
        title={kpi.title}
        tone={kpi.accent}
        value={result.displayValue}
      />
    </div>
  );
}