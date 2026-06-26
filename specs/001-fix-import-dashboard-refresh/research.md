# Research: Fix Import Dashboard Refresh

## Decision: Backend `reclamos` table is the source of truth after successful import

**Rationale**: `backend/dashboard_api.py` imports rows into `reclamos`, and `/api/dashboard/resumen`, `/api/dashboard/comunas`, and `/api/dashboard/reclamos` all read from the same table. `Dashboard.tsx` already fetches those endpoints through `fetchDashboardDatabase` and prefers `databaseDashboardData` over localStorage when available.

**Alternatives considered**:
- localStorage as source of truth: fast and currently used, but it cannot serve backend endpoints or shared sessions and can hide persistence failures.
- Static/mock data as source of truth: already present as fallback, but does not satisfy imported real-data dashboard behavior.
- Mixed source permanently: current failure mode; rejected because KPIs, maps, Regiones, and Ruta can diverge.

## Decision: Keep localStorage only as fallback and immediate optimistic state

**Rationale**: `DataImportModal` currently saves to localStorage before backend import, and `refreshImportedRows` reloads that state immediately while backend refetch runs. This is useful when backend is unavailable, but success messaging must distinguish local fallback from persisted import.

**Alternatives considered**:
- Remove localStorage import persistence now: higher regression risk for offline/current fallback flows.
- Keep swallowing backend errors: rejected because users see a successful close while dashboard endpoints do not change.

## Decision: Use upsert by `ticket` for backend import

**Rationale**: Current backend appends every imported row. The user requested preserving existing behavior if defined, but no business rule documenting append was found; append can duplicate the same file and inflate KPIs. Ticket is the safest stable key in the requested column list and existing model.

**Alternatives considered**:
- Replace dataset on every import: simple, but dangerous for mixed RM/Regiones and partial imports.
- Append forever: current behavior, but creates duplicate-count risk.
- User-selected mode: useful later, but outside this correction and adds UI complexity.

## Decision: Normalize columns through a shared alias map

**Rationale**: Header normalization exists in `normalizeImportedRows.ts`, but alias candidates are scattered across RM and Regiones normalizers. A shared typed alias map can cover all required columns consistently while keeping existing mode-specific calculations.

Required aliases to cover:
- Ticket: `Ticket`, `N° Ticket`, `N Ticket`, `ID`
- Prioridad: `Prioridad`
- Retiro Muestra: `Retiro Muestra`
- Región: `Región`, `Region`, `REGION_KUT`
- Ciudad: `Ciudad`
- Comuna: `Comuna`, `Descripción Comuna`, `Descripcion Comuna`, `Ciudad`
- Cliente: `Cliente`
- Fecha Recepción: `Fecha Recepción`, `Fecha Recepcion`, `Fecha Recepcion ticket`, `Fecha Recepcion Ticket`
- Fecha Visita: `Fecha Visita`, `Fecha de Retiro / Entrega`
- Estado Visita: `Estado Visita`, `Estado`
- Tarifa Ruta: `Tarifa Ruta`
- KM: `KM`, `Cant. KM`, `Cant KM`
- Precio Neto: `Precio Neto`, `Precio Neto (Tarifa Plana)`, `Precio Neto Tarifa Plana`
- Traslado: `Traslado`
- Precio Neto + Traslado: `Precio Neto + Traslado`
- Fecha Envío: `Fecha Envío`, `Fecha Envio`, `Fecha Envio Valija`, `Fecha Envio de Muestras`, `Fecha Envio Muestras`
- Tracking: `Tracking`, `N° Tracking Starken`, `N Tracking Starken`
- Valor Envío: `Valor Envío`, `Valor Envio`, `Valor Envio Bulto`
- Observación: `Observación`, `Observacion`, `OBSERVACION`, `OBSERVCION`
- Factura: `Factura`, `FACTURA`
- Calle: `Calle`
- Número: `Número`, `Numero`

**Alternatives considered**:
- Continue adding aliases directly in each normalizer: lower initial effort but duplicates logic and misses cross-mode consistency.
- Backend-only normalization: too late for preview/edit/error UX.

## Decision: Extend import payload and model with nullable business fields

**Rationale**: Current `importApi.ts` sends only ticket, mes, region, comuna, cliente, prioridad, estado, fechas, facturacion, promedio, observacion. The requested import list includes route, shipping, invoice, address, and amount fields. Persisting them as nullable columns preserves dashboard compatibility and unlocks table/Ruta behavior without breaking existing rows.

**Alternatives considered**:
- Store extra fields as JSON text: flexible, but harder for dashboard filters and future queries.
- Do not persist extra fields: preserves current shape, but fails requested scope and Ruta/table needs.

## Decision: Preserve existing endpoint paths and add compatible response fields

**Rationale**: Existing frontend calls `/api/importar/reclamos`; user also asked to review `/api/import/reclamos`. The plan should not remove or rename the existing endpoint. If an alias is needed, it can call the same handler. Response can remain `{ ok, insertados }` plus additional counters.

**Alternatives considered**:
- Replace endpoint with a new path: unnecessary compatibility risk.
- Change response shape completely: breaks existing callers.

## Decision: Dashboard refetch should be explicit after import success

**Rationale**: `refreshImportedRows` already increments `databaseReloadKey`; implementation should keep that mechanism but pass a structured import result, show success/error, and ensure all consumers use the refreshed unified rows. Regiones map currently receives `importedRows.regiones`, so it must be changed to the same source used by KPIs/table.

**Alternatives considered**:
- Full page reload: violates objective.
- Rely on localStorage event: same-tab localStorage writes do not reliably trigger React state unless manually wired and still do not confirm backend persistence.

## Decision: Keep Censo scripts and `data/raw` untouched

**Rationale**: The feature only changes app import/persistence/refresh. Existing scripts `scripts/censo/procesar_censo_2024.py` and `scripts/territorial/cruzar_reclamos_censo.py` are validation surfaces, not edit targets.

**Alternatives considered**:
- Regenerate territorial derived data as part of import: too broad and risks breaking Censo workflow.