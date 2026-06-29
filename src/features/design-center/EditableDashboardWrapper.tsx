import { type ReactNode } from 'react';
import type { DesignComponentConfig, DesignComponentId } from './designTypes';
import { componentSizeOptions } from './safeOptions';

type EditableDashboardWrapperProps = {
  componentId: DesignComponentId;
  componentConfig: DesignComponentConfig | undefined;
  children: ReactNode;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisibility: () => void;
  onChangeSize: (size: DesignComponentConfig['size']) => void;
  onOpenEdit: () => void;
};

const componentLabels: Record<string, string> = {
  header: 'Encabezado',
  filters: 'Filtros',
  'left-kpi-facturacion': 'KPI Facturacion',
  'left-kpi-reclamos': 'KPI Reclamos',
  'left-kpi-promedio': 'KPI Promedio',
  'main-map': 'Mapa',
  'right-summary': 'Resumen',
  'card-total-comunas': 'Total comunas',
  'card-alta-prioridad': 'Alta prioridad',
  'card-periodo': 'Periodo',
  'card-tickets': 'Tickets',
  'chart-facturacion-mensual': 'Graf. Facturacion',
  'chart-top-reclamos': 'Graf. Top reclamos',
  'chart-top-facturacion': 'Graf. Top facturacion',
  'chart-prioridad': 'Graf. Prioridad',
  'table-evidencia': 'Tabla evidencia',
  'route-visitador': 'Ruta Visitador',
};

export function EditableDashboardWrapper({
  componentId,
  componentConfig,
  children,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onChangeSize,
  onOpenEdit,
}: EditableDashboardWrapperProps) {
  const config = componentConfig;
  const isHidden = config && !config.visible;

  return (
    <div className={`group relative ${isHidden ? 'opacity-40' : ''}`}>
      {isHidden ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <span className="rounded bg-slate-800/70 px-3 py-1 text-xs font-black text-white">Oculto</span>
        </div>
      ) : null}

      <div className="absolute right-1 top-1 z-20 hidden gap-0.5 rounded-lg border border-blue-200 bg-white shadow-sm group-hover:flex">
        <span className="flex items-center px-1.5 text-[10px] font-bold text-blue-700 whitespace-nowrap">
          {componentLabels[componentId] ?? componentId}
        </span>

        <button
          className="h-6 w-6 rounded text-xs font-black text-slate-600 hover:bg-slate-100"
          onClick={onMoveUp}
          title="Mover arriba"
          type="button"
        >
          ↑
        </button>

        <button
          className="h-6 w-6 rounded text-xs font-black text-slate-600 hover:bg-slate-100"
          onClick={onMoveDown}
          title="Mover abajo"
          type="button"
        >
          ↓
        </button>

        <select
          className="h-6 w-16 rounded border-0 bg-transparent text-[10px] font-bold text-slate-600 hover:bg-slate-100"
          onChange={(e) => onChangeSize(e.target.value as DesignComponentConfig['size'])}
          onClick={(e) => e.stopPropagation()}
          title="Tamaño"
          value={config?.size ?? 'medium'}
        >
          {componentSizeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        <button
          className={`h-6 w-6 rounded text-xs font-black ${isHidden ? 'text-green-600' : 'text-slate-600'} hover:bg-slate-100`}
          onClick={onToggleVisibility}
          title={isHidden ? 'Mostrar' : 'Ocultar'}
          type="button"
        >
          {isHidden ? '◎' : '◉'}
        </button>

        <button
          className="h-6 w-6 rounded text-xs font-black text-blue-700 hover:bg-blue-50"
          onClick={onOpenEdit}
          title="Editar"
          type="button"
        >
          ✎
        </button>
      </div>

      <div className={`rounded-lg ${!isHidden ? 'ring-1 ring-dashed ring-blue-300 ring-offset-1' : ''}`}>
        {children}
      </div>
    </div>
  );
}
