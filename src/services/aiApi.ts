const LEGACY_API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ||
  (LEGACY_API_BASE ? `${LEGACY_API_BASE}/api` : '/api');

const apiUrl = (path: string) => `${API_BASE}${path}`;

export type AiProvider = 'auto' | 'nvidia' | 'gemini' | 'groq' | 'openrouter';

export type AskAiPayload = {
  prompt: string;
  context?: string;
  provider?: AiProvider;
};

export type AskAiResponse = {
  provider: string;
  model: string;
  fallback: boolean;
  answer: string;
};

export async function askAi(payload: AskAiPayload): Promise<AskAiResponse> {
  const response = await fetch(apiUrl('/ai/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: payload.prompt,
      context: payload.context,
      provider: payload.provider ?? 'auto',
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? 'No se pudo consultar la IA');
  }

  return (await response.json()) as AskAiResponse;
}
