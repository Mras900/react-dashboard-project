from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Query
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from database import engine


router = APIRouter()

BASE_IMPORT_COLUMNS = (
    "ticket", "mes", "region", "comuna", "cliente", "prioridad", "estado_visita",
    "fecha_recepcion", "fecha_visita", "facturacion", "promedio", "observacion",
)
EXPANDED_IMPORT_COLUMNS = (
    "ciudad", "retiro_muestra", "tarifa_ruta", "km", "precio_neto", "traslado",
    "precio_neto_traslado", "fecha_envio", "tracking", "valor_envio", "factura",
    "calle", "numero", "source_file_name",
)
IMPORT_COLUMNS = (*BASE_IMPORT_COLUMNS, *EXPANDED_IMPORT_COLUMNS)

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
    columns = _get_reclamos_columns()
    comuna_expr = "COALESCE(NULLIF(TRIM(comuna), ''), NULLIF(TRIM(ciudad), ''), 'Sin comuna')" if "ciudad" in columns else "COALESCE(NULLIF(TRIM(comuna), ''), 'Sin comuna')"
    raw_sql = f"""
        SELECT {comuna_expr} AS comuna,
               COALESCE(NULLIF(TRIM(region), ''), 'Región Metropolitana') AS region,
               COUNT(*) AS reclamos,
               COALESCE(SUM(facturacion), 0) AS facturacion,
               COALESCE(AVG(facturacion), 0) AS promedio,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(prioridad, ''))) IN ('alta', 'alto', 'high') THEN 1 ELSE 0 END) AS prioridad_alta
        FROM reclamos {where_clause}
        GROUP BY {comuna_expr}, COALESCE(NULLIF(TRIM(region), ''), 'Región Metropolitana')
        ORDER BY reclamos DESC, facturacion DESC
    """
    try:
        with _database_connection() as conn:
            _ensure_reclamos_columns(conn)
            rows = conn.execute(text(raw_sql), values).fetchall()
    except SQLAlchemyError as error:
        raise _database_unavailable() from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return [
        {
            "comuna": row["comuna"],
            "region": row["region"],
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
    return [dict(row._mapping) for row in rows]


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
    return {
        "ticket": _clean_text(item.get("ticket")),
        "mes": _clean_text(item.get("mes")),
        "region": _clean_text(item.get("region")),
        "ciudad": _clean_text(item.get("ciudad")),
        "comuna": _clean_text(item.get("comuna")),
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


