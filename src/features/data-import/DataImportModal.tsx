import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { FileUploadDropzone } from './FileUploadDropzone';
import { clearImportedRows, saveImportedRows } from './importStorage';
import type { ImportedDashboardRow, ImportMode, ImportPreviewResult, ImportResult, RawImportedRow } from './importTypes';
import { ImportPreviewTable, type ImportPreviewFilter } from './ImportPreviewTable';
import { ImportSummaryCards } from './ImportSummaryCards';
import { normalizeRmRows } from './normalizeRmRows';
import { normalizeRegionRows } from './normalizeRegionRows';
import { detectImportedColumns, summarizeImportRows } from './normalizeImportedRows';
import { detectRowDatasetScope, detectRowsImportSchema } from './detectDatasetScope';
import { parseCsv } from './parseCsv';
import { parseExcel } from './parseExcel';
import { applyEditableImportedChanges, type EditableImportedChanges } from './validateImportedRows';
import { importClaimsToBackend } from '../../services/importApi';

type DataImportModalProps = {
  onClose: () => void;
  onImported: (result?: ImportResult) => void;
};

const modeOptions: Array<{ label: string; value: ImportMode }> = [
  { label: 'Región Metropolitana', value: 'rm' },
  { label: 'Regiones', value: 'regiones' },
  { label: 'Automático / Mixto', value: 'auto' },
];

async function parseFile(file: File): Promise<RawImportedRow[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'csv') return parseCsv(file);
  if (extension === 'xls' || extension === 'xlsx' || extension === 'xlsm') return parseExcel(file);
  throw new Error('Formato no soportado. Usa CSV, XLS, XLSX o XLSM.');
}

function normalizeByMode(rows: RawImportedRow[], fileName: string, mode: ImportMode): ImportedDashboardRow[] {
  const detectedSchema = detectRowsImportSchema(rows);

  if (detectedSchema === 'rm') return normalizeRmRows(rows, fileName, mode);
  if (detectedSchema === 'regiones') return normalizeRegionRows(rows, fileName, mode);
  if (mode === 'rm') return normalizeRmRows(rows, fileName, mode);
  if (mode === 'regiones') return normalizeRegionRows(rows, fileName, mode);

  const rmRows: RawImportedRow[] = [];
  const regionRows: RawImportedRow[] = [];

  rows.forEach((row) => {
    const scope = detectRowDatasetScope(row, mode);
    if (scope === 'rm') rmRows.push(row);
    else regionRows.push(row);
  });

  return [...normalizeRmRows(rmRows, fileName, mode), ...normalizeRegionRows(regionRows, fileName, mode)];
}

function downloadErrors(rows: ImportedDashboardRow[]) {
  const errorRows = rows.filter((row) => row.validationStatus === 'error');
  const csv = [
    ['ticket', 'scope', 'mensaje'],
    ...errorRows.map((row) => [row.ticket, row.scope, row.validationMessage ?? '']),
  ]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'errores-importacion.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function DataImportModal({ onClose, onImported }: DataImportModalProps) {
  const [mode, setMode] = useState<ImportMode>('rm');
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [originalRows, setOriginalRows] = useState<ImportedDashboardRow[]>([]);
  const [previewFilter, setPreviewFilter] = useState<ImportPreviewFilter>('all');
  const [isReading, setIsReading] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const previewRows = preview?.rows ?? [];
  const summary = useMemo(() => summarizeImportRows(previewRows), [previewRows]);
  const rowsToSave = useMemo(() => previewRows.filter((row) => row.validationStatus === 'valid' || row.validationStatus === 'warning'), [previewRows]);
  const errorRows = useMemo(() => previewRows.filter((row) => row.validationStatus === 'error'), [previewRows]);
  const canConfirm = rowsToSave.length > 0 && !isReading && !isPersisting;

  const handleFile = async (file: File) => {
    setIsReading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const rawRows = await parseFile(file);
      const rows = normalizeByMode(rawRows, file.name, mode);
      const detectedColumns = detectImportedColumns(rawRows);
      const detectedSchema = detectRowsImportSchema(rawRows);
      console.info('[import] preview', {
        totalRows: rows.length,
        rmRows: rows.filter((row) => row.scope === 'rm').length,
        regionesRows: rows.filter((row) => row.scope === 'regiones').length,
        detectedSchema,
        skippedInvalidRows: rows.filter((row) => row.validationStatus === 'error').length,
      });
      setOriginalRows(rows.map((row) => ({ ...row })));
      setPreview({ rows, summary: summarizeImportRows(rows), fileName: file.name, detectedColumns });
      setPreviewFilter(rows.some((row) => row.validationStatus === 'error') ? 'error' : 'all');
    } catch (error) {
      setPreview(null);
      setOriginalRows([]);
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo leer el archivo.');
    } finally {
      setIsReading(false);
    }
  };

  const confirmImport = async () => {
    if (!preview || !canConfirm) return;

    setIsPersisting(true);
    setErrorMessage('');
    setSuccessMessage('');

    // Save to localStorage FIRST — separate by detected datasetScope, not UI mode
    const rmRows = rowsToSave.filter((r) => (r.datasetScope || r.scope) === 'rm');
    const regionesRows = rowsToSave.filter((r) => (r.datasetScope || r.scope) === 'regiones');
    if (rmRows.length > 0) saveImportedRows('rm', rmRows);
    if (regionesRows.length > 0) saveImportedRows('regiones', regionesRows);

    let message = '';
    try {
      const result = await importClaimsToBackend(rowsToSave, preview.detectedColumns);
      message = result.message || `Importación completada: ${result.insertados} insertados, ${result.actualizados ?? 0} actualizados.`;
    } catch (err: unknown) {
      message = `Importación guardada localmente. No se pudo persistir en servidor: ${err instanceof Error ? err.message : 'Error de conexión'}`;
      console.warn('[import] Backend persist skipped, data saved in localStorage');
    }

    setSuccessMessage(message);
    onImported();
    onClose();
    setIsPersisting(false);
  };

  const clearScope = (scope?: 'rm' | 'regiones') => {
    clearImportedRows(scope);
    onImported();
    if (!scope) setPreview(null);
  };

  const updatePreviewRow = (rowId: string, changes: EditableImportedChanges) => {
    setPreview((current) => {
      if (!current) return current;

      const rows = current.rows.map((row) => (row.importRowId === rowId ? applyEditableImportedChanges(row, changes, mode) : row));
      return { ...current, rows, summary: summarizeImportRows(rows) };
    });
  };

  const deletePreviewRow = (rowId: string) => {
    setPreview((current) => {
      if (!current) return current;

      const rows = current.rows.filter((row) => row.importRowId !== rowId);
      return { ...current, rows, summary: summarizeImportRows(rows) };
    });
  };

  const restoreOriginalRows = () => {
    if (!preview) return;
    const rows = originalRows.map((row) => ({ ...row }));
    setPreview({ ...preview, rows, summary: summarizeImportRows(rows) });
    setPreviewFilter(rows.some((row) => row.validationStatus === 'error') ? 'error' : 'all');
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="cc-import-dialog cc-import-modal cc-polish-shadow flex max-h-[92vh] flex-col w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0" showCloseButton>
        <DialogHeader className="cc-import-header px-5 py-4 pr-16">
          <DialogTitle className="cc-import-title text-lg font-black">Importar datos</DialogTitle>
          <DialogDescription className="cc-import-subtitle mt-1 text-xs font-semibold">Carga separada para RM, Regiones o archivo mixto.</DialogDescription>
        </DialogHeader>

        <div className="cc-import-body grid gap-4 overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <span className="cc-import-label text-xs font-black uppercase">Tipo de carga</span>
                <div className="cc-import-modes grid overflow-hidden rounded-lg">
                  {modeOptions.map((option) => (
                    <Button
                      key={option.value}
                      aria-pressed={mode === option.value}
                      className="cc-import-mode h-auto justify-start rounded-none px-3 py-3 text-left text-xs font-black transition"
                      data-active={mode === option.value ? 'true' : 'false'}
                      onClick={() => {
                        setMode(option.value);
                        setPreview(null);
                        setOriginalRows([]);
                        setPreviewFilter('all');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      type="button"
                      variant={mode === option.value ? 'default' : 'ghost'}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <FileUploadDropzone fileName={preview?.fileName} onFileSelect={handleFile} />
              {isReading ? (
                <div className="grid gap-2 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] p-3">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ) : null}
              {isPersisting ? <Alert className="cc-import-alert"><AlertDescription>Guardando en backend...</AlertDescription></Alert> : null}
              {successMessage ? <Alert className="cc-import-alert"><AlertDescription>{successMessage}</AlertDescription></Alert> : null}
              {errorMessage ? <Alert className="cc-import-alert" variant="destructive"><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}
            </div>

            <div className="grid gap-3">
              {preview ? <ImportSummaryCards summary={summary} /> : null}
              <ImportPreviewTable
                filter={previewFilter}
                onDeleteRow={deletePreviewRow}
                onFilterChange={setPreviewFilter}
                onUpdateRow={updatePreviewRow}
                rows={previewRows}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="cc-import-footer flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button className="cc-danger-button" onClick={() => clearScope('rm')} type="button" variant="destructive">Limpiar datos RM</Button>
            <Button className="cc-danger-button" onClick={() => clearScope('regiones')} type="button" variant="destructive">Limpiar datos Regiones</Button>
            <Button className="cc-danger-button cc-danger-button-strong" onClick={() => clearScope()} type="button" variant="destructive">Limpiar todo</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {preview ? (
              <Button className="cc-button-secondary" onClick={restoreOriginalRows} type="button" variant="outline">
                Restaurar datos originales
              </Button>
            ) : null}
            {errorRows.length > 0 ? (
              <Button className="cc-warning-button flex items-center gap-2" onClick={() => downloadErrors(errorRows)} type="button" variant="outline">
                <Download size={15} />
                Descargar errores CSV
              </Button>
            ) : null}
            <Button className="cc-button-secondary" disabled={isPersisting} onClick={onClose} type="button" variant="outline">Cancelar</Button>
            <Button className="cc-button-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={!canConfirm} onClick={confirmImport} type="button">
              {isPersisting ? 'Guardando...' : errorRows.length > 0 ? `Confirmar ${rowsToSave.length} filas válidas` : 'Confirmar carga'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

