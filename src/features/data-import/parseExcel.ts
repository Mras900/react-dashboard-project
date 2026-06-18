import * as XLSX from 'xlsx';
import type { RawImportedRow } from './importTypes';

export async function parseExcel(file: File): Promise<RawImportedRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames.find((sheetName) => sheetName === 'Consolidado_Regiones') ?? workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<RawImportedRow>(sheet, { defval: '' });
  return rows.filter((row) => Object.values(row).some((value) => String(value ?? '').trim()));
}
