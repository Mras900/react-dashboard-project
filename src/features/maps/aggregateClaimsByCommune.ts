import type { ImportedDashboardRow } from '../data-import/importTypes';
import { normalizeMapJoinKey } from './normalizeMapJoinKey';

export interface CommuneClaimAggregate {
  comuna: string;
  joinKey: string;
  reclamosTotales: number;
  ticketsUnicos: number;
  facturacionTotal: number;
  kmTotal: number;
  trasladoTotal: number;
  valorEnvioBultoTotal: number;
  alta: number;
  media: number;
  baja: number;
  completadas: number;
  pendientes: number;
  noRealizadas: number;
}

export function aggregateClaimsByCommune(rows: ImportedDashboardRow[]): Map<string, CommuneClaimAggregate> {
  const grouped = new Map<string, CommuneClaimAggregate>();
  const ticketsByKey = new Map<string, Set<string>>();

  const validRows = rows.filter((row) => row.scope === 'regiones' && row.validationStatus !== 'error');

  for (const row of validRows) {
    const comuna = row.ciudad || row.comuna || row.regionNormalizada || row.regionOriginal;
    if (!comuna) continue;

    const joinKey = normalizeMapJoinKey(comuna);
    if (!joinKey) continue;

    let agg = grouped.get(joinKey);
    if (!agg) {
      agg = {
        comuna,
        joinKey,
        reclamosTotales: 0,
        ticketsUnicos: 0,
        facturacionTotal: 0,
        kmTotal: 0,
        trasladoTotal: 0,
        valorEnvioBultoTotal: 0,
        alta: 0,
        media: 0,
        baja: 0,
        completadas: 0,
        pendientes: 0,
        noRealizadas: 0,
      };
      grouped.set(joinKey, agg);
    }

    agg.reclamosTotales += 1;
    agg.facturacionTotal += row.facturacionTotal ?? 0;
    agg.kmTotal += row.km ?? 0;
    agg.trasladoTotal += row.traslado ?? 0;
    agg.valorEnvioBultoTotal += row.valorEnvioBulto ?? 0;

    if (row.ticket) {
      let tickets = ticketsByKey.get(joinKey);
      if (!tickets) {
        tickets = new Set();
        ticketsByKey.set(joinKey, tickets);
      }
      tickets.add(row.ticket);
      agg.ticketsUnicos = tickets.size;
    }

    if (row.prioridad === 'alta') agg.alta += 1;
    else if (row.prioridad === 'media') agg.media += 1;
    else if (row.prioridad === 'baja') agg.baja += 1;

    if (row.estadoVisitaNormalizado === 'completada') agg.completadas += 1;
    else if (row.estadoVisitaNormalizado === 'pendiente') agg.pendientes += 1;
    else if (row.estadoVisitaNormalizado === 'no_realizada') agg.noRealizadas += 1;
  }

  return grouped;
}
