import type { RawImportedRow } from './importTypes';
import { detectRowsImportSchema } from './detectDatasetScope';

function nonEmptyRows(rows: RawImportedRow[]) {
  return rows.filter((row) => Object.values(row).some((value) => String(value ?? '').trim()));
}

export async function parseExcel(file: File): Promise<RawImportedRow[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const candidates = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = sheet ? nonEmptyRows(XLSX.utils.sheet_to_json<RawImportedRow>(sheet, { defval: '' })) : [];
    return { sheetName, rows, schema: detectRowsImportSchema(rows) };
  });

  const schemaMatch = candidates.find((candidate) => candidate.rows.length > 0 && candidate.schema !== 'unknown');
  if (schemaMatch) return schemaMatch.rows;

  const namedMatch = candidates.find((candidate) => ['Consolidado_Limpio', 'Consolidado_Regiones'].includes(candidate.sheetName) && candidate.rows.length > 0);
  if (namedMatch) return namedMatch.rows;

  return candidates.find((candidate) => candidate.rows.length > 0)?.rows ?? [];
}

