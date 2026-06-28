import type { DesignSectionConfig } from './designTypes';
import type { useDesignConfig } from './useDesignConfig';

type LayoutSettingsProps = {
  designConfig: ReturnType<typeof useDesignConfig>;
};

function sortedSections(sections: DesignSectionConfig[]) {
  return [...sections].sort((a, b) => a.order - b.order);
}

function reorderSection(sections: DesignSectionConfig[], sectionId: string, direction: -1 | 1) {
  const sorted = sortedSections(sections);
  const index = sorted.findIndex((section) => section.id === sectionId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return sections;

  const current = sorted[index];
  const target = sorted[targetIndex];
  return sections.map((section) => {
    if (section.id === current.id) return { ...section, order: target.order };
    if (section.id === target.id) return { ...section, order: current.order };
    return section;
  });
}

export function LayoutSettings({ designConfig }: LayoutSettingsProps) {
  const { draftConfig, updateDraft, resetLayout } = designConfig;
  const sections = sortedSections(draftConfig.sections);

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-[#466083]">Secciones</p>
          <h3 className="text-lg font-black text-[#071b4d]">Orden y visibilidad</h3>
        </div>
        <button className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#172448] shadow-sm hover:bg-slate-50" onClick={resetLayout} type="button">
          Reset layout
        </button>
      </div>

      <div className="grid gap-3">
        {sections.map((section, index) => (
          <div key={section.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <label className="flex items-center gap-2 text-sm font-black text-[#071b4d]">
              <input
                checked={section.visible}
                className="h-4 w-4 rounded border-slate-300 text-blue-700"
                onChange={(event) => updateDraft((current) => ({
                  ...current,
                  sections: current.sections.map((item) => (item.id === section.id ? { ...item, visible: event.target.checked } : item)),
                }))}
                type="checkbox"
              />
              Visible
            </label>
            <input
              aria-label={`Nombre seccion ${section.id}`}
              className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-[#071b4d] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              maxLength={90}
              onChange={(event) => updateDraft((current) => ({
                ...current,
                sections: current.sections.map((item) => (item.id === section.id ? { ...item, label: event.target.value } : item)),
              }))}
              value={section.label}
            />
            <div className="flex gap-2">
              <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#172448] disabled:opacity-40" disabled={index === 0} onClick={() => updateDraft((current) => ({ ...current, sections: reorderSection(current.sections, section.id, -1) }))} type="button">
                Arriba
              </button>
              <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#172448] disabled:opacity-40" disabled={index === sections.length - 1} onClick={() => updateDraft((current) => ({ ...current, sections: reorderSection(current.sections, section.id, 1) }))} type="button">
                Abajo
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}