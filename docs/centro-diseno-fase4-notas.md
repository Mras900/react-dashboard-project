# Fase 4 - Manager de graficos configurables

## Archivos cambiados

- `src/features/design-center/designTypes.ts`
- `src/features/design-center/defaultDesignPreset.ts`
- `src/features/design-center/designStorage.ts`
- `src/features/design-center/useDesignConfig.ts`
- `src/features/design-center/DesignCenterView.tsx`
- `src/components/Dashboard.tsx`

## Archivos creados

- `src/features/design-center/chartRegistry.ts`
- `src/features/design-center/chartDataAdapters.ts`
- `src/features/design-center/ChartSettings.tsx`
- `src/features/design-center/ConfigurableChartCard.tsx`
- `docs/centro-diseno-fase4-notas.md`

## Como funciona la creacion de graficos

El manager vive en Configuraciones -> Centro de diseno. Permite crear un grafico desde dropdowns seguros:

1. Click "Crear Grafico".
2. Seleccionar tipo: Barras / Linea / Torta.
3. Seleccionar fuente de datos.
4. Seleccionar campo Eje X (categorico).
5. Seleccionar campo Eje Y (numerico).
6. Seleccionar agregacion: count / sum / average / max / min.
7. Configurar visibilidad, seccion, tamano, color y orden.
8. Usar Vista previa para ver el grafico antes de guardar.

## Como funciona la edicion de graficos

Cada grafico configurable muestra todos sus campos editables:

- titulo
- subtitulo
- tipo (bar / line / pie)
- fuente
- campo X
- campo Y
- agregacion
- dataset_scope filter
- visible
- seccion
- orden
- tamano (small / medium / large)
- color/accent

## Duplicacion

Duplicar crea un grafico custom `customConfigChart:*`. El grafico original protegido queda intacto.

## Fuentes y campos permitidos

Definidos en `chartRegistry.ts`. Cada fuente tiene campos X (categoricos) y Y (numericos) separados:

| Fuente | Campos X | Campos Y |
|---|---|---|
| dashboard_resumen | field (auto) | value (auto) |
| dashboard_comunas | comuna, region, dataset_scope | reclamos, facturacion, promedio, prioridad_alta |
| dashboard_reclamos | mes, region, comuna, ciudad, cliente, prioridad, estado_visita, ticket | tarifa_ruta, km, precio_neto, traslado, precio_neto_traslado, valor_envio, facturacion, promedio, reclamos |
| dashboard_visitas | por_comuna.nombre, por_region.nombre | kpis.*, por_comuna.*, por_region.* (visitas, tickets, facturacion) |

No se usan campos fuera de los documentados en `docs/centro-diseno-auditoria.md`.

## Datos invalidos o faltantes

`Sin datos` se muestra si:
- La fuente no existe o es null.
- El campo X o Y no existe en los datos.
- No hay datos tras aplicar filtro dataset_scope.
- La agregacion devuelve 0 registros.
- La estructura de datos es inesperada.

No se lanzan errores. No se rompe el dashboard.

## Graficos default protegidos

| ID | Tipo | Fuente | X | Y | Agg |
|---|---|---|---|---|---|
| chartGraficoFacturacionMensual | line | dashboard_reclamos | mes | facturacion | sum |
| chartTopComunasReclamos | bar | dashboard_comunas | comuna | reclamos | sum |
| chartTopComunasFacturacion | bar | dashboard_comunas | comuna | facturacion | sum |
| chartDistribucionPrioridad | pie | dashboard_reclamos | prioridad | ticket | count |

Son `protected: true`. Se pueden ocultar o duplicar, pero no eliminar permanentemente.

## Reset de graficos

`Reset Graficos` restaura las definiciones de graficos del preset protegido. Conserva textos, tokens, layout y KPIs.

## Vista previa

Cuando `Vista previa` esta activa, cada grafico en ChartSettings muestra una miniatura del grafico renderizado con datos reales. Los datos provienen de `configurableKpiDataSources` (mismos datos que el dashboard).

## Renderizado

Los graficos se renderizan con `recharts` (dependencia existente) en `ConfigurableChartCard.tsx`. Los tipos soportados:

- **bar**: `BarChart` con barras verticales, ordenado por valor descendente.
- **line**: `LineChart` con puntos y linea monotona.
- **pie**: `PieChart` con labels de porcentaje.

Colores: palette segun acent seleccionado (blue/red/cyan/green/amber/slate).

## Integracion con dashboard

Los graficos configurables se renderizan como widgets adicionales cuando hay config activa. No reemplazan los widgets de grafico existentes. Usuarios pueden ocultar los widgets existentes via CardSettings.

El orden base de graficos configurables es `500 + chart.order` para que aparezcan despues de los widgets nativos y KPIs custom.

## Limitaciones conocidas

- No backend persistence aun.
- No formulas custom.
- No SQL.
- No drag and drop.
- No codigo de grafico arbitrario.
- No expresiones evaluables.
- No JavaScript/Function constructor/eval.
- dashboard_resumen solo expone un campo X/Y sintetico (field/value) para graficar todas las metricas como barras.
- Los graficos de dashboard_visitas requieren rutas con punto (por_comuna.nombre, kpis.tickets).
- No se pueden seleccionar campos X e Y de diferentes sub-estructuras de dashboard_visitas (e.g., X de por_comuna, Y de kpis).
