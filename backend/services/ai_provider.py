import os
from typing import Any, Callable

from services.providers.gemini_provider import ask_gemini
from services.providers.groq_provider import ask_groq
from services.providers.nvidia_provider import ProviderConfigError, ProviderExternalError, ask_nvidia
from services.providers.openrouter_provider import ask_openrouter


BASE_SYSTEM_PROMPT = (
    "Eres un asistente operativo para un dashboard de reclamos, visitas, rutas, comunas, "
    "regiones y facturacion. Responde en espanol de Chile, de forma ejecutiva y clara. "
    "No inventes datos. Si falta informacion, dilo explicitamente."
)

ProviderFn = Callable[[str, str | None, str | None], dict[str, Any]]
PROVIDERS: dict[str, ProviderFn] = {
    "nvidia": ask_nvidia,
    "gemini": ask_gemini,
    "groq": ask_groq,
    "openrouter": ask_openrouter,
}


def _clean_provider(value: str | None) -> str | None:
    cleaned = (value or "").strip().lower()
    if not cleaned or cleaned == "auto":
        return None
    return cleaned


def _call_provider(provider_name: str, prompt: str, context: str | None, system_prompt: str | None) -> dict[str, Any]:
    provider_fn = PROVIDERS.get(provider_name)
    if provider_fn is None:
        raise ProviderConfigError(f"Proveedor IA no soportado: {provider_name}.")
    return provider_fn(prompt, context, system_prompt or BASE_SYSTEM_PROMPT)


def ask_ai(
    prompt: str,
    context: str | None = None,
    system_prompt: str | None = None,
    provider: str | None = None,
) -> dict[str, Any]:
    requested_provider = _clean_provider(provider)
    primary_provider = requested_provider or _clean_provider(os.getenv("AI_PROVIDER")) or "nvidia"
    fallback_provider = _clean_provider(os.getenv("AI_FALLBACK_PROVIDER"))

    try:
        result = _call_provider(primary_provider, prompt, context, system_prompt)
        return {**result, "fallback": False}
    except (ProviderConfigError, ProviderExternalError):
        if not fallback_provider or fallback_provider == primary_provider:
            raise

    result = _call_provider(fallback_provider, prompt, context, system_prompt)
    return {**result, "fallback": True}
