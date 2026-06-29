from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.monthly_report import generate_monthly_report, markdown_to_basic_html
from services.providers.nvidia_provider import ProviderConfigError, ProviderExternalError
from services.report_exporter import resolve_report_file, save_monthly_report_docx, save_monthly_report_html, save_monthly_report_pdf


router = APIRouter(prefix="/api/reports", tags=["monthly-reports"])


class MonthlyReportRequest(BaseModel):
    territorio: str = "rm"
    year: int
    month: int
    fecha_desde: str | None = None
    fecha_hasta: str | None = None
    comuna: str | None = None
    region: str | None = None
    estado: str | None = None
    prioridad: str | None = None
    include_ai_analysis: bool = True
    include_sensitive_data: bool = False
    include_census: bool = True
    include_red_zones: bool = True
    include_source_references: bool = True


class MonthlyExportRequest(MonthlyReportRequest):
    format: str = "html"


def _filters(payload: MonthlyReportRequest) -> dict:
    return payload.model_dump(exclude={"include_ai_analysis"}, exclude_none=True)


def _build_report(payload: MonthlyReportRequest) -> dict:
    return generate_monthly_report(_filters(payload), include_ai_analysis=payload.include_ai_analysis)


@router.post("/monthly/preview")
def preview_monthly_report(payload: MonthlyReportRequest) -> dict:
    try:
        report = _build_report(payload)
    except ProviderConfigError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except ProviderExternalError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    return {
        "ok": True,
        "report_id": report["report_id"],
        "title": report["title"],
        "markdown": report["markdown"],
        "metrics": report["metrics"],
        "source_references": report.get("source_references", []),
        "warnings": report.get("warnings", []),
        "fallback": report.get("fallback", False),
        "provider": report.get("ai_provider"),
        "model": report.get("ai_model"),
    }


@router.post("/monthly/html")
def monthly_report_html(payload: MonthlyReportRequest) -> Response:
    try:
        report = _build_report(payload)
    except ProviderConfigError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except ProviderExternalError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    html = markdown_to_basic_html(report["markdown"], report["title"])
    return Response(content=html, media_type="text/html; charset=utf-8")


@router.post("/monthly/export")
def export_monthly_report(payload: MonthlyExportRequest) -> dict:
    export_format = payload.format.lower().strip()
    if export_format not in {"html", "pdf", "docx"}:
        raise HTTPException(status_code=400, detail="Formato no soportado.")
    try:
        report = _build_report(payload)
    except ProviderConfigError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except ProviderExternalError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    html = markdown_to_basic_html(report["markdown"], report["title"])
    warnings = list(report.get("warnings", []))
    path = None
    if export_format == "html":
        path = save_monthly_report_html(report["report_id"], html)
    elif export_format == "pdf":
        path = save_monthly_report_pdf(report["report_id"], html)
        if path is None:
            warnings.append("Export PDF preparado, pero libreria PDF no disponible.")
    elif export_format == "docx":
        path = save_monthly_report_docx(report["report_id"], report["markdown"])
        if path is None:
            warnings.append("Export Word preparado, pero libreria DOCX no disponible.")
    if path is None:
        return {"ok": False, "report_id": report["report_id"], "format": export_format, "download_url": None, "warnings": warnings}
    filename = path.replace("\\", "/").split("/")[-1]
    return {"ok": True, "report_id": report["report_id"], "format": export_format, "download_url": f"/api/reports/download/{filename}", "warnings": warnings}


@router.get("/download/{filename}")
def download_report(filename: str) -> FileResponse:
    path = resolve_report_file(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    media_type = "text/html" if filename.endswith(".html") else "application/octet-stream"
    return FileResponse(path, media_type=media_type, filename=filename)
