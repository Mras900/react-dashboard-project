# Fase 0 - Auditoria Centro de Diseno

## Alcance

Auditoria solo lectura del dashboard actual. Objetivo: preparar Centro de diseno dentro de Configuracion sin cambiar comportamiento estable.

No tocar en fase 1: backend, DB, auth/login, import Excel, RM/Regiones, TailAdmin base, mapa/Leaflet.

## Estructura actual

| Tema | Ubicacion | Hallazgo |
|---|---|---|
| Tab Configuracion | `src/components/Dashboard.tsx:1172`, `src/components/Dashboard.tsx:2829` | `SettingsView` vive dentro de `Dashboard.tsx`; se renderiza cuando `activeTab === 'settings'` con `ProtectedView viewKey="configuracion"`. |
| Titulo/subtitulo principal | `src/components/Dashboard.tsx:2649` | `TailAdminTopbar` recibe `title` y `subtitle` hardcoded desde `Dashboard.tsx`. |
| KPI cards | `src/components/Dashboard.tsx:570`, `src/components/Dashboard.tsx:610`, `src/components/Dashboard.tsx:715`, `src/components/Dashboard.tsx:2258` | `PrimaryMetric`, `InsightCard`, `CustomKpiCard`; lista `dashboardWidgets` define cards visibles. |
| Titulos/labels hardcoded | `src/components/Dashboard.tsx:2263`-`2293`, `src/components/Dashboard.tsx:2300`, `src/components/Dashboard.tsx:2680`-`2747` | Textos de KPIs, mapa, filtros, header, botones y mensajes viven inline. |
| TailAdmin usado | `src/components/Dashboard.tsx:60`-`63`, `src/features/auth/LoginView.tsx:1` | `TailAdminTopbar`, `TailAdminSidePanel`, `TailAdminRightPanel`, `TailAdminKpiCard`, `TailAdminLogin`. `TailAdminDashboardShell` existe pero no esta integrado. |
| Layout configurable existente | `src/features/layout/DashboardLayoutGrid.tsx`, `src/features/layout/layoutStorage.ts` | Hay grid + localStorage `dashboard-layout-v4`, pero `Dashboard.tsx` no monta `DashboardLayoutGrid`. |
| Settings actuales | `src/components/Dashboard.tsx:1020`-`1210` | Constructor de KPI personalizado y reportes; buen punto para agregar Centro de diseno sin tocar dashboard principal primero. |

## localStorage existente

| Key | Ubicacion | Uso |
|---|---|---|
| `dashboard-theme` | `src/components/Dashboard.tsx:1607`, `src/features/auth/TailAdminLogin.tsx` | Tema claro/dark-premium. |
| `dashboard-custom-kpis` | `src/components/Dashboard.tsx:1493`, `src/components/Dashboard.tsx:1691` | KPIs personalizados. |
| `dashboard-layout-v4` | `src/features/layout/layoutStorage.ts:5`, `src/features/layout/DashboardLayoutGrid.tsx:94` | Layout y widgets ocultos, no montado en dashboard actual. |
| import storage | `src/features/data-import/importStorage.ts` | Datos importados por scope. No tocar. |
| ruta storage | `src/features/ruta/routeDailyStorage.ts` | Visitas ruta. No tocar. |
| map base layer | `src/components/maps/mapLayers.ts` | Capa mapa base. No tocar. |

## Punto seguro de integracion

Fase 1 debe agregar capa de configuracion visual en `src/features/design-center/` y montarla dentro de `SettingsView`, debajo o junto al `KpiBuilder` actual. Dashboard debe seguir usando preset protegido por defecto si no hay config guardada.

Patron recomendado:

1. Definir `DEFAULT_DESIGN_PRESET` inmutable con valores actuales.
2. Cargar override desde localStorage solo en hook dedicado.
3. Resolver config con merge seguro: `resolved = deepMerge(DEFAULT_DESIGN_PRESET, userDraft)`.
4. Pasar `resolved` a `Dashboard.tsx` solo para textos/visibilidad/orden simples en fase 1.
5. Si config invalida, ignorar y volver a default.

## Preservar dashboard actual como preset protegido

Crear preset `default-v1` que copie estado visual actual:

- titulo: `Visor de Facturacion y Reclamos - RM/Regiones`
- subtitulo dashboard: `Inteligencia operativa para decisiones estrategicas`
- subtitulo modulo: `Gestion del modulo activo`
- widgets visibles actuales: todos los `dashboardWidgets` con `visible: true`
- orden actual: layout usado por `ExecutiveDashboardLayout`, no `DashboardLayoutGrid`
- colores: mantener clases actuales; fase 1 solo tokens permitidos, no CSS libre

Regla: nunca editar `DEFAULT_DESIGN_PRESET` desde UI. Boton Reset borra localStorage y vuelve a default.

## Archivos a crear en fase 1

| Archivo | Proposito |
|---|---|
| `src/features/design-center/designTypes.ts` | Tipos: preset, textos, colores seguros, spacing, widgets. |
| `src/features/design-center/defaultDesignPreset.ts` | Preset protegido con estado actual. |
| `src/features/design-center/designStorage.ts` | Load/save/reset localStorage con version y validacion. |
| `src/features/design-center/useDesignConfig.ts` | Hook que entrega `{ preset, update, reset }`. |
| `src/features/design-center/DesignCenterView.tsx` | UI dentro de Configuracion. |
| `src/features/design-center/safeOptions.ts` | Fuentes, colores, spacing permitidos. |

## Archivos a modificar en fase 1

| Archivo | Cambio seguro |
|---|---|
| `src/components/Dashboard.tsx` | Importar hook/config, montar `DesignCenterView` en `SettingsView`, aplicar solo titulo/subtitulo y visibilidad/labels de widgets. |
| `src/features/layout/types.ts` | Opcional: extender metadata visual si se decide usar config sobre widgets. |
| `src/features/layout/layoutStorage.ts` | No modificar en fase 1 salvo que se conecte `DashboardLayoutGrid`; recomendado no tocar aun. |

## Riesgos y mitigacion

| Riesgo | Evitar asi |
|---|---|
| Romper RM/Regiones | No tocar filtros, `viewMode`, `databaseMetrics`, `currentData`, import storage. |
| Romper mapa | No tocar `MapContainer`, `MapLayers`, `RegionClaimsLayer`, `LayersControl`. |
| Config corrupta en localStorage | Validar version/schema; fallback a default. |
| Usuarios sin permiso cambian diseno | Exponer Centro de diseno solo bajo `configuracion`; opcion futura: admin-only. |
| Reordenar blocks rompe layout actual | Fase 1 solo hide/show y labels; reordenar despues usando `DashboardLayoutGrid` ya existente. |
| Estilos libres rompen UI | Solo tokens preaprobados, no CSS arbitrario. |

## Data shape - fuente permitida `dashboard_resumen`

Frontend source: `src/services/dashboardDatabaseApi.ts` type `DashboardSummary`; consumed in `fetchDashboardDatabase().resumen`.

| field name | type | example value | source |
|---|---|---|---|
| `facturacion_total` | number | `993500` | `/api/dashboard/resumen` |
| `reclamos_totales` | number | `49` | `/api/dashboard/resumen` |
| `promedio_por_reclamo` | number | `20275.51` | `/api/dashboard/resumen` |
| `total_comunas` | number | `52` | `/api/dashboard/resumen` |
| `alta_prioridad` | number | `12` | `/api/dashboard/resumen` |
| `tickets_unicos` | number | `49` | `/api/dashboard/resumen` |

## Data shape - fuente permitida `dashboard_comunas`

Frontend source: `src/services/dashboardDatabaseApi.ts` type `DashboardCommune`; consumed by `databaseMetrics` in `src/components/Dashboard.tsx`.

| field name | type | example value | source |
|---|---|---|---|
| `comuna` | string | `Puente Alto` | `/api/dashboard/comunas` |
| `region` | string \| null | `Región Metropolitana` | `/api/dashboard/comunas` |
| `dataset_scope` | string \| undefined | `rm` | `/api/dashboard/comunas` |
| `reclamos` | number | `49` | `/api/dashboard/comunas` |
| `facturacion` | number | `993500` | `/api/dashboard/comunas` |
| `promedio` | number | `20275.51` | `/api/dashboard/comunas` |
| `prioridad_alta` | number | `8` | `/api/dashboard/comunas` |

## Data shape - fuente permitida `dashboard_reclamos`

Frontend source: `src/services/dashboardDatabaseApi.ts` type `DashboardClaim`; converted by `databaseClaimToImportedRow` in `src/components/Dashboard.tsx`.

| field name | type | example value | source |
|---|---|---|---|
| `ticket` | string \| null | `TCK-001` | `/api/dashboard/reclamos` |
| `mes` | string \| null | `Ene` | `/api/dashboard/reclamos` |
| `region` | string \| null | `Región Metropolitana` | `/api/dashboard/reclamos` |
| `comuna` | string \| null | `Puente Alto` | `/api/dashboard/reclamos` |
| `ciudad` | string \| null \| undefined | `Quillota` | `/api/dashboard/reclamos` |
| `cliente` | string \| null | `Cliente Demo` | `/api/dashboard/reclamos` |
| `prioridad` | string \| null | `alta` | `/api/dashboard/reclamos` |
| `estado_visita` | string \| null | `Realizada` | `/api/dashboard/reclamos` |
| `fecha_recepcion` | string \| null | `2026-01-03` | `/api/dashboard/reclamos` |
| `fecha_visita` | string \| null | `2026-01-05` | `/api/dashboard/reclamos` |
| `retiro_muestra` | boolean \| null \| undefined | `true` | `/api/dashboard/reclamos` |
| `tarifa_ruta` | number \| null \| undefined | `21500` | `/api/dashboard/reclamos` |
| `km` | number \| null \| undefined | `12.5` | `/api/dashboard/reclamos` |
| `precio_neto` | number \| null \| undefined | `17500` | `/api/dashboard/reclamos` |
| `traslado` | number \| null \| undefined | `4000` | `/api/dashboard/reclamos` |
| `precio_neto_traslado` | number \| null \| undefined | `21500` | `/api/dashboard/reclamos` |
| `fecha_envio` | string \| null \| undefined | `2026-01-06` | `/api/dashboard/reclamos` |
| `tracking` | string \| null \| undefined | `STK123` | `/api/dashboard/reclamos` |
| `valor_envio` | number \| null \| undefined | `3500` | `/api/dashboard/reclamos` |
| `factura` | string \| null \| undefined | `993500` | `/api/dashboard/reclamos` |
| `calle` | string \| null \| undefined | `Av. Siempre Viva` | `/api/dashboard/reclamos` |
| `numero` | string \| null \| undefined | `123` | `/api/dashboard/reclamos` |
| `source_file_name` | string \| null \| undefined | `region(1).xlsx` | `/api/dashboard/reclamos` |
| `facturacion` | number \| null | `993500` | `/api/dashboard/reclamos` |
| `promedio` | number \| null | `20275.51` | `/api/dashboard/reclamos` |
| `observacion` | string \| null | `Sin novedad` | `/api/dashboard/reclamos` |
| `created_at` | string \| null \| undefined | `2026-06-28T12:00:00` | `/api/dashboard/reclamos` |
| `dataset_scope` | string \| undefined | `rm` | `/api/dashboard/reclamos` |
| `[key: string]` | unknown | backend extra field | `/api/dashboard/reclamos` |

## Data shape - fuente permitida `dashboard_visitas`

Frontend source: `src/services/dashboardApi.ts` type `DashboardDailyResponse`; consumed by `dailyComunaData`, `regionalMapMetrics`, route evidence.

### `kpis`

| field name | type | example value | source |
|---|---|---|---|
| `tickets` | number | `49` | `/api/dashboard/visitas?territorio=rm` |
| `visitas` | number | `49` | `/api/dashboard/visitas?territorio=rm` |
| `exitosas` | number | `42` | `/api/dashboard/visitas?territorio=rm` |
| `no_exitosas` | number | `3` | `/api/dashboard/visitas?territorio=rm` |
| `pendientes` | number | `4` | `/api/dashboard/visitas?territorio=rm` |
| `zonas_rojas` | number | `2` | `/api/dashboard/visitas?territorio=rm` |
| `facturacion_visitas` | number | `993500` | `/api/dashboard/visitas?territorio=rm` |
| `combustible_costo` | number | `12500` | `/api/dashboard/visitas?territorio=rm` |
| `km` | number | `210.4` | `/api/dashboard/visitas?territorio=rm` |
| `tiempo_total_s` | number | `28800` | `/api/dashboard/visitas?territorio=rm` |

### `por_comuna` / `por_region`

| field name | type | example value | source |
|---|---|---|---|
| `nombre` | string | `Puente Alto` | `/api/dashboard/visitas?territorio=rm` |
| `visitas` | number | `49` | `/api/dashboard/visitas?territorio=rm` |
| `tickets` | number | `49` | `/api/dashboard/visitas?territorio=rm` |
| `exitosas` | number | `42` | `/api/dashboard/visitas?territorio=rm` |
| `no_exitosas` | number | `3` | `/api/dashboard/visitas?territorio=rm` |
| `pendientes` | number | `4` | `/api/dashboard/visitas?territorio=rm` |
| `zonas_rojas` | number | `2` | `/api/dashboard/visitas?territorio=rm` |
| `facturacion` | number | `993500` | `/api/dashboard/visitas?territorio=rm` |
| `combustible_costo` | number | `12500` | `/api/dashboard/visitas?territorio=rm` |
| `km` | number | `210.4` | `/api/dashboard/visitas?territorio=rm` |
| `lat` | number \| null | `-33.61` | `/api/dashboard/visitas?territorio=rm` |
| `lon` | number \| null | `-70.57` | `/api/dashboard/visitas?territorio=rm` |

### `evidencia`

| field name | type | example value | source |
|---|---|---|---|
| `ticket_id` | string | `TCK-001` | `/api/dashboard/visitas?territorio=rm` |
| `referencia` | string | `REF-001` | `/api/dashboard/visitas?territorio=rm` |
| `fecha_visita` | string | `2026-01-05` | `/api/dashboard/visitas?territorio=rm` |
| `comuna` | string \| null | `Puente Alto` | `/api/dashboard/visitas?territorio=rm` |
| `region` | string \| null | `Región Metropolitana` | `/api/dashboard/visitas?territorio=rm` |
| `territorio` | string | `rm` | `/api/dashboard/visitas?territorio=rm` |
| `estado` | string | `exitosa` | `/api/dashboard/visitas?territorio=rm` |
| `valor_calculado` | number | `21500` | `/api/dashboard/visitas?territorio=rm` |
| `visitador` | string \| null | `Juan Perez` | `/api/dashboard/visitas?territorio=rm` |

## Modelo auth/permission actual

Si existe rol/permisos.

Frontend:

- `src/features/auth/authTypes.ts`: `AuthRole = 'admin' | 'user'`, `AuthUser.permissions: AppViewKey[]`.
- `src/features/auth/AuthProvider.tsx`: expone `user`, `token`, `hasPermission(viewKey)`, `isAdmin`.
- Token vive en `sessionStorage` key `dashboard-auth-token` via `authStorage`.
- `Dashboard.tsx` usa `hasPermission` para nav y `ProtectedView` para tabs.
- `UserMenu` muestra Usuarios solo si `isAdmin`.

Backend:

- `backend/auth/models.py`: `User.role`, tabla `user_permissions`.
- `backend/auth/security.py`: JWT payload incluye `sub`, `username`, `role`, `iat`, `exp`; permisos no van en token.
- `backend/auth/routes.py`: `/api/auth/me` devuelve usuario serializado con `role` y `permissions`; admin recibe todas las vistas.
- Admin-only via `require_admin`.

Implicacion fase 1: Centro de diseno puede vivir bajo permiso `configuracion`; si se quiere restringir cambios globales, usar `isAdmin` en UI y backend futuro.

## Test infra actual

`package.json` no tiene script `test`. No hay runner configurado visible en scripts. Dependencias no incluyen Vitest/Jest/Testing Library. Validacion actual realista: `npx tsc -p tsconfig.app.json --noEmit` y `npm run build`.

## Plan fase 1

1. Crear modulo `src/features/design-center/` con tipos, preset default, storage, hook y UI.
2. Montar `DesignCenterView` dentro de `SettingsView` sin tocar tabs ni permisos existentes.
3. Aplicar config solo a textos topbar y labels de widgets conocidos.
4. Agregar hide/show de widgets usando IDs existentes; no reordenar aun.
5. Guardar config en localStorage con version `design-center-v1`.
6. Reset borra config y vuelve a default protegido.
7. Mantener `dashboardWidgets` como fuente estable; wrapper de config transforma metadata antes de render.

## No hacer en fase 1

- No tocar backend.
- No tocar import Excel.
- No tocar mapas.
- No cambiar endpoints.
- No cambiar auth model.
- No activar `DashboardLayoutGrid` todavia, salvo fase posterior con QA visual.