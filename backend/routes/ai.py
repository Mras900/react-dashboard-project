from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.ai_provider import ask_ai
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
