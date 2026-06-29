from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from database import engine
from services.dashboard_context import sanitize_ai_context
from services.reference_sources import get_source_references


def ensure_rag_tables() -> None:
    if engine is None:
        return
    ddl = [
        """
        CREATE TABLE IF NOT EXISTS ai_documents (
            id SERIAL PRIMARY KEY,
            source_type TEXT NOT NULL,
            source_id TEXT,
            title TEXT,
            content TEXT NOT NULL,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(source_type, source_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS ai_chunks (
            id SERIAL PRIMARY KEY,
            document_id INT REFERENCES ai_documents(id) ON DELETE CASCADE,
            chunk_index INT DEFAULT 0,
            chunk_text TEXT NOT NULL,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
    ]
    if engine.url.get_backend_name() == "sqlite":
        ddl = [item.replace("SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT").replace("JSONB", "TEXT").replace("TIMESTAMP DEFAULT NOW()", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP") for item in ddl]
    with engine.begin() as conn:
        for statement in ddl:
            conn.execute(text(statement))


def _chunks(text_value: str, size: int = 1200) -> list[str]:
    return [text_value[index:index + size] for index in range(0, len(text_value), size)] or [text_value]


def _upsert_document(source_type: str, source_id: str, title: str, content: str, metadata: dict[str, Any]) -> bool:
    if engine is None:
        return False
    ensure_rag_tables()
    metadata = sanitize_ai_context(metadata)
    content = str(sanitize_ai_context(content) or "")
    try:
        with engine.begin() as conn:
            existing = conn.execute(text("SELECT id FROM ai_documents WHERE source_type=:source_type AND source_id=:source_id"), {"source_type": source_type, "source_id": source_id}).fetchone()
            if existing:
                doc_id = existing[0]
                conn.execute(text("UPDATE ai_documents SET title=:title, content=:content, metadata=:metadata WHERE id=:id"), {"id": doc_id, "title": title, "content": content, "metadata": json.dumps(metadata, ensure_ascii=False)})
                conn.execute(text("DELETE FROM ai_chunks WHERE document_id=:id"), {"id": doc_id})
                is_new = False
            else:
                row = conn.execute(text("INSERT INTO ai_documents (source_type, source_id, title, content, metadata) VALUES (:source_type, :source_id, :title, :content, :metadata) RETURNING id"), {"source_type": source_type, "source_id": source_id, "title": title, "content": content, "metadata": json.dumps(metadata, ensure_ascii=False)}).fetchone()
                doc_id = row[0]
                is_new = True
            for index, chunk in enumerate(_chunks(content)):
                conn.execute(text("INSERT INTO ai_chunks (document_id, chunk_index, chunk_text, metadata) VALUES (:document_id, :chunk_index, :chunk_text, :metadata)"), {"document_id": doc_id, "chunk_index": index, "chunk_text": chunk, "metadata": json.dumps(metadata, ensure_ascii=False)})
            return is_new
    except SQLAlchemyError:
        return False


def index_claims(limit: int = 1000) -> dict[str, Any]:
    if engine is None:
        return {"ok": False, "indexed": 0, "skipped": 0}
    ensure_rag_tables()
    try:
        with engine.connect() as conn:
            rows = [dict(row._mapping) for row in conn.execute(text("SELECT * FROM reclamos ORDER BY COALESCE(fecha_visita, fecha_recepcion, CAST(created_at AS TEXT)) DESC LIMIT :limit"), {"limit": limit}).fetchall()]
    except SQLAlchemyError:
        return {"ok": False, "indexed": 0, "skipped": 0}
    indexed = skipped = 0
    for row in rows:
        ticket = str(row.get("ticket") or row.get("id") or "sin-ticket")
        content = "\n".join(str(row.get(key) or "") for key in ("ticket", "comuna", "region", "estado_visita", "prioridad", "fecha_recepcion", "fecha_visita", "observacion"))
        metadata = {"comuna": row.get("comuna") or row.get("ciudad"), "region": row.get("region"), "estado": row.get("estado_visita"), "prioridad": row.get("prioridad"), "fecha": row.get("fecha_visita") or row.get("fecha_recepcion"), "ticket": row.get("ticket"), "producto": row.get("producto"), "motivo": row.get("motivo")}
        if _upsert_document("claim", ticket, f"Reclamo {ticket}", content, metadata):
            indexed += 1
        else:
            skipped += 1
    return {"ok": True, "indexed": indexed, "skipped": skipped}


def index_reference_sources() -> dict[str, Any]:
    refs = get_source_references({})
    indexed = skipped = 0
    sources = []
    root = Path(__file__).resolve().parents[2]
    for ref in refs:
        if not ref.get("available"):
            skipped += 1
            sources.append(ref)
            continue
        path = root / str(ref.get("path") or "")
        content = ref.get("title", "")
        if path.exists():
            try:
                content = path.read_text(encoding="utf-8")[:20000]
            except UnicodeDecodeError:
                content = ref.get("title", "")
        is_new = _upsert_document(str(ref.get("type") or "geo_layer"), str(ref.get("source_id")), str(ref.get("title")), content, ref)
        indexed += int(is_new)
        skipped += int(not is_new)
        sources.append(ref)
    return {"ok": True, "indexed": indexed, "skipped": skipped, "sources": sources}


