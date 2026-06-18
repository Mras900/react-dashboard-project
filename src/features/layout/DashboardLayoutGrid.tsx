import { useEffect, useMemo, useState } from 'react';
import * as ReactGridLayout from 'react-grid-layout';
import { Eye, EyeOff, GripHorizontal, RotateCcw, Save, Settings2 } from 'lucide-react';
import { defaultLayouts, loadDashboardLayout, resetDashboardLayout, saveDashboardLayout, toggleHiddenWidget } from './layoutStorage';
import type { DashboardWidget, DashboardWidgetId, GridLayoutItem, GridLayouts } from './types';

const ResponsiveGridLayout = (ReactGridLayout as any).Responsive;

export const GRID_COLS = {
  xxl: 12,
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2,
} as const;

const BREAKPOINTS = {
  xxl: 1536,
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
} as const;

type Breakpoint = keyof typeof GRID_COLS;

type DashboardLayoutGridProps = {
  widgets: DashboardWidget[];
};

function cloneLayouts(layouts: GridLayouts): GridLayouts {
  return Object.fromEntries(
    Object.entries(layouts).map(([breakpoint, items]) => [
      breakpoint,
      items.map((item: GridLayoutItem) => ({ ...item })),
    ]),
  ) as GridLayouts;
}

function dispatchResizeForLeaflet(): void {
  if (typeof window === 'undefined') return;

  window.setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 120);
}

function createMissingLayoutItem(
  id: string,
  index: number,
  breakpoint: Breakpoint,
): GridLayoutItem {
  const cols = GRID_COLS[breakpoint];

  if (breakpoint === 'lg') {
    return {
      i: id,
      x: (index * 3) % cols,
      y: 999 + index * 2,
      w: 3,
      h: 2,
    };
  }

  return {
    i: id,
    x: 0,
    y: 999 + index * 2,
    w: cols,
    h: 2,
  };
}

function ensureLayoutsForWidgets(layouts: GridLayouts, widgetIds: string[]): GridLayouts {
  const next = cloneLayouts(layouts);
  const breakpoints = Object.keys(GRID_COLS) as Breakpoint[];

  breakpoints.forEach((breakpoint) => {
    const current = next[breakpoint] ? next[breakpoint].map((item) => ({ ...item })) : [];
    const currentIds = new Set(current.map((item) => item.i));

    const missingItems = widgetIds
      .filter((id) => !currentIds.has(id))
      .map((id, index) => createMissingLayoutItem(id, index, breakpoint));

    next[breakpoint] = [...current, ...missingItems];
  });

  return next;
}

export function DashboardLayoutGrid({ widgets }: DashboardLayoutGridProps) {
  const stored = useMemo(() => loadDashboardLayout(), []);
  const [editMode, setEditMode] = useState(false);
  const [layouts, setLayouts] = useState<GridLayouts>(stored.layouts);
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<DashboardWidgetId[]>(
    stored.hiddenWidgetIds,
  );

  const widgetIds = useMemo(() => widgets.map((widget) => widget.id), [widgets]);
  const widgetIdsKey = widgetIds.join('|');
  const safeLayouts = useMemo(
    () => ensureLayoutsForWidgets(layouts, widgetIds),
    [layouts, widgetIds],
  );
  const visibleWidgets = useMemo(
    () => widgets.filter((widget) => !hiddenWidgetIds.includes(widget.id)),
    [widgets, hiddenWidgetIds],
  );

  useEffect(() => {
    setLayouts((current) => ensureLayoutsForWidgets(current, widgetIds));
  }, [widgetIdsKey]);

  useEffect(() => {
    dispatchResizeForLeaflet();
  }, [safeLayouts, hiddenWidgetIds, editMode]);

  const handleSave = () => {
    saveDashboardLayout({
      layouts: safeLayouts,
      hiddenWidgetIds,
    });

    setEditMode(false);
    dispatchResizeForLeaflet();
  };

  const handleReset = () => {
    resetDashboardLayout();
    setLayouts(cloneLayouts(defaultLayouts));
    setHiddenWidgetIds([]);
    setEditMode(false);
    dispatchResizeForLeaflet();
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#466083]">
            Personalización
          </p>
          <h2 className="text-xl font-black text-[#071b4d]">
            Layout configurable
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Mueve, ordena, redimensiona, oculta o muestra bloques del dashboard sin tocar código.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className={`flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-black shadow-sm ${
              editMode
                ? 'bg-orange-100 text-orange-700'
                : 'border border-slate-200 bg-white text-[#172448] hover:bg-slate-50'
            }`}
            onClick={() => setEditMode((current) => !current)}
            type="button"
          >
            <Settings2 size={16} />
            {editMode ? 'Modo edición activo' : 'Editar layout'}
          </button>

          <button
            className="flex h-10 items-center gap-2 rounded-lg bg-[#073B91] px-4 text-xs font-black text-white shadow-sm"
            onClick={handleSave}
            type="button"
          >
            <Save size={16} />
            Guardar
          </button>

          <button
            className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-[#172448] shadow-sm hover:bg-slate-50"
            onClick={handleReset}
            type="button"
          >
            <RotateCcw size={16} />
            Restaurar
          </button>
        </div>
      </div>

      {editMode ? (
        <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50/40 p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-wide text-[#073B91]">
            Mostrar / ocultar widgets
          </p>

          <div className="flex flex-wrap gap-2">
            {widgets.map((widget) => {
              const hidden = hiddenWidgetIds.includes(widget.id);

              return (
                <button
                  key={widget.id}
                  className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-black transition ${
                    hidden
                      ? 'border-slate-200 bg-white text-slate-400'
                      : 'border-blue-200 bg-white text-[#073B91]'
                  }`}
                  onClick={() => {
                    setHiddenWidgetIds((current) => toggleHiddenWidget(current, widget.id));
                  }}
                  type="button"
                >
                  {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                  {widget.title}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <ResponsiveGridLayout
        className="layout"
        layouts={safeLayouts}
        breakpoints={BREAKPOINTS}
        cols={GRID_COLS}
        rowHeight={76}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        draggableHandle=".layout-drag-handle"
        isDraggable={editMode}
        isResizable={editMode}
        resizeHandles={editMode ? ['se'] : []}
        compactType="vertical"
        preventCollision={false}
        useCSSTransforms={true}
        onDragStop={() => dispatchResizeForLeaflet()}
        onLayoutChange={(_: GridLayoutItem[], allLayouts: GridLayouts) => {
          setLayouts(ensureLayoutsForWidgets(allLayouts, widgetIds));
        }}
        onResizeStop={() => dispatchResizeForLeaflet()}
      >
        {visibleWidgets.map((widget) => (
          <div key={widget.id} className="min-h-0 overflow-hidden rounded-lg">
            <div
              className={`relative h-full min-h-full overflow-hidden rounded-lg ${
                editMode ? 'border-2 border-dashed border-blue-300 bg-white' : ''
              }`}
            >
              {editMode ? (
                <div className="layout-drag-handle absolute left-0 right-0 top-0 z-50 flex h-10 cursor-move items-center justify-between bg-slate-950/85 px-4 text-xs font-black text-white">
                  <span className="flex items-center gap-2">
                    <GripHorizontal size={15} />
                    Arrastrar
                  </span>
                  <span className="text-[10px] opacity-80">Mover / redimensionar</span>
                </div>
              ) : null}
              <div className={editMode ? 'h-full min-h-full pt-10' : 'h-full min-h-full'}>
                {widget.content}
              </div>
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
