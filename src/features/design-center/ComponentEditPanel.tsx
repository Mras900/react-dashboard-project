import type { DesignComponentConfig, DesignKpiAccent, DesignSectionId } from './designTypes';
import { componentSizeOptions, sectionOptions } from './safeOptions';

type ComponentEditPanelProps = {
  component: DesignComponentConfig;
  onUpdate: (updater: (comp: DesignComponentConfig) => DesignComponentConfig) => void;
  onClose: () => void;
};

const accentColorOptions: Array<{ value: DesignKpiAccent; label: string }> = [
  { value: 'blue', label: 'Azul' },
  { value: 'red', label: 'Rojo' },
  { value: 'cyan', label: 'Cian' },
  { value: 'green', label: 'Verde' },
  { value: 'amber', label: 'Ambar' },
  { value: 'slate', label: 'Pizarra' },
];

const componentInfo: Record<string, string> = {
  header: 'Encabezado del dashboard',
  filters: 'Barra de filtros operativos',
  'left-kpi-facturacion': 'Card Facturacion total',
  'left-kpi-reclamos': 'Card Reclamos totales',
  'left-kpi-promedio': 'Card Promedio por reclamo',
  'main-map': 'Mapa de reclamos',
  'right-summary': 'Panel resumen operativo',
  'card-total-comunas': 'Card Total comunas',
  'card-alta-prioridad': 'Card Alta prioridad',
  'card-periodo': 'Card Periodo analizado',
  'card-tickets': 'Card Tickets unicos',
  'chart-facturacion-mensual': 'Grafico Facturacion mensual',
  'chart-top-reclamos': 'Grafico Top reclamos',
  'chart-top-facturacion': 'Grafico Top facturacion',
  'chart-prioridad': 'Grafico Distribucion prioridad',
  'table-evidencia': 'Tabla Evidencia por comuna',
  'route-visitador': 'Ruta Visitador',
};

export function ComponentEditPanel({ component, onUpdate, onClose }: ComponentEditPanelProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 border-l border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase text-[#466083]">Editar componente</p>
          <h3 className="text-sm font-black text-[#071b4d]">{componentInfo[component.id] ?? component.id}</h3>
        </div>
        <button className="h-8 w-8 rounded-lg border border-slate-200 text-sm font-black text-slate-500 hover:bg-slate-50" onClick={onClose} type="button">
          ✕
        </button>
      </div>

      <div className="grid gap-4 overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 64px)' }}>
        <label className="grid gap-1">
          <span className="text-[10px] font-black uppercase text-[#466083]">Titulo</span>
          <input
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]"
            maxLength={90}
            onChange={(e) => onUpdate((c) => ({ ...c, title: e.target.value }))}
            value={component.title}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-[10px] font-black uppercase text-[#466083]">Subtitulo</span>
          <input
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-[#071b4d]"
            maxLength={90}
            onChange={(e) => onUpdate((c) => ({ ...c, subtitle: e.target.value }))}
            value={component.subtitle ?? ''}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-[10px] font-black uppercase text-[#466083]">Visible</span>
          <label className="flex items-center gap-2 text-sm font-black text-[#071b4d]">
            <input
              checked={component.visible}
              className="h-4 w-4 rounded border-slate-300 text-blue-700"
              onChange={(e) => onUpdate((c) => ({ ...c, visible: e.target.checked }))}
              type="checkbox"
            />
            {component.visible ? 'Visible' : 'Oculto'}
          </label>
        </label>

        <label className="grid gap-1">
          <span className="text-[10px] font-black uppercase text-[#466083]">Seccion</span>
          <select
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]"
            onChange={(e) => onUpdate((c) => ({ ...c, section: e.target.value as DesignSectionId }))}
            value={component.section}
          >
            {sectionOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-[10px] font-black uppercase text-[#466083]">Orden</span>
          <input
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]"
            min={0}
            onChange={(e) => onUpdate((c) => ({ ...c, order: Number(e.target.value) || 0 }))}
            type="number"
            value={component.order}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-[10px] font-black uppercase text-[#466083]">Tamano</span>
          <select
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]"
            onChange={(e) => onUpdate((c) => ({ ...c, size: e.target.value as DesignComponentConfig['size'] }))}
            value={component.size}
          >
            {componentSizeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-[10px] font-black uppercase text-[#466083]">Color acento</span>
          <select
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-black text-[#071b4d]"
            onChange={(e) => onUpdate((c) => ({ ...c, accent: e.target.value ? (e.target.value as DesignKpiAccent) : undefined }))}
            value={component.accent ?? ''}
          >
            <option value="">Ninguno</option>
            {accentColorOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
