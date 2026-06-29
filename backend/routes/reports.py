from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from services.monthly_report import generate_monthly_report, markdown_to_basic_html
from services.providers.nvidia_provider import ProviderConfigError, ProviderExternalError


router = APIRouter(prefix="/api/reports/monthly", tags=["monthly-reports"])


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


def _filters(payload: MonthlyReportRequest) -> dict:
    data = payload.model_dump(exclude={"include_ai_analysis", "include_sensitive_data"}, exclude_none=True)
    data["include_sensitive_data"] = payload.include_sensitive_data
    return data


@router.post("/preview")
def preview_monthly_report(payload: MonthlyReportRequest) -> dict:
    try:
        report = generate_monthly_report(_filters(payload), include_ai_analysis=payload.include_ai_analysis)
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
        "fallback": report.get("fallback", False),
        "provider": report.get("ai_provider"),
        "model": report.get("ai_model"),
    }


@router.post("/html")
def monthly_report_html(payload: MonthlyReportRequest) -> Response:
    try:
        report = generate_monthly_report(_filters(payload), include_ai_analysis=payload.include_ai_analysis)
    except ProviderConfigError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except ProviderExternalError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    html = markdown_to_basic_html(report["markdown"], report["title"])
    return Response(content=html, media_type="text/html; charset=utf-8")
