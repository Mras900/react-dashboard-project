from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from database import engine
from services.dashboard_context import sanitize_ai_context
from services.rag_indexer import ensure_rag_tables


def _metadata_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def rag_search(query: str, limit: int = 10, filters: dict | None = None) -> list[dict[str, Any]]:
    filters = filters or {}
    if engine is None:
        return []
    try:
        ensure_rag_tables()
    except Exception:
        return []
    where = ["LOWER(c.chunk_text) LIKE LOWER(:query)"] if query else ["1=1"]
    values: dict[str, Any] = {"query": f"%{query}%", "limit": max(1, min(limit, 50))}
    if filters.get("source_type"):
        where.append("d.source_type = :source_type")
        values["source_type"] = filters["source_type"]
    sql = f"""
        SELECT c.id, c.chunk_text, c.metadata, d.source_type, d.source_id, d.title
        FROM ai_chunks c JOIN ai_documents d ON d.id = c.document_id
        WHERE {' AND '.join(where)}
        ORDER BY c.id DESC
        LIMIT :limit
    """
    try:
        with engine.connect() as conn:
            rows = [dict(row._mapping) for row in conn.execute(text(sql), values).fetchall()]
    except SQLAlchemyError:
        return []
    result = []
    for row in rows:
        meta = _metadata_dict(row.get("metadata"))
        keep = True
        for key in ("comuna", "region"):
            if filters.get(key) and str(meta.get(key) or "").strip().lower() != str(filters.get(key)).strip().lower():
                keep = False
        if not keep:
            continue
        result.append(sanitize_ai_context({
            "id": row.get("id"),
            "source_type": row.get("source_type"),
            "source_id": row.get("source_id"),
            "title": row.get("title"),
            "chunk_text": row.get("chunk_text"),
            "metadata": meta,
        }))
    return result[: max(1, min(limit, 50))]


def build_rag_context(items: list[dict[str, Any]]) -> str:
    blocks = []
    for item in items:
        meta = item.get("metadata") or {}
        blocks.append(
            f"Fuente: {item.get('source_type')} / {item.get('title')}\n"
            f"Metadata: {json.dumps(meta, ensure_ascii=False)}\n"
            f"Contenido: {item.get('chunk_text')}"
        )
    return "\n\n---\n\n".join(blocks)



