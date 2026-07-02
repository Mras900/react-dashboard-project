#!/usr/bin/env python3
"""Importador offline de visitas historicas a PostgreSQL.

Uso:
    python backend/scripts/import_historical_visits.py --file "data/historical/2025.csv" --year 2025 --dataset "visitas_2025"

Requiere:
    - DATABASE_URL en backend/.env o variable de entorno
    - pandas, sqlalchemy, python-dotenv
"""

import argparse
import csv
import hashlib
import io
import os
import sys
from datetime import datetime
from pathlib import Path

# Asegurar que backend/ esta en el path
SCRIPT_DIR = Path(__file__).resolve().parent  # backend/scripts/
BACKEND_DIR = SCRIPT_DIR.parent  # backend/
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=False)

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker


# --- PII columns never stored ---
_PII_TOKENS = {"rut", "correo electronico", "correo electrónico",
               "direccion (cliente)", "dirección (cliente)", "direccion",
               "dirección", "email", "e-mail",
               "cliente"}


def _is_pii(h: str) -> bool:
    n = normalize_header(h)
    for t in _PII_TOKENS:
        if n == t or n.startswith(t) or t.startswith(n):
            return True
    return bool("cliente" in n and "producto" not in n)


# --- Columnas esperadas y mapeo (sin PII) ---
COLUMN_MAP = {
    "ticket": "ticket",
    "kut estado 2": "kut_estado_2",
    "rut": "_rut_raw",
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


def normalize_header(h: str) -> str:
    return h.strip().lower().replace("¿", "").replace("?", "").strip()


def parse_chilean_date(val: str) -> str | None:
    """Convierte fecha a ISO yyyy-mm-dd. Soporta dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd."""
    if not val or not val.strip():
        return None
    v = val.strip()
    if v in ("#", "-", "."):
        return None
    for sep in ["/", "-", "."]:
        if sep not in v:
            continue
        parts = v.split(sep)
        if len(parts) != 3:
            continue
        try:
            p0, p1, p2 = int(parts[0]), int(parts[1]), int(parts[2])
        except ValueError:
            continue
        if p0 > 31:
            y, m, d = p0, p1, p2
        elif p2 > 31:
            d, m, y = p0, p1, p2
        else:
            d, m, y = p0, p1, p2  # dd-mm-yyyy (Chile)
        if y < 100:
            y += 2000
        if 1 <= m <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"
    import re as _re
    if _re.match(r"^\d{4}-\d{2}-\d{2}$", v):
        return v
    return None


def clean_numeric(val: str) -> float | None:
    if not val or not val.strip():
        return None
    v = val.strip().replace("$", "").replace(" ", "")
    if not v:
        return None
    try:
        if "," in v and "." in v:
            v = v.replace(".", "").replace(",", ".")
        elif "," in v:
            v = v.replace(",", ".")
        return float(v)
    except (ValueError, TypeError):
        return None


def hash_rut(rut: str) -> str | None:
    if not rut or not rut.strip():
        return None
    cleaned = rut.strip().upper().replace(".", "").replace("-", "").replace(" ", "")
    if not cleaned:
        return None
    return hashlib.sha256(cleaned.encode("utf-8")).hexdigest()


_ALTER_SQL = [
    "ALTER TABLE historical_visits ALTER COLUMN tiene_envase TYPE TEXT",
    "ALTER TABLE historical_visits ALTER COLUMN tiene_muestra TYPE TEXT",
    "ALTER TABLE historical_visits ALTER COLUMN imposibilidad_contacto TYPE TEXT",
    "ALTER TABLE historical_visits ALTER COLUMN requiere_respuesta TYPE TEXT",
    "ALTER TABLE historical_visits ALTER COLUMN prioridad TYPE TEXT",
    "ALTER TABLE historical_visits ALTER COLUMN estado TYPE TEXT",
    "ALTER TABLE historical_visits ALTER COLUMN kut_estado_2 TYPE TEXT",
]


def ensure_historical_columns(engine):
    """Amplia columnas existentes de VARCHAR(10) a TEXT."""
    try:
        existing = {c["name"] for c in __import__("sqlalchemy").inspect(engine).get_columns("historical_visits")}
    except Exception:
        return  # table does not exist yet
    for sql in _ALTER_SQL:
        col_name = sql.split()[-1].lower()
        if col_name not in existing:
            continue
        try:
            with engine.connect() as conn:
                conn.execute(text(f"SET statement_timeout = '5s'"))
                conn.execute(text(sql))
                conn.commit()
        except Exception:
            pass
    print("[OK] Columnas migradas a TEXT.")


def ensure_table(engine):
    """Crea la tabla si no existe."""
    from models.historical_visit import HistoricalVisit
    from database import Base
    Base.metadata.create_all(bind=engine)
    print("[OK] Tabla historical_visits asegurada.")
    ensure_historical_columns(engine)


def import_file(
    session: Session,
    filepath: str,
    source_year: int | None,
    dataset_name: str,
) -> dict:
    stats = {"imported": 0, "skipped": 0, "errors": 0, "years": set()}

    with open(filepath, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, delimiter=";")

        if not reader.fieldnames:
            print("[ERROR] CSV sin columnas o separador incorrecto.")
            return stats

        headers_raw = [h.strip() for h in reader.fieldnames if h]
        col_map = {}
        for h in headers_raw:
            normalized = normalize_header(h)
            target = None
            for pattern, mapped in COLUMN_MAP.items():
                if pattern == normalized or normalized.startswith(pattern) or pattern.startswith(normalized):
                    target = mapped
                    break
            col_map[h] = target

        for row_num, row in enumerate(reader, start=2):
            ticket_val = (row.get("Ticket") or row.get("TICKET") or "").strip()
            if not ticket_val:
                stats["errors"] += 1
                continue

            mapped = {}
            _rut_raw = None
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
                    mapped[target] = clean_numeric(val)
                elif target in ("fecha_visita", "fecha_envio_laboratorio", "fecha_respuesta"):
                    mapped[target] = parse_chilean_date(val)
                elif target == "source_year":
                    try:
                        mapped[target] = int(float(val))
                    except (ValueError, TypeError):
                        mapped[target] = None
                else:
                    mapped[target] = val if val else None

            # Inferir year
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
                stats["errors"] += 1
                continue

            mapped["source_year"] = use_year
            if dataset_name:
                mapped["dataset_name"] = dataset_name

            # Duplicado check
            from models.historical_visit import HistoricalVisit
            existing = session.query(HistoricalVisit).filter(
                HistoricalVisit.ticket == ticket_val,
                HistoricalVisit.source_year == use_year,
            ).first()
            if existing:
                stats["skipped"] += 1
                continue

            # Hash RUT y privacidad
            if _rut_raw:
                mapped["rut_hash"] = hash_rut(_rut_raw)
            mapped["has_email"] = _has_email
            mapped["has_address"] = _has_address

            # Raw row sanitizada (sin PII)
            raw_row_safe = {}
            for header, value in row.items():
                if _is_pii(header.strip()):
                    continue
                val = (value or "").strip()
                if val:
                    raw_row_safe[header.strip()] = val
            mapped["raw_row"] = raw_row_safe if raw_row_safe else None

            record = HistoricalVisit(**mapped)
            session.add(record)
            stats["imported"] += 1
            stats["years"].add(use_year)

            # Commit cada 500
            if stats["imported"] % 500 == 0:
                session.commit()
                print(f"  ... {stats['imported']} importados hasta fila {row_num}")

    session.commit()
    return stats


def main():
    parser = argparse.ArgumentParser(description="Importar visitas historicas CSV a PostgreSQL")
    parser.add_argument("--file", required=True, help="Ruta al archivo CSV historico")
    parser.add_argument("--year", type=int, default=None, help="Override source_year")
    parser.add_argument("--dataset", default="", help="Nombre del dataset")
    args = parser.parse_args()

    filepath = Path(args.file)
    if not filepath.exists():
        print(f"[ERROR] Archivo no encontrado: {filepath}")
        sys.exit(1)

    DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
    if not DATABASE_URL:
        print("[ERROR] DATABASE_URL no configurada en backend/.env")
        sys.exit(1)

    print(f"[INFO] Conectando a base de datos...")
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    ensure_table(engine)

    print(f"[INFO] Importando: {filepath}")
    print(f"       Dataset: {args.dataset or '(sin nombre)'}")
    print(f"       Year override: {args.year or 'auto-detectar'}")

    with SessionLocal() as session:
        stats = import_file(session, str(filepath), args.year, args.dataset)

    print("\n=== RESUMEN ===")
    print(f"  Importados:       {stats['imported']}")
    print(f"  Duplicados omit:  {stats['skipped']}")
    print(f"  Errores:          {stats['errors']}")
    print(f"  Anos detectados:  {sorted(stats['years'])}")

    if stats["imported"] > 0:
        print("\n[OK] Importacion completada.")
    else:
        print("\n[WARN] No se importaron registros.")

    # Verificacion final
    with SessionLocal() as session:
        total = session.query(type("M", (object,), {"count": lambda q: session.execute(
            text("SELECT COUNT(*) FROM historical_visits")
        ).scalar()})).count
        total_count = session.execute(
            text("SELECT COUNT(*) FROM historical_visits")
        ).scalar()
        print(f"\n[DB] Total registros en historical_visits: {total_count}")


if __name__ == "__main__":
    main()
