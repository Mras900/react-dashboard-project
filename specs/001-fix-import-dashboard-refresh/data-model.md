# Data Model: Fix Import Dashboard Refresh

## ImportedReclamo

Represents one valid reclamo row parsed from CSV/XLSX and eligible for persistence/dashboard display.

### Fields

- `ticket`: string, required for upsert; trimmed. Rows without ticket should be rejected unless explicitly accepted as non-deduplicable in implementation.
- `prioridad`: `alta | media | baja | sin_prioridad`; normalized from source text.
- `retiro_muestra`: boolean | null.
- `region`: string | null; normalized display value when possible.
- `ciudad`: string | null.
- `comuna`: string | null; used for RM map joins and commune totals.
- `cliente`: string | null.
- `fecha_recepcion`: ISO date string or original string when parsing cannot safely convert.
- `fecha_visita`: ISO date string or original string when parsing cannot safely convert.
- `estado_visita`: string | null.
- `estado_visita_normalizado`: `completada | pendiente | no_realizada | sin_estado` for frontend calculations.
- `tarifa_ruta`: number | null.
- `km`: number | null.
- `precio_neto`: number | null.
- `traslado`: number | null.
- `precio_neto_traslado`: number | null.
- `facturacion`: number; dashboard amount, default 0.
- `promedio`: number; current backend-compatible field, default 0.
- `fecha_envio`: string | null.
- `tracking`: string | null.
- `valor_envio`: number | null.
- `observacion`: string | null.
- `factura`: string | null.
- `calle`: string | null.
- `numero`: string | null.
- `scope`: `rm | regiones`; frontend classification for view separation.
- `source_file_name`: string | null.
- `created_at`: timestamp | null; backend generated or preserved existing behavior.
- `updated_at`: timestamp | null; recommended for upsert observability.

### Validation Rules

- `ticket` is required for persisted import upsert.
- `comuna` or `ciudad` is required for territorial display.
- At least one date or `mes` should be present for date/month filters; missing date is warning unless current behavior treats it as blocking.
- Numeric monetary fields parse currency symbols, Chilean thousands separators, decimal comma, and blank as zero/null according to field semantics.
- Unknown communes are allowed but reported as unmapped; they must not break map rendering.

## ImportFile

Represents the user-provided CSV/XLSX file during modal preview/import.

### Fields

- `fileName`: string.
- `extension`: `csv | xls | xlsx | xlsm`.
- `selectedMode`: `rm | regiones | auto`.
- `rawRows`: array of raw row objects from PapaParse/xlsx.
- `detectedFormat`: `rm | regiones | mixed | unknown`.

### Validation Rules

- Unsupported extension is rejected before parsing.
- Empty file or no data rows is rejected with visible error.
- Corrupt/unreadable workbook or CSV parse failure is visible in modal.

## ColumnMapping

Represents normalized header detection for user files.

### Fields

- `canonicalField`: one expected import field.
- `aliases`: string array.
- `matchedHeader`: string | null.
- `requiredFor`: `rm | regiones | both | optional`.
- `missingSeverity`: `error | warning`.

### Validation Rules

- Header comparison removes accents, lowercases, trims, and collapses whitespace.
- Missing blocking columns produce a modal error or row-level error before persistence.
- Supported aliases must be shared by RM and Regiones normalizers where fields overlap.

## ImportResult

Represents the outcome returned from backend and shown in the UI.

### Fields

- `ok`: boolean.
- `insertados`: number.
- `actualizados`: number.
- `omitidos`: number.
- `errores`: array of row-level or file-level errors.
- `unmapped`: number.
- `message`: string.

### Validation Rules

- `ok=false` prevents modal close as success.
- `ok=true` triggers dashboard refetch.
- Counters must add up to the rows sent or explain skipped rows.

## DashboardDataset

Represents the unified reclamo data consumed by dashboard widgets.

### Fields

- `resumen`: KPI summary from backend dashboard endpoint or local fallback.
- `comunas`: commune/region aggregates.
- `reclamos`: detail rows converted to `ImportedDashboardRow` for shared frontend consumers.
- `source`: `backend | localStorageFallback | mockFallback`.
- `errors`: string array.
- `updatedAt`: timestamp.

### Relationships

- `DashboardDataset.reclamos` is derived from persisted `ImportedReclamo` rows or local fallback rows.
- `DashboardDataset.comunas` drives KPIs, map, charts, table, territorial insights, and Regiones layer.
- `RutaVisitador` remains independent for route optimization, but dashboard route entry points should see the same refreshed reclamo context when using dashboard metrics.

## State Transitions

### Import Modal

1. `idle` -> user selects file.
2. `reading` -> parse CSV/XLSX.
3. `preview` -> normalized rows and row errors shown.
4. `persisting` -> valid/warning rows sent to backend.
5. `success` -> result shown, modal closes or dashboard success appears, dashboard refetch starts.
6. `error` -> visible error; previous dashboard state remains usable.

### Dashboard Refresh

1. `stable` -> import success event.
2. `refreshing` -> previous data remains visible and status says updating.
3. `refreshed` -> backend data replaces fallback data for all dashboard consumers.
4. `refresh_failed` -> warning shown, local fallback or previous data remains visible, retry available.