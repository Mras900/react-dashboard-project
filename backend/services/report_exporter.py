from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "generated_reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)
SAFE_RE = re.compile(r"[^A-Za-z0-9_.-]+")


def _safe_name(report_id: str, suffix: str) -> str:
    cleaned = SAFE_RE.sub("-", report_id).strip(".-") or "report"
    return f"{cleaned}.{suffix}"


def save_monthly_report_html(report_id: str, html: str) -> str:
    filename = _safe_name(report_id, "html")
    path = REPORT_DIR / filename
    path.write_text(html, encoding="utf-8")
    return str(path)


def save_monthly_report_pdf(report_id: str, html: str) -> str | None:
    return None


def save_monthly_report_docx(report_id: str, markdown: str) -> str | None:
    return None


def resolve_report_file(filename: str) -> Path | None:
    if Path(filename).name != filename:
        return None
    if not filename.lower().endswith((".html", ".pdf", ".docx")):
        return None
    path = REPORT_DIR / filename
    try:
        resolved = path.resolve()
        if not str(resolved).startswith(str(REPORT_DIR.resolve())):
            return None
    except OSError:
        return None
    return path if path.exists() else None
