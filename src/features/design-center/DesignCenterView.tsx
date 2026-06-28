import type { ReactNode } from 'react';
import { CardSettings } from './CardSettings';
import { LayoutSettings } from './LayoutSettings';
import {
  backgroundColorOptions,
  cardColorOptions,
  primaryColorOptions,
  radiusOptions,
  spacingOptions,
  textColorOptions,
} from './safeOptions';
import type { useDesignConfig } from './useDesignConfig';

type DesignCenterViewProps = {
  designConfig: ReturnType<typeof useDesignConfig>;
};

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-black uppercase text-[#466083]">{children}</span>;
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <FieldLabel>{label}</FieldLabel>
      <input
        className="h-12 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-[#071b4d] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        maxLength={90}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid gap-2">
      <FieldLabel>{label}</FieldLabel>
      <select
        className="h-12 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-[#071b4d] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DesignCenterView({ designConfig }: DesignCenterViewProps) {
  const { draftConfig, isPreviewActive, updateDraft, saveDraft, previewDraft, stopPreview, resetConfig } = designConfig;

  return (
    <section className="cc-card overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="cc-label-pro">Centro de diseno</p>
        <h2 className="cc-page-title-pro mt-1">Configuracion visual segura</h2>
        {isPreviewActive ? <p className="mt-1 text-xs font-black text-blue-700">Vista previa activa.</p> : null}
      </div>

      <div className="grid gap-5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Titulo dashboard"
            onChange={(value) => updateDraft((current) => ({ ...current, texts: { ...current.texts, dashboardTitle: value } }))}
            value={draftConfig.texts.dashboardTitle}
          />
          <TextInput
            label="Subtitulo dashboard"
            onChange={(value) => updateDraft((current) => ({ ...current, texts: { ...current.texts, dashboardSubtitle: value } }))}
            value={draftConfig.texts.dashboardSubtitle}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SelectField label="Color primario" onChange={(value) => updateDraft((current) => ({ ...current, tokens: { ...current.tokens, primaryColor: value } }))} options={primaryColorOptions} value={draftConfig.tokens.primaryColor} />
          <SelectField label="Fondo" onChange={(value) => updateDraft((current) => ({ ...current, tokens: { ...current.tokens, backgroundColor: value } }))} options={backgroundColorOptions} value={draftConfig.tokens.backgroundColor} />
          <SelectField label="Tarjetas" onChange={(value) => updateDraft((current) => ({ ...current, tokens: { ...current.tokens, cardColor: value } }))} options={cardColorOptions} value={draftConfig.tokens.cardColor} />
          <SelectField label="Texto" onChange={(value) => updateDraft((current) => ({ ...current, tokens: { ...current.tokens, textColor: value } }))} options={textColorOptions} value={draftConfig.tokens.textColor} />
          <SelectField label="Bordes" onChange={(value) => updateDraft((current) => ({ ...current, tokens: { ...current.tokens, borderRadius: value } }))} options={radiusOptions} value={draftConfig.tokens.borderRadius} />
          <SelectField label="Espaciado" onChange={(value) => updateDraft((current) => ({ ...current, tokens: { ...current.tokens, spacingMode: value } }))} options={spacingOptions} value={draftConfig.tokens.spacingMode} />
        </div>

        <LayoutSettings designConfig={designConfig} />
        <CardSettings designConfig={designConfig} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
        <button className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-[#172448] shadow-sm transition hover:bg-slate-50" onClick={resetConfig} type="button">
          Restaurar diseno por defecto
        </button>
        <div className="flex flex-wrap gap-2">
          {isPreviewActive ? (
            <button className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-[#172448] shadow-sm transition hover:bg-slate-50" onClick={stopPreview} type="button">
              Cancelar vista previa
            </button>
          ) : null}
          <button className="h-11 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-black text-[#073B91] shadow-sm transition hover:bg-blue-100" onClick={previewDraft} type="button">
            Vista previa
          </button>
          <button className="h-11 rounded-lg bg-[#073B91] px-5 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800" onClick={saveDraft} type="button">
            Guardar configuracion
          </button>
        </div>
      </div>
    </section>
  );
}