import type { ReactNode } from 'react';
import { Bell, CloudDownload, Download, Moon, Sun } from 'lucide-react';

type TailAdminTopbarProps = {
  title: string;
  subtitle: string;
  viewMode: 'rm' | 'regiones';
  isDarkPremium: boolean;
  isEmptyCurrentView: boolean;
  emptyViewMessage: string;
  onPrintDashboard: () => void;
  onExportEvidence: () => void;
  onToggleTheme: () => void;
  userMenu: ReactNode;
};

export function TailAdminTopbar({
  title,
  subtitle,
  viewMode,
  isDarkPremium,
  isEmptyCurrentView,
  emptyViewMessage,
  onPrintDashboard,
  onExportEvidence,
  onToggleTheme,
  userMenu,
}: TailAdminTopbarProps) {
  const downloadLabel = viewMode === 'rm' ? 'Descargar RM' : 'Descargar Regiones';
  const downloadTitle = viewMode === 'regiones' && isEmptyCurrentView ? emptyViewMessage : downloadLabel;

  return (
    <header className="cc-header no-print mb-3 flex min-h-[68px] flex-col gap-3 rounded-lg border border-white/[0.08] bg-[#111827]/95 px-4 py-3 shadow-lg shadow-black/20 backdrop-blur xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1B4FD8] shadow-[0_0_0_4px_rgba(27,79,216,0.16)]" aria-hidden="true" />
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7A90A8]">Dashboard administrativo</p>
        </div>
        <h1 className="mt-1 truncate text-xl font-black tracking-tight text-[#EAF0F8] 2xl:text-2xl">{title}</h1>
        <p className="mt-1 truncate text-xs font-semibold text-[#7A90A8] 2xl:text-sm">{subtitle}</p>
      </div>

      <div className="cc-header-actions flex flex-wrap items-center justify-start gap-2 xl:justify-end">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#1B4FD8]/40 bg-[#1B4FD8] px-3 text-xs font-black text-white shadow-lg shadow-blue-950/25 transition hover:bg-[#245ee9] disabled:cursor-not-allowed disabled:opacity-50 2xl:px-4"
          disabled={viewMode === 'regiones' && isEmptyCurrentView}
          onClick={onPrintDashboard}
          title={downloadTitle}
          type="button"
        >
          <CloudDownload size={17} />
          <span>{downloadLabel}</span>
        </button>

        <button
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-black text-[#EAF0F8] shadow-sm transition hover:border-[#1B4FD8]/60 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50 2xl:px-4"
          disabled={isEmptyCurrentView}
          onClick={onExportEvidence}
          title={isEmptyCurrentView ? emptyViewMessage : 'Exportar evidencia'}
          type="button"
        >
          <Download size={17} />
          <span>Exportar evidencia</span>
        </button>

        <button
          aria-label={isDarkPremium ? 'Cambiar a tema claro' : 'Cambiar a modo oscuro'}
          className="theme-toggle inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-black text-[#EAF0F8] shadow-sm transition hover:border-[#1B4FD8]/60 hover:bg-white/[0.07] 2xl:px-4"
          onClick={onToggleTheme}
          title={isDarkPremium ? 'Tema claro' : 'Modo oscuro'}
          type="button"
        >
          {isDarkPremium ? <Sun size={17} /> : <Moon size={17} />}
          <span className="hidden sm:inline">{isDarkPremium ? 'Tema claro' : 'Modo oscuro'}</span>
        </button>

        <button
          aria-label="Notificaciones"
          className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[#EAF0F8] transition hover:border-[#1B4FD8]/60 hover:bg-white/[0.07]"
          type="button"
        >
          <Bell size={19} />
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">3</span>
        </button>

        {userMenu}
      </div>
    </header>
  );
}
