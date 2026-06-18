import type { ImportSummary } from './importTypes';

const items: Array<{ key: keyof ImportSummary; label: string }> = [
  { key: 'totalRows', label: 'Filas leídas' },
  { key: 'rmRows', label: 'Filas RM' },
  { key: 'regionesRows', label: 'Filas Regiones' },
  { key: 'validRows', label: 'Válidas' },
  { key: 'warningRows', label: 'Warnings' },
  { key: 'errorRows', label: 'Errores' },
  { key: 'uniqueTickets', label: 'Tickets únicos' },
];

export function ImportSummaryCards({ summary }: { summary: ImportSummary }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-black uppercase text-[#466083]">{item.label}</p>
          <p className="mt-1 text-lg font-black text-[#071b4d]">{Number(summary[item.key]).toLocaleString('es-CL')}</p>
        </div>
      ))}
    </div>
  );
}
