import type { ReactNode } from 'react';
import { ChevronUp, SlidersHorizontal } from 'lucide-react';

type TailAdminSidePanelProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  footer?: ReactNode;
  className?: string;
};

export function TailAdminSidePanel({
  title,
  subtitle,
  children,
  collapsed = false,
  onToggle,
  footer,
  className = '',
}: TailAdminSidePanelProps) {
  return (
    <section className={`rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] shadow-lg shadow-black/20 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-main)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1B4FD8]/30 bg-[#1B4FD8]/15 text-[#AFC6FF]">
            <SlidersHorizontal size={19} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-[var(--text-main)] sm:text-base">{title}</h2>
            {subtitle ? <p className="mt-0.5 truncate text-xs font-semibold text-[var(--cc-muted)]">{subtitle}</p> : null}
          </div>
        </div>

        {onToggle ? (
          <button
            aria-expanded={!collapsed}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--cc-muted)] transition hover:border-[#1B4FD8]/60 hover:text-[var(--text-main)]"
            onClick={onToggle}
            type="button"
          >
            <ChevronUp className={collapsed ? 'rotate-180 transition-transform' : 'transition-transform'} size={17} />
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="max-h-[34rem] overflow-y-auto px-4 py-3">
          {children}
        </div>
      ) : null}

      {footer && !collapsed ? (
        <div className="border-t border-[var(--border-main)] px-4 py-3 text-xs font-semibold text-[var(--cc-muted)]">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
