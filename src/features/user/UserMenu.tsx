import { ChevronDown, Moon, Settings, Sun, UploadCloud, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type UserMenuProps = {
  isDarkPremium: boolean;
  onOpenImport: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
};

export function UserMenu({ isDarkPremium, onOpenImport, onOpenSettings, onToggleTheme }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const closeMenu = () => setIsOpen(false);

  return (
    <div ref={containerRef} className="relative">
      {/* TODO: Más adelante proteger estas opciones con autenticación. */}
      <button className="flex h-10 items-center gap-2 rounded-full text-[#172448]" onClick={() => setIsOpen((current) => !current)} type="button" aria-expanded={isOpen}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#073B91] text-sm font-black text-white">AV</span>
        <ChevronDown size={14} />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <button
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-black text-[#172448] transition hover:bg-slate-50"
            onClick={() => {
              closeMenu();
              onOpenImport();
            }}
            type="button"
          >
            <UploadCloud size={16} />
            Importar datos
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-black text-[#172448] transition hover:bg-slate-50"
            onClick={() => {
              closeMenu();
              onOpenSettings();
            }}
            type="button"
          >
            <Settings size={16} />
            Configuración
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-black text-[#172448] transition hover:bg-slate-50"
            onClick={() => {
              closeMenu();
              onToggleTheme();
            }}
            type="button"
          >
            {isDarkPremium ? <Sun size={16} /> : <Moon size={16} />}
            Cambiar tema
          </button>
          <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-black text-[#172448] transition hover:bg-slate-50" onClick={closeMenu} type="button">
            <X size={16} />
            Cerrar menú
          </button>
        </div>
      ) : null}
    </div>
  );
}
