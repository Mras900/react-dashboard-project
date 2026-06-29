# Auditoría inicial — Rediseño por módulos

## 1. Resumen ejecutivo

La aplicación actual no está dividida por rutas URL. `src/App.tsx` solo decide entre `LoginView` y `Dashboard`, y `src/components/Dashboard.tsx` concentra la navegación interna por pestañas mediante estado local `activeTab`.

Existen módulos funcionales reutilizables para Dashboard, Ruta Visitador, Reportes, Configuraciones, Mapa, Usuarios, IA, importación y zonas rojas. No existe una pestaña específica de Facturación, pero sí hay datos, columnas, cálculos, tablas editables de preimportación, exportaciones y endpoints que pueden alimentar una futura vista de Facturación.

La prioridad de Fase 1 debería ser reordenar navegación y contenedores visuales sin mover lógica crítica: importador, cálculos agregados, mapas Leaflet, protección por permisos y endpoints backend.

## 2. Sidebar y navegación actual

Archivo principal: `src/components/Dashboard.tsx`.

El sidebar está definido de forma hardcodeada en el arreglo `navItems` dentro de `Dashboard.tsx`. También existe `bottomNavItems` para Ayuda. No se detectó una configuración externa de navegación.

Ítems actuales visibles según permisos:

| ID interno | Label visible | Permiso | Estado observado |
|---|---|---|---|
| `dashboard` | Panel principal | `dashboard` | Funcional |
| `settings` | Configuraciones | `configuracion` | Funcional |
| `reports` | Reportes | `reportes` | Funcional |
| `ruta` | Ruta visitador | `ruta` | Funcional |
| `arqueo` | Arqueo Ruta | `ruta` | Apunta a placeholder/construcción en el switch principal |
| `alerts` | Alertas | `dashboard` | Apunta a placeholder/construcción |
| `map` | Mapa | `dashboard` | Funcional como vista propia |
| `users` | Usuarios | `usuarios` | Funcional |
| `help` | Ayuda | `dashboard` | Apunta a placeholder/construcción |

Para llegar a la navegación objetivo futura:

| Objetivo futuro | Origen actual recomendado | Cambio necesario |
|---|---|---|
| Dashboard | `dashboard` / Panel principal | Renombrar label y conservar `ProtectedView viewKey="dashboard"` |
| Ruta diaria | `ruta` / Ruta visitador | Renombrar label; conservar `RutaVisitadorView` |
| Reportes | `reports` | Mantener como pestaña principal |
| Facturación | No existe como tab | Crear vista nueva en fase posterior reutilizando datos/tablas existentes |
| Configuraciones | `settings` | Quitar de aquí reportes/ruta si se consolidan como pestañas propias |

## 3. Rutas actuales

Archivo de entrada: `src/App.tsx`.

No se detecta React Router (`BrowserRouter`, `Routes`, `Route`) para las vistas principales. El sistema usa un dashboard monolítico con `activeTab` en `src/components/Dashboard.tsx`.

Rutas/vistas actuales:

| Vista | Ruta URL | Implementación actual |
|---|---|---|
| Dashboard | Sin ruta URL propia | `activeTab === 'dashboard'` en `Dashboard.tsx` |
| Configuraciones | Sin ruta URL propia | `activeTab === 'settings'`, renderiza `SettingsView` |
| Ruta diaria | Sin ruta URL propia | `activeTab === 'ruta'`, renderiza `RutaVisitadorView` |
| Reportes | Sin ruta URL propia | `activeTab === 'reports'`, renderiza `ReportsView` |
| Facturación | No existe | No hay tab ni vista dedicada |
| Mapa | Sin ruta URL propia | `activeTab === 'map'`, renderiza `MapView` |
| Usuarios | Sin ruta URL propia | `activeTab === 'users'`, renderiza `UserManagementView` |

Rutas antiguas o duplicadas: no hay rutas frontend duplicadas porque no hay router URL. Sí hay aliases backend para importación: `/api/importar/reclamos` y `/api/import/reclamos`.

Riesgo: al no existir rutas URL, agregar navegación con React Router más adelante puede romper deep links, permisos o estado si se hace de golpe.

## 4. Dashboard principal

Archivo principal: `src/components/Dashboard.tsx`.

Componentes internos principales:

- `TailAdminTopbar`, `TailAdminSidePanel`, `TailAdminRightPanel`.
- `ExecutiveDashboardLayout`, `DashboardSlot`, `RouteMetricsSummary`.
- `TailAdminKpiCard`, `ConfigurableKpiCard`, `ConfigurableChartCard`.
- `EditableDashboardWrapper`, `InlineEditToolbar`, `ComponentEditPanel`.
- `AiAssistantPanel`.
- `TerritorialInsightCards`, `TerritorialExplanationModal`, `TerritorialComunaDetailModal`.
- `MapView`, `RegionClaimsLayer`, `ActiveRedZonesLayers`.

Componentes de KPIs:

- `TailAdminKpiCard`.
- `PrimaryMetric`, `InsightCard`, `StatStripItem` dentro de `Dashboard.tsx`.
- `ConfigurableKpiCard`.
- `KpiBuilder` y lógica de KPIs personalizados en `SettingsView`.

Componentes de mapas:

- Mapa embebido del dashboard en `Dashboard.tsx` con `MapContainer`, `GeoJSON`, `TileLayer`, `LayersControl`.
- `src/features/mapa/MapView.tsx` para la vista de mapa dedicada.
- `src/features/maps/RegionClaimsLayer.tsx`.
- `src/features/red-zones/ActiveRedZonesLayers.tsx`.

Componentes de gráficos:

- Gráficos propios dentro de `ExecutiveDashboardLayout`.
- `src/components/charts/ChartRenderer.tsx`.
- Widgets en `src/components/charts/widgets/*`.
- `src/features/design-center/ConfigurableChartCard.tsx`.

Componentes de tablas:

- Tabla de evidencia dentro de `ExecutiveDashboardLayout`.
- `src/components/charts/widgets/TableChartWidget.tsx`.
- `ImportPreviewTable` para previsualización editable de importación.

Separación RM / Regiones:

- Estado `viewMode` con valores `rm` y `regiones`.
- Selector visible RM / Regiones dentro de `TailAdminSidePanel`.
- Protección por permisos `ProtectedView viewKey={viewMode}`.
- Datos separados con `loadRmImportedRows`, `loadRegionImportedRows`, `aggregateImportedRows`, `dataset_scope` y lógica `isRmComuna`.

Lógica de datos:

- Fuente backend preferente: `fetchDashboardDatabase` consume resumen, comunas y reclamos.
- Fallback/local: `localStorage` vía `importStorage.ts`.
- Datos diarios: `fetchDashboardDailyVisits`.
- Agregación: `aggregateImportedRows`, `sumComunaMetrics`, `mergeComunaMetrics`, cálculos `useMemo` en `Dashboard.tsx`.

Endpoints consumidos:

- `/api/dashboard/resumen`
- `/api/dashboard/comunas`
- `/api/dashboard/reclamos`
- `/api/dashboard/visitas`
- `/api/config/dashboard-visual*`
- `/api/ai/chat`

Partes reutilizables:

- Layout visual `ExecutiveDashboardLayout`.
- Selector RM / Regiones.
- KPIs, tabla de evidencia, exportación CSV/XLSX, panel IA.
- Capas de mapa y agregaciones territoriales.

Partes que no se deben tocar sin pruebas:

- Cálculos `filteredData`, `totals`, `tableRows`, `databaseMetrics`.
- Importación y fallback localStorage/backend.
- Mapa Leaflet y capas GeoJSON.
- Protección `ProtectedView`.

## 5. Ruta diaria

Archivos principales:

- `src/features/ruta/RutaVisitadorView.tsx`.
- `src/features/ruta/services/rutaApi.ts`.
- `src/features/ruta/rutaUtils.ts`.
- `src/features/ruta/routeDailyStorage.ts`.
- `src/features/ruta/routeDailyMetrics.ts`.
- `src/features/ruta/routeWeatherService.ts`.
- Backend: `backend/main.py`, `backend/services/route_optimizer.py`, `backend/services/ruta_visitas_service.py`, `backend/services/ruta_optimizaciones_service.py`.

Actualmente Ruta diaria vive como vista propia en `activeTab === 'ruta'`. Además, el dashboard principal incluye un resumen de ruta (`RouteMetricsSummary`). No está dentro de Configuraciones.

Componentes/capacidades detectadas:

| Capacidad | Existe | Ubicación |
|---|---|---|
| Mapa | Sí | `RutaVisitadorView.tsx` con React Leaflet |
| Lista de visitas/paradas | Sí | `RutaVisitadorView.tsx` |
| Optimización | Sí | `optimizarRuta`, `/api/ruta/optimizar`, `route_optimizer.py` |
| Valorización | Sí | `getFareTable`, `calculateStopValue`, `buildRutaSummary` |
| Clima | Sí | `routeWeatherService.ts`, `/api/weather/route` |
| Carga por ticket | Sí | `buscarPorTicket`, `/api/ruta/ticket/{ticket_id}` |
| Carga por RUT | Sí | `buscarPorRut`, `/api/ruta/rut/{rut}` |
| Carga masiva | Sí | `bulkTicketIds`, `parseTicketIds` |
| Zonas rojas | Sí | `ActiveRedZonesLayers`, `redZonesApi`, `isPointInActiveRedZone` |
| Dirección desde ticket | Sí | `toRutaStop` usa `direccion`, `direccion_limpia`, `geocode_query_used` |
| Validación zona roja | Sí | frontend y endpoint `/api/red-zones/validate-point` |
| Mapa territorial/heatmap | Parcial | capas comunales y zonas rojas; endpoint heat-points existe |

Componentes reutilizables:

- `RutaVisitadorView` completo como vista.
- `routeDailyStorage` para persistencia local.
- `rutaApi` para backend.
- `rutaUtils` para normalización, valorización, CSV y zonas rojas.
- `ActiveRedZonesLayers` y `redZonesApi`.

Riesgos de mover/rediseñar:

- Alto acoplamiento entre estado local, mapa Leaflet, carga de tickets, optimización y zonas rojas.
- Hay persistencia local y backend; mover sin wrapper puede perder sincronización con dashboard.
- La optimización depende de geocodificación y OSRM; cambios visuales no deben alterar payloads.

## 6. Reportes

Existe módulo Reportes como pestaña propia: `activeTab === 'reports'` renderiza `src/features/reports/ReportsView.tsx`.

También Reportes aparece dentro de Configuraciones si el usuario tiene permiso `reportes`: `SettingsView` renderiza `ReportsView rmRows={tableRows}`. Esto es duplicación funcional a considerar.

Componentes detectados:

- `ReportsView`.
- `MonthlyReportGenerator`.
- `ChartBuilder`.
- `ChartRenderer`.
- `useSavedCharts`.
- `default-charts.ts`, `chart-utils.ts`, `chart-types.ts`.
- `SimilarClaimsPanel` integrado dentro de Reportes.

Generador de informes:

- `MonthlyReportGenerator` existe y consume `previewMonthlyReport`, `getMonthlyReportHtml` y `exportMonthlyReport`.
- Backend: `backend/routes/reports.py`, `backend/services/monthly_report.py`, `backend/services/report_exporter.py`.

Exportaciones:

- Dashboard: CSV y Excel desde `Dashboard.tsx`.
- Importador: CSV de errores.
- Ruta Visitador: CSV de ruta.
- Reportes backend: export mensual `html`, `pdf`, `docx` según `exportMonthlyReport`.
- No se detectó export CSV propio de Reportes, pero sí gráficos guardados y generación mensual.

Resumen mensual/semanal:

- Mensual existe en `MonthlyReportGenerator`.
- Ruta diaria maneja día/semana/mes para métricas de ruta.
- Dashboard permite filtros mes, semana, día y rango.

IA integrada:

- Sí. Reportes incluye `SimilarClaimsPanel`.
- `MonthlyReportGenerator` soporta `include_ai_analysis`.

## 7. Integración IA

Archivos frontend:

- `src/services/aiApi.ts`.
- `src/features/ai/AiAssistantPanel.tsx`.
- `src/features/ai/SimilarClaimsPanel.tsx`.
- `src/features/reports/MonthlyReportGenerator.tsx`.
- `src/features/reports/ReportsView.tsx`.

Archivos backend:

- `backend/routes/ai.py`.
- `backend/services/ai_provider.py`.
- `backend/services/claim_similarity.py`.
- `backend/services/rag_search.py`.
- `backend/services/rag_indexer.py`.
- `backend/services/providers/nvidia_provider.py`.
- `backend/services/providers/gemini_provider.py`.
- `backend/services/providers/groq_provider.py`.
- `backend/services/providers/openrouter_provider.py`.

Endpoints IA disponibles:

- `POST /api/ai/chat`
- `POST /api/ai/dashboard-summary`
- `POST /api/ai/analyze-comunas`
- `POST /api/ai/generate-report`
- `POST /api/ai/similar-claims`
- `POST /api/ai/similar-claims-summary`
- `POST /api/ai/rag/index-claims`
- `POST /api/ai/rag/index-reference-sources`
- `POST /api/ai/rag/search`
- `POST /api/ai/rag/chat`

Frontend que consume IA:

- `AiAssistantPanel` en Dashboard.
- `SimilarClaimsPanel` en Reportes.
- `MonthlyReportGenerator` para análisis mensual con IA.

Reutilización para Reportes: viable. Ya existe IA conectada a reportes, reclamos similares, resumen mensual y generación de reporte. No conviene crear nueva lógica IA en Fase 1; conviene envolver y ordenar lo existente.

## 8. Facturación

No existe módulo/pestaña Facturación dedicada.

Sí existen datos y lógica relacionados con facturación:

- Campo `facturacion` en backend `reclamos`.
- Campo frontend `facturacionTotal` en `ImportedDashboardRow`.
- KPIs de facturación en Dashboard.
- Gráficos de facturación mensual y top comunas.
- Tabla de evidencia con facturación, promedio y prioridades.
- Importador con edición de campo `facturacionTotal`.
- Reportes mensuales con `facturacion_estimada`.

Vista para revisar datos:

- Parcial. La tabla de evidencia del Dashboard permite revisar agregados por comuna.
- `ImportPreviewTable` permite revisar y corregir filas antes de confirmar importación.
- No existe una tabla dedicada para revisar/editar reclamos ya persistidos en backend.

Componentes existentes para futura Facturación:

| Necesidad | Existe | Ubicación |
|---|---|---|
| Búsqueda | Parcial | búsqueda en tabla de evidencia; filtros importador |
| Filtros | Sí | Dashboard: periodo, prioridad, estado, comuna/región |
| Edición | Parcial | `ImportPreviewTable` solo antes de importar |
| Validación | Sí | `validateImportedRows.ts` e importador backend |
| Corrección comuna | Parcial | editable en `ImportPreviewTable` |
| Corrección región | Parcial | editable en `ImportPreviewTable` |
| Corrección prioridad | Parcial | editable en `ImportPreviewTable` |
| Corrección estado | Parcial | editable en `ImportPreviewTable` |
| Duplicados | Parcial | Dashboard tiene acción `showDuplicates`; tickets únicos se calculan |
| Registros con errores | Sí | filtro `error` y descarga CSV en importador |

Endpoints para actualizar datos:

- Importador usa upsert por ticket en `POST /api/importar/reclamos`.
- No se detectó endpoint específico tipo `PUT /api/reclamos/{id}` para editar registros persistidos.

Corrección actual de datos:

- Principalmente desde importador antes de confirmar carga.
- Backend normaliza al importar en `_clean_import_row`.

Reutilización recomendada para pestaña Facturación:

- Reutilizar `ImportPreviewTable` como base visual, pero no acoplarla directamente si se requiere edición de datos persistidos.
- Reutilizar `dashboardDatabaseApi` y tipos `DashboardClaim`.
- Reutilizar exportación CSV/XLSX del Dashboard.
- Backend futuro: endpoints CRUD/patch de reclamos y auditoría de cambios.

## 9. Configuraciones

Archivo principal actual: función `SettingsView` dentro de `src/components/Dashboard.tsx`.

Componentes dentro de Configuraciones:

- `DesignCenterView` para centro de diseño.
- `KpiBuilder` para KPIs personalizados.
- `ReportsView` si `canViewReports` es true.

Centro de diseño:

- `src/features/design-center/DesignCenterView.tsx`.
- `useDesignConfig.ts`.
- `designConfigApi.ts`.
- `defaultDesignPreset.ts`.
- `KpiSettings`, `ChartSettings`, `LayoutSettings`, `ComponentSettings`, `ComponentEditPanel`.

Importador:

- No vive visualmente dentro de Configuraciones. Se abre desde `UserMenu` con `onOpenImport`, mostrando `DataImportModal`.

Usuarios:

- Vista propia `activeTab === 'users'`, no dentro de Configuraciones.

Preferencias:

- Tema y acciones de usuario en `UserMenu` / `TailAdminTopbar`.
- Configuración visual persistida en centro de diseño.

Ruta diaria dentro de Configuraciones:

- No. Solo Reportes aparece duplicado dentro de Configuraciones.

Qué debe quedarse en Configuraciones:

- Centro de diseño.
- KPIs personalizados.
- Preferencias visuales/configuración de layout.
- Administración avanzada de configuración visual.

Qué debería salir:

- `ReportsView` debería vivir solo en Reportes para evitar duplicación.
- Usuarios podría mantenerse como tab propia o submódulo futuro de Configuraciones, pero hoy ya está separado.
- Importador podría quedar como acción global o moverse a Facturación/Configuraciones según decisión de producto.

## 10. Importador de datos

Ubicación:

- `src/features/data-import/DataImportModal.tsx`.
- `FileUploadDropzone.tsx`.
- `ImportPreviewTable.tsx`.
- `ImportSummaryCards.tsx`.
- `parseExcel.ts`.
- `parseCsv.ts`.
- `normalizeRmRows.ts`.
- `normalizeRegionRows.ts`.
- `normalizeImportedRows.ts`.
- `validateImportedRows.ts`.
- `detectDatasetScope.ts`.
- `importStorage.ts`.
- Servicio API: `src/services/importApi.ts`.
- Backend: `backend/dashboard_api.py`.

Servicios usados:

- `xlsx` para Excel.
- `papaparse` para CSV.
- `importClaimsToBackend` para persistir.
- `localStorage` para fallback/datos locales.

Persistencia:

- Guarda primero en `localStorage` (`dashboard-rm-data`, `dashboard-regiones-data`, `dashboard-import-metadata`).
- Luego intenta persistir en backend vía `POST /api/importar/reclamos`.
- Si backend falla, mantiene datos locales.

Datos que alimenta:

- Dashboard RM.
- Dashboard Regiones.
- Ruta Visitador mediante `eligibleRouteReclamos`.
- Reportes.
- IA/reportes indirectamente si los datos llegan a backend.
- Futuro módulo Facturación.

Riesgos de romper importación:

- Cambiar aliases de columnas puede dejar de mapear Excel/CSV reales.
- Cambiar `datasetScope` o `scope` puede romper separación RM/Regiones.
- Cambiar validación puede impedir cargas actualmente aceptadas.
- Cambiar orden localStorage/backend puede perder fallback.

Archivos que no se deben tocar sin pruebas:

- `DataImportModal.tsx`.
- `normalizeImportedRows.ts`.
- `normalizeRmRows.ts`.
- `normalizeRegionRows.ts`.
- `validateImportedRows.ts`.
- `detectDatasetScope.ts`.
- `importStorage.ts`.
- `src/services/importApi.ts`.
- `backend/dashboard_api.py`, especialmente `_clean_import_row` e `_import_claims_impl`.

## 11. Mapas y capas

Componentes de mapa:

- `src/components/Dashboard.tsx`: mapa principal embebido.
- `src/features/mapa/MapView.tsx`: vista Mapa.
- `src/features/ruta/RutaVisitadorView.tsx`: mapa de ruta diaria.
- `src/features/maps/RegionClaimsLayer.tsx`.
- `src/features/maps/loadRegionalGeoLayer.ts`.
- `src/features/maps/aggregateClaimsByCommune.ts`.
- `src/features/maps/normalizeMapJoinKey.ts`.
- `src/features/red-zones/ActiveRedZonesLayers.tsx`.
- `src/components/maps/BaseLayerSelector.tsx`.
- `src/components/maps/mapLayers.ts`.

Capas/archivos públicos:

- `/data/map-layers/zonas_rojas.geojson`.
- `/data/map-layers/regiones-chile.geojson`.
- `/data/map-layers/limite-urbano.geojson`.
- `/data/map-layers/limite-urbano-v2.geojson`.
- `/data/map-layers/cuadrantes-santiago.geojson`.
- `/data/map-layers/comunas.kml.geojson`.
- `/data/map-layers/chile_comunas_simplified.geojson`.
- `/data/map-layers/borde-region-metropolitana.geojson`.

Mapas RM:

- Dashboard usa comunas RM y capas borde/limite urbano/cuadrantes/zonas rojas.
- `MapView` recibe `rmComunasLayer`, `historicalRedZones`, `activeRedZones`.

Mapas Regiones:

- `loadRegionalGeoLayer` y `RegionClaimsLayer`.
- Datos regionales agregados por comuna/ciudad/región.

Mapa Ruta diaria:

- `RutaVisitadorView` con paradas, línea optimizada, punto inicial, comunas, zonas rojas históricas y activas.

Zonas rojas/heatmap:

- Zonas rojas activas CRUD: `/api/red-zones`.
- Validación punto: `/api/red-zones/validate-point`.
- Heat points backend: `/api/red-zones/heat-points`.

Tecnología:

- Leaflet y React Leaflet.
- GeoJSON estático y capas backend.

Qué mapas se pueden reutilizar:

- `MapView` como vista dedicada.
- `ActiveRedZonesLayers`.
- Carga de capas GeoJSON.
- `RegionClaimsLayer`.
- Base map layers de Dashboard/Ruta.

Riesgos:

- Leaflet suele requerir `invalidateSize`; mover contenedores puede dejar mapas en blanco.
- Cambiar dimensiones/overflow de layout puede romper renderizado.
- Cambiar claves de join comunal/regional afecta colores y agregaciones.
- Capas grandes pueden impactar performance si se duplican.

## 12. Datos y lógica crítica

KPIs:

- `src/components/Dashboard.tsx`: `sumComunaMetrics`, `filteredKpis`, `totals`, `filteredData`.
- `src/features/design-center/kpiCalculations.ts`: KPIs configurables.
- `src/features/design-center/kpiRegistry.ts`: fuentes/campos permitidos.
- `src/features/ui-tailadmin/TailAdminKpiCard.tsx`: presentación.

Agregación por comuna:

- `src/features/data-import/importStorage.ts`: `aggregateImportedRows`.
- `src/components/Dashboard.tsx`: `mergeComunaMetrics`, `databaseMetrics`, `regionalMapMetrics`.
- `src/features/maps/aggregateClaimsByCommune.ts`.
- Backend: `/api/dashboard/comunas` en `backend/dashboard_api.py`.

Agregación por región:

- `src/components/Dashboard.tsx`: separación `rmData`, `regionesData`, `regionalMapMetrics`.
- `src/features/data-import/detectDatasetScope.ts`.
- Backend: `dataset_scope` en `dashboard_api.py`.

Facturación:

- `src/components/Dashboard.tsx`: totales, mensual, tabla de evidencia, export CSV/XLSX.
- `src/data/dashboardData.ts`: fallback histórico.
- `src/features/data-import/normalizeImportedRows.ts`: `parseMoney`.
- `backend/dashboard_api.py`: SQL de resumen/comunas/reclamos e importación.
- `backend/services/monthly_report.py`: métricas de reporte mensual.

Prioridad:

- `normalizePriority` en `normalizeImportedRows.ts`.
- `normalizeDatabasePriority` en `Dashboard.tsx`.
- SQL de prioridad alta en `dashboard_api.py`.

Tickets únicos:

- `aggregateImportedRows` usa `Set`.
- `dashboard_api.py` usa `COUNT(DISTINCT ticket)`.
- `Dashboard.tsx` recalcula en métricas regionales y tabla.

Normalización de datos importados:

- `normalizeImportedRows.ts`.
- `normalizeRmRows.ts`.
- `normalizeRegionRows.ts`.
- `validateImportedRows.ts`.
- `_clean_import_row` en `backend/dashboard_api.py`.

Archivos nunca deben tocarse sin pruebas:

- `src/components/Dashboard.tsx`.
- `src/features/data-import/*`.
- `src/features/ruta/RutaVisitadorView.tsx`.
- `src/features/ruta/rutaUtils.ts`.
- `src/features/ruta/services/rutaApi.ts`.
- `src/features/maps/*`.
- `src/features/red-zones/*`.
- `src/services/dashboardDatabaseApi.ts`.
- `src/services/dashboardApi.ts`.
- `backend/dashboard_api.py`.
- `backend/main.py`.
- `backend/services/route_optimizer.py`.
- `backend/services/ruta_visitas_service.py`.
- `backend/routes/ai.py`.
- `backend/routes/reports.py`.

## 13. Endpoints detectados

| Módulo | Endpoint | Método | Para qué se usa | Riesgo si se modifica |
|---|---|---|---|---|
| Dashboard | `/api/dashboard/resumen` | GET | KPIs agregados de facturación, reclamos, comunas, prioridad y tickets | Alto: rompe KPIs principales |
| Dashboard | `/api/dashboard/comunas` | GET | Agregación por comuna/región para mapas, tablas y gráficos | Alto: rompe RM/Regiones y mapas |
| Dashboard | `/api/dashboard/reclamos` | GET | Detalle de reclamos para agregación frontend, ruta y reportes | Alto: rompe datos base |
| Dashboard/Ruta | `/api/dashboard/visitas` | GET | Métricas de visitas diarias por territorio | Alto: rompe resumen de ruta y mezcla con dashboard |
| Ruta diaria | `/api/ruta/ticket/{ticket_id}` | GET | Buscar visita por ticket | Alto: rompe carga por ticket |
| Ruta diaria | `/api/ruta/rut/{rut}` | GET | Buscar visita por RUT | Alto: rompe carga por RUT |
| Ruta diaria | `/api/ruta/optimizar` | POST | Optimizar orden de visitas y geometría | Alto: rompe planificación |
| Ruta diaria | `/api/ruta/visitas-diarias` | POST/GET | Guardar/listar visitas diarias | Alto: rompe persistencia de ruta |
| Ruta diaria | `/api/ruta/optimizaciones` | POST/GET | Guardar/listar optimizaciones | Medio/alto: rompe histórico |
| Importador | `/api/importar/reclamos` | POST | Persistir reclamos importados | Alto: rompe importación |
| Importador | `/api/import/reclamos` | POST | Alias de importación | Medio: compatibilidad |
| IA | `/api/ai/chat` | POST | Asistente IA del dashboard | Medio: rompe panel IA |
| IA | `/api/ai/similar-claims` | POST | Buscar reclamos similares | Medio/alto: rompe Reportes IA |
| IA | `/api/ai/similar-claims-summary` | POST | Resumen IA de similares | Medio/alto: rompe Reportes IA |
| IA | `/api/ai/dashboard-summary` | POST | Resumen IA del dashboard | Medio |
| IA | `/api/ai/analyze-comunas` | POST | Análisis IA comunal | Medio |
| IA | `/api/ai/generate-report` | POST | Generación IA de reporte | Medio |
| Reportes | `/api/reports/monthly/preview` | POST | Preview de informe mensual | Alto para Reportes |
| Reportes | `/api/reports/monthly/html` | POST | HTML de informe mensual | Medio/alto |
| Reportes | `/api/reports/monthly/export` | POST | Exporta informe | Medio/alto |
| Reportes | `/api/reports/download/{filename}` | GET | Descarga archivo exportado | Medio |
| Configuración | `/api/config/dashboard-visual` | GET | Carga configuración visual activa | Medio/alto |
| Configuración | `/api/config/dashboard-visual/draft` | POST | Guarda borrador visual | Medio |
| Configuración | `/api/config/dashboard-visual/publish` | POST | Publica configuración visual | Medio/alto |
| Configuración | `/api/config/dashboard-visual/reset` | POST | Resetea configuración activa | Medio |
| Configuración | `/api/config/dashboard-visual/history` | GET | Historial de versiones | Bajo/medio |
| Configuración | `/api/config/dashboard-visual/restore/{config_id}` | POST | Restaura versión visual | Medio |
| Zonas rojas | `/api/red-zones` | GET/POST | Listar/crear zonas activas | Alto para Ruta/Mapa |
| Zonas rojas | `/api/red-zones/{zone_id}` | PUT/DELETE | Editar/eliminar zonas | Alto |
| Zonas rojas | `/api/red-zones/validate-point` | GET | Validar coordenada contra zona roja | Alto para Ruta diaria |
| Zonas rojas | `/api/red-zones/heat-points` | GET | Puntos de calor | Medio |
| Clima | `/api/weather/route` | GET | Clima para ruta | Medio |
| Auth | `/api/auth/login` | POST | Login | Crítico |
| Auth | `/api/auth/me` | GET | Sesión actual | Crítico |
| Auth | `/api/auth/logout` | POST | Logout | Medio |
| Usuarios | `/api/admin/users*` | GET/POST/PUT/DELETE | Administración usuarios/permisos | Alto |
| Geocoding | `/api/geocode/search` | GET | Buscar/corregir dirección | Alto para Ruta |

## 14. Componentes reutilizables

Dashboard:

- Componentes reutilizables: `ExecutiveDashboardLayout`, `TailAdminTopbar`, `TailAdminSidePanel`, `TailAdminKpiCard`, `ConfigurableKpiCard`, `ConfigurableChartCard`, `TerritorialInsightCards`, `AiAssistantPanel`, tabla de evidencia y exportadores.
- Requieren wrapper visual: filtros RM/Regiones, tabla de evidencia, bloques de gráficos hardcodeados en `Dashboard.tsx`.
- No conviene tocar: cálculo de `filteredData`, `databaseMetrics`, `totals`, mapas Leaflet y protección de permisos.

Ruta diaria:

- Componentes reutilizables: `RutaVisitadorView`, `rutaApi`, `rutaUtils`, `routeDailyStorage`, `routeDailyMetrics`, `routeWeatherService`, `ActiveRedZonesLayers`.
- Requieren wrapper visual: cabecera/acciones para encajar en navegación objetivo "Ruta diaria".
- No conviene tocar: payload de optimización, búsqueda por ticket/RUT, cálculo de valorización, validación zona roja.

Reportes:

- Componentes reutilizables: `ReportsView`, `MonthlyReportGenerator`, `ChartBuilder`, `ChartRenderer`, `SimilarClaimsPanel`, `useSavedCharts`.
- Componentes faltantes: vista de biblioteca/reportes más estructurada por periodicidad, historial de exportaciones visible, reportes semanales si se requieren.
- Componentes que se podrían crear después: contenedor de reportes programados, editor de plantillas, tabla de informes generados.

Facturación:

- Componentes reutilizables: tabla de evidencia del Dashboard, `ImportPreviewTable`, `ImportSummaryCards`, exportación CSV/XLSX, `dashboardDatabaseApi`, tipos `DashboardClaim`.
- Componentes faltantes: vista dedicada, tabla editable de datos persistidos, filtros avanzados por factura/tracking/estado, workflow de corrección post-importación.
- Endpoints pendientes: actualización parcial de reclamos, detección backend de duplicados, auditoría de cambios, listado paginado/filtrado para facturación.

Configuraciones:

- Componentes reutilizables: `DesignCenterView`, `KpiBuilder`, `useDesignConfig`, `ComponentEditPanel`, `UserManagementView` si se decide agrupar usuarios.
- Componentes que deberían quedarse: centro de diseño, KPIs personalizados, layout/dashboard visual, preferencias.
- Componentes que deberían moverse: `ReportsView` fuera de Configuraciones para evitar duplicidad.

## 15. Riesgos detectados

- Riesgo de romper importador: alto, porque alimenta Dashboard, Ruta, Reportes y futura Facturación; además mezcla localStorage y backend.
- Riesgo de romper mapas: alto, por dependencias Leaflet, tamaños de contenedor, capas GeoJSON y claves de unión territorial.
- Riesgo de romper RM / Regiones: alto, por `viewMode`, permisos, `dataset_scope`, `scope`, `isRmComuna` y agregaciones.
- Riesgo de romper Ruta diaria: alto, por acoplamiento entre ticket/RUT, geocoding, optimización, zonas rojas, clima, localStorage y backend.
- Riesgo de duplicar componentes: medio/alto; `ReportsView` ya aparece como tab y dentro de Configuraciones.
- Riesgo de inventar módulos falsos: alto para Facturación; todavía no hay vista dedicada, solo piezas reutilizables.
- Riesgo de modificar datos o cálculos sin querer: alto en `Dashboard.tsx`, `importStorage.ts`, `dashboard_api.py`.
- Riesgo de rutas directas en producción: medio; hoy no hay URLs por módulo, por lo que recarga/deep link no existe para tabs.
- Riesgo de autenticación/protección de rutas: alto si se introduce React Router sin preservar `ProtectedView`, `AuthProvider` y permisos por `AppViewKey`.

## 16. Recomendación para Fase 1

Conviene ejecutar primero una Fase 1 de navegación/contenedores, no de lógica. El objetivo debería ser normalizar los cinco tabs futuros usando el sistema actual de `activeTab` antes de introducir rutas URL.

Componentes a reutilizar desde el inicio:

- Dashboard: `ExecutiveDashboardLayout`, filtros, KPIs, mapas, tabla de evidencia.
- Ruta diaria: `RutaVisitadorView` completo.
- Reportes: `ReportsView`, `MonthlyReportGenerator`, `SimilarClaimsPanel`.
- Configuraciones: `DesignCenterView`, `KpiBuilder`.
- Facturación: empezar con una vista nueva solo como contenedor, reutilizando tabla de evidencia/importador de forma controlada.

Módulos listos para rediseño visual:

- Dashboard.
- Ruta diaria.
- Reportes.
- Configuraciones.

Módulos que requieren crear vista nueva:

- Facturación.

Módulos que requieren backend futuro:

- Facturación editable post-importación.
- Duplicados y correcciones persistidas.
- Historial/auditoría de cambios de reclamos.

Archivos que no se deben tocar en la siguiente fase salvo pruebas específicas:

- `backend/dashboard_api.py`.
- `backend/main.py`.
- `src/features/data-import/*`.
- `src/features/ruta/RutaVisitadorView.tsx`.
- `src/features/ruta/rutaUtils.ts`.
- `src/features/ruta/services/rutaApi.ts`.
- `src/features/maps/*`.
- `src/features/red-zones/*`.
- `src/services/dashboardDatabaseApi.ts`.
- `src/services/dashboardApi.ts`.

Fase 1 recomendada: cambiar solo labels, agrupación visual y renderizado de tabs en `Dashboard.tsx`, dejando intactos endpoints, cálculos, importador, mapas, autenticación y modelos de datos.
