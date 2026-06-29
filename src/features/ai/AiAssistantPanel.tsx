import { useMemo, useState } from 'react';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import { askAi, type AiProvider, type AskAiResponse } from '../../services/aiApi';

const providerOptions: Array<{ label: string; value: AiProvider }> = [
  { label: 'Auto', value: 'auto' },
  { label: 'NVIDIA', value: 'nvidia' },
  { label: 'Gemini', value: 'gemini' },
  { label: 'Groq', value: 'groq' },
  { label: 'OpenRouter', value: 'openrouter' },
];

type AiAssistantPanelProps = {
  context?: string;
};

export function AiAssistantPanel({ context }: AiAssistantPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<AiProvider>('auto');
  const [answer, setAnswer] = useState<AskAiResponse | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !isLoading, [isLoading, prompt]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await askAi({
        prompt: prompt.trim(),
        context,
        provider,
      });
      setAnswer(response);
    } catch (requestError) {
      setAnswer(null);
      setError(requestError instanceof Error ? requestError.message : 'No se pudo consultar la IA');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="cc-card rounded-lg border border-white/[0.08] bg-[#111827] p-4 shadow-lg shadow-black/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
              <Bot size={18} />
            </span>
            <div>
              <h2 className="text-base font-black text-[#EAF0F8]">Asistente IA operativo</h2>
              <p className="text-xs font-semibold text-[#7A90A8]">Consulta segura desde backend, sin claves en React.</p>
            </div>
          </div>
        </div>
        <label className="grid min-w-[170px] gap-1 text-xs font-black uppercase tracking-wide text-[#7A90A8]">
          Proveedor
          <select
            className="h-10 rounded-lg border border-white/[0.08] bg-[#0D1117] px-3 text-sm font-bold normal-case text-[#EAF0F8] outline-none focus:border-[#1B4FD8]"
            onChange={(event) => setProvider(event.target.value as AiProvider)}
            value={provider}
          >
            {providerOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
        <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-[#7A90A8]">
          Pregunta
          <textarea
            className="min-h-28 resize-y rounded-lg border border-white/[0.08] bg-[#0D1117] px-3 py-3 text-sm font-semibold normal-case leading-relaxed text-[#EAF0F8] outline-none placeholder:text-[#52657D] focus:border-[#1B4FD8] focus:ring-4 focus:ring-[#1B4FD8]/15"
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ej: Resume los riesgos operativos principales de esta vista."
            value={prompt}
          />
        </label>
        <div className="flex items-end">
          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1B4FD8] px-4 text-sm font-black text-white shadow-lg shadow-blue-950/20 transition hover:bg-[#235ce5] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSubmit}
            onClick={handleSubmit}
            type="button"
          >
            {isLoading ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
            Preguntar a IA
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-100" role="alert">
          {error}
        </div>
      ) : null}

      {answer ? (
        <article className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.04] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wide text-[#7A90A8]">
            <Sparkles size={15} />
            <span>Proveedor: {answer.provider}</span>
            <span>Modelo: {answer.model}</span>
            {answer.fallback ? <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-amber-100">Fallback</span> : null}
          </div>
          <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[#EAF0F8]">{answer.answer}</p>
        </article>
      ) : null}
    </section>
  );
}
