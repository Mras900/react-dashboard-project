import csv
import hashlib
import io
import logging
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from models.historical_visit import HistoricalVisit
from schemas.historical_visit_schema import (
    HistoricalAiContextResponse,
    HistoricalCompareResponse,
    HistoricalImportResponse,
    HistoricalSummaryResponse,
    CompareYearMetric,
)

router = APIRouter(prefix="/api/historical-visits", tags=["historical"])
logger = logging.getLogger(__name__)

# --- Utilidades ---

COLUMN_MAP: dict[str, str] = {
    "cliente": "cliente",
    "ticket": "ticket",
    "kut estado 2": "kut_estado_2",
    "rut": "_rut_raw",  # especial: se hashea
    "subclasificacion ac": "subclasificacion_ac",
    "categoria del objeto": "categoria_objeto",
    "atribucion de responsable": "atribucion_responsable",
    "categoria de incidente": "categoria_incidente",
    "categoria de causa": "categoria_causa",
    "mapa": "mapa",
    "tiene envase del producto": "tiene_envase",
    "tiene muestra del defecto": "tiene_muestra",
    "se envia imposibilidad de contacto": "imposibilidad_contacto",
    "prioridad": "prioridad",
    "region": "region",
    "comuna": "comuna",
    "fecha visita": "fecha_visita",
    "producto reclamado": "producto_reclamado",
    "estado": "estado",
    "tiene muestra del defecto2": "tiene_muestra",
    "fecha envio laboratorio": "fecha_envio_laboratorio",
    "fecha de respuesta": "fecha_respuesta",
    "requiere respuesta": "requiere_respuesta",
    "ano natural": "source_year",
    "año natural": "source_year",
    "correo electronico": "_has_email",
    "correo electrónico": "_has_email",
    "direccion (cliente)": "_has_address",
    "dirección (cliente)": "_has_address",
    "contador": "contador",
    "detalle lugar de compra": "_detalle_compra",
}


def _normalize_header(h: str) -> str:
    """Limpia y normaliza nombre de columna CSV."""
    return h.strip().lower().replace("¿", "").replace("?", "").strip()


def _parse_chilean_date(val: str) -> str | None:
    """Convierte fecha chilena a ISO o la deja como string."""
    if not val or not val.strip():
        return None
    v = val.strip()
    # dd-mm-yyyy o dd/mm/yyyy
    for sep in ["-", "/"]:
        parts = v.split(sep)
        if len(parts) == 3:
            try:
                d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                if 1 <= d <= 31 and 1 <= m <= 12:
                    # Normaliza año 2 digitos
                    if y < 100:
                        y += 2000
                    return f"{y:04d}-{m:02d}-{d:02d}"
            except ValueError:
                continue
    # Si ya es ISO o no se puede parsear, devolver como viene
    return v


def _clean_numeric(val: str) -> float | None:
    """Limpia string numerico chileno (puntos como separador miles, coma decimal)."""
    if not val or not val.strip():
        return None
    v = val.strip().replace("$", "").replace(" ", "")
    if not v:
        return None
    try:
        # Si tiene coma y punto, ej: 1.234,56
        if "," in v and "." in v:
            v = v.replace(".", "").replace(",", ".")
        elif "," in v:
            v = v.replace(",", ".")
        return float(v)
    except (ValueError, TypeError):
        return None


def _hash_rut(rut: str) -> str | None:
    """Normaliza y hashea RUT chileno."""
    if not rut or not rut.strip():
        return None
    cleaned = rut.strip().upper().replace(".", "").replace("-", "").replace(" ", "")
    if not cleaned:
        return None
    return hashlib.sha256(cleaned.encode("utf-8")).hexdigest()


# --- IMPORT ENDPOINT ---

BATCH_SIZE = 200


@router.post("/import", response_model=HistoricalImportResponse)
def import_historical_visits(
    file: UploadFile = File(...),
    dataset_name: str = Form(default=""),
    source_year: int | None = Form(default=None),
    db: Session = Depends(get_db),
) -> HistoricalImportResponse:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos CSV.")

    content = file.file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            decoded = content.decode("utf-8")
        except UnicodeDecodeError:
            decoded = content.decode("latin-1", errors="replace")

    reader = csv.DictReader(io.StringIO(decoded), delimiter=";")
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV sin columnas o separador incorrecto.")

    headers_raw = [h.strip() for h in reader.fieldnames if h]
    col_map: dict[str, str | None] = {}
    for h in headers_raw:
        normalized = _normalize_header(h)
        target = None
        for pattern, mapped in COLUMN_MAP.items():
            if pattern == normalized or normalized.startswith(pattern) or pattern.startswith(normalized):
                target = mapped
                break
        col_map[h] = target

    result = HistoricalImportResponse()
    row_buffer: list[HistoricalVisit] = []

    for row_num, row in enumerate(reader, start=2):
        ticket_val = (row.get("Ticket") or row.get("TICKET") or "").strip()
        if not ticket_val:
            result.errors += 1
            continue

        mapped: dict[str, Any] = {}
        _rut_raw: str | None = None
        _has_email = False
        _has_address = False

        for header, value in row.items():
            target = col_map.get(header.strip())
            if target is None:
                continue
            val = (value or "").strip()

            if target == "_rut_raw":
                if val:
                    _rut_raw = val
                continue
            if target == "_has_email":
                if val:
                    _has_email = True
                continue
            if target == "_has_address":
                if val:
                    _has_address = True
                continue
            if target == "_detalle_compra":
                continue

            if target == "contador":
                mapped[target] = _clean_numeric(val)
            elif target in ("fecha_visita", "fecha_envio_laboratorio", "fecha_respuesta"):
                mapped[target] = _parse_chilean_date(val)
            elif target == "source_year":
                try:
                    mapped[target] = int(float(val))
                except (ValueError, TypeError):
                    mapped[target] = None
            else:
                mapped[target] = val if val else None

        row_year = mapped.get("source_year")
        if not row_year and mapped.get("fecha_visita"):
            try:
                dt = datetime.strptime(mapped["fecha_visita"], "%Y-%m-%d")
                row_year = dt.year
            except (ValueError, TypeError):
                pass

        if source_year:
            use_year = source_year
        elif row_year:
            use_year = row_year
        else:
            result.errors += 1
            continue

        mapped["source_year"] = use_year
        if dataset_name:
            mapped["dataset_name"] = dataset_name

        # Duplicado
        try:
            existing = db.query(HistoricalVisit).filter(
                HistoricalVisit.ticket == ticket_val,
                HistoricalVisit.source_year == use_year,
            ).first()
        except SQLAlchemyError as exc:
            logger.error("Error consultando duplicado fila %d ticket=%s: %s", row_num, ticket_val, exc)
            result.errors += 1
            continue

        if existing:
            result.skipped_duplicates += 1
            continue

        if _rut_raw:
            mapped["rut_hash"] = _hash_rut(_rut_raw)
        mapped["has_email"] = _has_email
        mapped["has_address"] = _has_address

        raw_row_safe: dict[str, str] = {}
        for header, value in row.items():
            h = header.strip()
            h_lower = _normalize_header(h)
            if h_lower in ("rut", "correo electronico", "correo electrónico",
                           "direccion (cliente)", "dirección (cliente)", "email", "e-mail"):
                continue
            val = (value or "").strip()
            if val:
                raw_row_safe[h] = val
        mapped["raw_row"] = raw_row_safe if raw_row_safe else None

        try:
            record = HistoricalVisit(**mapped)
            db.add(record)
            row_buffer.append(record)
            result.imported += 1
            result.rows_by_year[str(use_year)] = result.rows_by_year.get(str(use_year), 0) + 1

            # Flush each BATCH_SIZE rows
            if len(row_buffer) >= BATCH_SIZE:
                db.flush()
                row_buffer.clear()
        except SQLAlchemyError as exc:
            logger.error("Error insertando fila %d ticket=%s: %s", row_num, ticket_val, exc)
            db.rollback()
            result.errors += 1
            # Remove errored records from buffer
            row_buffer.clear()

    # Commit remaining batch
    if row_buffer:
        try:
            db.flush()
        except SQLAlchemyError as exc:
            logger.error("Error en flush final: %s", exc)
            db.rollback()
            result.errors += 1

    try:
        db.commit()
    except SQLAlchemyError as exc:
        logger.error("Error en commit final: %s", exc)
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error de base de datos durante importacion. {result.imported} filas procesadas antes del error. Revisar logs del servidor.",
        )

    # Stats desde DB
    try:
        result.source_years_detected = sorted(
            r[0] for r in db.query(HistoricalVisit.source_year).distinct().all() if r[0]
        )
        year_rows = db.query(
            HistoricalVisit.source_year, func.count(HistoricalVisit.id)
        ).group_by(HistoricalVisit.source_year).all()
        result.rows_by_year = {str(y): int(c) for y, c in year_rows if y}

        comuna_rows = db.query(
            HistoricalVisit.comuna, func.count(HistoricalVisit.id).label("cnt")
        ).filter(
            HistoricalVisit.comuna.isnot(None),
            HistoricalVisit.comuna != "",
        ).group_by(HistoricalVisit.comuna).order_by(text("cnt DESC")).limit(10).all()
        result.rows_by_comuna = [{"comuna": c, "total": int(t)} for c, t in comuna_rows if c]

        estado_rows = db.query(
            HistoricalVisit.estado, func.count(HistoricalVisit.id)
        ).filter(
            HistoricalVisit.estado.isnot(None),
            HistoricalVisit.estado != "",
        ).group_by(HistoricalVisit.estado).all()
        result.rows_by_estado = {str(e): int(c) for e, c in estado_rows if e}

        prioridad_rows = db.query(
            HistoricalVisit.prioridad, func.count(HistoricalVisit.id)
        ).filter(
            HistoricalVisit.prioridad.isnot(None),
            HistoricalVisit.prioridad != "",
        ).group_by(HistoricalVisit.prioridad).all()
        result.rows_by_prioridad = {str(p): int(c) for p, c in prioridad_rows if p}
    except SQLAlchemyError as exc:
        logger.error("Error calculando stats post-import: %s", exc)
        # Non-fatal: return partial result

    total_msg = f"Importados {result.imported}"
    if result.skipped_duplicates:
        total_msg += f", {result.skipped_duplicates} duplicados omitidos"
    if result.errors:
        total_msg += f", {result.errors} errores"
    result.message = total_msg

    return result


# --- SUMMARY ENDPOINT ---

@router.get("/summary", response_model=HistoricalSummaryResponse)
def historical_summary(
    year: int | None = Query(default=None),
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
    comuna: str | None = Query(default=None),
    region: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> HistoricalSummaryResponse:
    q = db.query(HistoricalVisit)

    if year:
        q = q.filter(HistoricalVisit.source_year == year)
    if from_date:
        q = q.filter(HistoricalVisit.fecha_visita >= from_date)
    if to_date:
        q = q.filter(HistoricalVisit.fecha_visita <= to_date)
    if comuna:
        q = q.filter(HistoricalVisit.comuna == comuna)
    if region:
        q = q.filter(HistoricalVisit.region == region)

    # Reuse filtered subquery for consistent counts
    base = q.subquery()

    result = HistoricalSummaryResponse()

    # Total
    total_row = db.query(func.count(text("1"))).select_from(base).scalar() or 0
    result.total = int(total_row)

    if result.total == 0:
        return result

    # by_year
    year_rows = db.query(base.c.source_year, func.count(text("1")).label("cnt")).group_by(base.c.source_year).all()
    result.by_year = {str(y): int(c) for y, c in year_rows if y}

    # by_month (extraer mes desde fecha_visita como string)
    month_sql = text("substr(fecha_visita, 6, 2)")
    month_rows = db.query(month_sql, func.count(text("1")).label("cnt")).select_from(base).filter(
        base.c.fecha_visita.isnot(None), base.c.fecha_visita != ""
    ).group_by(month_sql).all()
    months_map = {
        "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
        "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
        "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
    }
    for m_code, cnt in month_rows:
        m_str = str(m_code).zfill(2) if m_code else ""
        label = months_map.get(m_str, m_str)
        result.by_month[label] = int(cnt)

    # by_comuna top 20
    comuna_rows = db.query(
        base.c.comuna, func.count(text("1")).label("cnt")
    ).filter(
        base.c.comuna.isnot(None), base.c.comuna != ""
    ).group_by(base.c.comuna).order_by(text("cnt DESC")).limit(20).all()
    result.by_comuna = [{"comuna": c, "total": int(t)} for c, t in comuna_rows if c]

    # by_prioridad
    prioridad_rows = db.query(
        base.c.prioridad, func.count(text("1")).label("cnt")
    ).filter(
        base.c.prioridad.isnot(None), base.c.prioridad != ""
    ).group_by(base.c.prioridad).all()
    result.by_prioridad = {str(p): int(c) for p, c in prioridad_rows if p}

    # by_estado
    estado_rows = db.query(
        base.c.estado, func.count(text("1")).label("cnt")
    ).filter(
        base.c.estado.isnot(None), base.c.estado != ""
    ).group_by(base.c.estado).all()
    result.by_estado = {str(e): int(c) for e, c in estado_rows if e}

    # by_categoria_incidente
    inc_rows = db.query(
        base.c.categoria_incidente, func.count(text("1")).label("cnt")
    ).filter(
        base.c.categoria_incidente.isnot(None), base.c.categoria_incidente != ""
    ).group_by(base.c.categoria_incidente).order_by(text("cnt DESC")).all()
    result.by_categoria_incidente = {str(i): int(c) for i, c in inc_rows if i}

    # by_categoria_causa
    causa_rows = db.query(
        base.c.categoria_causa, func.count(text("1")).label("cnt")
    ).filter(
        base.c.categoria_causa.isnot(None), base.c.categoria_causa != ""
    ).group_by(base.c.categoria_causa).order_by(text("cnt DESC")).all()
    result.by_categoria_causa = {str(ca): int(c) for ca, c in causa_rows if ca}

    # by_producto top 15
    prod_rows = db.query(
        base.c.producto_reclamado, func.count(text("1")).label("cnt")
    ).filter(
        base.c.producto_reclamado.isnot(None), base.c.producto_reclamado != ""
    ).group_by(base.c.producto_reclamado).order_by(text("cnt DESC")).limit(15).all()
    result.by_producto = [{"producto": p, "total": int(t)} for p, t in prod_rows if p]

    # promedio_dias_visita_respuesta
    days_row = db.query(
        func.avg(
            func.julianday(base.c.fecha_respuesta) - func.julianday(base.c.fecha_visita)
        )
    ).select_from(base).filter(
        base.c.fecha_visita.isnot(None), base.c.fecha_visita != "",
        base.c.fecha_respuesta.isnot(None), base.c.fecha_respuesta != "",
    ).scalar()
    if days_row is not None:
        result.promedio_dias_visita_respuesta = round(float(days_row), 1)

    return result


# --- COMPARE ENDPOINT ---

@router.get("/compare", response_model=HistoricalCompareResponse)
def historical_compare(
    year_a: int = Query(...),
    year_b: int = Query(...),
    month: int | None = Query(default=None),
    comuna: str | None = Query(default=None),
    region: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> HistoricalCompareResponse:
    def _build_year_metric(y: int) -> CompareYearMetric:
        q = db.query(HistoricalVisit).filter(HistoricalVisit.source_year == y)
        if month:
            m_str = f"{month:02d}"
            q = q.filter(HistoricalVisit.fecha_visita.like(f"%-{m_str}-%"))
        if comuna:
            q = q.filter(HistoricalVisit.comuna == comuna)
        if region:
            q = q.filter(HistoricalVisit.region == region)

        base = q.subquery()
        total = db.query(func.count(text("1"))).select_from(base).scalar() or 0

        comuna_rows = db.query(
            base.c.comuna, func.count(text("1")).label("cnt")
        ).filter(
            base.c.comuna.isnot(None), base.c.comuna != ""
        ).group_by(base.c.comuna).order_by(text("cnt DESC")).limit(20).all()
        by_comuna = [{"comuna": c, "total": int(t)} for c, t in comuna_rows if c]

        prio_rows = db.query(
            base.c.prioridad, func.count(text("1")).label("cnt")
        ).filter(
            base.c.prioridad.isnot(None), base.c.prioridad != ""
        ).group_by(base.c.prioridad).all()
        by_prioridad = {str(p): int(c) for p, c in prio_rows if p}

        est_rows = db.query(
            base.c.estado, func.count(text("1")).label("cnt")
        ).filter(
            base.c.estado.isnot(None), base.c.estado != ""
        ).group_by(base.c.estado).all()
        by_estado = {str(e): int(c) for e, c in est_rows if e}

        inc_rows = db.query(
            base.c.categoria_incidente, func.count(text("1")).label("cnt")
        ).filter(
            base.c.categoria_incidente.isnot(None), base.c.categoria_incidente != ""
        ).group_by(base.c.categoria_incidente).order_by(text("cnt DESC")).limit(10).all()
        by_categoria = {str(i): int(c) for i, c in inc_rows if i}

        month_sql = text("substr(fecha_visita, 6, 2)")
        mes_rows = db.query(month_sql, func.count(text("1")).label("cnt")).select_from(base).filter(
            base.c.fecha_visita.isnot(None), base.c.fecha_visita != ""
        ).group_by(month_sql).all()
        by_mes = {}
        for m_code, cnt in mes_rows:
            m_str = str(m_code).zfill(2) if m_code else ""
            by_mes[m_str] = int(cnt)

        return CompareYearMetric(
            year=y,
            total=int(total),
            by_comuna=by_comuna,
            by_prioridad=by_prioridad,
            by_estado=by_estado,
            by_categoria_incidente=by_categoria,
            by_mes=by_mes,
        )

    metric_a = _build_year_metric(year_a)
    metric_b = _build_year_metric(year_b)

    diff = metric_b.total - metric_a.total
    var_pct = (
        round(((metric_b.total - metric_a.total) / metric_a.total) * 100, 1)
        if metric_a.total > 0
        else None
    )

    # top_comunas_aumento / baja
    comunas_a = {c["comuna"]: c["total"] for c in metric_a.by_comuna}
    comunas_b = {c["comuna"]: c["total"] for c in metric_b.by_comuna}
    all_comunas = set(list(comunas_a.keys()) + list(comunas_b.keys()))
    comuna_deltas = []
    for c in all_comunas:
        ta = comunas_a.get(c, 0)
        tb = comunas_b.get(c, 0)
        comuna_deltas.append({"comuna": c, "year_a": ta, "year_b": tb, "diferencia": tb - ta})
    comuna_deltas.sort(key=lambda x: x["diferencia"], reverse=True)
    top_comunas_aumento = [c for c in comuna_deltas if c["diferencia"] > 0][:10]
    top_comunas_baja = [c for c in reversed(comuna_deltas) if c["diferencia"] < 0][:10]

    # top_categorias_aumento
    cats_a = metric_a.by_categoria_incidente
    cats_b = metric_b.by_categoria_incidente
    all_cats = set(list(cats_a.keys()) + list(cats_b.keys()))
    cat_deltas = []
    for c in all_cats:
        ta = cats_a.get(c, 0)
        tb = cats_b.get(c, 0)
        cat_deltas.append({"categoria": c, "year_a": ta, "year_b": tb, "diferencia": tb - ta})
    cat_deltas.sort(key=lambda x: x["diferencia"], reverse=True)
    top_categorias_aumento = cat_deltas[:10]

    # top_estados comparativo
    estados_all = set(list(metric_a.by_estado.keys()) + list(metric_b.by_estado.keys()))
    top_estados = {}
    for e in estados_all:
        top_estados[e] = {"year_a": metric_a.by_estado.get(e, 0), "year_b": metric_b.by_estado.get(e, 0)}

    # top_prioridades comparativo
    prios_all = set(list(metric_a.by_prioridad.keys()) + list(metric_b.by_prioridad.keys()))
    top_prioridades = {}
    for p in prios_all:
        top_prioridades[p] = {"year_a": metric_a.by_prioridad.get(p, 0), "year_b": metric_b.by_prioridad.get(p, 0)}

    # resumen textual deterministico
    lines = [
        f"Comparacion {year_a} vs {year_b}:",
        f"  {year_a}: {metric_a.total} registros",
        f"  {year_b}: {metric_b.total} registros",
    ]
    if diff != 0:
        direction = "aumento" if diff > 0 else "disminucion"
        lines.append(f"  Diferencia: {abs(diff)} registros ({direction})")
        if var_pct is not None:
            lines.append(f"  Variacion: {var_pct:+.1f}%")
    if top_comunas_aumento:
        lines.append(f"  Top comunas con aumento: {', '.join(c['comuna'] for c in top_comunas_aumento[:5])}")
    if top_comunas_baja:
        lines.append(f"  Top comunas con baja: {', '.join(c['comuna'] for c in top_comunas_baja[:5])}")
    if top_categorias_aumento:
        lines.append(f"  Top categorias incidente: {', '.join(c['categoria'] for c in top_categorias_aumento[:5])}")

    text_summary = "\n".join(lines)

    return HistoricalCompareResponse(
        year_a=metric_a,
        year_b=metric_b,
        diferencia_absoluta=diff,
        variacion_porcentual=var_pct,
        top_comunas_aumento=top_comunas_aumento,
        top_comunas_baja=top_comunas_baja,
        top_categorias_aumento=top_categorias_aumento,
        top_estados=top_estados,
        top_prioridades=top_prioridades,
        resumen_textual_base=text_summary,
    )


# --- AI CONTEXT ENDPOINT (sin PII) ---

@router.get("/ai-context", response_model=HistoricalAiContextResponse)
def historical_ai_context(
    year_a: int = Query(...),
    year_b: int | None = Query(default=None),
    month: int | None = Query(default=None),
    comuna: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> HistoricalAiContextResponse:
    def _year_total(y: int) -> int:
        q = db.query(func.count(HistoricalVisit.id)).filter(HistoricalVisit.source_year == y)
        if month:
            m_str = f"{month:02d}"
            q = q.filter(HistoricalVisit.fecha_visita.like(f"%-{m_str}-%"))
        if comuna:
            q = q.filter(HistoricalVisit.comuna == comuna)
        return q.scalar() or 0

    total_a = _year_total(year_a)
    total_b = _year_total(year_b) if year_b else None

    totales = {"year_a": total_a}
    if year_b:
        totales["year_b"] = total_b or 0

    variaciones: dict[str, float | None] = {}
    if year_b and total_a > 0 and total_b is not None:
        variaciones["variacion_porcentual"] = round(((total_b - total_a) / total_a) * 100, 1)
        variaciones["diferencia_absoluta"] = total_b - total_a

    # Top comunas combinado (usar year_a como base)
    q_comunas = db.query(
        HistoricalVisit.comuna, func.count(HistoricalVisit.id).label("cnt")
    ).filter(
        HistoricalVisit.source_year == year_a,
        HistoricalVisit.comuna.isnot(None),
        HistoricalVisit.comuna != "",
    )
    if month:
        m_str = f"{month:02d}"
        q_comunas = q_comunas.filter(HistoricalVisit.fecha_visita.like(f"%-{m_str}-%"))
    if comuna:
        q_comunas = q_comunas.filter(HistoricalVisit.comuna == comuna)
    top_comunas = q_comunas.group_by(HistoricalVisit.comuna).order_by(text("cnt DESC")).limit(15).all()
    top_comunas_list = [{"comuna": c, "total": int(t)} for c, t in top_comunas if c]

    # Top categorias year_a
    q_cats = db.query(
        HistoricalVisit.categoria_incidente, func.count(HistoricalVisit.id).label("cnt")
    ).filter(
        HistoricalVisit.source_year == year_a,
        HistoricalVisit.categoria_incidente.isnot(None),
        HistoricalVisit.categoria_incidente != "",
    )
    if month:
        q_cats = q_cats.filter(HistoricalVisit.fecha_visita.like(f"%-{m_str}-%"))
    if comuna:
        q_cats = q_cats.filter(HistoricalVisit.comuna == comuna)
    top_cats = q_cats.group_by(HistoricalVisit.categoria_incidente).order_by(text("cnt DESC")).limit(10).all()
    top_cats_list = [{"categoria": c, "total": int(t)} for c, t in top_cats if c]

    # Tendencias mensuales
    meses = [
        "01", "02", "03", "04", "05", "06",
        "07", "08", "09", "10", "11", "12",
    ]
    tendencias: dict[str, dict[str, int]] = {}
    for m in meses:
        entry: dict[str, int] = {}
        q_m = db.query(func.count(HistoricalVisit.id)).filter(
            HistoricalVisit.fecha_visita.like(f"%-{m}-%")
        )
        q_m_a = q_m.filter(HistoricalVisit.source_year == year_a)
        if comuna:
            q_m_a = q_m_a.filter(HistoricalVisit.comuna == comuna)
        cnt_a = q_m_a.scalar() or 0
        entry[str(year_a)] = int(cnt_a)
        if year_b:
            q_m_b = q_m.filter(HistoricalVisit.source_year == year_b)
            if comuna:
                q_m_b = q_m_b.filter(HistoricalVisit.comuna == comuna)
            cnt_b = q_m_b.scalar() or 0
            entry[str(year_b)] = int(cnt_b)
        if entry.get(str(year_a), 0) > 0 or (year_b and entry.get(str(year_b), 0) > 0):
            label_m = {
                "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
                "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
                "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
            }.get(m, m)
            tendencias[label_m] = entry

    # Hallazgos principales (deterministicos, sin IA)
    hallazgos = []
    if total_a > 0:
        hallazgos.append(f"{year_a}: {total_a} visitas registradas.")
    if year_b and total_b is not None and total_b > 0:
        hallazgos.append(f"{year_b}: {total_b} visitas registradas.")
    if variaciones.get("variacion_porcentual") is not None:
        v = variaciones["variacion_porcentual"]
        if v and v > 0:
            hallazgos.append(f"Aumento del {v:+.1f}% vs {year_a}.")
        elif v and v < 0:
            hallazgos.append(f"Disminucion del {v:+.1f}% vs {year_a}.")
        else:
            hallazgos.append("Volumen estable entre anos.")
    if top_comunas_list:
        hallazgos.append(f"Comuna lider: {top_comunas_list[0]['comuna']} ({top_comunas_list[0]['total']} visitas).")
    if top_cats_list:
        hallazgos.append(f"Categoria principal: {top_cats_list[0]['categoria']} ({top_cats_list[0]['total']} casos).")
    hallazgos.append("Datos agregados. Sin PII.")

    return HistoricalAiContextResponse(
        totales=totales,
        variaciones=variaciones,
        top_comunas=top_comunas_list,
        top_categorias=top_cats_list,
        tendencias_mensuales=tendencias,
        hallazgos_principales=hallazgos,
    )
