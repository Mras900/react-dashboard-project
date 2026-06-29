from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from database import engine
from services.dashboard_context import sanitize_ai_context
from services.reference_sources import calculate_population_rates, calculate_territorial_risk, get_red_zones_summary


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _norm(value: Any) -> str:
    import unicodedata
    return unicodedata.normalize("NFD", _clean(value).lower()).encode("ascii", "ignore").decode("ascii")


def _columns() -> set[str]:
    if engine is None:
        return set()
    try:
        return {column["name"] for column in inspect(engine).get_columns("reclamos")}
    except SQLAlchemyError:
        return set()


def _date_range(filters: dict[str, Any]) -> tuple[str | None, str | None]:
    year = filters.get("year")
    month = filters.get("month")
    if year and month:
        y, m = int(year), int(month)
        start = date(y, m, 1)
        end = date(y + int(m == 12), 1 if m == 12 else m + 1, 1)
        return start.isoformat(), end.isoformat()
    return filters.get("fecha_desde"), filters.get("fecha_hasta")


def _fetch_candidates(filters: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    columns = _columns()
    if engine is None or not columns:
        return []
    where: list[str] = []
    values: dict[str, Any] = {}
    for column, key in (("comuna", "comuna"), ("region", "region"), ("prioridad", "prioridad"), ("estado_visita", "estado")):
        if column in columns and filters.get(key):
            where.append(f"LOWER(TRIM(COALESCE({column}, ''))) = LOWER(:{key})")
            values[key] = _clean(filters.get(key))
    territorio = _norm(filters.get("territorio"))
    if territorio in {"rm", "regiones"} and "dataset_scope" in columns:
        where.append("LOWER(TRIM(COALESCE(dataset_scope, ''))) = :territorio")
        values["territorio"] = territorio
    fecha_desde, fecha_hasta = _date_range(filters)
    date_expr = "COALESCE(fecha_visita, fecha_recepcion, CAST(created_at AS TEXT))"
    if fecha_desde:
        where.append(f"SUBSTR({date_expr}, 1, 10) >= :fecha_desde")
        values["fecha_desde"] = fecha_desde[:10]
    if fecha_hasta:
        where.append(f"SUBSTR({date_expr}, 1, 10) < :fecha_hasta")
        values["fecha_hasta"] = fecha_hasta[:10]
    sql = f"SELECT * FROM reclamos {'WHERE ' + ' AND '.join(where) if where else ''} ORDER BY {date_expr} DESC LIMIT :limit"
    values["limit"] = max(limit * 20, 100)
    try:
        with engine.connect() as conn:
            return [dict(row._mapping) for row in conn.execute(text(sql), values).fetchall()]
    except SQLAlchemyError:
        return []


def _score(row: dict[str, Any], query: str, filters: dict[str, Any]) -> float:
    q = _norm(query)
    score = 0.0
    ticket = _norm(row.get("ticket"))
    comuna = _norm(row.get("comuna") or row.get("ciudad"))
    estado = _norm(row.get("estado_visita"))
    prioridad = _norm(row.get("prioridad"))
    observacion = _norm(row.get("observacion"))
    producto = _norm(row.get("producto") or row.get("producto_reclamado"))
    motivo = _norm(row.get("motivo") or row.get("motivo_reclamo"))
    if ticket and ticket == q:
        score += 1.0
    if ticket and ticket in q:
        score += 0.5
    if comuna and (comuna in q or comuna == _norm(filters.get("comuna"))):
        score += 0.25
    if estado and (estado in q or estado == _norm(filters.get("estado"))):
        score += 0.2
    if observacion and any(word and word in observacion for word in q.split() if len(word) > 3):
        score += 0.35
    if prioridad and (prioridad in q or prioridad == _norm(filters.get("prioridad"))):
        score += 0.12
    if producto and producto in q:
        score += 0.15
    if motivo and motivo in q:
        score += 0.15
    if _norm(filters.get("territorio")) and _norm(row.get("dataset_scope")) == _norm(filters.get("territorio")):
        score += 0.08
    return min(score, 1.0)


def _territorial_context(row: dict[str, Any], filters: dict[str, Any]) -> dict[str, Any]:
    comuna = row.get("comuna") or row.get("ciudad")
    summary = get_red_zones_summary({"comuna": comuna})
    metrics = {"comunas_con_mas_reclamos": [{"comuna": comuna, "region": row.get("region"), "reclamos": 1, "prioridad_alta": 1 if _norm(row.get("prioridad")) in {"alta", "alto", "high"} else 0}], "visitas_no_exitosas": 1 if _norm(row.get("estado_visita")) in {"no_exitosa", "visita no exitosa"} else 0}
    rates = calculate_population_rates(metrics, filters)
    risk = calculate_territorial_risk(metrics, filters)
    risk_item = (risk.get("items") or [{}])[0]
    rate_item = (rates.get("items") or [{}])[0]
    return {
        "has_red_zones": bool(summary.get("total_zones")),
        "risk_level": risk_item.get("risk_level", "bajo"),
        "population_rate_available": bool(rates.get("population_available") and rate_item),
        "claims_per_100k": rate_item.get("claims_per_100k"),
    }


def find_similar_claims(query: str, limit: int = 10, filters: dict | None = None) -> list[dict[str, Any]]:
    filters = filters or {}
    rows = _fetch_candidates(filters, limit)
    scored = []
    for row in rows:
        score = _score(row, query, filters)
        if score <= 0 and query.strip():
            continue
        item = {
            "ticket": row.get("ticket"),
            "comuna": row.get("comuna") or row.get("ciudad"),
            "region": row.get("region"),
            "estado": row.get("estado_visita"),
            "prioridad": row.get("prioridad"),
            "fecha_recepcion": row.get("fecha_recepcion"),
            "fecha_visita": row.get("fecha_visita"),
            "producto": row.get("producto") or row.get("producto_reclamado"),
            "motivo": row.get("motivo") or row.get("motivo_reclamo"),
            "observacion_resumida": row.get("observacion"),
            "score": round(score, 3),
        }
        if filters.get("include_territorial_context", True):
            item["territorial_context"] = _territorial_context(row, filters)
        scored.append(sanitize_ai_context(item))
    risk_level = _norm(filters.get("risk_level"))
    only_red = bool(filters.get("only_red_zone_communes"))
    if risk_level:
        scored = [item for item in scored if _norm((item.get("territorial_context") or {}).get("risk_level")) == risk_level]
    if only_red:
        scored = [item for item in scored if (item.get("territorial_context") or {}).get("has_red_zones")]
    scored.sort(key=lambda item: (float(item.get("score") or 0), _clean(item.get("fecha_visita") or item.get("fecha_recepcion"))), reverse=True)
    return scored[: max(1, min(limit, 50))]
