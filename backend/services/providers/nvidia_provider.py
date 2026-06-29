import os
from typing import Any


class ProviderConfigError(RuntimeError):
    pass


class ProviderExternalError(RuntimeError):
    pass


DEFAULT_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
DEFAULT_NVIDIA_MODEL = "nvidia/nemotron-3-super-120b-a12b"


def _build_messages(prompt: str, context: str | None, system_prompt: str | None) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if context:
        messages.append({"role": "user", "content": f"Contexto:\n{context}\n\nPregunta:\n{prompt}"})
    else:
        messages.append({"role": "user", "content": prompt})
    return messages


def ask_nvidia(prompt: str, context: str | None = None, system_prompt: str | None = None) -> dict[str, Any]:
    api_key = (os.getenv("NVIDIA_API_KEY") or "").strip()
    if not api_key:
        raise ProviderConfigError("NVIDIA_API_KEY no esta configurada.")

    base_url = (os.getenv("NVIDIA_BASE_URL") or DEFAULT_NVIDIA_BASE_URL).strip()
    model = (os.getenv("NVIDIA_MODEL") or DEFAULT_NVIDIA_MODEL).strip()

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, base_url=base_url)
        completion = client.chat.completions.create(
            model=model,
            messages=_build_messages(prompt, context, system_prompt),
            temperature=0.2,
        )
    except Exception as error:  # noqa: BLE001
        raise ProviderExternalError("Fallo la llamada a NVIDIA NIM.") from error

    answer = completion.choices[0].message.content if completion.choices else ""
    return {
        "provider": "nvidia",
        "model": model,
        "answer": answer or "",
    }
