# Fase 5 - Persistencia backend de configuracion con versiones

## Archivos cambiados

- `backend/dashboard_api.py`
- `backend/models/__init__.py`
- `src/features/design-center/designStorage.ts`
- `src/features/design-center/useDesignConfig.ts`
- `src/features/design-center/DesignCenterView.tsx`

## Archivos creados

- `backend/models/dashboard_config.py`
- `backend/sql/001_create_dashboard_visual_configs.sql`
- `src/features/design-center/designConfigApi.ts`
- `docs/centro-diseno-fase5-notas.md`

## Nueva tabla: dashboard_visual_configs

| Columna | Tipo | Descripcion |
|---|---|---|
| id | SERIAL PK | ID unico |
| name | VARCHAR(255) | Nombre descriptivo |
| config_json | JSONB NOT NULL | Configuracion visual completa |
| is_active | BOOLEAN DEFAULT false | Solo una version activa a la vez |
| is_draft | BOOLEAN DEFAULT true | Borrador vs publicada |
| version | INTEGER NOT NULL | Version secuencial |
| created_by | VARCHAR(80) NOT NULL | Username de quien creo |
| created_at | TIMESTAMP | Creacion |
| updated_at | TIMESTAMP | Ultima actualizacion |

La tabla se crea automaticamente via SQLAlchemy `Base.metadata.create_all()` en startup.
El archivo `backend/sql/001_create_dashboard_visual_configs.sql` contiene la migracion explícita para produccion.

## Backup requerido

Antes de aplicar migracion en produccion:

```bash
mkdir -p ~/backups-dashboard
docker exec dashboard_postgres pg_dump -U ruta_user -d ruta_dashboard \
  > ~/backups-dashboard/ruta_dashboard_$(date +%Y%m%d_%H%M%S).sql
```

Verificar que el archivo existe y no esta vacio antes de continuar.

## Como aplicar migracion

Opcion A (auto, recomendado):
- La tabla se crea automaticamente al iniciar el backend via `create_database_tables()`.
- No requiere pasos manuales si el backend tiene acceso a la DB.

Opcion B (manual, produccion):
```bash
docker exec -i dashboard_postgres psql -U ruta_user -d ruta_dashboard \
  < backend/sql/001_create_dashboard_visual_configs.sql
```

## Nuevos endpoints backend

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| GET | /api/config/dashboard-visual | Usuario autenticado | Retorna config activa o null |
| POST | /api/config/dashboard-visual/draft | Admin | Guarda borrador |
| POST | /api/config/dashboard-visual/publish | Admin | Valida, desactiva anterior, activa nueva |
| POST | /api/config/dashboard-visual/reset | Admin | Desactiva config activa (no borra historial) |
| GET | /api/config/dashboard-visual/history | Admin | Lista versiones anteriores |
| POST | /api/config/dashboard-visual/restore/{id} | Admin | Restaura version como nueva version activa |

### GET /api/config/dashboard-visual

```json
{"active": {"id": 1, "name": "...", "config": {...}, "isActive": true, "isDraft": false, "version": 1, "createdBy": "admin", "createdAt": "...", "updatedAt": "..."}}
```

O si no hay config activa:

```json
{"active": null}
```

### Validacion backend

Cada `POST` que recibe config ejecuta `_validate_config_body()` que verifica:

- config es objeto JSON
- version es entero
- No contiene claves peligrosas (`__proto__`, `constructor`, `prototype`)
- sections: solo ids permitidos (hero, main, side, bottom), visible es boolean
- widgets: section permitida, size permitido
- kpis: source, aggregation, datasetScope, icon, accent permitidos
- charts: type, source, aggregation, datasetScope, accent permitidos

Config invalida → HTTP 422 con mensaje. No se persiste.

### Permisos admin

- `require_admin` de `auth.security` protege todos los endpoints excepto GET.
- GET requiere solo `get_current_user` (cualquier usuario autenticado puede leer config activa).
- En backend, solo usuarios con role=admin pueden ejecutar acciones de escritura.

## Frontend: cadena de fallback

```
1. Intentar backend → GET /api/config/dashboard-visual
2. Si backend ok y config valida → usar config backend
3. Si backend fail → intentar localStorage
4. Si localStorage ok → usar localStorage
5. Si localStorage fail/null → usar preset default
```

Nunca rompe dashboard. Backend no disponible = misma experiencia que antes.

## Frontend: API client (designConfigApi.ts)

Metodos de fetch con autenticacion via Bearer token de sessionStorage:

- `fetchActiveConfig()` → GET
- `saveDraftConfig(config, name?)` → POST draft
- `publishConfig(config, name?)` → POST publish
- `resetActiveConfig()` → POST reset
- `fetchConfigHistory()` → GET history
- `restoreConfigVersion(configId)` → POST restore/{id}

## Frontend: UI changes

Diseno: badge de fuente (Backend / localStorage / Default) en cabecera.
Muestra version activa y fecha de actualizacion si backend.
Admin-only: botones Guardar borrador, Publicar, Reset backend, Historial.
Historial muestra lista de versiones anteriores con boton Restaurar.

## Estado de inicializacion asincrona

`useDesignConfig` ahora:

1. Inicializa sincronicamente desde localStorage (experiencia inmediata).
2. En useEffect, intenta fetch desde backend.
3. Si backend responde con config valida, reemplaza estado.
4. `backendInitialized` indica si el fetch backend ya completo.
5. `configSource` indica origen actual: backend / localStorage / default.

## Rollback strategy

Si la tabla `dashboard_visual_configs` no existe o hay error:

1. Backend endpoints devuelven 503 (DB error).
2. Frontend catcha el error, ignora backend, usa localStorage/default.
3. Dashboard sigue funcionando sin cambios visibles.
4. Para rollback completo: borrar o renombrar la tabla, o revertir el commit.

Rollback DDL:
```sql
DROP TABLE IF EXISTS dashboard_visual_configs;
```

Esto elimina todas las configs guardadas. Dashboard vuelve a localStorage automaticamente.

## Limitaciones conocidas

- No hay migraciones automatizadas con Alembic: la tabla se crea via `Base.metadata.create_all`.
- No hay soft-delete: reset solo desactiva is_active, no borra filas.
- No hay paginacion en historial: todas las versiones se devuelven en una lista.
- No hay validacion de schema JSON versionada en backend: solo se verifican campos conocidos.
- No se puede editar config activa directamente desde UI del backend (solo reemplazar publicando).
- Los nombres de config (name) son strings libres, no validados semánticamente.
- No se persiste automaticamente cada cambio local: solo cuando admin hace Publish.
