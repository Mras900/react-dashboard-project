from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
import logging

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import desc, inspect, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from auth.models import User
from auth.security import get_current_user, require_admin
from database import engine, get_db
from models.dashboard_config import DashboardVisualConfig


router = APIRouter()
logger = logging.getLogger(__name__)

BASE_IMPORT_COLUMNS = (
    "ticket", "mes", "region", "comuna", "cliente", "prioridad", "estado_visita",
    "fecha_recepcion", "fecha_visita", "facturacion", "promedio", "observacion",
)
EXPANDED_IMPORT_COLUMNS = (
    "ciudad", "retiro_muestra", "tarifa_ruta", "km", "precio_neto", "traslado",
    "precio_neto_traslado", "fecha_envio", "tracking", "valor_envio", "factura",
    "calle", "numero", "source_file_name",
)
IMPORT_COLUMNS = (*BASE_IMPORT_COLUMNS, *EXPANDED_IMPORT_COLUMNS, "dataset_scope")

MIGRATION_COLUMNS: dict[str, str] = {
    "ciudad": "VARCHAR(255)",
    "retiro_muestra": "BOOLEAN",
    "tarifa_ruta": "FLOAT",
    "km": "FLOAT",
    "precio_neto": "FLOAT",
    "traslado": "FLOAT",
    "precio_neto_traslado": "FLOAT",
    "fecha_envio": "VARCHAR(50)",
    "tracking": "VARCHAR(255)",
    "valor_envio": "FLOAT",
    "factura": "VARCHAR(255)",
    "calle": "VARCHAR(255)",
    "numero": "VARCHAR(100)",
    "source_file_name": "VARCHAR(255)",
    "updated_at": "TIMESTAMP",
    "dataset_scope": "VARCHAR(50)",
}


@contextmanager
def _database_connection():
    if engine is None:
        raise RuntimeError("DATABASE_URL no esta configurada. Revisa backend/.env")
    connection = engine.connect()
    try:
        yield connection
        connection.commit()
    except SQLAlchemyError:
        connection.rollback()
        raise
    finally:
        connection.close()


def _get_reclamos_columns() -> set[str]:
    if engine is None:
        return set()
    try:
        return {column["name"] for column in inspect(engine).get_columns("reclamos")}
    except SQLAlchemyError:
        return set()


def _ensure_reclamos_columns(conn: Any) -> set[str]:
    existing = _get_reclamos_columns()
    if not existing:
        return existing
    if engine is not None and engine.url.get_backend_name() == 'sqlite':
        return existing
    for column, column_type in MIGRATION_COLUMNS.items():
        if column in existing:
            continue
        try:
            conn.execute(text(f"ALTER TABLE reclamos ADD COLUMN {column} {column_type}"))
            existing.add(column)
        except SQLAlchemyError:
            continue
    # Backfill dataset_scope for legacy rows
    if "dataset_scope" in existing:
        try:
            conn.execute(text("""
                UPDATE reclamos SET dataset_scope = 'rm'
                WHERE dataset_scope IS NULL AND (
                    LOWER(TRIM(COALESCE(region, ''))) LIKE '%metropolitana%'
                    OR LOWER(TRIM(COALESCE(region, ''))) = 'rm'
                )
            """))
            conn.execute(text("""
                UPDATE reclamos SET dataset_scope = 'regiones'
                WHERE dataset_scope IS NULL
            """))
        except SQLAlchemyError:
            pass
    return existing


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _clean_bool(value: Any) -> bool | None:
    if value in (None, ""):
        return None
    if isinstance(value, bool):
        return value
    text_value = str(value).strip().lower()
    if text_value in {"1", "true", "si", "sí", "s", "yes"}:
        return True
    if text_value in {"0", "false", "no", "n"}:
        return False
    return None


def _clean_number(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as error:
        raise HTTPException(status_code=422, detail=f"Valor numerico invalido: {value}") from error


def _clean_date(value: Any) -> date | datetime | str | None:
    if value in (None, ""):
        return None
    if isinstance(value, (date, datetime)):
        return value
    return str(value).strip() or None


def _build_claim_filters(
    *,
    mes: str | None = None,
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    region: str | None = None,
    comuna: str | None = None,
    prioridad: str | None = None,
    estado: str | None = None,
) -> tuple[str, dict[str, Any]]:
    filters: list[str] = []
    values: dict[str, Any] = {}
    for column, value in (("region", region), ("comuna", comuna), ("mes", mes), ("prioridad", prioridad), ("estado_visita", estado)):
        cleaned = _clean_text(value)
        if cleaned:
            key = f"filter_{column}"
            filters.append(f"LOWER(TRIM({column})) = LOWER(:{key})")
            values[key] = cleaned
    claim_date = "COALESCE(fecha_visita, fecha_recepcion, created_at)"
    if fecha_inicio:
        filters.append(f"{claim_date} >= :fecha_inicio")
        values["fecha_inicio"] = fecha_inicio.isoformat()
    if fecha_fin:
        filters.append(f"{claim_date} <= :fecha_fin")
        values["fecha_fin"] = fecha_fin.isoformat()
    if fecha_inicio and fecha_fin and fecha_inicio > fecha_fin:
        raise HTTPException(status_code=422, detail="fecha_inicio no puede ser posterior a fecha_fin.")
    return (f"WHERE {' AND '.join(filters)}" if filters else "", values)


def _row_as_dict(row: Any | None) -> dict[str, Any] | None:
    return None if row is None else dict(row._mapping)


def _database_unavailable() -> HTTPException:
    return HTTPException(status_code=503, detail="No se pudo conectar a la base de datos configurada.")


_RM_COMUNAS = {
    "SANTIAGO", "CERRILLOS", "CERRO NAVIA", "CONCHALI", "EL BOSQUE",
    "ESTACION CENTRAL", "HUECHURABA", "INDEPENDENCIA", "LA CISTERNA",
    "LA FLORIDA", "LA GRANJA", "LA PINTANA", "LA REINA", "LAS CONDES",
    "LO BARNECHEA", "LO ESPEJO", "LO PRADO", "MACUL", "MAIPU",
    "NUNOA", "PEDRO AGUIRRE CERDA", "PENALOLEN", "PROVIDENCIA",
    "PUDAHUEL", "QUILICURA", "QUINTA NORMAL", "RECOLETA", "RENCA",
    "SAN JOAQUIN", "SAN MIGUEL", "SAN RAMON", "VITACURA",
    "PUENTE ALTO", "PIRQUE", "SAN JOSE DE MAIPO",
    "COLINA", "LAMPA", "TILTIL",
    "SAN BERNARDO", "BUIN", "CALERA DE TANGO", "PAINE",
    "MELIPILLA", "ALHUE", "CURACAVI", "MARIA PINTO", "SAN PEDRO",
    "TALAGANTE", "EL MONTE", "ISLA DE MAIPO", "PADRE HURTADO", "PENAFLOR",
}


def _normalize_name(value: str | None) -> str:
    if not value:
        return ""
    import unicodedata
    return unicodedata.normalize("NFD", value).encode("ascii", "ignore").decode("ascii").strip().upper()


def _is_rm_comuna(comuna: str | None, ciudad: str | None = None) -> bool:
    name = _normalize_name(comuna) or _normalize_name(ciudad) or ""
    if not name:
        return False
    return name in _RM_COMUNAS


def _normalize_region(region: str | None, comuna: str | None = None, ciudad: str | None = None) -> str | None:
    cleaned = _clean_text(region)
    if cleaned:
        return cleaned
    if _is_rm_comuna(comuna, ciudad):
        return "Región Metropolitana"
    return None


def _is_rm_region(region: str | None) -> bool:
    if not region:
        return False
    name = _normalize_name(region)
    return "METROPOLITANA" in name or name == "RM" or "SANTIAGO" in name


def _detect_dataset_scope(
    region: str | None = None,
    comuna: str | None = None,
    ciudad: str | None = None,
    imported_scope: str | None = None,
) -> str:
    if _is_rm_comuna(comuna, ciudad):
        return "rm"
    if _is_rm_region(region):
        return "rm"
    if region:
        return "regiones"
    if imported_scope == "rm":
        return "rm"
    if imported_scope == "regiones":
        return "regiones"
    return "regiones"


def _ensure_dataset_scope_column(conn: Any) -> bool:
    existing = _get_reclamos_columns()
    if "dataset_scope" in existing:
        return False
    try:
        conn.execute(text("ALTER TABLE reclamos ADD COLUMN dataset_scope VARCHAR(50)"))
        return True
    except SQLAlchemyError:
        return False


@router.get("/api/health/db")
def database_health() -> dict[str, bool | str]:
    if engine is None:
        return {"ok": False, "error": "DATABASE_URL no esta configurada", "env_path_checked": str(engine)}
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"ok": True, "database": str(engine.url)}
    except SQLAlchemyError as error:
        return {"ok": False, "error": str(error)}


@router.get("/api/dashboard/resumen")
def dashboard_summary(
    mes: str | None = Query(default=None),
    fecha_inicio: date | None = Query(default=None),
    fecha_fin: date | None = Query(default=None),
    region: str | None = Query(default=None),
    comuna: str | None = Query(default=None),
    prioridad: str | None = Query(default=None),
    estado: str | None = Query(default=None),
) -> dict[str, float | int]:
    where_clause, values = _build_claim_filters(mes=mes, fecha_inicio=fecha_inicio, fecha_fin=fecha_fin, region=region, comuna=comuna, prioridad=prioridad, estado=estado)
    raw_sql = f"""
        SELECT COALESCE(SUM(facturacion), 0) AS facturacion_total,
               COUNT(*) AS reclamos_totales,
               COALESCE(AVG(facturacion), 0) AS promedio_por_reclamo,
               COUNT(DISTINCT NULLIF(TRIM(comuna), '')) AS total_comunas,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(prioridad, ''))) IN ('alta', 'alto', 'high') THEN 1 ELSE 0 END) AS alta_prioridad,
               COUNT(DISTINCT NULLIF(TRIM(ticket), '')) AS tickets_unicos
        FROM reclamos {where_clause}
    """
    try:
        with _database_connection() as conn:
            _ensure_reclamos_columns(conn)
            row = conn.execute(text(raw_sql), values).fetchone()
    except SQLAlchemyError as error:
        raise _database_unavailable() from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    mapped = _row_as_dict(row) or {}
    return {
        "facturacion_total": float(mapped.get("facturacion_total", 0) or 0),
        "reclamos_totales": int(mapped.get("reclamos_totales", 0) or 0),
        "promedio_por_reclamo": float(mapped.get("promedio_por_reclamo", 0) or 0),
        "total_comunas": int(mapped.get("total_comunas", 0) or 0),
        "alta_prioridad": int(mapped.get("alta_prioridad", 0) or 0),
        "tickets_unicos": int(mapped.get("tickets_unicos", 0) or 0),
    }


@router.get("/api/dashboard/comunas")
def dashboard_communes(
    mes: str | None = Query(default=None),
    fecha_inicio: date | None = Query(default=None),
    fecha_fin: date | None = Query(default=None),
    region: str | None = Query(default=None),
    comuna: str | None = Query(default=None),
    prioridad: str | None = Query(default=None),
    estado: str | None = Query(default=None),
) -> list[dict[str, str | float | int | None]]:
    where_clause, values = _build_claim_filters(mes=mes, fecha_inicio=fecha_inicio, fecha_fin=fecha_fin, region=region, comuna=comuna, prioridad=prioridad, estado=estado)
    comuna_expr = "COALESCE(NULLIF(TRIM(comuna), ''), NULLIF(TRIM(ciudad), ''), 'Sin ubicación')"
    region_expr = "COALESCE(NULLIF(TRIM(region), ''), CASE WHEN dataset_scope = 'rm' THEN 'Región Metropolitana' ELSE 'Regiones' END)"
    scope_expr = "COALESCE(NULLIF(TRIM(dataset_scope), ''), CASE WHEN region ILIKE '%metropolitana%' THEN 'rm' ELSE 'regiones' END)"
    value_expr = "COALESCE(facturacion, precio_neto_traslado, precio_neto, 0)"
    average_expr = "COALESCE(promedio, facturacion, precio_neto_traslado, precio_neto, 0)"
    raw_sql = f"""
        SELECT
          {comuna_expr} AS comuna,
          {region_expr} AS region,
          {scope_expr} AS dataset_scope,
          COUNT(*)::int AS reclamos,
          COALESCE(SUM({value_expr}), 0)::float AS facturacion,
          COALESCE(AVG({average_expr}), 0)::float AS promedio,
          SUM(CASE WHEN LOWER(TRIM(COALESCE(prioridad, ''))) IN ('alta', 'alto', 'high') THEN 1 ELSE 0 END)::int AS prioridad_alta
        FROM reclamos {where_clause}
        GROUP BY {comuna_expr}, {region_expr}, {scope_expr}
        ORDER BY reclamos DESC, facturacion DESC
    """
    try:
        with _database_connection() as conn:
            _ensure_reclamos_columns(conn)
            rows = conn.execute(text(raw_sql), values).fetchall()
    except SQLAlchemyError as error:
        logger.exception("Error querying /api/dashboard/comunas")
        raise HTTPException(status_code=500, detail="Error al consultar comunas en la base de datos.") from error
    except RuntimeError as error:
        logger.exception("Database unavailable for /api/dashboard/comunas")
        raise HTTPException(status_code=503, detail=str(error)) from error
    return [
        {
            "comuna": row["comuna"],
            "region": row["region"],
            "dataset_scope": row["dataset_scope"],
            "reclamos": int(row["reclamos"] or 0),
            "facturacion": float(row["facturacion"] or 0),
            "promedio": float(row["promedio"] or 0),
            "prioridad_alta": int(row["prioridad_alta"] or 0),
        }
        for row in (dict(item._mapping) for item in rows)
    ]


@router.get("/api/dashboard/reclamos")
def dashboard_claims(
    region: str | None = Query(default=None),
    comuna: str | None = Query(default=None),
    mes: str | None = Query(default=None),
    prioridad: str | None = Query(default=None),
    estado: str | None = Query(default=None),
    fecha_inicio: date | None = Query(default=None),
    fecha_fin: date | None = Query(default=None),
) -> list[dict[str, Any]]:
    where_clause, values = _build_claim_filters(mes=mes, fecha_inicio=fecha_inicio, fecha_fin=fecha_fin, region=region, comuna=comuna, prioridad=prioridad, estado=estado)
    columns = _get_reclamos_columns()
    order_column = "COALESCE(updated_at, created_at)" if "updated_at" in columns else "created_at"
    raw_sql = f"SELECT * FROM reclamos {where_clause} ORDER BY {order_column} DESC LIMIT 1000"
    try:
        with _database_connection() as conn:
            _ensure_reclamos_columns(conn)
            rows = conn.execute(text(raw_sql), values).fetchall()
    except SQLAlchemyError as error:
        raise _database_unavailable() from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    has_scope_column = "dataset_scope" in _get_reclamos_columns()
    result: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row._mapping)
        raw_region = item.get("region")
        comuna = item.get("comuna")
        ciudad = item.get("ciudad")
        normalized = _normalize_region(raw_region, comuna, ciudad)
        if normalized is not None:
            item["region"] = normalized
        if not has_scope_column or not item.get("dataset_scope"):
            item["dataset_scope"] = _detect_dataset_scope(region=raw_region, comuna=comuna, ciudad=ciudad)
        result.append(item)
    return result


def _extract_import_payload(payload: Any) -> tuple[list[Any], list[str]]:
    if isinstance(payload, list):
        return payload, []
    if isinstance(payload, dict):
        rows = payload.get("rows") or payload.get("reclamos") or []
        detected = payload.get("detected_columns") or payload.get("columnas_detectadas") or []
        if not isinstance(rows, list):
            raise HTTPException(status_code=422, detail="El campo rows debe ser una lista de reclamos.")
        return rows, [str(column) for column in detected] if isinstance(detected, list) else []
    raise HTTPException(status_code=422, detail="El body debe ser una lista de reclamos o un objeto con rows.")


def _clean_import_row(item: dict[str, Any]) -> dict[str, Any]:
    precio_neto = float(_clean_number(item.get("precio_neto")) or 0)
    traslado = float(_clean_number(item.get("traslado")) or 0)
    precio_neto_traslado = _clean_number(item.get("precio_neto_traslado"))
    facturacion = _clean_number(item.get("facturacion"))
    comuna = _clean_text(item.get("comuna"))
    ciudad = _clean_text(item.get("ciudad"))
    raw_region = item.get("region")
    imported_scope = _clean_text(item.get("import_scope")) or _clean_text(item.get("dataset_scope")) or _clean_text(item.get("scope"))
    dataset_scope = _detect_dataset_scope(region=raw_region, comuna=comuna, ciudad=ciudad, imported_scope=imported_scope)
    return {
        "ticket": _clean_text(item.get("ticket")),
        "mes": _clean_text(item.get("mes")),
        "region": _normalize_region(raw_region, comuna, ciudad),
        "ciudad": ciudad,
        "comuna": comuna,
        "cliente": _clean_text(item.get("cliente")),
        "prioridad": _clean_text(item.get("prioridad")),
        "retiro_muestra": _clean_bool(item.get("retiro_muestra")),
        "estado_visita": _clean_text(item.get("estado_visita")),
        "fecha_recepcion": _clean_date(item.get("fecha_recepcion")),
        "fecha_visita": _clean_date(item.get("fecha_visita")),
        "tarifa_ruta": float(_clean_number(item.get("tarifa_ruta")) or 0),
        "km": float(_clean_number(item.get("km")) or 0),
        "precio_neto": precio_neto,
        "traslado": traslado,
        "precio_neto_traslado": float(precio_neto_traslado) if precio_neto_traslado is not None else precio_neto + traslado,
        "facturacion": float(facturacion) if facturacion is not None else float(precio_neto_traslado or precio_neto + traslado or 0),
        "promedio": float(_clean_number(item.get("promedio")) or 0),
        "fecha_envio": _clean_date(item.get("fecha_envio")),
        "tracking": _clean_text(item.get("tracking")),
        "valor_envio": float(_clean_number(item.get("valor_envio")) or 0),
        "observacion": _clean_text(item.get("observacion")),
        "factura": _clean_text(item.get("factura")),
        "calle": _clean_text(item.get("calle")),
        "numero": _clean_text(item.get("numero")),
        "source_file_name": _clean_text(item.get("source_file_name")),
        "dataset_scope": dataset_scope,
    }


def _import_claims_impl(payload: Any = Body(...)) -> dict[str, Any]:
    raw_rows, detected_columns = _extract_import_payload(payload)
    if not raw_rows:
        return {"ok": True, "filas_recibidas": 0, "insertados": 0, "actualizados": 0, "omitidos": 0, "unmapped": 0, "errores": [], "detected_columns": detected_columns, "columnas_detectadas": detected_columns, "message": "Sin filas para importar"}

    rows: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for index, item in enumerate(raw_rows):
        if not isinstance(item, dict):
            errors.append({"row": index + 1, "message": "La fila debe ser un objeto JSON."})
            continue
        cleaned = _clean_import_row(item)
        if not cleaned["ticket"]:
            errors.append({"row": index + 1, "message": "Falta Ticket. La fila fue omitida."})
            continue
        rows.append(cleaned)

    inserted = 0
    updated = 0
    omitted = len(raw_rows) - len(rows)
    unmapped = sum(1 for row in rows if not row.get("comuna") and not row.get("ciudad"))
    now = datetime.utcnow()

    try:
        with _database_connection() as conn:
            existing_columns = _ensure_reclamos_columns(conn)
            writable_columns = [column for column in IMPORT_COLUMNS if column in existing_columns]
            timestamp_columns = [column for column in ("created_at", "updated_at") if column in existing_columns]
            update_columns = [column for column in writable_columns if column != "ticket"] + (["updated_at"] if "updated_at" in existing_columns else [])
            update_assignments = ", ".join(f"{column} = :{column}" for column in update_columns)
            insert_columns = [*writable_columns, *timestamp_columns]
            insert_sql_columns = ", ".join(insert_columns)
            insert_placeholders = ", ".join(f":{column}" for column in insert_columns)

            for row in rows:
                existing = conn.execute(text("SELECT id FROM reclamos WHERE ticket = :ticket LIMIT 1"), {"ticket": row["ticket"]}).fetchone()
                params = {column: row.get(column) for column in writable_columns}
                if "created_at" in timestamp_columns:
                    params["created_at"] = now
                if "updated_at" in existing_columns:
                    params["updated_at"] = now
                if existing and update_assignments:
                    conn.execute(text(f"UPDATE reclamos SET {update_assignments} WHERE id = :id"), {**params, "id": existing._mapping["id"]})
                    updated += 1
                else:
                    conn.execute(text(f"INSERT INTO reclamos ({insert_sql_columns}) VALUES ({insert_placeholders})"), params)
                    inserted += 1
    except SQLAlchemyError as error:
        raise _database_unavailable() from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    ok = bool(rows)
    return {"ok": ok, "filas_recibidas": len(raw_rows), "insertados": inserted, "actualizados": updated, "omitidos": omitted, "unmapped": unmapped, "errores": errors, "detected_columns": detected_columns, "columnas_detectadas": detected_columns, "message": "Importación completada" if ok else "No se importaron filas válidas"}


@router.post("/api/importar/reclamos")
def import_claims(payload: Any = Body(...)) -> dict[str, Any]:
    return _import_claims_impl(payload)


@router.post("/api/import/reclamos")
def import_claims_alias(payload: Any = Body(...)) -> dict[str, Any]:
    return _import_claims_impl(payload)


# ---------------------------------------------------------------------------
# Dashboard Visual Config endpoints
# ---------------------------------------------------------------------------

def _serialize_config(config: DashboardVisualConfig) -> dict[str, Any]:
    return {
        "id": config.id,
        "name": config.name,
        "config": config.config_json,
        "isActive": config.is_active,
        "isDraft": config.is_draft,
        "version": config.version,
        "createdBy": config.created_by,
        "createdAt": config.created_at.isoformat() if config.created_at else None,
        "updatedAt": config.updated_at.isoformat() if config.updated_at else None,
    }


def _next_version(db: Session) -> int:
    latest = db.scalar(select(DashboardVisualConfig.version).order_by(desc(DashboardVisualConfig.version)).limit(1))
    return (latest or 0) + 1


def extract_visual_config(payload: dict) -> dict:
    """Extract visual config from payload supporting multiple formats.

    Accepts:
    - {"name": "...", "config": {...}}        → wrapper format
    - {"name": "...", "config_json": {...}}   → legacy format
    - {"version": 1, "texts": {...}, ...}      → direct config format
    """
    if isinstance(payload.get("config"), dict):
        config = payload["config"]
    elif isinstance(payload.get("config_json"), dict):
        config = payload["config_json"]
    elif isinstance(payload.get("version"), int):
        config = payload
    elif isinstance(payload, dict) and "version" not in payload and "texts" not in payload:
        raise HTTPException(status_code=422, detail="config es requerido (como campo 'config', 'config_json' o directamente)")
    else:
        config = payload

    if not isinstance(config, dict):
        raise HTTPException(status_code=422, detail="config debe ser un objeto JSON")

    if not isinstance(config.get("version"), int):
        config["version"] = 1

    return config


@router.get("/api/config/dashboard-visual")
def get_active_config(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, Any] | dict[str, None]:
    """Return active published config, or null marker if none exists."""
    active = db.scalar(
        select(DashboardVisualConfig).where(
            DashboardVisualConfig.is_active.is_(True)
        ).limit(1)
    )
    if active is None:
        return {"active": None}
    return {"active": _serialize_config(active)}


@router.post("/api/config/dashboard-visual/draft")
def save_draft(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict[str, Any]:
    """Save draft config. Admin only."""
    config = extract_visual_config(payload)
    validated = _validate_config_body(config)
    name = payload.get("name", "") or "Borrador"
    draft = DashboardVisualConfig(
        name=name,
        config_json=validated,
        is_active=False,
        is_draft=True,
        version=_next_version(db),
        created_by=admin.username,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return _serialize_config(draft)


@router.post("/api/config/dashboard-visual/publish")
def publish_config(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict[str, Any]:
    """Validate, deactivate previous active, create new active version. Admin only."""
    config = extract_visual_config(payload)
    validated = _validate_config_body(config)

    current_active = db.scalar(
        select(DashboardVisualConfig).where(
            DashboardVisualConfig.is_active.is_(True)
        ).limit(1)
    )
    if current_active is not None:
        current_active.is_active = False

    name = payload.get("name", "") or "Configuracion publicada"
    published = DashboardVisualConfig(
        name=name,
        config_json=validated,
        is_active=True,
        is_draft=False,
        version=_next_version(db),
        created_by=admin.username,
    )
    db.add(published)
    db.commit()
    db.refresh(published)
    return _serialize_config(published)


@router.post("/api/config/dashboard-visual/reset")
def reset_config(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict[str, str]:
    """Deactivate active config so dashboard falls back to localStorage/default. Admin only.
    Does not delete history."""
    current_active = db.scalar(
        select(DashboardVisualConfig).where(
            DashboardVisualConfig.is_active.is_(True)
        ).limit(1)
    )
    if current_active is not None:
        current_active.is_active = False
        db.commit()
    return {"status": "reset", "message": "Configuracion activa desactivada. Dashboard usara localStorage/default."}


@router.get("/api/config/dashboard-visual/history")
def get_history(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[dict[str, Any]]:
    """Return version list. Admin only. Full JSON omitted from listing."""
    configs = db.scalars(
        select(DashboardVisualConfig).order_by(desc(DashboardVisualConfig.version))
    ).all()
    return [_serialize_config(c) for c in configs]


@router.post("/api/config/dashboard-visual/restore/{config_id}")
def restore_config(
    config_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict[str, Any]:
    """Restore previous config by publishing its JSON as new active version. Admin only."""
    source = db.get(DashboardVisualConfig, config_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Configuracion no encontrada.")

    current_active = db.scalar(
        select(DashboardVisualConfig).where(
            DashboardVisualConfig.is_active.is_(True)
        ).limit(1)
    )
    if current_active is not None:
        current_active.is_active = False

    restored = DashboardVisualConfig(
        name=f"Restaurado: {source.name}",
        config_json=source.config_json,
        is_active=True,
        is_draft=False,
        version=_next_version(db),
        created_by=admin.username,
    )
    db.add(restored)
    db.commit()
    db.refresh(restored)
    return _serialize_config(restored)


def _validate_config_body(config: dict) -> dict:
    """Validate config shape before persisting. Reject unsafe patterns."""
    if not isinstance(config, dict):
        raise HTTPException(status_code=422, detail="config debe ser un objeto JSON.")

    dangerous_keys = {"__proto__", "constructor", "prototype"}
    for key in config:
        if key in dangerous_keys:
            raise HTTPException(status_code=422, detail=f"Clave no permitida: {key}")

    version = config.get("version")
    if not isinstance(version, int):
        config["version"] = 1

    _validate_texts(config.get("texts"))
    _validate_sections(config.get("sections"))
    _validate_widgets(config.get("widgets"))
    _validate_kpis_list(config.get("kpis"))
    _validate_charts_list(config.get("charts"))

    return config


def _validate_texts(texts: Any) -> None:
    if texts is None or not isinstance(texts, dict):
        return
    for key in texts:
        if not isinstance(texts[key], str):
            raise HTTPException(status_code=422, detail=f"texts.{key} debe ser string.")


_ALLOWED_SECTIONS = {"hero", "main", "side", "bottom"}
_ALLOWED_SIZES = {"small", "medium", "large"}


def _validate_sections(sections: Any) -> None:
    if sections is None or not isinstance(sections, list):
        return
    for s in sections:
        if not isinstance(s, dict):
            raise HTTPException(status_code=422, detail="Cada seccion debe ser objeto.")
        if "id" in s and s["id"] not in _ALLOWED_SECTIONS:
            raise HTTPException(status_code=422, detail=f"Seccion no permitida: {s.get('id')}")
        if "visible" in s and not isinstance(s["visible"], bool):
            raise HTTPException(status_code=422, detail="section.visible debe ser boolean.")


def _validate_widgets(widgets: Any) -> None:
    if widgets is None or not isinstance(widgets, list):
        return
    for w in widgets:
        if not isinstance(w, dict):
            raise HTTPException(status_code=422, detail="Cada widget debe ser objeto.")
        if "section" in w and w["section"] not in _ALLOWED_SECTIONS:
            raise HTTPException(status_code=422, detail=f"Widget seccion no permitida: {w.get('section')}")
        if "size" in w and w["size"] not in _ALLOWED_SIZES:
            raise HTTPException(status_code=422, detail=f"Widget tamano no permitido: {w.get('size')}")


_ALLOWED_KPI_SOURCES = {"dashboard_resumen", "dashboard_comunas", "dashboard_reclamos", "dashboard_visitas"}
_ALLOWED_KPI_AGGREGATIONS = {"count", "sum", "average", "max", "min"}
_ALLOWED_KPI_DATASET_SCOPES = {"all", "rm", "regiones"}
_ALLOWED_KPI_ICONS = {"file", "alert", "users", "map", "shield", "chart"}
_ALLOWED_KPI_ACCENTS = {"blue", "red", "cyan", "green", "amber", "slate"}
_ALLOWED_CHART_TYPES = {"bar", "line", "pie"}


def _validate_kpis_list(kpis: Any) -> None:
    if kpis is None or not isinstance(kpis, list):
        return
    for kpi in kpis:
        if not isinstance(kpi, dict):
            raise HTTPException(status_code=422, detail="Cada KPI debe ser objeto.")
        if "source" in kpi and kpi["source"] not in _ALLOWED_KPI_SOURCES:
            raise HTTPException(status_code=422, detail=f"KPI source no permitido: {kpi.get('source')}")
        if "aggregation" in kpi and kpi["aggregation"] not in _ALLOWED_KPI_AGGREGATIONS:
            raise HTTPException(status_code=422, detail=f"KPI aggregation no permitida: {kpi.get('aggregation')}")
        if "datasetScope" in kpi and kpi["datasetScope"] not in _ALLOWED_KPI_DATASET_SCOPES:
            raise HTTPException(status_code=422, detail=f"KPI datasetScope no permitido: {kpi.get('datasetScope')}")
        if "icon" in kpi and kpi["icon"] not in _ALLOWED_KPI_ICONS:
            raise HTTPException(status_code=422, detail=f"KPI icon no permitido: {kpi.get('icon')}")
        if "accent" in kpi and kpi["accent"] not in _ALLOWED_KPI_ACCENTS:
            raise HTTPException(status_code=422, detail=f"KPI accent no permitido: {kpi.get('accent')}")


_ALLOWED_CHART_SOURCES = _ALLOWED_KPI_SOURCES


def _validate_charts_list(charts: Any) -> None:
    if charts is None or not isinstance(charts, list):
        return
    for chart in charts:
        if not isinstance(chart, dict):
            raise HTTPException(status_code=422, detail="Cada grafico debe ser objeto.")
        if "type" in chart and chart["type"] not in _ALLOWED_CHART_TYPES:
            raise HTTPException(status_code=422, detail=f"Chart type no permitido: {chart.get('type')}")
        if "source" in chart and chart["source"] not in _ALLOWED_CHART_SOURCES:
            raise HTTPException(status_code=422, detail=f"Chart source no permitido: {chart.get('source')}")
        if "aggregation" in chart and chart["aggregation"] not in _ALLOWED_KPI_AGGREGATIONS:
            raise HTTPException(status_code=422, detail=f"Chart aggregation no permitida: {chart.get('aggregation')}")
        if "datasetScope" in chart and chart["datasetScope"] not in _ALLOWED_KPI_DATASET_SCOPES:
            raise HTTPException(status_code=422, detail=f"Chart datasetScope no permitido: {chart.get('datasetScope')}")
        if "accent" in chart and chart["accent"] not in _ALLOWED_KPI_ACCENTS:
            raise HTTPException(status_code=422, detail=f"Chart accent no permitido: {chart.get('accent')}")


