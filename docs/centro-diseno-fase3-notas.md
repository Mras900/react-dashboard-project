# Fase 3 - Manager de KPIs configurables simples

## Archivos cambiados

- `src/features/design-center/designTypes.ts`
- `src/features/design-center/defaultDesignPreset.ts`
- `src/features/design-center/designStorage.ts`
- `src/features/design-center/useDesignConfig.ts`
- `src/features/design-center/DesignCenterView.tsx`
- `src/features/design-center/KpiSettings.tsx`
- `src/features/design-center/kpiRegistry.ts`
- `src/features/design-center/kpiCalculations.ts`
- `src/features/design-center/ConfigurableKpiCard.tsx`
- `src/components/Dashboard.tsx`

## Como funciona la edicion de KPIs

El manager vive en Configuraciones -> Centro de diseno. Permite editar titulo, descripcion, icono seguro, color seguro, visibilidad, seccion, orden, tamano, fuente, campo, agregacion y filtro `dataset_scope`.

## Duplicacion

Duplicar crea un KPI custom `customConfigKpi:*`. El KPI original protegido queda intacto.

## Creacion custom

Crear KPI genera una definicion custom desde dropdowns seguros: fuente, campo, agregacion, filtro, icono, color, seccion y tamano. No hay formulas, SQL ni codigo editable.

## Fuentes y campos permitidos

Fuentes: `dashboard_resumen`, `dashboard_comunas`, `dashboard_reclamos`, `dashboard_visitas`.
Campos: solo los documentados en `docs/centro-diseno-auditoria.md` y listados en `kpiRegistry.ts`.

## Datos invalidos o faltantes

`count` devuelve 0 si no hay datos. `sum`, `average`, `max` y `min` devuelven 0 o `Sin datos` si la fuente/campo no existe, viene vacio o trae valores no numericos. No se lanzan errores.

## Proteccion de KPIs default

Los KPIs default tienen `protected: true`. Se pueden ocultar o duplicar, pero no eliminar. Solo KPIs custom pueden borrarse.

## Reset KPI config

`Reset KPIs` restaura definiciones KPI del preset protegido y conserva textos, tokens y layout general.

## Limitaciones conocidas

- No chart manager aun.
- No persistencia backend aun.
- No formulas custom.
- No SQL.
- No drag and drop.