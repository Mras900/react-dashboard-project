import os
from typing import Any

import requests

from services.providers.nvidia_provider import ProviderConfigError, ProviderExternalError


DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


def ask_gemini(prompt: str, context: str | None = None, system_prompt: str | None = None) -> dict[str, Any]:
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not api_key:
        raise ProviderConfigError("GEMINI_API_KEY no esta configurada.")

    model = (os.getenv("GEMINI_MODEL") or DEFAULT_GEMINI_MODEL).strip()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    text_parts = []
    if system_prompt:
        text_parts.append(system_prompt)
    if context:
        text_parts.append(f"Contexto:\n{context}")
    text_parts.append(f"Pregunta:\n{prompt}")

    try:
        response = requests.post(
            url,
            params={"key": api_key},
            json={"contents": [{"parts": [{"text": "\n\n".join(text_parts)}]}]},
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()
    except Exception as error:  # noqa: BLE001
        raise ProviderExternalError("Fallo la llamada a Gemini.") from error

    candidates = payload.get("candidates") if isinstance(payload, dict) else None
    content = candidates[0].get("content", {}) if candidates else {}
    parts = content.get("parts", []) if isinstance(content, dict) else []
    answer = "\n".join(str(part.get("text", "")) for part in parts if isinstance(part, dict)).strip()
    return {
        "provider": "gemini",
        "model": model,
        "answer": answer,
    }
