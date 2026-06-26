# UI Contract: Import to Dashboard Refresh

## Import Modal Contract

### Inputs

- User selects import mode: RM, Regiones, or Automático/Mixto.
- User selects a CSV/XLS/XLSX/XLSM file.

### Preview Behavior

- File is parsed client-side.
- Rows are normalized using shared column aliases.
- Valid rows, warning rows, and error rows are visible before confirmation.
- Missing blocking columns show clear messages.
- Error CSV download remains available for invalid rows.

### Confirm Behavior

- Confirm button is disabled while reading or persisting.
- On backend success:
  - local fallback may be updated;
  - backend import result is shown or passed to dashboard;
  - modal closes;
  - dashboard refetch starts;
  - current RM/Regiones view and active filters remain unchanged.
- On backend failure:
  - modal stays open;
  - a visible error explains the failure;
  - previous dashboard state remains visible;
  - user can retry or cancel.

## Dashboard Refresh Contract

### Event

`onImported(result: ImportResult)` from `DataImportModal` to `Dashboard`.

### Dashboard Responsibilities

- Preserve existing view mode and filters.
- Mark data as refreshing while keeping previous UI visible.
- Refetch dashboard resumen, comunas, and reclamos.
- Recompute:
  - KPIs;
  - RM map;
  - Regiones map;
  - charts;
  - operational table;
  - territorial insight cards;
  - Ruta Visitador entry points/metrics where dashboard data is used.
- Show a success message with inserted/updated counts.
- Show retry alert if refetch fails.

## Nonblank Contract

No import or refresh state may render a blank page. Required visible states:

- Reading file.
- Preview with zero valid rows.
- Persisting import.
- Import success.
- Import backend error.
- Dashboard refresh in progress.
- Dashboard refresh failed with fallback/previous data.