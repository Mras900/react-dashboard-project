import os
from typing import Any

from services.providers.nvidia_provider import ProviderConfigError, ProviderExternalError, _build_messages


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def ask_openrouter(prompt: str, context: str | None = None, system_prompt: str | None = None) -> dict[str, Any]:
    api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        raise ProviderConfigError("OPENROUTER_API_KEY no esta configurada.")

    model = (os.getenv("OPENROUTER_MODEL") or "").strip()
    if not model:
        raise ProviderConfigError("OPENROUTER_MODEL no esta configurado.")

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, base_url=OPENROUTER_BASE_URL)
        completion = client.chat.completions.create(
            model=model,
            messages=_build_messages(prompt, context, system_prompt),
            temperature=0.2,
        )
    except Exception as error:  # noqa: BLE001
        raise ProviderExternalError("Fallo la llamada a OpenRouter.") from error

    answer = completion.choices[0].message.content if completion.choices else ""
    return {
        "provider": "openrouter",
        "model": model,
        "answer": answer or "",
    }
