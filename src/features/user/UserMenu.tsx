import { ChevronDown, LogOut, Moon, Settings, Sun, UploadCloud, UserCog, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';

type UserMenuProps = {
  isDarkPremium: boolean;
  onOpenImport: () => void;
  onOpenSettings: () => void;
  onOpenUsers: () => void;
  onToggleTheme: () => void;
};

export function UserMenu({ isDarkPremium, onOpenImport, onOpenSettings, onOpenUsers, onToggleTheme }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { user, logout, hasPermission, isAdmin } = useAuth();

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const closeMenu = () => setIsOpen(false);
  const initials = user?.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'US';

  return (
    <div ref={containerRef} className="relative">
      <button className="cc-user-trigger flex h-10 items-center gap-2 rounded-full text-[#172448]" onClick={() => setIsOpen((current) => !current)} type="button" aria-expanded={isOpen}>
        <span className="cc-avatar flex h-9 w-9 items-center justify-center rounded-full bg-[#073B91] text-sm font-black text-white">{initials}</span>
        <ChevronDown size={14} />
      </button>

      {isOpen ? (
        <div className="cc-user-menu absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="cc-user-menu-header border-b border-slate-200 px-3 py-3">
            <p className="truncate text-sm font-bold text-[#172448]">{user?.displayName}</p>
            <p className="mt-0.5 text-xs font-semibold text-[#466083]">{isAdmin ? 'Administrador' : 'Usuario'} · @{user?.username}</p>
          </div>
          {hasPermission('importaciones') ? <button className="cc-user-menu-item flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-[#172448] hover:bg-slate-50" onClick={() => { closeMenu(); onOpenImport(); }} type="button"><UploadCloud size={16} />Importar datos</button> : null}
          {hasPermission('configuracion') ? <button className="cc-user-menu-item flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-[#172448] hover:bg-slate-50" onClick={() => { closeMenu(); onOpenSettings(); }} type="button"><Settings size={16} />Configuración</button> : null}
          {isAdmin ? <button className="cc-user-menu-item flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-[#172448] hover:bg-slate-50" onClick={() => { closeMenu(); onOpenUsers(); }} type="button"><UserCog size={16} />Usuarios</button> : null}
          <button className="cc-user-menu-item flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-[#172448] hover:bg-slate-50" onClick={() => { closeMenu(); onToggleTheme(); }} type="button">{isDarkPremium ? <Sun size={16} /> : <Moon size={16} />}Cambiar tema</button>
          <button className="cc-user-menu-item cc-user-menu-danger flex w-full items-center gap-2 border-t border-slate-200 px-3 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-50" onClick={() => { closeMenu(); void logout(); }} type="button"><LogOut size={16} />Cerrar sesión</button>
          <button className="cc-user-menu-item cc-user-menu-muted flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-[#466083] hover:bg-slate-50" onClick={closeMenu} type="button"><X size={16} />Cerrar menú</button>
        </div>
      ) : null}
    </div>
  );
}