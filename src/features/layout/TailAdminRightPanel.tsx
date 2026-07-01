import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
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
  const reduceMotion = useReducedMotion();
  const panelMotion = reduceMotion
    ? { initial: false, animate: { opacity: 1, x: 0 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, x: 8 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.22, ease: 'easeOut' as const } };

  return (
    <motion.aside className={`cc-right-panel rounded-lg border ${className}`} {...panelMotion}>
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
    </motion.aside>
  );
}
