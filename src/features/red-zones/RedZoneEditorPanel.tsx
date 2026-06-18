import { Loader2, MapPin, Save, Trash2, X } from 'lucide-react';
import type { RedZoneDraft, RedZoneDisplayMode, RedZoneSeverity } from './redZoneTypes';

const inputClass =
  'h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export function RedZoneEditorPanel({
  draft,
  saving,
  error,
  onChange,
  onPickCenter,
  onSave,
  onDelete,
  onCancel,
}: {
  draft: RedZoneDraft;
  saving: boolean;
  error: string;
  onChange: (draft: RedZoneDraft) => void;
  onPickCenter: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute bottom-4 right-4 z-[500] w-[min(360px,calc(100%-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#071b4d]">{draft.id ? 'Editar zona roja' : 'Nueva zona roja'}</h3>
          <p className="mt-1 text-xs text-slate-500">Configura el centro, radio y visualización.</p>
        </div>
        <button aria-label="Cancelar edición" className="text-slate-500 hover:text-slate-900" onClick={onCancel} type="button">
          <X size={18} />
        </button>
      </div>
      <div className="mt-3 grid max-h-[52vh] gap-3 overflow-y-auto pr-1">
        <input className={inputClass} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="Nombre zona" value={draft.name} />
        <div className="grid grid-cols-2 gap-2">
          <input className={inputClass} onChange={(event) => onChange({ ...draft, comuna: event.target.value })} placeholder="Comuna" value={draft.comuna ?? ''} />
          <input className={inputClass} onChange={(event) => onChange({ ...draft, region: event.target.value })} placeholder="Región" value={draft.region ?? ''} />
        </div>
        <button className="flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700 hover:bg-blue-100" onClick={onPickCenter} type="button">
          <MapPin size={15} />
          Seleccionar o mover centro
        </button>
        <div className="grid grid-cols-2 gap-2">
          <input className={inputClass} onChange={(event) => onChange({ ...draft, lat: Number(event.target.value) })} step="any" type="number" value={draft.lat ?? ''} />
          <input className={inputClass} onChange={(event) => onChange({ ...draft, lon: Number(event.target.value) })} step="any" type="number" value={draft.lon ?? ''} />
        </div>
        <label className="grid gap-1 text-xs font-bold text-slate-700">
          Radio: {Math.round(draft.radius_m)} m
          <input min={50} max={5000} onChange={(event) => onChange({ ...draft, radius_m: Number(event.target.value) })} step={50} type="range" value={draft.radius_m} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <select className={inputClass} onChange={(event) => onChange({ ...draft, severity: event.target.value as RedZoneSeverity })} value={draft.severity}>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
          <select className={inputClass} onChange={(event) => onChange({ ...draft, display_mode: event.target.value as RedZoneDisplayMode })} value={draft.display_mode}>
            <option value="circle">Círculo</option>
            <option value="heatpoint">Punto de calor</option>
            {draft.polygon_geojson ? <option value="polygon">Polígono</option> : null}
          </select>
        </div>
        <textarea className="min-h-16 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" onChange={(event) => onChange({ ...draft, notes: event.target.value })} placeholder="Notas" value={draft.notes ?? ''} />
        {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}
        <div className="flex gap-2">
          <button className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0f5fcf] text-xs font-bold text-white disabled:opacity-60" disabled={saving} onClick={onSave} type="button">
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            Guardar
          </button>
          {onDelete ? (
            <button className="flex h-9 items-center justify-center gap-2 rounded-lg bg-red-50 px-3 text-xs font-bold text-red-700" disabled={saving} onClick={onDelete} type="button">
              <Trash2 size={15} />
              Eliminar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
