# Hotfix 422 publish - version definitivo

## Causa raiz

Backend `save_draft` / `publish` usaba `name: str = ""` (query param) + `config: dict = Body(...)`.
FastAPI asigna todo el body JSON a `config`. `name` en body no se parseaba.
Frontend enviaba wrapper `{ name, config }`. Backend veia `config = { name, config }`.
`_validate_config_body()` buscaba `version` en raiz → wrapper → no encontraba → 422.

## Correccion frontend

`designConfigApi.ts`: `saveDraftConfig` y `publishConfig`:

- Normalizan config con `normalizeForBackend()` → version=1 si falta
- Envian body como `{ name, config: safeConfig }`
- Guard `Number.isInteger(version)` antes de fetch

## Correccion backend

`dashboard_api.py`:

- Nueva funcion `extract_visual_config(payload)`:
  - Acepta `{ name, config }` wrapper
  - Acepta `{ name, config_json }` legacy
  - Acepta config directo `{ version, texts, ... }`
  - Auto-asigna `version = 1` si no es entero
- Endpoints cambian a `payload: dict = Body(...)` y extraen config via `extract_visual_config`
- `name` se lee de `payload.get("name", "")`
- `_validate_config_body` ya no rechaza version faltante → auto-asigna 1

## Payload correcto

```json
{
  "name": "Dashboard visual",
  "config": {
    "version": 1,
    "texts": { ... },
    "tokens": { ... },
    "sections": [ ... ],
    "components": [ ... ],
    "widgets": [ ... ],
    "kpis": [ ... ],
    "charts": [ ... ]
  }
}
```

## Archivos modificados

- `src/features/design-center/designConfigApi.ts`
- `backend/dashboard_api.py`
- `docs/centro-diseno-hotfix-422-publish-version.md`

## Prueba manual

1. Login admin.
2. Modo edicion inline → ocultar componente → Publicar → 200 OK.
3. Configuracion → Centro de diseno → Publicar → 200 OK.
4. Si backend caido → dashboard no se rompe (fallback localStorage).
5. `GET /api/config/dashboard-visual` → retorna config publicada.
