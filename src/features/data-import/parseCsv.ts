import Papa from 'papaparse';
import type { RawImportedRow } from './importTypes';

export function parseCsv(file: File): Promise<RawImportedRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawImportedRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      complete: (result) => resolve(result.data.filter((row) => Object.values(row).some((value) => String(value ?? '').trim()))),
      error: (error) => reject(error),
    });
  });
}
