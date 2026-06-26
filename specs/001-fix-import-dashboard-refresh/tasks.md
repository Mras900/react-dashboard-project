# Tasks: Fix Import Dashboard Refresh

**Input**: Design documents from `specs/001-fix-import-dashboard-refresh/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api-contract.md`, `contracts/ui-contract.md`, `quickstart.md`

**Tests**: Manual endpoint/UI validation is required by the plan and quickstart. Automated tests are not required in this task list unless added during implementation.

**Organization**: Tasks are ordered by dependency and grouped into the requested phases. User story labels map to:

- **[US1]**: Importar reclamos y ver dashboard actualizado
- **[US2]**: Recibir errores claros ante columnas invalidas
- **[US3]**: Mantener funcionalidades territoriales y filtros

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after prior blocking dependencies are complete
- **[Story]**: Included for user story implementation tasks only
- Every task includes an exact file path or validation target

---

## Phase 1: Diagnostico Seguro

**Purpose**: Confirm current behavior and regression surfaces before editing code.

- [X] T001 Review current frontend import flow in `src/features/data-import/DataImportModal.tsx` and document where `parseFile`, `normalizeByMode`, `confirmImport`, `onImported`, and `onClose` run
- [X] T002 [P] Review CSV/XLSX parsers in `src/features/data-import/parseCsv.ts` and `src/features/data-import/parseExcel.ts` for supported extensions, sheet selection, empty-row handling, and parse-error behavior
- [X] T003 [P] Review preview/edit behavior in `src/features/data-import/ImportPreviewTable.tsx` and `src/features/data-import/validateImportedRows.ts` for visible row errors and editable fields
- [X] T004 Review localStorage fallback behavior in `src/features/data-import/importStorage.ts` and identify exactly when RM and Regiones rows are saved, loaded, and cleared
- [X] T005 Review backend import call in `src/services/importApi.ts` and confirm the effective default URL for `/api/importar/reclamos`
- [X] T006 Review dashboard refresh entry point in `src/components/Dashboard.tsx` and document how `refreshImportedRows`, `databaseReloadKey`, `databaseDashboardData`, and `importedRows` interact
- [X] T007 [P] Review backend routes in `backend/main.py` and `backend/dashboard_api.py` and confirm current availability of `/api/importar/reclamos`, `/api/import/reclamos`, `/api/dashboard/resumen`, `/api/dashboard/comunas`, `/api/health`, `/api/health/db`, and `/api/db/health`
- [X] T008 [P] Review persistence model in `backend/models/reclamo.py` and confirm current columns in table `reclamos` against `specs/001-fix-import-dashboard-refresh/data-model.md`
- [X] T009 [P] Review dashboard SQL in `backend/dashboard_api.py` and confirm `/api/dashboard/resumen` and `/api/dashboard/comunas` read from table `reclamos`
- [X] T010 [P] Review Regiones map data path in `src/components/Dashboard.tsx` and `src/features/maps/RegionClaimsLayer.tsx` and confirm where `importedRows.regiones` bypasses backend-refreshed data
- [X] T011 [P] Review Ruta Visitador dependency surface in `src/features/ruta/RutaVisitadorView.tsx`, `src/features/ruta/routeDailyStorage.ts`, and dashboard route metrics usage in `src/components/Dashboard.tsx`
- [X] T012 [P] Check that `data/raw`, `scripts/censo/procesar_censo_2024.py`, and `scripts/territorial/cruzar_reclamos_censo.py` have no planned implementation edits
- [X] T013 Confirm expected import persistence behavior in `specs/001-fix-import-dashboard-refresh/research.md` and `backend/dashboard_api.py`; if no existing rule is documented, keep upsert by `ticket` as the safe strategy

**Checkpoint**: Current import, persistence, dashboard refresh, Regiones, Ruta, and Censo boundaries are understood before code changes.

---

## Phase 2: Backend Importacion

**Purpose**: Make backend import persistence reliable, upsert-safe, and explicit without breaking existing dashboard endpoints.

- [X] T014 [US1] Add nullable reclamo fields from the data model to `backend/models/reclamo.py` while preserving existing fields and table name `reclamos`
- [X] T015 [US1] Add safe database bootstrap or migration logic for missing nullable reclamo columns in `backend/database.py` or a focused backend migration helper so existing databases do not fail after model expansion
- [X] T016 [US1] Extend `IMPORT_COLUMNS` and row cleaning in `backend/dashboard_api.py` to accept retiro_muestra, tarifa_ruta, km, precio_neto, traslado, precio_neto_traslado, fecha_envio, tracking, valor_envio, factura, calle, numero, source_file_name, and updated_at
- [X] T017 [US1] Implement application-level upsert by non-empty `ticket` in `backend/dashboard_api.py` with transactional insert/update behavior and no duplicate ticket inflation
- [X] T018 [US2] Reject or omit backend import rows without required `ticket` in `backend/dashboard_api.py` and include row-level errors in the import response
- [X] T019 [US1] Expand the backend import response in `backend/dashboard_api.py` to include filas recibidas, insertadas, actualizadas, omitidas, unmapped, columnas detectadas when provided, errores, and message while preserving `ok` and `insertados`
- [X] T020 [US1] Preserve existing `/api/importar/reclamos` route in `backend/dashboard_api.py` and add `/api/import/reclamos` as a compatibility alias only if diagnostic task T007 found it missing but needed
- [X] T021 [US1] Confirm `/api/dashboard/resumen` in `backend/dashboard_api.py` still aggregates from table `reclamos` after import model expansion
- [X] T022 [US1] Confirm `/api/dashboard/comunas` in `backend/dashboard_api.py` still aggregates from table `reclamos` after import model expansion
- [X] T023 [US1] Confirm `/api/dashboard/reclamos` in `backend/dashboard_api.py` returns new nullable fields without breaking existing frontend consumers

**Checkpoint**: Backend stores imported reclamos in `reclamos`, uses upsert by Ticket, and dashboard endpoints read the same persisted source.

---

## Phase 3: Frontend Importacion y Errores

**Purpose**: Make CSV/XLSX normalization broader and make backend import failures visible to users.

- [X] T024 [US1] Add typed `ImportResult` and expanded imported row fields in `src/features/data-import/importTypes.ts` to match `contracts/api-contract.md`
- [X] T025 [US1] Add a shared typed alias map for required CSV/XLSX columns in `src/features/data-import/normalizeImportedRows.ts`
- [X] T026 [US1] Refactor `getField` and `getRawField` usage in `src/features/data-import/normalizeImportedRows.ts` to support the shared alias map without using unnecessary `any`
- [X] T027 [US1] Update RM normalization in `src/features/data-import/normalizeRmRows.ts` to use shared aliases for Ticket, Prioridad, Retiro Muestra, Región, Comuna, Cliente, Fecha Recepción, Fecha Visita, Estado Visita, Factura, Calle, Número, and Observación
- [X] T028 [US1] Update Regiones normalization in `src/features/data-import/normalizeRegionRows.ts` to use shared aliases for Ticket, Región, Ciudad, Comuna, Cliente, Tarifa Ruta, KM, Precio Neto, Traslado, Precio Neto + Traslado, Fecha Envío, Tracking, Valor Envío, Factura, Calle, Número, and Observación
- [X] T029 [US2] Update validation messages in `src/features/data-import/validateImportedRows.ts` so missing blocking columns show clear field names and preserve warning behavior for nonblocking fields
- [X] T030 [US1] Expand payload mapping in `src/services/importApi.ts` to send all typed import fields required by `contracts/api-contract.md`
- [X] T031 [US1] Update `importClaimsToBackend` in `src/services/importApi.ts` to return the full typed backend import result and parse backend `detail` errors safely
- [X] T032 [US1] Include `detected_columns` / `columnas_detectadas` metadata in the import result flow across `src/features/data-import/DataImportModal.tsx`, `src/services/importApi.ts`, and `backend/dashboard_api.py`
- [X] T033 [US2] Remove the `console.warn`-only backend error path in `src/features/data-import/DataImportModal.tsx` so failed persistence does not close the modal as success
- [X] T034 [US2] Add visible persisting, success, and backend-error states to `src/features/data-import/DataImportModal.tsx` with confirm button disabled while persisting
- [X] T035 [US2] Ensure parse errors, invalid files, empty files, and missing-column errors remain visible in `src/features/data-import/DataImportModal.tsx` without clearing the previous dashboard state
- [X] T036 [US1] Update the `onImported` prop contract in `src/features/data-import/DataImportModal.tsx` to pass `ImportResult` to the parent on successful backend import

**Checkpoint**: Users see real import errors, valid CSV/XLSX rows map all required columns, and success only fires after backend persistence succeeds.

---

## Phase 4: Refetch Dashboard

**Purpose**: Refresh all main dashboard surfaces automatically after successful import without page reload.

- [X] T037 [US1] Update `DataImportModal` usage and `refreshImportedRows` signature in `src/components/Dashboard.tsx` to receive `ImportResult`
- [X] T038 [US1] Add dashboard-level import success state in `src/components/Dashboard.tsx` showing inserted, updated, omitted, and unmapped counts after successful import
- [X] T039 [US1] Keep localStorage as fallback in `src/components/Dashboard.tsx` but ensure backend data is authoritative after successful refetch
- [X] T040 [US1] Ensure `refreshImportedRows` in `src/components/Dashboard.tsx` increments `databaseReloadKey`, preserves active RM/Regiones view, and preserves current filters
- [X] T041 [US1] Confirm KPIs recompute from refreshed backend data in `src/components/Dashboard.tsx` after `databaseDashboardData` updates
- [X] T042 [US1] Confirm RM map data recomputes from refreshed backend data in `src/components/Dashboard.tsx` and still passes stable props to Leaflet layers
- [X] T043 [US1] Confirm charts recompute from refreshed backend rows and aggregates in `src/components/Dashboard.tsx`, including monthly bars and top communes
- [X] T044 [US1] Confirm operational table and evidence export recompute from refreshed backend data in `src/components/Dashboard.tsx`
- [X] T045 [US1] Preserve dashboard refresh failure alert and retry behavior in `src/components/Dashboard.tsx` so failed refetch does not blank the screen

**Checkpoint**: After import success, dashboard KPIs, RM map, charts, table, and visible status refresh without manual reload.

---

## Phase 5: Regiones y Consistencia de Datos

**Purpose**: Remove source divergence between backend, localStorage fallback, Regiones map, filters, and Ruta surfaces.

- [X] T046 [US3] Create a unified current detail-row selector in `src/components/Dashboard.tsx` that returns backend rows when available and localStorage rows only as fallback
- [X] T047 [US3] Replace direct `importedRows.regiones` usage for the Regiones map in `src/components/Dashboard.tsx` with the unified Regiones detail rows
- [X] T048 [US3] Update `src/features/maps/RegionClaimsLayer.tsx` only if needed so it accepts the unified row shape without weakening TypeScript types
- [X] T049 [US3] Confirm Regiones filters by month, date range, comuna/region, and priority in `src/components/Dashboard.tsx` use the same refreshed dataset as KPIs and charts
- [X] T050 [US3] Audit and implement refresh for the estado filter in `src/components/Dashboard.tsx` so imported records preserve estado filtering after backend refetch
- [X] T051 [US3] Confirm RM and Regiones remain separated in `src/components/Dashboard.tsx` when imported files contain mixed scopes
- [X] T052 [US3] Confirm territorial insight inputs in `src/features/territorial/useTerritorialMetrics.ts` still receive RM-only rows and do not run for Regiones
- [X] T053 [US3] Implement eligible imported reclamo handoff from `src/components/Dashboard.tsx` to `src/features/ruta/RutaVisitadorView.tsx`, or document the current independent Ruta source contract in `specs/001-fix-import-dashboard-refresh/tasks.md` if Ruta must remain independent
- [X] T054 [US3] Confirm Ruta Visitador still renders and operates in `src/features/ruta/RutaVisitadorView.tsx` after dashboard import source changes
- [X] T055 [US3] Confirm route-related dashboard metrics in `src/components/Dashboard.tsx` still use existing route daily storage/backend flows and are not overwritten by import rows
- [X] T056 [US3] Ensure localStorage clear actions in `src/features/data-import/DataImportModal.tsx` and `src/features/data-import/importStorage.ts` remain fallback-safe and do not erase backend-persisted data unexpectedly

**Checkpoint**: RM, Regiones, Leaflet, filters, and Ruta are consistent with the same source-of-truth rules.

---

## Phase 6: Validacion Final

**Purpose**: Prove the full flow works and document residual risks.

- [X] T057 Run `npm run build` from repository root and record the result in the final delivery notes
- [X] T058 Start FastAPI from `backend/main.py` with the configured environment and record the command used in final delivery notes
- [X] T059 Validate `GET /api/health` against the running backend and record response status/content summary
- [X] T060 Validate `GET /api/health/db` and `GET /api/db/health` against the running backend and record response status/content summary
- [ ] T061 Validate `GET /api/dashboard/resumen` against the running backend after import-capable changes and confirm it reads persisted `reclamos`
- [ ] T062 Validate `GET /api/dashboard/comunas` against the running backend after import-capable changes and confirm it reads persisted `reclamos`
- [ ] T063 Validate `POST /api/importar/reclamos` manually with a minimal JSON payload and confirm inserted/updated/omitted counters
- [ ] T064 Import a valid CSV from the UI and confirm KPIs, RM map, charts, table, and import success message update without page reload
- [ ] T065 Import a valid XLSX from the UI and confirm KPIs, RM map, charts, table, and import success message update without page reload
- [ ] T066 Validate `GET /api/dashboard/reclamos` after CSV/XLSX import and confirm it returns imported rows, tickets, and expanded optional nullable fields
- [ ] T067 Import a file with missing blocking columns from the UI and confirm visible errors, no modal success close, and no blank screen
- [ ] T068 Validate Regiones view after import and confirm the Regiones map no longer depends on stale `importedRows.regiones`
- [ ] T069 Validate filters by dia, semana, mes, comuna, prioridad, and estado after import refresh
- [ ] T070 Validate Ruta Visitador still opens, renders its Leaflet map, and preserves existing route/red-zone behavior
- [X] T071 Check `git status --short -- data/raw scripts/censo scripts/territorial` and confirm no Censo scripts, territorial scripts, or raw data files were modified
- [ ] T072 Document modified files, commands run, endpoint checks, CSV/XLSX validation results, skipped checks, and detected risks in final delivery notes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Diagnostico Seguro**: No dependencies; complete before code changes.
- **Phase 2: Backend Importacion**: Depends on Phase 1 findings for route and persistence decisions.
- **Phase 3: Frontend Importacion y Errores**: Depends on Phase 2 response contract or can begin after T018 contract shape is known.
- **Phase 4: Refetch Dashboard**: Depends on T030 and T034 so dashboard receives a structured import result.
- **Phase 5: Regiones y Consistencia de Datos**: Depends on Phase 4 unified refresh behavior.
- **Phase 6: Validacion Final**: Depends on all implementation phases.

### User Story Dependencies

- **US1**: Core MVP. Backend persistence, import success, dashboard refresh.
- **US2**: Depends on import parsing/backend call surfaces from US1 but can be validated independently with invalid files.
- **US3**: Depends on refreshed dataset from US1 and preserves territorial/Ruta behavior.

### Blocking Task Highlights

- T014-T023 block reliable backend import behavior.
- T024-T032 block typed frontend/backend import contract.
- T033-T036 block correct UI success/error behavior.
- T037-T045 block automatic dashboard refresh.
- T046-T056 block Regiones/Ruta consistency.

---

## Parallel Opportunities

- T002, T003, T007, T008, T009, T010, T011, and T012 can run in parallel during diagnosis.
- T021, T022, and T023 can run in parallel after backend import model changes are complete.
- T027 and T028 can run in parallel after T025-T026 shared aliases are available.
- T041, T042, T043, and T044 can run in parallel after T037-T040 refresh orchestration is complete.
- T052, T054, and T055 can run in parallel after T046-T051 establish unified data selection.
- T059-T062 can run in parallel after backend is running; T066 should run after T063-T065 create imported rows.
- T063-T069 are manual validation scenarios and should be run sequentially enough to preserve clear evidence, but they touch distinct surfaces.

## Parallel Example: Phase 1 Diagnosis

```text
Task: T002 Review CSV/XLSX parsers in src/features/data-import/parseCsv.ts and src/features/data-import/parseExcel.ts
Task: T007 Review backend routes in backend/main.py and backend/dashboard_api.py
Task: T010 Review Regiones map data path in src/components/Dashboard.tsx and src/features/maps/RegionClaimsLayer.tsx
Task: T011 Review Ruta Visitador dependency surface in src/features/ruta/RutaVisitadorView.tsx, src/features/ruta/routeDailyStorage.ts, and src/components/Dashboard.tsx
```

## Parallel Example: Column Normalization

```text
Task: T027 Update RM normalization in src/features/data-import/normalizeRmRows.ts
Task: T028 Update Regiones normalization in src/features/data-import/normalizeRegionRows.ts
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 diagnosis.
2. Complete backend persistence tasks T014-T023.
3. Complete frontend import/error tasks T024-T036.
4. Complete dashboard refetch tasks T037-T045.
5. Validate CSV and XLSX import for US1 before moving to broader consistency work.

### Incremental Delivery

1. Backend import contract works and dashboard endpoints read `reclamos`.
2. Modal stops hiding backend errors and reports success only after persistence.
3. Dashboard refetch updates KPIs, RM map, charts, and table.
4. Regiones map and Ruta surfaces are checked and aligned.
5. Full validation proves no blank screen and no Censo/raw-data regression.

## Notes

- Do not implement during task generation.
- Do not modify `data/raw`.
- Do not commit ZIP, Parquet, or heavy Censo files.
- Preserve `/api/importar/reclamos` compatibility.
- Avoid unnecessary `any` in TypeScript changes.
- Keep localStorage as fallback, not the authoritative source after successful backend import.
