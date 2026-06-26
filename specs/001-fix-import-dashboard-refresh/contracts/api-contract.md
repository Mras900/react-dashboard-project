# API Contract: Import and Dashboard Refresh

## POST /api/importar/reclamos

Persists valid reclamos parsed by the frontend import modal.

### Compatibility

- Existing path remains supported.
- Existing response fields `ok` and `insertados` remain supported.
- Optional alias `/api/import/reclamos` may be added only if implementation finds callers/tests require it.

### Request Body

```json
[
  {
    "ticket": "T-001",
    "prioridad": "alta",
    "retiro_muestra": true,
    "region": "Región Metropolitana",
    "ciudad": "Santiago",
    "comuna": "Santiago",
    "cliente": "Cliente Demo",
    "fecha_recepcion": "2026-06-01",
    "fecha_visita": "2026-06-03",
    "estado_visita": "Completada",
    "tarifa_ruta": 21500,
    "km": 12.5,
    "precio_neto": 20000,
    "traslado": 1500,
    "precio_neto_traslado": 21500,
    "facturacion": 21500,
    "promedio": 0,
    "fecha_envio": "2026-06-04",
    "tracking": "ABC123",
    "valor_envio": 3500,
    "observacion": "Sin observación",
    "factura": "F-123",
    "calle": "Av. Siempre Viva",
    "numero": "742"
  }
]
```

### Success Response

```json
{
  "ok": true,
  "insertados": 8,
  "actualizados": 2,
  "omitidos": 0,
  "unmapped": 1,
  "errores": [],
  "message": "Importación completada"
}
```

### Error Responses

- `422`: body is not a list, row is not an object, required fields missing, invalid numeric value.
- `503`: database unavailable or `DATABASE_URL` missing.

```json
{
  "detail": "Faltan columnas requeridas: Ticket, Comuna"
}
```

## GET /api/dashboard/resumen

Returns aggregate KPIs from persisted reclamos.

### Query Parameters

- `mes`: optional string.
- `fecha_inicio`: optional date.
- `fecha_fin`: optional date.
- `region`: optional string.
- `comuna`: optional string.
- `prioridad`: optional string.

### Response

```json
{
  "facturacion_total": 215000,
  "reclamos_totales": 10,
  "promedio_por_reclamo": 21500,
  "total_comunas": 3,
  "alta_prioridad": 4,
  "tickets_unicos": 10
}
```

## GET /api/dashboard/comunas

Returns commune/region aggregates from persisted reclamos.

### Response Item

```json
{
  "comuna": "Santiago",
  "region": "Región Metropolitana",
  "reclamos": 5,
  "facturacion": 107500,
  "promedio": 21500,
  "prioridad_alta": 2
}
```

## GET /api/dashboard/reclamos

Returns detail rows used by frontend to build shared dashboard rows, map layers, tables, and charts.

### Response Requirements

- Include existing fields currently returned by `SELECT * FROM reclamos`.
- Include newly persisted nullable business fields when added.
- Preserve query filters used by dashboard.

## GET /api/health and GET /api/health/db

Used for validation. `/api/health` verifies service availability; `/api/health/db` verifies configured database availability.