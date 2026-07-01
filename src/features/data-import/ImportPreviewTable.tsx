import { Check, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  if (status === 'error') return 'cc-import-row-error';
  if (status === 'warning') return 'cc-import-row-warning';
  return 'cc-import-row-valid';
}

function getStatusLabel(status?: ImportValidationStatus) {
  if (status === 'error') return 'Error';
  if (status === 'warning') return 'Warning';
  return 'Válida';
}

function getStatusBadgeClass(status?: ImportValidationStatus) {
  if (status === 'error') return 'border-red-200 bg-red-50 text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200';
  if (status === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100';
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
    <div className="cc-import-preview grid gap-3">
      <div className="cc-import-toolbar flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              aria-pressed={filter === option.value}
              className="cc-import-filter h-auto px-3 py-2 text-xs font-black transition"
              onClick={() => onFilterChange(option.value)}
              type="button"
              variant={filter === option.value ? 'default' : 'outline'}
            >
              {option.label} ({counts[option.value]})
            </Button>
          ))}
        </div>
        <p className="cc-import-visible-count text-xs font-bold">{visibleRows.length} filas visibles</p>
      </div>

      {counts.error > 0 ? (
        <p className="cc-import-notice cc-import-notice-error">
          Puedes editar las filas con error o eliminarlas antes de confirmar la carga.
        </p>
      ) : null}

      <div className="cc-import-table rounded-lg">
        <Table className="min-w-[1320px] text-left text-xs">
          <TableHeader className="cc-import-table-head sticky top-0 z-10 text-[11px] uppercase">
            <TableRow>
              {editableFields.map((field) => (
                <TableHead key={field.key} className="px-3 py-2 font-black">{field.label}</TableHead>
              ))}
              <TableHead className="px-3 py-2 font-black">Scope</TableHead>
              <TableHead className="px-3 py-2 font-black">Estado</TableHead>
              <TableHead className="px-3 py-2 font-black">Mensaje</TableHead>
              <TableHead className="px-3 py-2 font-black">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="cc-import-table-body">
            {visibleRows.length > 0 ? (
              visibleRows.map((row) => {
                const isEditing = editingRowId === row.importRowId;

                return (
                  <TableRow key={row.importRowId} className={`cc-import-row ${getRowClass(row.validationStatus)}`} onDoubleClick={() => startEdit(row)}>
                    {editableFields.map((field) => (
                      <TableCell key={field.key} className="px-3 py-2 align-top">
                        {isEditing ? (
                          field.options ? (
                            <select
                              className="cc-input cc-import-input h-9 w-full min-w-[120px] rounded-md border px-2 text-xs font-bold"
                              onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                              value={draft[field.key] ?? ''}
                            >
                              {field.options.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              className={`cc-input cc-import-input h-9 w-full min-w-[120px] rounded-md border px-2 text-xs font-bold ${
                                row.validationStatus === 'error' && !getEditableValue(row, field.key) ? 'border-red-500/60' : ''
                              }`}
                              inputMode={field.numeric ? 'decimal' : 'text'}
                              onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                              value={draft[field.key] ?? ''}
                            />
                          )
                        ) : (
                          <span className={field.numeric ? 'font-black' : 'font-semibold'}>
                            {getEditableValue(row, field.key) || '-'}
                          </span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="px-3 py-2 align-top font-black"><Badge variant="outline">{row.scope}</Badge></TableCell>
                    <TableCell className="cc-import-status px-3 py-2 align-top font-black" data-status={row.validationStatus ?? 'valid'}>
                      <Badge variant="outline" className={getStatusBadgeClass(row.validationStatus)}>{getStatusLabel(row.validationStatus)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[260px] px-3 py-2 align-top font-semibold cc-text-secondary">{row.validationMessage || '-'}</TableCell>
                    <TableCell className="px-3 py-2 align-top">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button className="cc-button-primary flex h-8 w-8 items-center justify-center rounded-md p-0" onClick={saveEdit} type="button" aria-label="Guardar cambios">
                            <Check size={15} />
                          </Button>
                          <Button className="cc-button-secondary flex h-8 w-8 items-center justify-center rounded-md p-0" onClick={cancelEdit} type="button" aria-label="Cancelar edición" variant="outline">
                            <X size={15} />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button className="cc-button-secondary flex h-8 w-8 items-center justify-center rounded-md p-0" onClick={() => startEdit(row)} type="button" aria-label="Editar fila" variant="outline">
                            <Pencil size={15} />
                          </Button>
                          <Button className="cc-danger-button flex h-8 w-8 items-center justify-center rounded-md p-0" onClick={() => onDeleteRow(row.importRowId)} type="button" aria-label="Eliminar fila" variant="destructive">
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell className="cc-import-empty px-3 py-8 text-center font-bold" colSpan={17}>Sin filas para el filtro seleccionado.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editingRowId ? (
        <Button className="cc-import-cancel-edit inline-flex w-fit items-center gap-2 text-xs font-black" onClick={cancelEdit} type="button" variant="ghost">
          <RotateCcw size={14} />
          Cancelar edición actual
        </Button>
      ) : null}
    </div>
  );
}
