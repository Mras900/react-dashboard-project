# Fase 2 - Orden y visibilidad de secciones/cards

## Archivos cambiados

- `src/features/design-center/designTypes.ts`
- `src/features/design-center/defaultDesignPreset.ts`
- `src/features/design-center/designStorage.ts`
- `src/features/design-center/useDesignConfig.ts`
- `src/features/design-center/DesignCenterView.tsx`
- `src/features/design-center/safeOptions.ts`
- `src/features/design-center/LayoutSettings.tsx`
- `src/features/design-center/CardSettings.tsx`
- `src/components/Dashboard.tsx`
- `docs/centro-diseno-fase2-notas.md`

## Secciones

El layout configurable usa solo secciones conocidas: `hero`, `main`, `side`, `bottom`.
Cada seccion permite renombrar label, show/hide y mover arriba/abajo. Sin config guardada ni preview, `Dashboard.tsx` conserva la ruta original.

## Cards/KPIs

Cada widget conocido permite show/hide, mover arriba/abajo dentro de su seccion, cambiar seccion permitida y tamano seguro `small`, `medium`, `large`.
No cambia formulas ni datos. KPIs personalizados existentes se mantienen en `bottom` cuando hay layout activo.

## Reset layout only

`Reset layout` restaura solo `sections` y `widgets` del preset protegido. Textos y tokens visuales se conservan hasta guardar, preview o cancelar.

## Verificacion manual

1. Borrar `dashboard-visual-config-v1` y recargar: dashboard usa ruta original sin renderer configurable.
2. En Configuraciones -> Centro de diseno, ocultar una seccion y usar Vista previa.
3. Mover una seccion arriba/abajo y guardar.
4. Mover una card entre secciones, cambiar tamano y guardar.
5. Usar Reset layout y verificar que orden/visibilidad/tamanos vuelven al preset.
6. Ejecutar en DevTools:

```js
localStorage.setItem('dashboard-visual-config-v1', '{invalid-json')
```

7. Recargar: no debe crashear, la key debe limpiarse y el dashboard debe renderizar original.

## Limitaciones conocidas

- No drag and drop aun.
- No persistencia backend aun.
- No chart manager aun.
- No KPI manager nuevo aun.