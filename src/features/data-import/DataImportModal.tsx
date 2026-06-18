import { Download, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { classifyTerritory } from './classifyTerritory';
import { FileUploadDropzone } from './FileUploadDropzone';
import { clearImportedRows, saveAutoImportedRows, saveImportedRows } from './importStorage';
import type { ImportedDashboardRow, ImportMode, ImportPreviewResult, RawImportedRow } from './importTypes';
import { ImportPreviewTable, type ImportPreviewFilter } from './ImportPreviewTable';
import { ImportSummaryCards } from './ImportSummaryCards';
import { normalizeRmRows } from './normalizeRmRows';
import { isConsolidadoRegionesFormat, normalizeRegionRows } from './normalizeRegionRows';
import { summarizeImportRows } from './normalizeImportedRows';
import { parseCsv } from './parseCsv';
import { parseExcel } from './parseExcel';
import { applyEditableImportedChanges, type EditableImportedChanges } from './validateImportedRows';

type DataImportModalProps = {
  onClose: () => void;
  onImported: () => void;
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
  if (mode === 'rm') return normalizeRmRows(rows, fileName, mode);
  if (mode === 'regiones') return normalizeRegionRows(rows, fileName, mode);
  if (rows.some(isConsolidadoRegionesFormat)) return normalizeRegionRows(rows, fileName, mode);

  const rmRows: RawImportedRow[] = [];
  const regionRows: RawImportedRow[] = [];
  const unclassifiedRows: ImportedDashboardRow[] = [];

  rows.forEach((row, index) => {
    const scope = classifyTerritory(row);
    if (scope === 'rm') rmRows.push(row);
    if (scope === 'regiones') regionRows.push(row);
    if (!scope) {
      unclassifiedRows.push({
        importRowId: `${fileName}-${mode}-sin-clasificar-${index}`,
        ticket: '',
        scope: 'regiones',
        sourceFileName: fileName,
        importMode: mode,
        validationStatus: 'error',
        validationMessage: 'No se pudo clasificar fila como RM o Regiones',
      });
    }
  });

  return [...normalizeRmRows(rmRows, fileName, mode), ...normalizeRegionRows(regionRows, fileName, mode), ...unclassifiedRows];
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
  const [errorMessage, setErrorMessage] = useState('');

  const previewRows = preview?.rows ?? [];
  const summary = useMemo(() => summarizeImportRows(previewRows), [previewRows]);
  const rowsToSave = useMemo(() => previewRows.filter((row) => row.validationStatus === 'valid' || row.validationStatus === 'warning'), [previewRows]);
  const errorRows = useMemo(() => previewRows.filter((row) => row.validationStatus === 'error'), [previewRows]);
  const canConfirm = rowsToSave.length > 0 && !isReading;

  const handleFile = async (file: File) => {
    setIsReading(true);
    setErrorMessage('');

    try {
      const rawRows = await parseFile(file);
      const rows = normalizeByMode(rawRows, file.name, mode);
      setOriginalRows(rows.map((row) => ({ ...row })));
      setPreview({ rows, summary: summarizeImportRows(rows), fileName: file.name });
      setPreviewFilter(rows.some((row) => row.validationStatus === 'error') ? 'error' : 'all');
    } catch (error) {
      setPreview(null);
      setOriginalRows([]);
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo leer el archivo.');
    } finally {
      setIsReading(false);
    }
  };

  const confirmImport = () => {
    if (!preview || !canConfirm) return;

    if (mode === 'auto') saveAutoImportedRows(rowsToSave);
    if (mode === 'rm') saveImportedRows('rm', rowsToSave);
    if (mode === 'regiones') saveImportedRows('regiones', rowsToSave);

    onImported();
    onClose();
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="import-title" className="text-lg font-black text-[#071b4d]">Importar datos</h2>
            <p className="mt-1 text-xs font-semibold text-[#6b7d98]">Carga separada para RM, Regiones o archivo mixto.</p>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100" onClick={onClose} type="button" aria-label="Cerrar importación">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto p-5">
          <div className="grid gap-3 md:grid-cols-[280px_minmax(0,1fr)]">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <span className="text-xs font-black uppercase text-[#466083]">Tipo de carga</span>
                <div className="grid overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {modeOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`px-3 py-3 text-left text-xs font-black transition ${mode === option.value ? 'bg-[#073B91] text-white' : 'text-[#172448] hover:bg-slate-50'}`}
                      onClick={() => {
                        setMode(option.value);
                        setPreview(null);
                        setOriginalRows([]);
                        setPreviewFilter('all');
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <FileUploadDropzone fileName={preview?.fileName} onFileSelect={handleFile} />
              {isReading ? <p className="text-xs font-bold text-[#466083]">Leyendo archivo...</p> : null}
              {errorMessage ? <p className="rounded-lg bg-red-50 p-3 text-xs font-bold text-red-600">{errorMessage}</p> : null}
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

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#172448] hover:bg-slate-50" onClick={() => clearScope('rm')} type="button">Limpiar datos RM</button>
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#172448] hover:bg-slate-50" onClick={() => clearScope('regiones')} type="button">Limpiar datos Regiones</button>
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50" onClick={() => clearScope()} type="button">Limpiar todo</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {preview ? (
              <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#172448] hover:bg-slate-50" onClick={restoreOriginalRows} type="button">
                Restaurar datos originales
              </button>
            ) : null}
            {errorRows.length > 0 ? (
              <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#172448] hover:bg-slate-50" onClick={() => downloadErrors(errorRows)} type="button">
                <Download size={15} />
                Descargar errores CSV
              </button>
            ) : null}
            <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black text-[#172448] hover:bg-slate-50" onClick={onClose} type="button">Cancelar</button>
            <button className="rounded-lg bg-[#073B91] px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canConfirm} onClick={confirmImport} type="button">
              {errorRows.length > 0 ? `Confirmar ${rowsToSave.length} filas válidas` : 'Confirmar carga'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
