from __future__ import annotations

import json
import re
from collections import Counter
from datetime import date
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from services.reference_sources import calculate_population_rates, calculate_territorial_risk, get_red_zones_summary, get_source_references

from database import engine

SENSITIVE_KEYS = {
    "rut", "telefono", "teléfono", "phone", "email", "correo", "cliente",
    "nombre", "consumidor", "direccion", "dirección", "direccion_original",
    "calle", "numero", "número", "lat", "lon", "visitador",
}
MONTH_NAMES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
    7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
}
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?56\s?)?(?:9\s?)?\d{4}\s?\d{4}(?!\d)")
RUT_RE = re.compile(r"(?i)\b\d{1,2}\.?\d{3}\.?\d{3}-?[0-9k]\b")


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _clean_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _date_range(filters: dict[str, Any]) -> tuple[str | None, str | None, int | None, int | None]:
    year = _clean_int(filters.get("year"))
    month = _clean_int(filters.get("month"))
    fecha_desde = _clean_text(filters.get("fecha_desde"))
    fecha_hasta = _clean_text(filters.get("fecha_hasta"))
    if year and month and not fecha_desde and not fecha_hasta and 1 <= month <= 12:
        start = date(year, month, 1)
        end = date(year + int(month == 12), 1 if month == 12 else month + 1, 1)
        fecha_desde = start.isoformat()
        fecha_hasta = end.isoformat()
    return fecha_desde, fecha_hasta, year, month


def _table_exists(table_name: str) -> bool:
    if engine is None:
        return False
    try:
        return table_name in inspect(engine).get_table_names()
    except SQLAlchemyError:
        return False


def _columns(table_name: str) -> set[str]:
    if engine is None:
        return set()
    try:
        return {column["name"] for column in inspect(engine).get_columns(table_name)}
    except SQLAlchemyError:
        return set()


def _add_filter(where: list[str], values: dict[str, Any], column: str, value: Any, columns: set[str]) -> None:
    if column not in columns:
        return
    cleaned = _clean_text(value)
    if not cleaned:
        return
    key = f"filter_{column}"
    where.append(f"LOWER(TRIM(COALESCE({column}, ''))) = LOWER(:{key})")
    values[key] = cleaned


def _claim_where(filters: dict[str, Any], columns: set[str]) -> tuple[str, dict[str, Any]]:
    where: list[str] = []
    values: dict[str, Any] = {}
    territorio = (_clean_text(filters.get("territorio")) or "").lower()
    if territorio in {"rm", "regiones"} and "dataset_scope" in columns:
        where.append("LOWER(TRIM(COALESCE(dataset_scope, ''))) = :territorio")
        values["territorio"] = territorio
    _add_filter(where, values, "comuna", filters.get("comuna"), columns)
    _add_filter(where, values, "region", filters.get("region"), columns)
    _add_filter(where, values, "prioridad", filters.get("prioridad"), columns)
    _add_filter(where, values, "estado_visita", filters.get("estado") or filters.get("estado_visita"), columns)
    fecha_desde, fecha_hasta, _, _ = _date_range(filters)
    claim_date = "COALESCE(fecha_visita, fecha_recepcion, CAST(created_at AS TEXT))"
    if fecha_desde and {"fecha_visita", "fecha_recepcion", "created_at"}.intersection(columns):
        where.append(f"SUBSTR({claim_date}, 1, 10) >= :fecha_desde")
        values["fecha_desde"] = fecha_desde[:10]
    if fecha_hasta and {"fecha_visita", "fecha_recepcion", "created_at"}.intersection(columns):
        where.append(f"SUBSTR({claim_date}, 1, 10) < :fecha_hasta")
        values["fecha_hasta"] = fecha_hasta[:10]
    month_text = _clean_text(filters.get("mes"))
    if month_text and "mes" in columns:
        where.append("LOWER(TRIM(COALESCE(mes, ''))) = LOWER(:mes)")
        values["mes"] = month_text
    return (f"WHERE {' AND '.join(where)}" if where else "", values)


def _visit_where(filters: dict[str, Any], columns: set[str]) -> tuple[str, dict[str, Any]]:
    where: list[str] = []
    values: dict[str, Any] = {}
    territorio = (_clean_text(filters.get("territorio")) or "").lower()
    if territorio in {"rm", "regiones"} and "territorio" in columns:
        where.append("LOWER(TRIM(COALESCE(territorio, ''))) = :territorio")
        values["territorio"] = territorio
    _add_filter(where, values, "comuna", filters.get("comuna"), columns)
    _add_filter(where, values, "region", filters.get("region"), columns)
    estado = filters.get("estado")
    if estado:
        _add_filter(where, values, "estado", estado, columns)
    fecha_desde, fecha_hasta, _, _ = _date_range(filters)
    if fecha_desde and "fecha_visita" in columns:
        where.append("fecha_visita >= :fecha_desde")
        values["fecha_desde"] = fecha_desde[:10]
    if fecha_hasta and "fecha_visita" in columns:
        where.append("fecha_visita < :fecha_hasta")
        values["fecha_hasta"] = fecha_hasta[:10]
    return (f"WHERE {' AND '.join(where)}" if where else "", values)


def _rows(sql: str, values: dict[str, Any]) -> list[dict[str, Any]]:
    if engine is None:
        return []
    try:
        with engine.connect() as conn:
            return [dict(row._mapping) for row in conn.execute(text(sql), values).fetchall()]
    except SQLAlchemyError:
        return []


def _single(sql: str, values: dict[str, Any]) -> dict[str, Any]:
    rows = _rows(sql, values)
    return rows[0] if rows else {}


def _sanitize_text(value: Any, max_len: int = 180) -> str | None:
    cleaned = _clean_text(value)
    if not cleaned:
        return None
    cleaned = EMAIL_RE.sub("[correo oculto]", cleaned)
    cleaned = PHONE_RE.sub("[telefono oculto]", cleaned)
    cleaned = RUT_RE.sub("[rut oculto]", cleaned)
    return cleaned[:max_len]


def sanitize_ai_context(data: Any) -> Any:
    if isinstance(data, list):
        return [sanitize_ai_context(item) for item in data]
    if isinstance(data, dict):
        sanitized: dict[str, Any] = {}
        for key, value in data.items():
            if key.lower() in SENSITIVE_KEYS:
                continue
            if isinstance(value, (dict, list)):
                sanitized[key] = sanitize_ai_context(value)
            elif isinstance(value, str):
                sanitized[key] = _sanitize_text(value)
            else:
                sanitized[key] = value
        return sanitized
    if isinstance(data, str):
        return _sanitize_text(data)
    return data


def _counter(rows: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts = Counter(_clean_text(row.get(key)) or "Sin informacion" for row in rows)
    return dict(counts.most_common(12))


def _top_observations(rows: list[dict[str, Any]]) -> list[str]:
    seen: list[str] = []
    for row in rows:
        text_value = _sanitize_text(row.get("observacion"), max_len=220)
        if text_value and text_value not in seen:
            seen.append(text_value)
        if len(seen) >= 8:
            break
    return seen


def get_dashboard_metrics(filters: dict | None = None) -> dict[str, Any]:
    filters = filters or {}
    fecha_desde, fecha_hasta, year, month = _date_range(filters)
    territorio = (_clean_text(filters.get("territorio")) or "nacional").lower()
    if territorio not in {"rm", "regiones", "nacional", "all"}:
        territorio = "nacional"

    claim_columns = _columns("reclamos") if _table_exists("reclamos") else set()
    claim_where, claim_values = _claim_where(filters, claim_columns) if claim_columns else ("", {})
    claims = _rows(f"SELECT * FROM reclamos {claim_where} ORDER BY COALESCE(fecha_visita, fecha_recepcion, CAST(created_at AS TEXT)) DESC LIMIT 1000", claim_values) if claim_columns else []

    value_expr = "COALESCE(facturacion, precio_neto_traslado, precio_neto, valor_envio, 0)"
    claim_summary = _single(
        f"""
        SELECT COUNT(*) AS reclamos_totales,
               COALESCE(SUM({value_expr}), 0) AS facturacion_estimada,
               COUNT(DISTINCT NULLIF(TRIM(ticket), '')) AS tickets_unicos,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(prioridad, ''))) IN ('alta','alto','high') THEN 1 ELSE 0 END) AS reclamos_prioridad_alta
        FROM reclamos {claim_where}
        """,
        claim_values,
    ) if claim_columns else {}
    communes = _rows(
        f"""
        SELECT COALESCE(NULLIF(TRIM(comuna), ''), NULLIF(TRIM(ciudad), ''), 'Sin ubicacion') AS comuna,
               COALESCE(NULLIF(TRIM(region), ''), CASE WHEN dataset_scope = 'rm' THEN 'Region Metropolitana' ELSE 'Regiones' END) AS region,
               COUNT(*) AS reclamos,
               COALESCE(SUM({value_expr}), 0) AS facturacion,
               SUM(CASE WHEN LOWER(TRIM(COALESCE(prioridad, ''))) IN ('alta','alto','high') THEN 1 ELSE 0 END) AS prioridad_alta
        FROM reclamos {claim_where}
        GROUP BY comuna, region
        ORDER BY reclamos DESC, prioridad_alta DESC, facturacion DESC
        LIMIT 10
        """,
        claim_values,
    ) if claim_columns else []

    visit_columns = _columns("ruta_visitas_diarias") if _table_exists("ruta_visitas_diarias") else set()
    visit_where, visit_values = _visit_where(filters, visit_columns) if visit_columns else ("", {})
    visit_summary = _single(
        f"""
        SELECT COUNT(*) AS visitas_totales,
               SUM(CASE WHEN estado = 'exitosa' THEN 1 ELSE 0 END) AS visitas_exitosas,
               SUM(CASE WHEN estado = 'no_exitosa' THEN 1 ELSE 0 END) AS visitas_no_exitosas,
               SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) AS visitas_pendientes,
               COALESCE(SUM(valor_calculado), 0) AS facturacion_visitas
        FROM ruta_visitas_diarias {visit_where}
        """,
        visit_values,
    ) if visit_columns else {}
    visit_rows = _rows(f"SELECT estado, comuna, region, observacion FROM ruta_visitas_diarias {visit_where} LIMIT 1000", visit_values) if visit_columns else []

    metrics = {
        "filters": sanitize_ai_context(filters),
        "territorio_usado": "nacional" if territorio == "all" else territorio,
        "year": year,
        "month": month,
        "mes_nombre": MONTH_NAMES.get(month or 0),
        "rango_fechas_usado": {"fecha_desde": fecha_desde, "fecha_hasta": fecha_hasta},
        "reclamos_totales": int(claim_summary.get("reclamos_totales") or 0),
        "facturacion_estimada": float(claim_summary.get("facturacion_estimada") or 0),
        "tickets_unicos": int(claim_summary.get("tickets_unicos") or 0),
        "reclamos_prioridad_alta": int(claim_summary.get("reclamos_prioridad_alta") or 0),
        "comunas_con_mas_reclamos": sanitize_ai_context(communes),
        "comunas_criticas": sanitize_ai_context([row for row in communes if int(row.get("prioridad_alta") or 0) > 0][:8] or communes[:5]),
        "visitas_totales": int(visit_summary.get("visitas_totales") or 0),
        "visitas_exitosas": int(visit_summary.get("visitas_exitosas") or 0),
        "visitas_no_exitosas": int(visit_summary.get("visitas_no_exitosas") or 0),
        "visitas_pendientes": int(visit_summary.get("visitas_pendientes") or 0),
        "facturacion_visitas": float(visit_summary.get("facturacion_visitas") or 0),
        "distribucion_estado": _counter(claims, "estado_visita") if claims else _counter(visit_rows, "estado"),
        "distribucion_prioridad": _counter(claims, "prioridad"),
        "principales_motivos": "campo no disponible",
        "principales_productos": "campo no disponible",
        "observaciones_agregadas": _top_observations(claims) or _top_observations(visit_rows),
        "muestra_sanitizada": sanitize_ai_context([
            {
                "ticket": row.get("ticket"),
                "comuna": row.get("comuna") or row.get("ciudad"),
                "region": row.get("region"),
                "estado": row.get("estado_visita"),
                "prioridad": row.get("prioridad"),
                "observacion_resumida": row.get("observacion"),
                "fecha_visita": row.get("fecha_visita"),
            }
            for row in claims[:20]
        ]),
    }
    metrics["sin_datos"] = metrics["reclamos_totales"] == 0 and metrics["visitas_totales"] == 0
    return metrics


def get_dashboard_context(filters: dict | None = None) -> str:
    metrics = sanitize_ai_context(get_dashboard_metrics(filters))
    if metrics.get("sin_datos"):
        return "No hay datos disponibles para los filtros seleccionados.\n" + json.dumps(metrics, ensure_ascii=False, indent=2, default=str)
    return json.dumps(metrics, ensure_ascii=False, indent=2, default=str)
