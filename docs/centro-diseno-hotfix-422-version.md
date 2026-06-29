# Hotfix 422 - config.version requerido

## Causa

Backend endpoint POST `/api/config/dashboard-visual/draft` y `/publish` reciben `config` via `Body()`.
Frontend enviaba `{ name, config }` como body completo. FastAPI asigna todo el body a `config`.
El objeto recibido era `{ name: "...", config: { version: 1, ... } }`.
`_validate_config_body()` buscaba `version` en raiz del body → no existia → 422.

## Archivos modificados

- `src/features/design-center/designConfigApi.ts`
- `src/features/design-center/useDesignConfig.ts`
- `src/features/design-center/designTypes.ts`
- `src/features/design-center/defaultDesignPreset.ts`
- `docs/centro-diseno-hotfix-422-version.md`

## Cambios

### designConfigApi.ts

`saveDraftConfig` y `publishConfig` ahora envian:

- Body HTTP = config directamente (sin wrapper `{ name, config }`)
- `name` como query param: `/api/config/dashboard-visual/draft?name=Borrador`

Antes:
```json
body: JSON.stringify({ name: "Borrador", config: { version: 1, ... } })
```

Ahora:
```json
body: JSON.stringify({ version: 1, ... })
url: /api/config/dashboard-visual/draft?name=Borrador
```

### useDesignConfig.ts

Guard de version antes de llamar backend:

```ts
if (!Number.isInteger(normalized.version)) {
  return { ok: false, error: 'Error interno: config.version no es entero' };
}
```

### designTypes.ts

Export `CURRENT_DESIGN_CONFIG_VERSION = 1` como unica fuente de verdad.

### defaultDesignPreset.ts

Usa `CURRENT_DESIGN_CONFIG_VERSION` en vez de hardcoded `1`.

## Prueba manual

1. Login como admin.
2. Click boton lapiz en sidebar → modo edicion.
3. Ocultar un componente, cambiar tamano.
4. Click "Guardar borrador" → debe responder OK, no 422.
5. Click "Publicar" → debe responder OK, no 422.
6. Recargar pagina → cambios persisten.
7. Abrir Configuracion → Centro de diseno → modificar algo → Guardar → OK.
