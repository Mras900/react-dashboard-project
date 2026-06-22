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
    <div className="cc-import-summary grid grid-cols-2 gap-2 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.key} className={`cc-import-summary-card cc-import-summary-${item.key} p-3 rounded-lg`}>
          <p className="cc-import-summary-label">{item.label}</p>
          <p className="cc-import-summary-value mt-1 text-lg font-black">{Number(summary[item.key]).toLocaleString('es-CL')}</p>
        </div>
      ))}
    </div>
  );
}
