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
    <aside className={`cc-right-panel rounded-lg border ${className}`}>
      <div className={`${compact ? 'px-3 py-3' : 'px-4 py-3'} cc-right-panel-header border-b`}>
        <div className="flex items-center gap-3">
          <span className="cc-right-panel-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
            <BarChart3 size={19} />
          </span>
          <div className="min-w-0">
            <h2 className="cc-right-panel-title truncate text-sm font-black sm:text-base">{title}</h2>
            {subtitle ? <p className="cc-right-panel-subtitle mt-0.5 truncate text-xs font-semibold">{subtitle}</p> : null}
          </div>
        </div>
      </div>

      <div className={`${compact ? 'gap-3 p-3' : 'gap-4 p-4'} cc-right-panel-body flex flex-col`}>
        {children}
      </div>

      {footer ? (
        <div className={`${compact ? 'px-3 py-3' : 'px-4 py-3'} cc-right-panel-footer border-t text-xs font-semibold`}>
          {footer}
        </div>
      ) : null}
    </aside>
  );
}

