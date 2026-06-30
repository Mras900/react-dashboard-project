import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

type KpiTone = 'blue' | 'green' | 'red' | 'amber' | 'cyan' | 'slate';
type TrendDirection = 'up' | 'down' | 'flat';

type TailAdminKpiCardProps = {
  title: string;
  value: string | number;
  icon?: ReactNode;
  detail?: string;
  trendLabel?: string;
  trendDirection?: TrendDirection;
  tone?: KpiTone;
  className?: string;
};

const toneStyles: Record<KpiTone, { icon: string; trend: string; halo: string }> = {
  blue: {
    icon: 'bg-[#1B4FD8]/15 text-[#8FB2FF] border-[#1B4FD8]/30',
    trend: 'bg-[#1B4FD8]/15 text-[#AFC6FF] border-[#1B4FD8]/30',
    halo: 'bg-[#1B4FD8]/10',
  },
  green: {
    icon: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
    trend: 'bg-emerald-400/10 text-emerald-200 border-emerald-400/20',
    halo: 'bg-emerald-400/10',
  },
  red: {
    icon: 'bg-red-400/10 text-red-300 border-red-400/20',
    trend: 'bg-red-400/10 text-red-200 border-red-400/20',
    halo: 'bg-red-400/10',
  },
  amber: {
    icon: 'bg-amber-400/10 text-amber-200 border-amber-400/20',
    trend: 'bg-amber-400/10 text-amber-100 border-amber-400/20',
    halo: 'bg-amber-400/10',
  },
  cyan: {
    icon: 'bg-cyan-400/10 text-cyan-200 border-cyan-400/20',
    trend: 'bg-cyan-400/10 text-cyan-100 border-cyan-400/20',
    halo: 'bg-cyan-400/10',
  },
  slate: {
    icon: 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-main)]',
    trend: 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-main)]',
    halo: 'bg-[var(--bg-card)]',
  },
};

const TrendIcon = ({ direction }: { direction: TrendDirection }) => {
  if (direction === 'up') return <ArrowUpRight size={14} />;
  if (direction === 'down') return <ArrowDownRight size={14} />;
  return <Minus size={14} />;
};

export function TailAdminKpiCard({
  title,
  value,
  icon,
  detail,
  trendLabel,
  trendDirection = 'flat',
  tone = 'blue',
  className = '',
}: TailAdminKpiCardProps) {
  const styles = toneStyles[tone];

  return (
    <section className={`relative flex min-h-[132px] items-center overflow-hidden rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] p-4 shadow-lg shadow-black/20 ${className}`}>
      <div className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl ${styles.halo}`} />
      <div className="relative w-full">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="truncate text-sm font-bold text-[var(--cc-muted)]">{title}</p>
            <p className="mt-1.5 break-words text-2xl font-black leading-none text-[var(--text-main)]">{value}</p>
            {(detail || trendLabel) ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {detail ? <p className="min-w-0 text-xs font-semibold leading-snug text-[var(--cc-muted)]">{detail}</p> : null}
                {trendLabel ? (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${styles.trend}`}>
                    <TrendIcon direction={trendDirection} />
                    {trendLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          {icon ? (
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}>
              {icon}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

