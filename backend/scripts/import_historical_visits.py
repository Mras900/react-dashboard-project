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


# --- Columnas esperadas y mapeo ---
COLUMN_MAP = {
    "cliente": "cliente",
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
    if not val or not val.strip():
        return None
    v = val.strip()
    for sep in ["-", "/"]:
        parts = v.split(sep)
        if len(parts) == 3:
            try:
                d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                if 1 <= d <= 31 and 1 <= m <= 12:
                    if y < 100:
                        y += 2000
                    return f"{y:04d}-{m:02d}-{d:02d}"
            except ValueError:
                continue
    return v


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


def ensure_table(engine):
    """Crea la tabla si no existe."""
    from models.historical_visit import HistoricalVisit
    from database import Base
    Base.metadata.create_all(bind=engine)
    print("[OK] Tabla historical_visits asegurada.")


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

            # Raw row sanitizada
            raw_row_safe = {}
            for header, value in row.items():
                h = header.strip()
                h_lower = normalize_header(h)
                if h_lower in ("rut", "correo electronico", "correo electrónico",
                               "direccion (cliente)", "dirección (cliente)", "email", "e-mail"):
                    continue
                val = (value or "").strip()
                if val:
                    raw_row_safe[h] = val
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
