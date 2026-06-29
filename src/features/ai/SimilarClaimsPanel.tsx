import { useState } from 'react';
import { Loader2, Search, Sparkles } from 'lucide-react';
import { findSimilarClaims, summarizeSimilarClaims, type SimilarClaimsPayload } from '../../services/aiApi';

export function SimilarClaimsPanel() {
  const [query, setQuery] = useState('');
  const [territorio, setTerritorio] = useState<'rm' | 'regiones' | 'nacional'>('rm');
  const [comuna, setComuna] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [onlyRed, setOnlyRed] = useState(false);
  const [includeTerritory, setIncludeTerritory] = useState(true);
  const [riskLevel, setRiskLevel] = useState<'' | 'alto' | 'medio' | 'bajo'>('');
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [summary, setSummary] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const payload = (): SimilarClaimsPayload => ({
    query,
    limit: 10,
    filters: {
      territorio,
      comuna: comuna || undefined,
      year,
      month,
      include_territorial_context: includeTerritory,
      only_red_zone_communes: onlyRed,
      risk_level: riskLevel || null,
    },
  });

  const runSearch = async () => {
    setLoading(true);
    setError('');
    setSummary('');
    try {
      const response = await findSimilarClaims(payload());
      setItems(response.items);
      setWarnings(response.warnings ?? []);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'No se pudo buscar reclamos parecidos');
    } finally {
      setLoading(false);
    }
  };

  const runSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await summarizeSimilarClaims(payload());
      setItems(response.items);
      setSummary(response.answer ?? 'Sin resumen IA disponible.');
      setWarnings(response.warnings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo resumir coincidencias');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#111827] p-4 shadow-lg shadow-black/20">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-wide text-[#7A90A8]">IA / reclamos parecidos</p>
        <h2 className="text-xl font-black text-[#EAF0F8]">Buscar casos similares</h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_140px_120px_120px]">
        <input className="h-10 rounded-lg border border-white/[0.08] bg-[#0D1117] px-3 text-sm font-semibold text-[#EAF0F8] outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Describe caso, ticket, observacion o comuna" value={query} />
        <select className="h-10 rounded-lg border border-white/[0.08] bg-[#0D1117] px-3 text-sm font-bold text-[#EAF0F8]" onChange={(event) => setTerritorio(event.target.value as 'rm' | 'regiones' | 'nacional')} value={territorio}>
          <option value="rm">RM</option><option value="regiones">Regiones</option><option value="nacional">Nacional</option>
        </select>
        <input className="h-10 rounded-lg border border-white/[0.08] bg-[#0D1117] px-3 text-sm font-semibold text-[#EAF0F8]" onChange={(event) => setComuna(event.target.value)} placeholder="Comuna" value={comuna} />
        <input className="h-10 rounded-lg border border-white/[0.08] bg-[#0D1117] px-3 text-sm font-semibold text-[#EAF0F8]" onChange={(event) => setYear(Number(event.target.value))} type="number" value={year} />
        <input className="h-10 rounded-lg border border-white/[0.08] bg-[#0D1117] px-3 text-sm font-semibold text-[#EAF0F8]" max={12} min={1} onChange={(event) => setMonth(Number(event.target.value))} type="number" value={month} />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-[#C8D7EA]">
        <label className="flex items-center gap-2"><input checked={onlyRed} onChange={(event) => setOnlyRed(event.target.checked)} type="checkbox" /> Solo comunas con zonas rojas</label>
        <label className="flex items-center gap-2"><input checked={includeTerritory} onChange={(event) => setIncludeTerritory(event.target.checked)} type="checkbox" /> Incluir contexto territorial</label>
        <select className="h-9 rounded-lg border border-white/[0.08] bg-[#0D1117] px-3 text-sm font-bold text-[#EAF0F8]" onChange={(event) => setRiskLevel(event.target.value as '' | 'alto' | 'medio' | 'bajo')} value={riskLevel}>
          <option value="">Riesgo todos</option><option value="alto">Alto</option><option value="medio">Medio</option><option value="bajo">Bajo</option>
        </select>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-lg bg-[#1B4FD8] px-4 py-2 text-sm font-black text-white disabled:opacity-50" disabled={loading || !query.trim()} onClick={runSearch} type="button">{loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />} Buscar reclamos parecidos</button>
        <button className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-4 py-2 text-sm font-black text-[#EAF0F8] disabled:opacity-50" disabled={loading || !query.trim()} onClick={runSummary} type="button"><Sparkles size={16} /> Resumir coincidencias con IA</button>
      </div>
      {error ? <div className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-100">{error}</div> : null}
      {warnings.length ? <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100">{warnings.join(' ')}</div> : null}
      {summary ? <article className="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm font-semibold text-cyan-50 whitespace-pre-wrap">{summary}</article> : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => {
          const context = (item.territorial_context as Record<string, unknown> | undefined) ?? {};
          return (
            <article className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-3" key={`${item.ticket ?? index}`}>
              <div className="flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wide text-[#7A90A8]"><span>{String(item.comuna ?? 'Sin comuna')}</span><span>Score {String(item.score ?? '0')}</span></div>
              <h3 className="mt-2 text-sm font-black text-[#EAF0F8]">Ticket {String(item.ticket ?? 'sin ticket')}</h3>
              <p className="mt-1 text-xs font-semibold text-[#C8D7EA]">{String(item.estado ?? 'Sin estado')} · {String(item.prioridad ?? 'Sin prioridad')}</p>
              <p className="mt-2 text-sm font-semibold text-[#EAF0F8]">{String(item.observacion_resumida ?? 'Sin observacion')}</p>
              {context.risk_level ? <p className="mt-2 text-xs font-black text-amber-100">Riesgo territorial: {String(context.risk_level)} · zonas rojas: {context.has_red_zones ? 'si' : 'no'}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

