const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

import type { ImportedDashboardRow, ImportResult } from '../features/data-import/importTypes';

type BackendClaimPayload = {
  ticket: string | null;
  mes: string | null;
  region: string | null;
  ciudad: string | null;
  comuna: string | null;
  cliente: string | null;
  prioridad: string | null;
  retiro_muestra: boolean | null;
  estado_visita: string | null;
  fecha_recepcion: string | null;
  fecha_visita: string | null;
  tarifa_ruta: number | null;
  km: number | null;
  precio_neto: number | null;
  traslado: number | null;
  precio_neto_traslado: number | null;
  facturacion: number;
  promedio: number;
  fecha_envio: string | null;
  tracking: string | null;
  valor_envio: number | null;
  observacion: string | null;
  factura: string | null;
  calle: string | null;
  numero: string | null;
  source_file_name: string | null;
  dataset_scope?: string | null;
  scope?: string | null;
};

type ImportRequestBody = {
  rows: BackendClaimPayload[];
  detected_columns: string[];
  columnas_detectadas: string[];
};

type BackendErrorPayload = {
  detail?: string | { msg?: string; message?: string } | Array<{ msg?: string; message?: string }>;
  message?: string;
};

const nullableNumber = (value: number | null | undefined): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function mapRowToPayload(row: ImportedDashboardRow): BackendClaimPayload {
  return {
    ticket: row.ticket || null,
    mes: row.mes || null,
    region: row.regionNormalizada || row.regionOriginal || null,
    ciudad: row.ciudad || null,
    comuna: row.comuna || row.ciudad || null,
    cliente: row.cliente || null,
    prioridad: row.prioridad || null,
    retiro_muestra: row.retiroMuestra ?? null,
    estado_visita: row.estadoVisita || null,
    fecha_recepcion: row.fechaRecepcionTicket || null,
    fecha_visita: row.fechaVisita || null,
    tarifa_ruta: nullableNumber(row.tarifaRuta),
    km: nullableNumber(row.km),
    precio_neto: nullableNumber(row.precioNeto),
    traslado: nullableNumber(row.traslado),
    precio_neto_traslado: nullableNumber(row.precioNetoTraslado),
    facturacion: row.facturacionTotal ?? 0,
    promedio: row.tarifaCalculada ?? 0,
    fecha_envio: row.fechaEnvioMuestras || row.fechaEnvioValija || null,
    tracking: row.trackingStarken || null,
    valor_envio: nullableNumber(row.valorEnvioBulto),
    observacion: row.observacion || null,
    factura: row.factura || null,
    calle: row.calle || null,
    numero: row.numeroDireccion || null,
    source_file_name: row.sourceFileName || null,
    dataset_scope: row.datasetScope || row.scope || null,
    scope: row.datasetScope || row.scope || null,
  };
}

function getBackendErrorMessage(payload: BackendErrorPayload) {
  const detail = payload.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.message || item.msg).filter(Boolean).join('; ') || 'Error al importar en el servidor';
  if (detail && typeof detail === 'object') return detail.message || detail.msg || 'Error al importar en el servidor';
  return payload.message || 'Error al importar en el servidor';
}

export async function importClaimsToBackend(
  rows: ImportedDashboardRow[],
  detectedColumns: string[] = [],
  signal?: AbortSignal,
): Promise<ImportResult> {
  const mappedRows = rows
    .filter((row) => row.validationStatus !== 'error')
    .map(mapRowToPayload);

  if (mappedRows.length === 0) {
    return {
      ok: true,
      filas_recibidas: 0,
      insertados: 0,
      actualizados: 0,
      omitidos: 0,
      unmapped: 0,
      errores: [],
      detected_columns: detectedColumns,
      columnas_detectadas: detectedColumns,
      message: 'Sin filas válidas para importar',
    };
  }

  const body: ImportRequestBody = {
    rows: mappedRows,
    detected_columns: detectedColumns,
    columnas_detectadas: detectedColumns,
  };

  const response = await fetch(`${API_BASE}/importar/reclamos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await response.json().catch(() => ({}))) as ImportResult & BackendErrorPayload;

  if (!response.ok) {
    throw new Error(getBackendErrorMessage(payload));
  }

  if (payload.ok === false) {
    const backendErrors = payload.errores?.map((error) => (typeof error === 'string' ? error : error.message)).filter(Boolean).join('; ');
    throw new Error(backendErrors || payload.message || 'No se importaron filas válidas');
  }

  return {
    ok: true,
    filas_recibidas: payload.filas_recibidas ?? mappedRows.length,
    filasRecibidas: payload.filas_recibidas ?? mappedRows.length,
    insertados: payload.insertados ?? 0,
    actualizados: payload.actualizados ?? 0,
    omitidos: payload.omitidos ?? 0,
    unmapped: payload.unmapped ?? 0,
    errores: payload.errores ?? [],
    detected_columns: payload.detected_columns ?? detectedColumns,
    columnas_detectadas: payload.columnas_detectadas ?? payload.detected_columns ?? detectedColumns,
    message: payload.message ?? 'Importación completada',
  };
}
