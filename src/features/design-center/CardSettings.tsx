import { sectionOptions, widgetSizeOptions } from './safeOptions';
import type { DesignSectionId, DesignWidgetConfig } from './designTypes';
import type { useDesignConfig } from './useDesignConfig';

type CardSettingsProps = {
  designConfig: ReturnType<typeof useDesignConfig>;
};

function sortedWidgets(widgets: DesignWidgetConfig[]) {
  return [...widgets].sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order);
}

function reorderWidget(widgets: DesignWidgetConfig[], widgetId: string, direction: -1 | 1) {
  const current = widgets.find((widget) => widget.id === widgetId);
  if (!current) return widgets;
  const peers = widgets.filter((widget) => widget.section === current.section).sort((a, b) => a.order - b.order);
  const index = peers.findIndex((widget) => widget.id === widgetId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= peers.length) return widgets;
  const target = peers[targetIndex];

  return widgets.map((widget) => {
    if (widget.id === current.id) return { ...widget, order: target.order };
    if (widget.id === target.id) return { ...widget, order: current.order };
    return widget;
  });
}

function moveWidgetToSection(widgets: DesignWidgetConfig[], widgetId: string, section: DesignSectionId) {
  const maxOrder = widgets.filter((widget) => widget.section === section).reduce((max, widget) => Math.max(max, widget.order), -1);
  return widgets.map((widget) => (widget.id === widgetId ? { ...widget, section, order: maxOrder + 1 } : widget));
}

export function CardSettings({ designConfig }: CardSettingsProps) {
  const { draftConfig, updateDraft } = designConfig;
  const widgets = sortedWidgets(draftConfig.widgets);

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-xs font-black uppercase text-[#466083]">Cards y KPIs</p>
        <h3 className="text-lg font-black text-[#071b4d]">Orden, seccion y tamano</h3>
      </div>

      <div className="grid gap-3">
        {widgets.map((widget) => {
          const peers = draftConfig.widgets.filter((item) => item.section === widget.section).sort((a, b) => a.order - b.order);
          const peerIndex = peers.findIndex((item) => item.id === widget.id);

          return (
            <div key={widget.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 xl:grid-cols-[auto_minmax(180px,1fr)_150px_130px_auto] xl:items-center">
              <label className="flex items-center gap-2 text-sm font-black text-[#071b4d]">
                <input
                  checked={widget.visible}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700"
                  onChange={(event) => updateDraft((current) => ({
                    ...current,
                    widgets: current.widgets.map((item) => (item.id === widget.id ? { ...item, visible: event.target.checked } : item)),
                  }))}
                  type="checkbox"
                />
                Visible
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-[#466083]">Titulo</span>
                <input
                  aria-label={`Titulo ${widget.id}`}
                  className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-[#071b4d] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  maxLength={90}
                  onChange={(event) => updateDraft((current) => ({
                    ...current,
                    widgets: current.widgets.map((item) => (item.id === widget.id ? { ...item, title: event.target.value } : item)),
                  }))}
                  value={widget.title}
                />
                {widget.description ? <span className="text-[11px] font-semibold text-slate-500">{widget.description}</span> : null}
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-[#466083]">Seccion</span>
                <select
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-[#071b4d] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => updateDraft((current) => ({ ...current, widgets: moveWidgetToSection(current.widgets, widget.id, event.target.value as DesignSectionId) }))}
                  value={widget.section}
                >
                  {sectionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-[#466083]">Tamano</span>
                <select
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-[#071b4d] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => updateDraft((current) => ({
                    ...current,
                    widgets: current.widgets.map((item) => (item.id === widget.id ? { ...item, size: event.target.value as DesignWidgetConfig['size'] } : item)),
                  }))}
                  value={widget.size}
                >
                  {widgetSizeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <div className="flex gap-2">
                <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#172448] disabled:opacity-40" disabled={peerIndex === 0} onClick={() => updateDraft((current) => ({ ...current, widgets: reorderWidget(current.widgets, widget.id, -1) }))} type="button">
                  Arriba
                </button>
                <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#172448] disabled:opacity-40" disabled={peerIndex === peers.length - 1} onClick={() => updateDraft((current) => ({ ...current, widgets: reorderWidget(current.widgets, widget.id, 1) }))} type="button">
                  Abajo
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}