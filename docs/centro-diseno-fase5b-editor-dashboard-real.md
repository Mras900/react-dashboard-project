# Fase 5B - Correccion de enfoque: editor visual del dashboard real

## Problema original

Centro de diseno tenia constructores de KPI y grafico como objetivo principal.
Esto creaba un dashboard paralelo en vez de modificar el existente.

## Solucion

Convertir Centro de diseno en editor de componentes reales del dashboard.
Cada elemento visual tiene ID estable. Config controla visible, seccion, orden, tamano, titulo, subtitulo y color.

## Archivos cambiados

- `src/features/design-center/designTypes.ts`
- `src/features/design-center/defaultDesignPreset.ts`
- `src/features/design-center/designStorage.ts`
- `src/features/design-center/safeOptions.ts`
- `src/features/design-center/DesignCenterView.tsx`
- `src/components/Dashboard.tsx`

## Archivos creados

- `src/features/design-center/ComponentSettings.tsx`
- `docs/centro-diseno-fase5b-editor-dashboard-real.md`

## IDs de componentes estables

| ID | Componente real | Grupo |
|---|---|---|
| header | Encabezado (topbar + titulo) | Estructura |
| filters | Barra de filtros operativos | Estructura |
| left-kpi-facturacion | Card Facturacion total | Indicadores |
| left-kpi-reclamos | Card Reclamos totales | Indicadores |
| left-kpi-promedio | Card Promedio por reclamo | Indicadores |
| main-map | Mapa de reclamos Leaflet | Mapa |
| right-summary | Panel resumen operativo (top reclamos, facturacion, cobertura) | Resumen |
| card-total-comunas | Stat card Total comunas | Stats |
| card-alta-prioridad | Stat card Alta prioridad | Stats |
| card-periodo | Stat card Periodo analizado | Stats |
| card-tickets | Stat card Tickets unicos | Stats |
| chart-facturacion-mensual | Grafico Facturacion mensual | Graficos |
| chart-top-reclamos | Grafico Top 10 comunas reclamos | Graficos |
| chart-top-facturacion | Grafico Top 10 comunas facturacion | Graficos |
| chart-prioridad | Grafico Distribucion por prioridad | Graficos |
| table-evidencia | Tabla de evidencia por comuna | Tabla |
| route-visitador | Modulo Ruta Visitador | Ruta |

## Que controla cada componente

- **visible**: ocultar/mostrar del dashboard real
- **section**: hero / main / side / bottom
- **order**: orden entre componentes
- **size**: small / medium / large / full (nuevo tamano completo)
- **accent**: color de acento opcional
- **title**: titulo visible
- **subtitle**: subtitulo visible

## Constructores movidos a "Avanzado"

KpiSettings y ChartSettings ahora estan dentro de seccion colapsable "Avanzado".
Abierta solo si usuario hace click. No visibles por defecto.

## Header controlado por config

`isComponentVisible('header')` controla si TailAdminTopbar se renderiza.
`getComponentTitle('header', ...)` provee titulo desde config.

## Backward compatibility

- `widgets` array existe en config pero no es el foco principal
- `kpis` y `charts` arrays preservados para datos de constructores avanzados
- Componentes nuevos tienen sus propios IDs separados de los viejos widget IDs
- Mapa `designComponentById` para acceso O(1) desde Dashboard.tsx

## Persistencia

Misma cadena de Fase 5: backend → localStorage → default.
Componentes se guardan dentro del mismo JSON de config.

## Tamano "full"

Nuevo `DesignComponentSize` tipo incluye `'full'`.
Usado para componentes que deben ocupar ancho completo (header, filters).

## Limitaciones

- Dashboard.tsx usa config de componente solo para header visibility/title.
- Widgets del dashboard array se siguen renderizando como antes.
- No hay wrap condicional de filtros aun (filters siempre visible si header visible).
- No hay apply de tamaño/acento a componentes individuales via CSS.
- Constructores en Avanzado siguen funcionales pero ocultos por defecto.
