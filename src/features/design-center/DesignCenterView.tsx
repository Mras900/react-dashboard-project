import { useState, type ReactNode } from 'react';
import { CardSettings } from './CardSettings';
import { ChartSettings } from './ChartSettings';
import { ComponentSettings } from './ComponentSettings';
import { LayoutSettings } from './LayoutSettings';
import { KpiSettings } from './KpiSettings';
import type { KpiDataSources } from './kpiCalculations';
import {
  backgroundColorOptions,
  cardColorOptions,
  primaryColorOptions,
  radiusOptions,
  spacingOptions,
  textColorOptions,
} from './safeOptions';
import type { useDesignConfig } from './useDesignConfig';
import { useAuth } from '../auth/useAuth';
import type { BackendConfigVersion } from './designConfigApi';

type DesignCenterViewProps = {
  designConfig: ReturnType<typeof useDesignConfig>;
  configurableKpiDataSources?: KpiDataSources;
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

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    backend: 'bg-green-100 text-green-800 border-green-300',
    localStorage: 'bg-amber-100 text-amber-800 border-amber-300',
    default: 'bg-slate-100 text-slate-600 border-slate-300',
  };
  const labels: Record<string, string> = {
    backend: 'Backend',
    localStorage: 'localStorage',
    default: 'Default',
  };
  const cls = colors[source] ?? colors.default;
  return <span className={`rounded border px-2 py-0.5 text-[10px] font-black uppercase ${cls}`}>{labels[source] ?? source}</span>;
}

function CollapsibleSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-black uppercase text-[#466083] hover:bg-slate-50"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span>{title}</span>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open ? <div className="border-t border-slate-200 p-4">{children}</div> : null}
    </div>
  );
}

export function DesignCenterView({ designConfig, configurableKpiDataSources }: DesignCenterViewProps) {
  const { isAdmin } = useAuth();
  const {
    draftConfig, isPreviewActive, updateDraft, saveDraft, previewDraft, stopPreview, resetConfig,
    configSource, backendMeta, backendInitialized,
    saveDraftToBackend, publishToBackend, resetOnBackend,
    fetchConfigHistory,
  } = designConfig;

  const [publishing, setPublishing] = useState(false);
  const [backendMsg, setBackendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [history, setHistory] = useState<BackendConfigVersion[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);

  async function handlePublish() {
    setPublishing(true);
    setBackendMsg(null);
    const result = await publishToBackend('Configuracion publicada');
    setPublishing(false);
    if (result.ok) {
      setBackendMsg({ ok: true, text: 'Publicado en backend.' });
    } else {
      setBackendMsg({ ok: false, text: result.error ?? 'Error al publicar.' });
    }
  }

  async function handleSaveDraft() {
    setBackendMsg(null);
    const result = await saveDraftToBackend('Borrador');
    if (result.ok) {
      setBackendMsg({ ok: true, text: 'Borrador guardado en backend.' });
    } else {
      setBackendMsg({ ok: false, text: result.error ?? 'Error al guardar.' });
    }
  }

  async function handleResetBackend() {
    setBackendMsg(null);
    const result = await resetOnBackend();
    if (result.ok) {
      setBackendMsg({ ok: true, text: 'Config activa eliminada. Usando localStorage/default.' });
    } else {
      setBackendMsg({ ok: false, text: result.error ?? 'Error al resetear.' });
    }
  }

  async function handleToggleHistory() {
    if (showHistory) {
      setShowHistory(false);
      setHistory(null);
      return;
    }
    const result = await fetchConfigHistory();
    if (result.ok) {
      setHistory(result.data);
      setShowHistory(true);
    } else {
      setBackendMsg({ ok: false, text: result.error ?? 'Error al cargar historial.' });
    }
  }

  async function handleRestore(configId: number) {
    setRestoring(configId);
    setBackendMsg(null);
    const result = await designConfig.restoreVersion(configId);
    setRestoring(null);
    if (result.ok) {
      setBackendMsg({ ok: true, text: 'Version restaurada y publicada.' });
      setShowHistory(false);
      setHistory(null);
    } else {
      setBackendMsg({ ok: false, text: result.error ?? 'Error al restaurar.' });
    }
  }

  return (
    <section className="cc-card overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="cc-label-pro">Centro de diseno</p>
            <h2 className="cc-page-title-pro mt-1">Editor del dashboard real</h2>
          </div>
          {backendInitialized ? (
            <div className="flex items-center gap-2">
              <SourceBadge source={configSource} />
              {backendMeta ? (
                <span className="text-[10px] font-bold text-slate-500">
                  v{backendMeta.version}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {isPreviewActive ? <p className="mt-1 text-xs font-black text-blue-700">Vista previa activa.</p> : null}
        {backendMeta ? (
          <p className="mt-1 text-[10px] font-semibold text-slate-400">
            Actualizado: {new Date(backendMeta.updatedAt).toLocaleString('es-CL')}
          </p>
        ) : null}
        {backendMsg ? (
          <p className={`mt-1 text-xs font-black ${backendMsg.ok ? 'text-green-700' : 'text-red-700'}`}>
            {backendMsg.text}
          </p>
        ) : null}
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

        <ComponentSettings designConfig={designConfig} />
        <LayoutSettings designConfig={designConfig} />
        <CardSettings designConfig={designConfig} />

        <CollapsibleSection title="Avanzado — Constructores de KPI y grafico">
          <KpiSettings designConfig={designConfig} />
          <div className="mt-4">
            <ChartSettings designConfig={designConfig} dataSources={configurableKpiDataSources ?? {}} />
          </div>
        </CollapsibleSection>
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

      {isAdmin ? (
        <div className="border-t border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-black uppercase text-[#466083]">Admin - Backend</span>
            <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#172448] shadow-sm hover:bg-slate-50 disabled:opacity-40" disabled={publishing} onClick={handleSaveDraft} type="button">
              Guardar borrador
            </button>
            <button className="h-9 rounded-lg bg-[#073B91] px-3 text-xs font-black text-white shadow-sm hover:bg-blue-800 disabled:opacity-40" disabled={publishing} onClick={handlePublish} type="button">
              {publishing ? 'Publicando...' : 'Publicar'}
            </button>
            <button className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 shadow-sm hover:bg-red-100" onClick={handleResetBackend} type="button">
              Reset backend
            </button>
            <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-[#172448] shadow-sm hover:bg-slate-50" onClick={handleToggleHistory} type="button">
              {showHistory ? 'Ocultar historial' : 'Historial'}
            </button>
          </div>

          {showHistory && history ? (
            <div className="mt-3 grid gap-2">
              {history.length === 0 ? (
                <p className="text-xs font-semibold text-slate-400">Sin versiones guardadas.</p>
              ) : (
                history.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2">
                    <div className="text-xs">
                      <span className="font-black text-[#071b4d]">v{v.version}</span>
                      <span className="ml-2 font-semibold text-slate-500">{v.name}</span>
                      {v.isActive ? <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-black text-green-700">ACTIVA</span> : null}
                      <span className="ml-2 text-slate-400">
                        {v.createdBy} - {new Date(v.createdAt).toLocaleDateString('es-CL')}
                      </span>
                    </div>
                    <button
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-black text-[#172448] disabled:opacity-40"
                      disabled={restoring === v.id}
                      onClick={() => handleRestore(v.id)}
                      type="button"
                    >
                      {restoring === v.id ? '...' : 'Restaurar'}
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
