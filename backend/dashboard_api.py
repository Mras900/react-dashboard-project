from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Query
from psycopg2 import DatabaseError
from psycopg2.extras import RealDictCursor, execute_values

from db import get_connection


router = APIRouter()

IMPORT_COLUMNS = (
    "ticket",
    "mes",
    "region",
    "comuna",
    "cliente",
    "prioridad",
    "estado_visita",
    "fecha_recepcion",
    "fecha_visita",
    "facturacion",
    "promedio",
    "observacion",
)

@contextmanager
def _database_connection():
    connection = get_connection()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _clean_number(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as error:
        raise HTTPException(status_code=422, detail=f"Valor numérico inválido: {value}") from error


def _clean_date(value: Any) -> date | datetime | str | None:
    if value in (None, ""):
        return None
    if isinstance(value, (date, datetime)):
        return value
    return str(value).strip() or None


def _database_error() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail="No se pudo consultar la base de datos configurada.",
    )


@router.get("/api/health/db")
def database_health() -> dict[str, bool | str]:
    try:
        with _database_connection() as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("SELECT current_database() AS database, current_user AS user")
                row = cursor.fetchone()
    except (DatabaseError, RuntimeError) as error:
        raise _database_error() from error

    return {
        "ok": True,
        "database": str(row["database"]),
        "user": str(row["user"]),
    }


@router.get("/api/dashboard/resumen")
def dashboard_summary() -> dict[str, float | int]:
    query = """
        SELECT
            COALESCE(SUM(facturacion), 0) AS facturacion_total,
            COUNT(*) AS reclamos_totales,
            COALESCE(AVG(facturacion), 0) AS promedio_por_reclamo,
            COUNT(DISTINCT NULLIF(BTRIM(comuna), '')) AS total_comunas,
            COUNT(*) FILTER (
                WHERE LOWER(BTRIM(COALESCE(prioridad, ''))) IN ('alta', 'alto', 'high')
            ) AS alta_prioridad,
            COUNT(DISTINCT NULLIF(BTRIM(ticket), '')) AS tickets_unicos
        FROM reclamos
    """
    try:
        with _database_connection() as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query)
                row = cursor.fetchone()
    except (DatabaseError, RuntimeError) as error:
        raise _database_error() from error

    return {
        "facturacion_total": float(row["facturacion_total"] or 0),
        "reclamos_totales": int(row["reclamos_totales"] or 0),
        "promedio_por_reclamo": float(row["promedio_por_reclamo"] or 0),
        "total_comunas": int(row["total_comunas"] or 0),
        "alta_prioridad": int(row["alta_prioridad"] or 0),
        "tickets_unicos": int(row["tickets_unicos"] or 0),
    }


@router.get("/api/dashboard/comunas")
def dashboard_communes() -> list[dict[str, str | float | int | None]]:
    query = """
        SELECT
            COALESCE(NULLIF(BTRIM(comuna), ''), 'Sin comuna') AS comuna,
            NULLIF(BTRIM(region), '') AS region,
            COUNT(*) AS reclamos,
            COALESCE(SUM(facturacion), 0) AS facturacion,
            COALESCE(AVG(facturacion), 0) AS promedio,
            COUNT(*) FILTER (
                WHERE LOWER(BTRIM(COALESCE(prioridad, ''))) IN ('alta', 'alto', 'high')
            ) AS prioridad_alta
        FROM reclamos
        GROUP BY
            COALESCE(NULLIF(BTRIM(comuna), ''), 'Sin comuna'),
            NULLIF(BTRIM(region), '')
        ORDER BY reclamos DESC, facturacion DESC
    """
    try:
        with _database_connection() as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()
    except (DatabaseError, RuntimeError) as error:
        raise _database_error() from error

    return [
        {
            "comuna": row["comuna"],
            "region": row["region"],
            "reclamos": int(row["reclamos"] or 0),
            "facturacion": float(row["facturacion"] or 0),
            "promedio": float(row["promedio"] or 0),
            "prioridad_alta": int(row["prioridad_alta"] or 0),
        }
        for row in rows
    ]


@router.get("/api/dashboard/reclamos")
def dashboard_claims(
    region: str | None = Query(default=None),
    comuna: str | None = Query(default=None),
    mes: str | None = Query(default=None),
    prioridad: str | None = Query(default=None),
) -> list[dict[str, Any]]:
    filters: list[str] = []
    values: list[str] = []

    for column, value in (
        ("region", region),
        ("comuna", comuna),
        ("mes", mes),
        ("prioridad", prioridad),
    ):
        cleaned = _clean_text(value)
        if cleaned:
            filters.append(f"LOWER(BTRIM({column})) = LOWER(%s)")
            values.append(cleaned)

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
    query = f"""
        SELECT *
        FROM reclamos
        {where_clause}
        ORDER BY created_at DESC
        LIMIT 1000
    """

    try:
        with _database_connection() as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, values)
                rows = cursor.fetchall()
    except (DatabaseError, RuntimeError) as error:
        raise _database_error() from error

    return [dict(row) for row in rows]


@router.post("/api/importar/reclamos")
def import_claims(payload: Any = Body(...)) -> dict[str, bool | int]:
    if not isinstance(payload, list):
        raise HTTPException(status_code=422, detail="El body debe ser una lista de reclamos.")
    if not payload:
        return {"ok": True, "insertados": 0}

    rows: list[tuple[Any, ...]] = []
    for index, item in enumerate(payload):
        if not isinstance(item, dict):
            raise HTTPException(
                status_code=422,
                detail=f"El reclamo en la posición {index} debe ser un objeto JSON.",
            )
        rows.append(
            (
                _clean_text(item.get("ticket")),
                _clean_text(item.get("mes")),
                _clean_text(item.get("region")),
                _clean_text(item.get("comuna")),
                _clean_text(item.get("cliente")),
                _clean_text(item.get("prioridad")),
                _clean_text(item.get("estado_visita")),
                _clean_date(item.get("fecha_recepcion")),
                _clean_date(item.get("fecha_visita")),
                _clean_number(item.get("facturacion")) or Decimal("0"),
                _clean_number(item.get("promedio")) or Decimal("0"),
                _clean_text(item.get("observacion")),
            )
        )

    columns = ", ".join(IMPORT_COLUMNS)
    query = f"INSERT INTO reclamos ({columns}) VALUES %s"

    try:
        with _database_connection() as connection:
            with connection.cursor() as cursor:
                execute_values(cursor, query, rows)
    except (DatabaseError, RuntimeError) as error:
        raise _database_error() from error

    return {"ok": True, "insertados": len(rows)}
