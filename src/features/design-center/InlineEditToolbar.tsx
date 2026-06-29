import { useState } from 'react';

type InlineEditToolbarProps = {
  onSaveDraft: () => Promise<{ ok: boolean; error?: string }>;
  onPublish: () => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
  onReset: () => void;
  hasUnsavedChanges?: boolean;
};

export function InlineEditToolbar({
  onSaveDraft,
  onPublish,
  onCancel,
  onReset,
  hasUnsavedChanges,
}: InlineEditToolbarProps) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const result = await onSaveDraft();
    setSaving(false);
    setMsg(result.ok ? { ok: true, text: 'Borrador guardado.' } : { ok: false, text: result.error ?? 'Error.' });
  }

  async function handlePublish() {
    setSaving(true);
    setMsg(null);
    const result = await onPublish();
    setSaving(false);
    if (result.ok) {
      setMsg({ ok: true, text: 'Publicado en backend.' });
    } else {
      setMsg({ ok: false, text: result.error ?? 'Error.' });
    }
  }

  return (
    <div className="sticky top-0 z-40 border-b-2 border-blue-500 bg-blue-50 px-4 py-2 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
            Modo edicion
          </span>
          {hasUnsavedChanges ? (
            <span className="text-xs font-bold text-amber-700">Cambios sin guardar</span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {msg ? (
            <span className={`text-xs font-black ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>
              {msg.text}
            </span>
          ) : null}

          <button
            className="h-9 rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 shadow-sm hover:bg-blue-100 disabled:opacity-40"
            disabled={saving}
            onClick={handleSave}
            type="button"
          >
            {saving ? '...' : 'Guardar borrador'}
          </button>

          <button
            className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
            disabled={saving}
            onClick={handlePublish}
            type="button"
          >
            {saving ? '...' : 'Publicar'}
          </button>

          <button
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>

          <button
            className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 hover:bg-red-100"
            onClick={onReset}
            type="button"
          >
            Restaurar default
          </button>
        </div>
      </div>
    </div>
  );
}
