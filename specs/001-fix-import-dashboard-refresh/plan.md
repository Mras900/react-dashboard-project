# Implementation Plan: Fix Import Dashboard Refresh

**Branch**: `(no git branch created by setup hook)` | **Date**: 2026-06-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-fix-import-dashboard-refresh/spec.md`

## Summary

Correct the reclamos import flow so valid CSV/XLSX files are parsed, normalized, persisted, and reflected automatically in the main dashboard without a manual page reload. The implementation will make backend persistence the authoritative source after successful import, keep localStorage only as an immediate/offline fallback during transition, refetch dashboard data after import, and ensure KPIs, RM map, Regiones map, charts, operational table, and Ruta Visitador consume the refreshed dataset consistently.

Current investigation shows the modal already parses CSV/XLSX, saves valid rows to localStorage, calls `POST /api/importar/reclamos`, then calls `onImported()`. The backend insert currently writes to `reclamos`, and dashboard endpoints read from `reclamos`. The likely failure is a mixed-source gap: backend persist errors are swallowed, imported payload omits several business columns, Regiones map still receives `importedRows.regiones` instead of the unified refreshed dataset, and successful import has no visible backend failure/success state beyond closing the modal.

## Technical Context

**Language/Version**: React + TypeScript with Vite frontend; Python FastAPI backend.

**Primary Dependencies**: Tailwind CSS, Leaflet/React-Leaflet, Recharts, PapaParse, xlsx, FastAPI, SQLAlchemy, pandas for existing territorial/Censo scripts.

**Storage**: PostgreSQL via `DATABASE_URL` is documented as operational persistence. SQLite artifact `backend/dashboard_local.db` exists locally, but backend code uses SQLAlchemy `DATABASE_URL`; when absent, endpoints return unavailable and frontend falls back to localStorage. Current dashboard also uses mock/static data and localStorage fallback paths.

**Testing**: `npm run build`; FastAPI startup via Uvicorn; endpoint checks for `/api/health`, `/api/health/db`, `/api/dashboard/resumen`, `/api/dashboard/comunas`; manual UI import checks for CSV/XLSX and dashboard refresh.

**Target Platform**: Browser dashboard served by Vite/frontend build plus FastAPI backend service.

**Project Type**: Web application with React frontend and FastAPI backend.

**Performance Goals**: Typical team CSV/XLSX imports should update visible dashboard state within 5 seconds after successful import completion. Dashboard must remain interactive and nonblank during fetch/import errors.

**Constraints**: Preserve RM and Regiones separation, Leaflet layers, filters, Ruta Visitador, Censo 2024 scripts, territorial scripts, `data/raw`, and existing FastAPI endpoint compatibility. Avoid unnecessary `any`; maintain typed import contracts.

**Scale/Scope**: One feature slice covering importacion plus dashboard territorial refresh. No rewrite of Censo scripts, route optimization, auth, user management, or map layer assets.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Existing functionality impact documented: CSV/XLSX import, dashboard data source selection, RM/Regiones maps, filters, table, charts, Ruta Visitador, and dashboard endpoints are in scope for regression checks.
- Blank-screen prevention covered: import parse/persist/refetch errors must show inline modal or dashboard alerts while preserving previous usable state.
- CSV/XLSX import compatibility assessed: current `parseCsv`, `parseExcel`, `normalizeRmRows`, `normalizeRegionRows`, and editable preview flow remain the base implementation.
- Leaflet, geographic layers, RM view, Regiones view, Ruta Visitador, and territorial filters assessed: no map component rewrite; feed them refreshed data through existing props/state.
- `data/raw` remains immutable; ZIP, Parquet, and heavy Censo artifacts remain out of Git.
- TypeScript typing plan avoids unnecessary `any`; FastAPI endpoint compatibility is preserved by extending existing payload/response contracts rather than removing fields.
- Required validation plan listed:
  - Frontend: `npm run build`
  - Backend: `/api/health`, `/api/health/db`, `/api/dashboard/resumen`, `/api/dashboard/comunas`
- Delivery stage identified: importacion and dashboard territorial, with compatibility boundary to cruce censo-reclamos.
- Final documentation plan includes modified files, commands run, validation results, and detected risks.

**Gate Result**: PASS. No constitutional violation is required for the plan.

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-import-dashboard-refresh/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-contract.md
│   └── ui-contract.md
└── tasks.md              # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── components/
│   └── Dashboard.tsx
├── features/
│   ├── data-import/
│   │   ├── DataImportModal.tsx
│   │   ├── importStorage.ts
│   │   ├── importTypes.ts
│   │   ├── normalizeImportedRows.ts
│   │   ├── normalizeRmRows.ts
│   │   ├── normalizeRegionRows.ts
│   │   ├── parseCsv.ts
│   │   ├── parseExcel.ts
│   │   └── validateImportedRows.ts
│   ├── mapa/
│   │   └── MapView.tsx
│   ├── maps/
│   │   └── RegionClaimsLayer.tsx
│   ├── ruta/
│   │   └── RutaVisitadorView.tsx
│   └── territorial/
│       └── useTerritorialMetrics.ts
└── services/
    ├── dashboardDatabaseApi.ts
    └── importApi.ts

backend/
├── main.py
├── dashboard_api.py
├── database.py
└── models/
    └── reclamo.py

scripts/
├── censo/
│   └── procesar_censo_2024.py      # must remain untouched unless validation-only references are needed
└── territorial/
    └── cruzar_reclamos_censo.py    # must remain untouched unless validation-only references are needed
```

**Structure Decision**: Use the current React/FastAPI layout. Keep import parsing/normalization in `src/features/data-import`, backend transport in `src/services/importApi.ts`, dashboard source orchestration in `src/components/Dashboard.tsx`, and persistence/query behavior in `backend/dashboard_api.py` and `backend/models/reclamo.py`.

## Current-State Findings

- `DataImportModal.confirmImport` saves to localStorage first, calls `importClaimsToBackend(rowsToSave)`, catches backend errors with `console.warn`, then closes and refreshes parent state. This can look successful even when backend persistence failed.
- `importApi.ts` posts to `${API_BASE}/importar/reclamos`. With default `VITE_API_URL` absent, `API_BASE` is `/api`, so the effective route is `/api/importar/reclamos`.
- Backend `dashboard_api.py` exposes `/api/importar/reclamos`, `/api/dashboard/resumen`, `/api/dashboard/comunas`, `/api/dashboard/reclamos`, and `/api/health/db`. `main.py` also exposes `/api/health` and `/api/db/health`.
- `POST /api/importar/reclamos` inserts rows into `reclamos` only. It does not replace, append intentionally by import batch, or upsert by ticket; current behavior is append.
- Dashboard database reads also query `reclamos`, so backend source alignment is mostly present.
- `Dashboard.tsx.refreshImportedRows` reloads localStorage, clears `databaseDashboardData`, and increments `databaseReloadKey`. This triggers refetch but uses localStorage immediately while backend responds.
- Dashboard chooses database data when `databaseDashboardData` is available, otherwise aggregates localStorage. Static/mock `monthlyFacturacion`, `operationalSummary`, and `sourceSummary` still participate in some fallback UI paths.
- Regiones map layer currently receives `importedRows.regiones`, not the database/unified dataset, so backend-persisted imports may update KPIs/charts but not the regional layer.
- Column normalization exists but is split between RM and Regiones and does not cover the complete required alias set consistently.
- `Reclamo` model lacks many business fields from the requested import list: retiro_muestra, tarifa_ruta, km, precio_neto, traslado, precio_neto_traslado, fecha_envio, tracking, valor_envio, factura, calle, numero.

## Proposed Source of Truth

After a successful backend import, the authoritative source for dashboard KPIs, map, charts, table, and Ruta Visitador should be the backend `reclamos` table through `/api/dashboard/*` endpoints. localStorage remains a fallback only when backend is unavailable or before refetch completes; it must not mask backend persistence errors as successful imports.

## Import Strategy Decision

**Decision**: Implement upsert by `ticket` when a non-empty ticket exists; insert rows without ticket only if they pass validation as non-deduplicable records.

**Rationale**: Current append behavior can duplicate the same file and inflate dashboard counts. The spec asks to avoid unexpected counts, and the user explicitly allows upsert by Ticket if existing behavior is undefined. Although the current code appends, there is no documented business rule requiring duplicate tickets.

**Compatibility Note**: Preserve endpoint path and response shape while adding fields such as `actualizados`, `insertados`, `omitidos`, and `errores` in a backwards-compatible response. Existing callers that only read `ok` and `insertados` continue to work.

## Implementation Strategy Incremental

1. Stabilize contracts and import result handling.
   - Make backend persistence failure visible in `DataImportModal` and do not close as success when persistence fails.
   - Return structured import result from `importClaimsToBackend`.

2. Centralize column aliases and payload mapping.
   - Add typed alias map covering Ticket, Prioridad, Retiro Muestra, Región, Ciudad, Comuna, Cliente, Fecha Recepción, Fecha Visita, Estado Visita, Tarifa Ruta, KM, Precio Neto, Traslado, Precio Neto + Traslado, Fecha Envío, Tracking, Valor Envío, Observación, Factura, Calle, Número.
   - Reuse alias helpers from RM and Regiones normalizers.

3. Extend persistence without breaking existing endpoints.
   - Add nullable columns to `Reclamo` model and insert/upsert payload handling.
   - Keep existing dashboard summary/commune fields stable.

4. Unify dashboard refresh source.
   - After successful import: close modal, show success, increment backend reload key, preserve filters and current view.
   - Feed Regiones map and any route/dashboard consumers from the same refreshed detail rows used for KPIs/table.

5. Validate end-to-end.
   - Build frontend, start backend, check health/dashboard endpoints, import CSV/XLSX from UI, verify dashboard changes without reload.

## Likely Files Modified

- `src/features/data-import/DataImportModal.tsx`
- `src/features/data-import/importTypes.ts`
- `src/features/data-import/normalizeImportedRows.ts`
- `src/features/data-import/normalizeRmRows.ts`
- `src/features/data-import/normalizeRegionRows.ts`
- `src/features/data-import/validateImportedRows.ts`
- `src/services/importApi.ts`
- `src/services/dashboardDatabaseApi.ts` if response types expand
- `src/components/Dashboard.tsx`
- `src/features/maps/RegionClaimsLayer.tsx` only if it needs typed rows beyond current `ImportedDashboardRow[]`
- `backend/dashboard_api.py`
- `backend/models/reclamo.py`
- Optional backend migration/bootstrap script if existing databases need new nullable columns beyond `create_all`

## Risks

- Existing databases may not receive new nullable columns from `Base.metadata.create_all`; implementation may need safe `ALTER TABLE ADD COLUMN IF NOT EXISTS` or a migration path.
- SQL parameter style currently uses `%s` in text queries; compatibility with the configured SQLAlchemy dialect must be tested in the real backend environment.
- Upsert by ticket requires a uniqueness strategy. Without a unique constraint, implementation must use transactional select/update/insert or add an index carefully.
- Regiones map currently uses localStorage rows directly; changing it to unified rows can alter visible behavior and must be checked with both local fallback and backend data.
- Frontend default API base differs between services: `importApi.ts` uses `VITE_API_URL || /api`, while `dashboardApi.ts` uses `VITE_API_BASE_URL || ''`. Avoid widening this inconsistency during implementation.
- Date filtering depends on string date formats. Imported dates must be normalized to ISO where possible.
- Censo/territorial scripts read `data/raw`/`data/processed`; this feature must not rewrite those flows.

## Decisions Pending

- Whether to add a database uniqueness constraint on `reclamos.ticket` or implement application-level upsert without schema constraint.
- Whether rows without ticket should be rejected or inserted with a generated import row identifier. Plan default: reject for dashboard import unless business requires otherwise.
- Whether success toast/message should live in modal before close or dashboard header after close. Plan default: dashboard-level transient success message after `onImported(result)`.
- Whether `/api/import/reclamos` should be added as an alias for `/api/importar/reclamos`. Plan default: add alias only if existing UI/tests reference it; preserve `/api/importar/reclamos`.

## Complexity Tracking

No constitutional violations requiring justification.

## Post-Design Constitution Check

- Existing functionality preserved by incremental changes to current modal, services, dashboard state, and backend endpoint rather than replacing modules.
- Blank-screen prevention handled through modal errors, dashboard alert fallback, and preserving previous data during failed refetch.
- CSV/XLSX compatibility retained through existing parsers plus broader alias normalization.
- Leaflet/RM/Regiones/Ruta/filtros protected by explicit validation scenarios in quickstart.
- `data/raw`, Censo scripts, and territorial scripts are validation-only surfaces, not edit targets.
- TypeScript typing remains explicit through expanded import/result types.
- FastAPI endpoint compatibility preserved.
- Required validation commands and endpoint checks documented in quickstart.