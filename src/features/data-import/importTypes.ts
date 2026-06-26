export type ImportMode = 'rm' | 'regiones' | 'auto';
export type TerritoryScope = 'rm' | 'regiones';

export type ImportedPriority = 'alta' | 'media' | 'baja' | 'sin_prioridad';
export type ImportedVisitStatus = 'completada' | 'pendiente' | 'no_realizada' | 'sin_estado';
export type ImportValidationStatus = 'valid' | 'warning' | 'error';

export type RawImportedRow = Record<string, string | number | boolean | null | undefined>;

export interface ImportedDashboardRow {
  importRowId: string;
  ticket: string;
  mes?: string;
  fechaVisita?: string;
  fechaRecepcionTicket?: string;
  fechaEnvioValija?: string;
  fechaEnvioMuestras?: string;
  prioridad?: ImportedPriority;
  estadoVisita?: string;
  estadoVisitaNormalizado?: ImportedVisitStatus;
  regionOriginal?: string;
  regionNormalizada?: string;
  comuna?: string;
  ciudad?: string;
  calle?: string;
  numeroDireccion?: string;
  cliente?: string;
  facturacionTotal?: number;
  factura?: string;
  facturaInformada?: boolean;
  tarifaRuta?: number;
  tarifaCalculada?: number;
  km?: number;
  precioNeto?: number;
  traslado?: number;
  precioNetoTraslado?: number;
  valorEnvioBulto?: number;
  retiroMuestra?: boolean;
  trackingStarken?: string;
  observacion?: string;
  scope: TerritoryScope;
  datasetScope?: TerritoryScope;
  sourceFileName?: string;
  importMode?: ImportMode;
  validationStatus?: ImportValidationStatus;
  validationMessage?: string;
  extraFields?: RawImportedRow;
}

export type ImportBackendError = string | { row?: number; message: string };

export interface ImportResult {
  ok: boolean;
  filas_recibidas?: number;
  filasRecibidas?: number;
  insertados: number;
  actualizados?: number;
  omitidos?: number;
  unmapped?: number;
  errores?: ImportBackendError[];
  detected_columns?: string[];
  columnas_detectadas?: string[];
  message?: string;
}

export interface ImportSummary {
  totalRows: number;
  rmRows: number;
  regionesRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  totalFacturacion: number;
  totalKm: number;
  totalTraslado: number;
  uniqueTickets: number;
}

export interface ImportPreviewResult {
  rows: ImportedDashboardRow[];
  summary: ImportSummary;
  fileName: string;
  detectedColumns: string[];
}
