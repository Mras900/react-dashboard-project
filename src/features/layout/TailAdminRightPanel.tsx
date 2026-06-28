import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';

type TailAdminRightPanelProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  className?: string;
};

export function TailAdminRightPanel({
  title,
  subtitle,
  children,
  footer,
  compact = false,
  className = '',
}: TailAdminRightPanelProps) {
  return (
    <aside className={`rounded-lg border border-white/[0.08] bg-[#111827] shadow-lg shadow-black/20 ${className}`}>
      <div className={`${compact ? 'px-3 py-3' : 'px-4 py-3'} border-b border-white/[0.08]`}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1B4FD8]/30 bg-[#1B4FD8]/15 text-[#AFC6FF]">
            <BarChart3 size={19} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-[#EAF0F8] sm:text-base">{title}</h2>
            {subtitle ? <p className="mt-0.5 truncate text-xs font-semibold text-[#7A90A8]">{subtitle}</p> : null}
          </div>
        </div>
      </div>

      <div className={`${compact ? 'max-h-[28rem] gap-3 p-3' : 'max-h-[38rem] gap-4 p-4'} flex flex-col overflow-y-auto`}>
        {children}
      </div>

      {footer ? (
        <div className={`${compact ? 'px-3 py-3' : 'px-4 py-3'} border-t border-white/[0.08] text-xs font-semibold text-[#7A90A8]`}>
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
