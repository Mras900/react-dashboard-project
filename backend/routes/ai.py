from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.ai_provider import ask_ai
from services.claim_similarity import find_similar_claims
from services.rag_indexer import index_claims, index_reference_sources
from services.rag_search import build_rag_context, rag_search
from services.dashboard_context import get_dashboard_context, get_dashboard_metrics
from services.providers.nvidia_provider import ProviderConfigError, ProviderExternalError


router = APIRouter(prefix="/api/ai", tags=["ai"])

AiProvider = Literal["auto", "nvidia", "gemini", "groq", "openrouter"]


class AiChatRequest(BaseModel):
    prompt: str
    context: str | None = None
    provider: AiProvider = "auto"


class AiChatResponse(BaseModel):
    provider: str
    model: str
    fallback: bool
    answer: str


@router.post("/chat", response_model=AiChatResponse)
def post_ai_chat(payload: AiChatRequest) -> AiChatResponse:
    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="El prompt no puede estar vacio.")

    try:
        result = ask_ai(prompt=prompt, context=payload.context, provider=payload.provider)
    except ProviderConfigError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except ProviderExternalError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return AiChatResponse(**result)
class DashboardAiRequest(BaseModel):
    territorio: str | None = None
    year: int | None = None
    month: int | None = None
    fecha_desde: str | None = None
    fecha_hasta: str | None = None
    comuna: str | None = None
    region: str | None = None
    estado: str | None = None
    prioridad: str | None = None
    provider: AiProvider = "auto"


def _filters_from_payload(payload: DashboardAiRequest) -> dict:
    return payload.model_dump(exclude_none=True, exclude={"provider"})


def _ask_with_dashboard_context(payload: DashboardAiRequest, prompt: str) -> dict:
    filters = _filters_from_payload(payload)
    context = get_dashboard_context(filters)
    try:
        result = ask_ai(prompt=prompt, context=context, provider=payload.provider)
    except ProviderConfigError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except ProviderExternalError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    return {**result, "metrics": get_dashboard_metrics(filters)}


@router.post("/dashboard-summary")
def post_dashboard_summary(payload: DashboardAiRequest) -> dict:
    return _ask_with_dashboard_context(
        payload,
        "Genera un resumen ejecutivo del dashboard con datos reales. No inventes cifras. Si no hay datos, dilo explicitamente.",
    )


@router.post("/analyze-comunas")
def post_analyze_comunas(payload: DashboardAiRequest) -> dict:
    return _ask_with_dashboard_context(
        payload,
        "Analiza comunas criticas con ranking absoluto, concentracion, posibles focos operativos y recomendaciones. Usa solo datos reales.",
    )


@router.post("/generate-report")
def post_generate_report(payload: DashboardAiRequest) -> dict:
    return _ask_with_dashboard_context(
        payload,
        "Genera un informe operativo textual con resumen general, comunas criticas, visitas exitosas/no exitosas, facturacion estimada, riesgos, recomendaciones y proximas acciones. Usa solo datos reales.",
    )
class SimilarClaimsRequest(BaseModel):
    query: str
    limit: int = 10
    filters: dict | None = None
    provider: AiProvider = "auto"


class RagSearchRequest(BaseModel):
    query: str = ""
    limit: int = 10
    filters: dict | None = None
    provider: AiProvider = "auto"


@router.post("/similar-claims")
def post_similar_claims(payload: SimilarClaimsRequest) -> dict:
    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="La busqueda no puede estar vacia.")
    items = find_similar_claims(query=query, limit=payload.limit, filters=payload.filters or {})
    warnings = [] if items else ["No se encontraron reclamos parecidos para los filtros seleccionados."]
    return {"items": items, "count": len(items), "warnings": warnings}


@router.post("/similar-claims-summary")
def post_similar_claims_summary(payload: SimilarClaimsRequest) -> dict:
    items = find_similar_claims(query=payload.query, limit=payload.limit, filters=payload.filters or {})
    context = {"query": payload.query, "items": items}
    try:
        result = ask_ai(
            prompt="Resume reclamos parecidos. Incluye patrones, comunas repetidas, estados, productos/motivos si existen, concentracion territorial, zonas rojas, visitas no exitosas, intensidad por poblacion si existe, causas operativas y recomendaciones de ruta.",
            context=str(context),
            provider=payload.provider,
        )
    except ProviderConfigError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except ProviderExternalError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    return {**result, "items": items, "count": len(items)}


@router.post("/rag/index-claims")
def post_rag_index_claims() -> dict:
    return index_claims()


@router.post("/rag/index-reference-sources")
def post_rag_index_reference_sources() -> dict:
    return index_reference_sources()


@router.post("/rag/search")
def post_rag_search(payload: RagSearchRequest) -> dict:
    items = rag_search(payload.query, limit=payload.limit, filters=payload.filters or {})
    return {"items": items, "count": len(items), "warnings": [] if items else ["No se encontraron chunks relevantes."]}


@router.post("/rag/chat")
def post_rag_chat(payload: RagSearchRequest) -> dict:
    items = rag_search(payload.query, limit=payload.limit, filters=payload.filters or {})
    if not items:
        return {"provider": "none", "model": "none", "fallback": False, "answer": "No hay informacion suficiente en el indice RAG para responder.", "items": []}
    try:
        result = ask_ai(
            prompt="Responde usando solo el contexto encontrado. No inventes datos. Menciona tickets, comunas y estados usados como base cuando esten disponibles. Si hay fuentes territoriales, indica segun la fuente disponible.",
            context=build_rag_context(items),
            provider=payload.provider,
        )
    except ProviderConfigError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except ProviderExternalError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    return {**result, "items": items}
