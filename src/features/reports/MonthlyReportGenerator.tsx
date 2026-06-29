import { useMemo, useState } from 'react';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import { exportMonthlyReport, getMonthlyReportHtml, previewMonthlyReport, type MonthlyReportPreview } from '../../services/aiApi';

const monthOptions = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((label, index) => ({ label, value: index + 1 }));
type Territory = 'rm' | 'regiones' | 'nacional';
type ExportFormat = 'html' | 'pdf' | 'docx';

const formatMetric = (value: unknown) => {
  const numberValue = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numberValue) ? new Intl.NumberFormat('es-CL').format(numberValue) : '0';
};

export function MonthlyReportGenerator() {
  const currentYear = new Date().getFullYear();
  const [territorio, setTerritorio] = useState<Territory>('rm');
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [includeAiAnalysis, setIncludeAiAnalysis] = useState(false);
  const [hideSensitiveData, setHideSensitiveData] = useState(true);
  const [includeCensus, setIncludeCensus] = useState(true);
  const [includeRedZones, setIncludeRedZones] = useState(true);
  const [includeSourceReferences, setIncludeSourceReferences] = useState(true);
  const [format, setFormat] = useState<ExportFormat>('html');
  const [preview, setPreview] = useState<MonthlyReportPreview | null>(null);
  const [htmlPreview, setHtmlPreview] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const filters = useMemo(() => ({
    territorio,
    year,
    month,
    include_ai_analysis: includeAiAnalysis,
    include_sensitive_data: hideSensitiveData,
    include_census: includeCensus,
    include_red_zones: includeRedZones,
    include_source_references: includeSourceReferences,
  }), [hideSensitiveData, includeAiAnalysis, includeCensus, includeRedZones, includeSourceReferences, month, territorio, year]);

  const handlePreview = async (forceAi = includeAiAnalysis) => {
    setIsLoading(true);
    setError('');
    setHtmlPreview('');
    setDownloadUrl('');
    try {
      setPreview(await previewMonthlyReport({ ...filters, include_ai_analysis: forceAi }));
    } catch (requestError) {
      setPreview(null);
      setError(requestError instanceof Error ? requestError.message : 'No se pudo generar el informe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHtmlPreview = async () => {
    setIsLoading(true);
    setError('');
    try {
      setHtmlPreview(await getMonthlyReportHtml(filters));
    } catch (requestError) {
      setHtmlPreview('');
      setError(requestError instanceof Error ? requestError.message : 'No se pudo generar el HTML');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    setIsLoading(true);
    setError('');
    setDownloadUrl('');
    try {
      const response = await exportMonthlyReport({ ...filters, format });
      setDownloadUrl(response.download_url ?? '');
      if (!response.ok) setError(response.warnings.join(' ') || 'Formato no disponible');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo exportar el informe');
    } finally {
      setIsLoading(false);
    }
  };

  const metrics = preview?.metrics ?? {};
  const sourceRefs = preview?.source_references ?? [];
  const warnings = preview?.warnings ?? [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Informe mensual</p><h2 className="text-xl font-black text-[#071b4d]">Generador operativo con datos reales</h2></div>
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700"><FileText size={15} /> Sin datos personales por defecto</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">Territorio<select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold text-[#071b4d]" onChange={(event) => setTerritorio(event.target.value as Territory)} value={territorio}><option value="rm">RM</option><option value="regiones">Regiones</option><option value="nacional">Nacional</option></select></label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">Año<input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold text-[#071b4d]" max={2100} min={2020} onChange={(event) => setYear(Number(event.target.value))} type="number" value={year} /></label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">Mes<select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold text-[#071b4d]" onChange={(event) => setMonth(Number(event.target.value))} value={month}>{monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">Formato<select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold text-[#071b4d]" onChange={(event) => setFormat(event.target.value as ExportFormat)} value={format}><option value="html">HTML</option><option value="pdf">PDF</option><option value="docx">Word</option></select></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-[#071b4d]">
        <label className="flex items-center gap-2"><input checked={includeAiAnalysis} onChange={(event) => setIncludeAiAnalysis(event.target.checked)} type="checkbox" /> Incluir analisis IA</label>
        <label className="flex items-center gap-2"><input checked={hideSensitiveData} onChange={(event) => setHideSensitiveData(event.target.checked)} type="checkbox" /> Ocultar datos personales</label>
        <label className="flex items-center gap-2"><input checked={includeCensus} onChange={(event) => setIncludeCensus(event.target.checked)} type="checkbox" /> Incluir referencia Censo</label>
        <label className="flex items-center gap-2"><input checked={includeRedZones} onChange={(event) => setIncludeRedZones(event.target.checked)} type="checkbox" /> Incluir zonas rojas</label>
        <label className="flex items-center gap-2"><input checked={includeSourceReferences} onChange={(event) => setIncludeSourceReferences(event.target.checked)} type="checkbox" /> Incluir referencias de fuentes</label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-[#071b4d] hover:bg-slate-50 disabled:opacity-50" disabled={isLoading} onClick={() => handlePreview(false)} type="button">{isLoading ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />} Generar vista previa</button>
        <button className="inline-flex items-center gap-2 rounded-lg bg-[#073B91] px-4 py-2 text-sm font-black text-white hover:bg-[#0A4CB6] disabled:opacity-50" disabled={isLoading} onClick={() => handlePreview(true)} type="button"><Sparkles size={16} /> Generar informe</button>
        <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-[#071b4d] hover:bg-slate-50 disabled:opacity-50" disabled={isLoading} onClick={handleHtmlPreview} type="button">Ver HTML</button>
        <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-[#071b4d] hover:bg-slate-50 disabled:opacity-50" disabled={isLoading} onClick={handleExport} type="button">Exportar informe</button>
      </div>
      {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700" role="alert">{error}</div> : null}
      {downloadUrl ? <a className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white" href={downloadUrl}>Descargar informe</a> : null}
      {warnings.length ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">{warnings.join(' ')}</div> : null}
      {preview ? <div className="mt-4 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]"><aside className="grid content-start gap-3"><div className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Reclamos</p><p className="text-2xl font-black text-[#071b4d]">{formatMetric(metrics.reclamos_totales)}</p></div><div className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Facturacion estimada</p><p className="text-2xl font-black text-[#071b4d]">${formatMetric(metrics.facturacion_estimada)}</p></div><div className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Alta prioridad</p><p className="text-2xl font-black text-[#071b4d]">{formatMetric(metrics.reclamos_prioridad_alta)}</p></div>{sourceRefs.map((ref, index) => <div className="rounded-lg border border-slate-200 p-3 text-xs font-bold text-slate-600" key={index}>{String(ref.title)}: {ref.available ? 'disponible' : 'no disponible'}</div>)}</aside><article className="max-h-[680px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4"><h3 className="mb-3 text-lg font-black text-[#071b4d]">{preview.title}</h3><pre className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-700">{preview.markdown}</pre></article></div> : null}
      {htmlPreview ? <iframe className="mt-4 h-[620px] w-full rounded-lg border border-slate-200" srcDoc={htmlPreview} title="Vista HTML informe mensual" /> : null}
    </section>
  );
}
