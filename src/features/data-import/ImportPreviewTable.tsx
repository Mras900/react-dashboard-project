import { Check, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ImportedDashboardRow, ImportValidationStatus } from './importTypes';
import type { EditableImportedChanges, EditableImportedField } from './validateImportedRows';

export type ImportPreviewFilter = 'all' | ImportValidationStatus;

type ImportPreviewTableProps = {
  rows: ImportedDashboardRow[];
  filter: ImportPreviewFilter;
  onDeleteRow: (rowId: string) => void;
  onFilterChange: (filter: ImportPreviewFilter) => void;
  onUpdateRow: (rowId: string, changes: EditableImportedChanges) => void;
};

const editableFields: Array<{ key: EditableImportedField; label: string; numeric?: boolean; options?: string[] }> = [
  { key: 'ticket', label: 'Ticket' },
  { key: 'fechaVisita', label: 'Fecha visita' },
  { key: 'regionOriginal', label: 'Región original' },
  { key: 'regionNormalizada', label: 'Región normalizada' },
  { key: 'ciudad', label: 'Ciudad' },
  { key: 'comuna', label: 'Comuna' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'prioridad', label: 'Prioridad', options: ['alta', 'media', 'baja', 'sin_prioridad'] },
  { key: 'estadoVisita', label: 'Estado visita' },
  { key: 'facturacionTotal', label: 'Facturación', numeric: true },
  { key: 'km', label: 'KM', numeric: true },
  { key: 'traslado', label: 'Traslado', numeric: true },
  { key: 'observacion', label: 'Observación' },
];

const filterOptions: Array<{ label: string; value: ImportPreviewFilter }> = [
  { label: 'Todos', value: 'all' },
  { label: 'Válidos', value: 'valid' },
  { label: 'Warnings', value: 'warning' },
  { label: 'Errores', value: 'error' },
];

function getEditableValue(row: ImportedDashboardRow, field: EditableImportedField) {
  const value = row[field];
  return value === undefined || value === null ? '' : String(value);
}

function getRowClass(status?: ImportValidationStatus) {
  if (status === 'error') return 'bg-red-50/70 ring-1 ring-inset ring-red-200';
  if (status === 'warning') return 'bg-amber-50/70 ring-1 ring-inset ring-amber-200';
  return '';
}

function getStatusLabel(status?: ImportValidationStatus) {
  if (status === 'error') return 'Error';
  if (status === 'warning') return 'Warning';
  return 'Válida';
}

export function ImportPreviewTable({ rows, filter, onDeleteRow, onFilterChange, onUpdateRow }: ImportPreviewTableProps) {
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableImportedChanges>({});

  useEffect(() => {
    if (rows.some((row) => row.validationStatus === 'error')) onFilterChange('error');
    else onFilterChange('all');
  }, [onFilterChange, rows]);

  const visibleRows = useMemo(
    () => (filter === 'all' ? rows : rows.filter((row) => row.validationStatus === filter)),
    [filter, rows],
  );
  const counts = useMemo(
    () => ({
      all: rows.length,
      valid: rows.filter((row) => row.validationStatus === 'valid').length,
      warning: rows.filter((row) => row.validationStatus === 'warning').length,
      error: rows.filter((row) => row.validationStatus === 'error').length,
    }),
    [rows],
  );

  const startEdit = (row: ImportedDashboardRow) => {
    setEditingRowId(row.importRowId);
    setDraft(Object.fromEntries(editableFields.map((field) => [field.key, getEditableValue(row, field.key)])) as EditableImportedChanges);
  };

  const cancelEdit = () => {
    setEditingRowId(null);
    setDraft({});
  };

  const saveEdit = () => {
    if (!editingRowId) return;
    onUpdateRow(editingRowId, draft);
    cancelEdit();
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                filter === option.value ? 'border-[#073B91] bg-[#073B91] text-white' : 'border-slate-200 bg-white text-[#172448] hover:bg-slate-50'
              }`}
              onClick={() => onFilterChange(option.value)}
              type="button"
            >
              {option.label} ({counts[option.value]})
            </button>
          ))}
        </div>
        <p className="text-xs font-bold text-[#6b7d98]">{visibleRows.length} filas visibles</p>
      </div>

      {counts.error > 0 ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          Puedes editar las filas con error o eliminarlas antes de confirmar la carga.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[1320px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase text-[#466083]">
            <tr>
              {editableFields.map((field) => (
                <th key={field.key} className="px-3 py-2 font-black">{field.label}</th>
              ))}
              <th className="px-3 py-2 font-black">Scope</th>
              <th className="px-3 py-2 font-black">Estado</th>
              <th className="px-3 py-2 font-black">Mensaje</th>
              <th className="px-3 py-2 font-black">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.length > 0 ? (
              visibleRows.map((row) => {
                const isEditing = editingRowId === row.importRowId;

                return (
                  <tr key={row.importRowId} className={getRowClass(row.validationStatus)} onDoubleClick={() => startEdit(row)}>
                    {editableFields.map((field) => (
                      <td key={field.key} className="px-3 py-2 align-top">
                        {isEditing ? (
                          field.options ? (
                            <select
                              className="h-9 w-full min-w-[120px] rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-[#172448] outline-none focus:border-blue-400"
                              onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                              value={draft[field.key] ?? ''}
                            >
                              {field.options.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className={`h-9 w-full min-w-[120px] rounded-md border bg-white px-2 text-xs font-bold text-[#172448] outline-none focus:border-blue-400 ${
                                row.validationStatus === 'error' && !getEditableValue(row, field.key) ? 'border-red-300' : 'border-slate-200'
                              }`}
                              inputMode={field.numeric ? 'decimal' : 'text'}
                              onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                              value={draft[field.key] ?? ''}
                            />
                          )
                        ) : (
                          <span className={field.numeric ? 'font-black text-[#172448]' : 'font-semibold text-[#172448]'}>
                            {getEditableValue(row, field.key) || '-'}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 align-top font-black">{row.scope}</td>
                    <td className="px-3 py-2 align-top font-black">{getStatusLabel(row.validationStatus)}</td>
                    <td className="max-w-[260px] px-3 py-2 align-top font-semibold text-[#6b7d98]">{row.validationMessage || '-'}</td>
                    <td className="px-3 py-2 align-top">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button className="flex h-8 w-8 items-center justify-center rounded-md bg-[#073B91] text-white" onClick={saveEdit} type="button" aria-label="Guardar cambios">
                            <Check size={15} />
                          </button>
                          <button className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-[#172448]" onClick={cancelEdit} type="button" aria-label="Cancelar edición">
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-[#172448] hover:bg-slate-50" onClick={() => startEdit(row)} type="button" aria-label="Editar fila">
                            <Pencil size={15} />
                          </button>
                          <button className="flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50" onClick={() => onDeleteRow(row.importRowId)} type="button" aria-label="Eliminar fila">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-3 py-8 text-center font-bold text-slate-500" colSpan={17}>Sin filas para el filtro seleccionado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingRowId ? (
        <button className="inline-flex w-fit items-center gap-2 text-xs font-black text-[#073B91]" onClick={cancelEdit} type="button">
          <RotateCcw size={14} />
          Cancelar edición actual
        </button>
      ) : null}
    </div>
  );
}
