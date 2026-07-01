import type { ReactNode } from 'react';
import { Bell, LogOut, Menu, Moon, Navigation, PanelLeftClose, PanelLeftOpen, Search, Sun, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type ShellTheme = 'dark' | 'light';

type TailAdminShellNavItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
};

type TailAdminDashboardShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  navItems?: TailAdminShellNavItem[];
  activeItemId?: string;
  onNavItemClick?: (itemId: string) => void;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
  actions?: ReactNode;
};

const THEME_KEY = 'tailadmin-dashboard-shell-theme';

export function TailAdminDashboardShell({
  children,
  title,
  subtitle,
  navItems = [],
  activeItemId,
  onNavItemClick,
  userName = 'Usuario',
  userRole = 'Operacion',
  onLogout,
  actions,
}: TailAdminDashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [theme, setTheme] = useState<ShellTheme>(() =>
    localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark',
  );

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const initials = useMemo(() => {
    const parts = userName.trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? '');
  }, [userName]);

  const isDark = theme === 'dark';
  const shellColors = isDark
    ? 'bg-[#0D1117] text-[#EAF0F8]'
    : 'bg-slate-50 text-slate-950';
  const panelColors = isDark
    ? 'border-white/[0.08] bg-[#111827] text-[#EAF0F8]'
    : 'border-slate-200 bg-white text-slate-950';
  const mutedText = isDark ? 'text-[#7A90A8]' : 'text-slate-500';

  return (
    <div className={`cc-tailadmin-shell min-h-screen ${shellColors}`} data-shell-theme={theme}>
      {isSidebarOpen ? (
        <button
          aria-label="Cerrar menu"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r transition-all duration-200 ${panelColors} ${
          isCompact ? 'lg:w-[92px]' : 'lg:w-[292px]'
        } ${isSidebarOpen ? 'w-[292px] translate-x-0' : 'w-[292px] -translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/[0.08] px-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1B4FD8] text-white">
            <Navigation size={22} />
          </span>
          {!isCompact ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-black">Reclamos</p>
              <p className={`truncate text-xs font-semibold ${mutedText}`}>Dashboard admin</p>
            </div>
          ) : null}
          <button
            aria-label={isCompact ? 'Expandir sidebar' : 'Compactar sidebar'}
            className="ml-auto hidden h-9 w-9 items-center justify-center rounded-lg text-[#7A90A8] transition hover:bg-white/[0.06] hover:text-[#EAF0F8] lg:flex"
            onClick={() => setIsCompact((current) => !current)}
            type="button"
          >
            {isCompact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            aria-label="Cerrar menu"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-[#7A90A8] lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className={`mb-3 px-3 text-xs font-black uppercase tracking-[0.18em] ${mutedText}`}>
            {isCompact ? 'Menu' : 'Navegacion'}
          </p>
          <div className="grid gap-1.5">
            {navItems.map((item) => {
              const isActive = item.id === activeItemId;
              return (
                <button
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    isActive
                      ? 'bg-[#1B4FD8] text-white shadow-lg shadow-blue-950/20'
                      : `${mutedText} hover:bg-white/[0.06] hover:text-[#EAF0F8]`
                  } ${isCompact ? 'lg:justify-center' : ''}`}
                  disabled={item.disabled}
                  key={item.id}
                  onClick={() => {
                    onNavItemClick?.(item.id);
                    setIsSidebarOpen(false);
                  }}
                  type="button"
                >
                  {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                  {!isCompact ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
                  {!isCompact && item.badge ? (
                    <span className="rounded-full border border-white/[0.12] bg-white/[0.08] px-2 py-0.5 text-[11px] font-black">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </nav>
      </aside>

      <div className={`min-h-screen transition-all duration-200 ${isCompact ? 'lg:pl-[92px]' : 'lg:pl-[292px]'}`}>
        <header className={`sticky top-0 z-20 border-b backdrop-blur ${panelColors}`}>
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
            <button
              aria-label="Abrir menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] text-[#7A90A8] lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
              type="button"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-black sm:text-xl">{title}</h1>
              {subtitle ? <p className={`truncate text-xs font-semibold sm:text-sm ${mutedText}`}>{subtitle}</p> : null}
            </div>

            <div className="hidden min-w-[220px] max-w-sm flex-1 sm:block">
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A90A8]" size={17} />
                <input
                  className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#0D1117] pl-10 pr-3 text-sm font-semibold text-[#EAF0F8] outline-none focus:border-[#1B4FD8] focus:ring-4 focus:ring-[#1B4FD8]/15"
                  placeholder="Buscar..."
                  type="search"
                />
              </label>
            </div>

            {actions}

            <button
              aria-label="Notificaciones"
              className="hidden h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] text-[#7A90A8] transition hover:border-[#1B4FD8] hover:text-[#EAF0F8] sm:flex"
              type="button"
            >
              <Bell size={18} />
            </button>
            <button
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="h-10 w-10 rounded-lg border border-white/[0.08] text-[#7A90A8] transition hover:border-[#1B4FD8] hover:text-[#EAF0F8]"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              type="button"
            >
              <span className="flex h-full items-center justify-center">{isDark ? <Sun size={18} /> : <Moon size={18} />}</span>
            </button>

            <div className="hidden items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 md:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B4FD8] text-xs font-black text-white">
                {initials.toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="max-w-28 truncate text-xs font-black">{userName}</p>
                <p className={`max-w-28 truncate text-[11px] font-semibold ${mutedText}`}>{userRole}</p>
              </div>
            </div>

            {onLogout ? (
              <button
                aria-label="Cerrar sesion"
                className="h-10 w-10 rounded-lg border border-white/[0.08] text-[#7A90A8] transition hover:border-red-400/50 hover:text-red-200"
                onClick={onLogout}
                type="button"
              >
                <span className="flex h-full items-center justify-center"><LogOut size={18} /></span>
              </button>
            ) : null}
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

