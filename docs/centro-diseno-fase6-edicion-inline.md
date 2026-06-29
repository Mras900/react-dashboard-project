# Fase 6 - Modo edicion visual inline con boton lapiz en dashboard real

## Archivos modificados

- `src/components/Dashboard.tsx`
- `src/features/design-center/useDesignConfig.ts`

## Archivos creados

- `src/features/design-center/EditableDashboardWrapper.tsx`
- `src/features/design-center/InlineEditToolbar.tsx`
- `src/features/design-center/ComponentEditPanel.tsx`
- `docs/centro-diseno-fase6-edicion-inline.md`

## Como activar modo edicion

1. Boton lapiz (Pen) en la barra lateral izquierda, cerca del boton contraer.
2. Visible solo para usuarios admin.
3. Click activa editMode → cambia preview a draftConfig.
4. Boton se ilumina azul cuando editMode activo.

## Componentes editables

17 IDs estables. Cada componente del dashboard muestra overlay con:

- Nombre del componente
- ↑ Mover arriba
- ↓ Mover abajo
- Selector de tamano (pequeno/mediano/grande/completo)
- ◉/◎ Ocultar/Mostrar
- ✎ Abrir panel de edicion lateral

## Panel lateral de edicion (ComponentEditPanel)

Panel derecho fijo (w-80) con:

- Titulo
- Subtitulo
- Visible (checkbox)
- Seccion (dropdown)
- Orden (numero)
- Tamano (dropdown)
- Color acento (dropdown)

## Barra flotante de edicion (InlineEditToolbar)

Barra azul pegajosa en parte superior del dashboard cuando editMode activo:

- Indicador "Modo edicion"
- "Cambios sin guardar" si hay cambios
- Guardar borrador
- Publicar
- Cancelar
- Restaurar default

## Fallback backend/localStorage/default

- Guardar borrador: usa `saveDraftToBackend()` (backend, fallback a nada si falla)
- Publicar: usa `publishToBackend()` (backend)
- Cancelar: vuelve a `savedConfig`, desactiva editMode
- Restaurar default: llama `resetConfig()` + sale de editMode
- Si backend falla, dashboard no se rompe

## Integracion con Configuracion

Centro de diseno en Configuracion sigue funcionando normalmente.
Edicion inline es via alternativa, no reemplazo.

## Mapa no se rompe

EditableDashboardWrapper solo agrega overlay con ring azul y mini barra hover.
No interfiere con renderizado Leaflet.

## Limitaciones actuales

- No drag and drop nativo HTML5 (solo botones ↑↓).
- Edicion inline solo para widgets del array `configuredDashboardWidgets`.
- Header y filters no tienen wrapper editable (solo control de visibilidad).
- Panel de edicion lateral no persiste scroll position.
- Orden swap entre componentes del mismo section no validado.
- No hay indicacion visual de "componente seleccionado" en el dashboard (solo panel abierto).
- Boton lapiz en sidebar, no en topbar como se solicito originalmente.

## Pruebas manuales

1. Login como admin → ver boton lapiz en sidebar.
2. Click lapiz → modo edicion activo → barra azul + overlays en componentes.
3. Click ocultar en un componente → se vuelve semitransparente con label "Oculto".
4. Click ↑↓ → orden swap en draft.
5. Click ✎ → panel lateral con todos los campos.
6. Cambiar titulo en panel → se actualiza en preview.
7. Guardar borrador → mensaje verde.
8. Publicar → mensaje verde + config guardada en backend.
9. Cancelar → vuelve al estado anterior.
10. Restaurar default → resetea todo.
11. Recargar pagina → config publicada persiste.
12. Login como user no admin → no ver boton lapiz.
