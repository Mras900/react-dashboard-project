# Fase 1 - Centro de diseno basico con localStorage

## Alcance

- Configuracion visual montada dentro de Configuraciones.
- Persistencia local en `dashboard-visual-config-v1`.
- Sin backend, DB, drag and drop, `DashboardLayoutGrid`, mapas, importaciones ni endpoints nuevos.
- Sin JavaScript arbitrario, `eval`, `Function`, CSS libre ni `dangerouslySetInnerHTML`.

## Verificacion manual: localStorage corrupto

1. Iniciar sesion y abrir dashboard.
2. En DevTools, ejecutar:

```js
localStorage.setItem('dashboard-visual-config-v1', '{invalid-json')
```

3. Recargar pagina.
4. Verificar que dashboard no crashea.
5. Verificar que `localStorage.getItem('dashboard-visual-config-v1')` devuelve `null`.
6. Verificar que dashboard original renderiza sin configuracion aplicada.

## Aceptacion manual sugerida

1. Sin key guardada, dashboard carga por ruta original.
2. En Configuraciones, cambiar titulo y usar Vista previa.
3. Verificar que titulo cambia solo con preview activa o guardado.
4. Ocultar un KPI conocido y verificar que layout sigue estable.
5. Usar Restaurar diseno por defecto y verificar que la key se borra.
