# Feature Specification: Fix Import Dashboard Refresh

**Feature Branch**: `001-fix-import-dashboard-refresh`

**Created**: 2026-06-26

**Status**: Draft

**Input**: User description: "Corregir el flujo de importacion de archivos CSV/XLSX para que, al importar reclamos, los datos se guarden correctamente y se visualicen automaticamente en el dashboard principal."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Importar reclamos y ver dashboard actualizado (Priority: P1)

Un usuario operativo importa un archivo valido de reclamos desde la app y, al finalizar la carga, ve automaticamente los nuevos datos reflejados en el dashboard principal sin recargar manualmente la pagina.

**Why this priority**: Es el flujo principal roto: la carga parece ejecutarse, pero los datos no aparecen donde el usuario toma decisiones.

**Independent Test**: Importar un archivo CSV o XLSX valido con reclamos nuevos y confirmar que KPIs, mapa, graficos, tabla operativa y Ruta Visitador reflejan esos reclamos al terminar la importacion.

**Acceptance Scenarios**:

1. **Given** el dashboard esta abierto con datos previos, **When** el usuario importa un XLSX valido de reclamos, **Then** el modal confirma la importacion y el dashboard actualiza KPIs, mapa, graficos, tabla y Ruta Visitador sin recarga manual.
2. **Given** el dashboard esta abierto con datos previos, **When** el usuario importa un CSV valido de reclamos, **Then** los datos importados quedan disponibles inmediatamente en la vista principal y en los filtros existentes.
3. **Given** el usuario esta en vista RM o vista Regiones, **When** finaliza una importacion valida, **Then** la vista activa se mantiene separada y solo muestra los datos que corresponden a su alcance territorial.

---

### User Story 2 - Recibir errores claros ante columnas invalidas (Priority: P2)

Un usuario intenta importar un archivo con columnas faltantes, nombres inesperados o datos insuficientes y recibe un mensaje claro que indica que debe corregir sin dejar la app en pantalla en blanco.

**Why this priority**: Sin errores comprensibles, el usuario no puede distinguir entre un archivo invalido y una falla del sistema.

**Independent Test**: Importar archivos con columnas requeridas ausentes, columnas con alias comunes y columnas mal nombradas; verificar que los alias validos se aceptan y los errores bloqueantes se muestran con detalle accionable.

**Acceptance Scenarios**:

1. **Given** un archivo no contiene una columna minima requerida para reclamos, **When** el usuario lo importa, **Then** la carga se rechaza y el mensaje identifica las columnas faltantes.
2. **Given** un archivo contiene columnas equivalentes con nombres alternativos esperados, **When** el usuario lo importa, **Then** el sistema reconoce esas columnas y procesa la carga.
3. **Given** ocurre un error durante la lectura o normalizacion, **When** el modal informa el resultado, **Then** el dashboard conserva su estado previo y no queda en blanco.

---

### User Story 3 - Mantener funcionalidades territoriales y filtros (Priority: P3)

Un usuario analiza los reclamos importados usando vista RM, vista Regiones, mapa, filtros y Ruta Visitador sin que la correccion de importacion altere esos flujos existentes.

**Why this priority**: La importacion solo entrega valor si alimenta correctamente las vistas territoriales ya usadas para priorizar y planificar.

**Independent Test**: Luego de importar datos validos, alternar entre RM y Regiones, aplicar filtros por dia, semana, mes, comuna, prioridad y estado, revisar capas del mapa y abrir Ruta Visitador.

**Acceptance Scenarios**:

1. **Given** hay reclamos importados con comuna, prioridad, estado y fecha, **When** el usuario aplica filtros, **Then** KPIs, mapa, graficos, tabla y Ruta Visitador responden al mismo conjunto filtrado.
2. **Given** el usuario alterna entre RM y Regiones, **When** observa el mapa y los resumenes, **Then** las vistas permanecen separadas y no mezclan resultados incompatibles.
3. **Given** existen capas geograficas cargadas, **When** se refrescan datos tras una importacion, **Then** Leaflet mantiene las capas y muestra comunas con datos sin perder controles existentes.

### Edge Cases

- Archivo vacio o sin filas de datos: la importacion se rechaza con un mensaje claro y el dashboard mantiene su estado actual.
- Archivo con extension valida pero contenido corrupto o ilegible: el usuario ve un error de lectura y puede volver a intentar.
- Archivo con columnas requeridas usando mayusculas, acentos, espacios o alias comunes: la deteccion debe normalizar nombres antes de decidir si faltan columnas.
- Reclamos con comuna no reconocida o fuera del alcance territorial activo: los datos se guardan y se reportan como no mapeados sin romper mapa, tablas ni filtros.
- Importacion duplicada del mismo archivo: el resultado debe ser consistente y comprensible para el usuario, evitando conteos inesperados.
- Falla durante guardado o actualizacion posterior: el usuario recibe estado de error, el dashboard no queda en blanco y no se muestran datos parcialmente inconsistentes como exito.
- Usuarios con filtros activos durante la importacion: los filtros se conservan y se aplican a los datos actualizados.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow importing reclamos from valid CSV files.
- **FR-002**: System MUST allow importing reclamos from valid XLSX files.
- **FR-003**: System MUST detect required reclamo columns after normalizing headers for casing, accents, extra spaces and supported aliases.
- **FR-004**: System MUST show clear, actionable errors when required columns are missing, unreadable or invalid.
- **FR-005**: System MUST persist successfully imported reclamos in the defined application persistence so subsequent dashboard reads use the imported records.
- **FR-006**: System MUST ensure imported reclamos become part of the dashboard data source used by KPIs, map, charts, operational table and Ruta Visitador.
- **FR-007**: System MUST refresh the dashboard automatically after a successful import without requiring a manual page reload.
- **FR-008**: System MUST keep active filters by dia, semana, mes, comuna, prioridad and estado applied after the refresh.
- **FR-009**: System MUST keep RM and Regiones views separate after imported data is loaded.
- **FR-010**: System MUST preserve Leaflet map rendering, geographic layers and existing layer controls while imported data refreshes.
- **FR-011**: System MUST preserve Ruta Visitador behavior and include eligible imported reclamos in route planning views.
- **FR-012**: System MUST make imported reclamos visible in KPIs, map commune totals, charts and operational table when they match the active view and filters.
- **FR-013**: System MUST prevent a blank screen during import, validation, persistence, refresh or downstream dashboard rendering failures.
- **FR-014**: System MUST report the import result, including accepted row count and rejected or unmapped row count when applicable.
- **FR-015**: System MUST preserve existing Censo 2024 scripts and derived territorial data behavior.
- **FR-016**: System MUST avoid modifying original raw source files or committing heavy source artifacts as part of this feature.

### Key Entities *(include if feature involves data)*

- **Imported Reclamo**: A complaint record loaded from CSV or XLSX, including identifiers, date, commune or territorial reference, priority, status and operational details needed by dashboard views.
- **Import File**: A user-provided CSV or XLSX file containing reclamo rows and headers that may require normalization before validation.
- **Column Mapping**: The association between file headers and expected reclamo fields, including supported aliases and normalized header forms.
- **Import Result**: The outcome shown to the user after import, including success or failure, accepted rows, rejected rows, missing columns and unmapped territorial rows.
- **Dashboard Dataset**: The current set of reclamos used by KPIs, map, charts, table, filters and Ruta Visitador.
- **Territorial View**: The active dashboard scope, either RM or Regiones, that determines which reclamos and geographic layers are visible.

## Constitutional Constraints *(mandatory)*

- **Affected Stage**: importacion and dashboard territorial. The feature also touches the boundary with cruce censo-reclamos because imported commune data must remain compatible with geographic joins.
- **Existing Behavior to Preserve**: CSV/XLSX import, Leaflet and geographic layers, RM and Regiones separation, Ruta Visitador, filters by dia, semana, mes, comuna, prioridad and estado, existing dashboard endpoints and Censo 2024 scripts.
- **Data Source Rules**: `data/raw` must not be modified. ZIP, Parquet and heavy Censo source files must not be committed. Any derived data behavior must remain documented and reproducible.
- **Validation Required**: `npm run build`; import validation for CSV and XLSX; dashboard refresh validation after import; backend dashboard checks for health, summary and commune data when backend behavior changes.
- **Risks to Track**: Data saved but not read by dashboard, dashboard reading stale local or mock data, mismatched column aliases, broken geographic joins, filters using old datasets, Ruta Visitador not receiving refreshed data, blank screen after import failure.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid CSV and XLSX sample files import successfully and show imported reclamos in the dashboard without manual page reload.
- **SC-002**: Dashboard KPIs, map, charts, operational table and Ruta Visitador reflect the imported dataset within 5 seconds after import completion for typical files used by the team.
- **SC-003**: 100% of files missing required columns produce a visible error identifying the missing fields and leave the previous dashboard state usable.
- **SC-004**: Active filters by dia, semana, mes, comuna, prioridad and estado remain applied after import refresh in all tested cases.
- **SC-005**: RM and Regiones views show separate, correct territorial totals after importing a file containing records for one or both scopes.
- **SC-006**: No tested import success or failure path results in a blank screen.
- **SC-007**: Imported reclamos with recognized communes appear on the map and in commune-level totals; unrecognized communes are reported without breaking mapped data.
- **SC-008**: The final validation build completes without errors.

## Assumptions

- Imported files represent reclamos and are intended to replace or append to the defined reclamo persistence according to the current product behavior discovered during planning.
- Existing users import files through the current in-app import modal.
- Required reclamo fields include enough information to support date-based filters, commune or territorial grouping, priority, status and operational table display.
- The dashboard should use one authoritative reclamo dataset after import rather than silently mixing stale local, mock and persisted sources.
- Existing Censo 2024 scripts and raw geographic inputs are outside the change scope except for compatibility validation.