# Quickstart Validation: Fix Import Dashboard Refresh

## Prerequisites

- Dependencies installed for frontend and backend.
- Backend `.env` configured with `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`.
- A valid CSV sample and a valid XLSX sample containing reclamos with the expected columns or aliases.
- No changes to `data/raw`, Censo source files, ZIP, Parquet, or heavy Censo artifacts.

## 1. Frontend Build

From repository root:

```powershell
npm run build
```

Expected result:

- Build exits with code 0.
- No TypeScript errors.
- No blank-screen regression in the generated app when opened through the normal dev/preview flow.

## 2. Start Backend

From repository root:

```powershell
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Expected result:

- FastAPI starts without traceback.
- Tables are created or existing tables are reused.

## 3. Backend Health Checks

In another terminal:

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:8000/api/health -UseBasicParsing
Invoke-WebRequest -Uri http://127.0.0.1:8000/api/health/db -UseBasicParsing
Invoke-WebRequest -Uri http://127.0.0.1:8000/api/dashboard/resumen -UseBasicParsing
Invoke-WebRequest -Uri http://127.0.0.1:8000/api/dashboard/comunas -UseBasicParsing
```

Expected result:

- `/api/health` returns `ok: true`.
- `/api/health/db` returns `ok: true` when database is configured.
- Dashboard endpoints return JSON, not 500/blank HTML.

## 4. Run Frontend Dev Server

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

If needed, configure frontend API env to reach backend consistently:

```powershell
$env:VITE_API_URL='http://127.0.0.1:8000/api'
$env:VITE_API_BASE_URL='http://127.0.0.1:8000'
npm run dev -- --host 127.0.0.1 --port 5173
```

Expected result:

- Dashboard loads.
- Existing RM and Regiones tabs remain available according to user permissions.
- Leaflet maps render, including RM and Regiones views.

## 5. CSV Import Scenario

1. Open the import modal from the app.
2. Select import mode matching the sample scope or Automático/Mixto.
3. Upload a valid CSV file.
4. Confirm the preview has valid rows and clear warnings/errors.
5. Confirm import.

Expected result:

- Modal does not close as success if backend persistence fails.
- On success, dashboard updates without browser reload.
- KPIs change according to imported data.
- Map shows communes/regions with data.
- Charts show imported totals.
- Operational table shows imported rows/aggregates.
- Active filters remain applied.
- No screen goes blank.

## 6. XLSX Import Scenario

Repeat the CSV scenario with a valid XLSX file.

Expected result:

- XLSX sheet is read correctly.
- Column aliases are detected.
- Dashboard updates within 5 seconds after success.

## 7. Missing Columns Scenario

1. Upload a CSV/XLSX missing one or more blocking columns such as Ticket or commune/city.
2. Attempt to confirm import.

Expected result:

- Missing columns or row-level issues are visible.
- Invalid rows are not persisted.
- Previous dashboard state remains usable.
- Error CSV download still works for row errors.

## 8. RM and Regiones Separation

1. Import a file with RM records.
2. Validate RM tab totals and map.
3. Switch to Regiones tab and verify it does not incorrectly mix RM-only records.
4. Import a Regiones file.
5. Validate Regiones tab and map.
6. Switch back to RM and verify its map/layers still work.

Expected result:

- View separation remains intact.
- Leaflet controls/layers remain usable.
- Regional layer uses the same refreshed dataset as KPIs/charts/table.

## 9. Filters

After successful import, test filters:

- Dia.
- Semana.
- Mes.
- Comuna.
- Prioridad.
- Estado, if implemented in the active UI surface.

Expected result:

- KPIs, map, charts, table, and Ruta-related dashboard metrics respond consistently to active filters.
- Filters remain selected after import refresh.

## 10. Ruta Visitador Regression

1. Open Ruta Visitador.
2. Confirm existing route map renders.
3. Confirm route/red-zone behavior still works.
4. Return to dashboard and verify imported reclamos are still visible.

Expected result:

- Ruta Visitador is not broken by import/dashboard source changes.
- Route localStorage and backend route visit flows remain intact.

## 11. Censo and Territorial Scripts Regression Boundary

Do not run scripts unless needed for unrelated validation. If touched accidentally, fail the review.

Check:

```powershell
git status --short -- data/raw scripts/censo scripts/territorial
```

Expected result:

- No modifications under `data/raw`.
- No unintended modifications to Censo 2024 or territorial scripts.

## 12. Final Delivery Notes Required

The final implementation report must list:

- Files modified.
- Commands run.
- Endpoint responses checked.
- CSV/XLSX manual validation results.
- Risks or skipped validations.