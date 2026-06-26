import type { LucideIcon } from 'lucide-react';

type InsightLevel = 'Sin reclamos' | 'Bajo' | 'Medio' | 'Alto' | 'Crítico' | 'Baja' | 'Media' | 'Alta' | 'Crítica' | string;

const levelStyles: Record<string, string> = {
  'Sin reclamos': 'border-slate-600/70 bg-slate-700/30 text-slate-200',
  Bajo: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  Baja: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  Medio: 'border-amber-400/45 bg-amber-500/15 text-amber-100',
  Media: 'border-amber-400/45 bg-amber-500/15 text-amber-100',
  Alto: 'border-orange-400/45 bg-orange-500/15 text-orange-100',
  Alta: 'border-orange-400/45 bg-orange-500/15 text-orange-100',
  Crítico: 'border-red-400/45 bg-red-500/15 text-red-100',
  Crítica: 'border-red-400/45 bg-red-500/15 text-red-100',
};

interface TerritorialInsightCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  level?: InsightLevel;
  secondary?: string;
  tooltip?: string;
}

export function TerritorialInsightCard({ title, value, description, icon: Icon, level, secondary, tooltip }: TerritorialInsightCardProps) {
  const levelClass = level ? levelStyles[level] ?? 'border-slate-500/50 bg-slate-600/20 text-slate-200' : '';

  return (
    <article
      className="group relative min-h-[148px] rounded-xl border border-slate-700/70 bg-[#0b1524] p-4 shadow-sm shadow-slate-950/20"
      title={tooltip}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/80 text-sky-200">
          <Icon size={18} />
        </div>
        {level ? <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${levelClass}`}>{level}</span> : null}
      </div>

      <div className="mt-4 min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{title}</p>
        <div className="mt-1 flex min-h-[34px] flex-wrap items-baseline gap-x-2 gap-y-1">
          <strong className="break-words text-xl font-black leading-tight text-white">{value}</strong>
          {secondary ? <span className="text-xs font-black text-sky-200">{secondary}</span> : null}
        </div>
        <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-400">{description}</p>
      </div>
    </article>
  );
}

