import os
from typing import Any

from services.providers.nvidia_provider import ProviderConfigError, ProviderExternalError, _build_messages


DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"


def ask_groq(prompt: str, context: str | None = None, system_prompt: str | None = None) -> dict[str, Any]:
    api_key = (os.getenv("GROQ_API_KEY") or "").strip()
    if not api_key:
        raise ProviderConfigError("GROQ_API_KEY no esta configurada.")

    model = (os.getenv("GROQ_MODEL") or DEFAULT_GROQ_MODEL).strip()
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, base_url=GROQ_BASE_URL)
        completion = client.chat.completions.create(
            model=model,
            messages=_build_messages(prompt, context, system_prompt),
            temperature=0.2,
        )
    except Exception as error:  # noqa: BLE001
        raise ProviderExternalError("Fallo la llamada a Groq.") from error

    answer = completion.choices[0].message.content if completion.choices else ""
    return {
        "provider": "groq",
        "model": model,
        "answer": answer or "",
    }
