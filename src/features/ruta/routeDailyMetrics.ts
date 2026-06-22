import type { RouteDailyVisit } from './routeDailyStorage';
import { getFareTable } from './rutaUtils';

export type RoutePeriod = 'dia' | 'semana' | 'mes';

export interface RouteDailyMetrics {
  ticketsRuta: number;
  exitosas: number;
  noExitosas: number;
  pendientes: number;
  zonasRojas: number;
  totalValorizado: number;
  proyectadoMaximo: number;
}

export function getRouteDateRange(period: RoutePeriod, selectedDate: string): { startDate: string; endDate: string } {
  const date = new Date(selectedDate + 'T12:00:00');

  if (period === 'dia') {
    const d = selectedDate;
    return { startDate: d, endDate: d };
  }

  if (period === 'semana') {
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { startDate: fmt(monday), endDate: fmt(sunday) };
  }

  if (period === 'mes') {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, date.getMonth() + 1, 0).getDate();
    return { startDate: `${year}-${month}-01`, endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}` };
  }

  return { startDate: selectedDate, endDate: selectedDate };
}

export function calculateRouteDailyMetrics(visits: RouteDailyVisit[]): RouteDailyMetrics {
  const fares = getFareTable(visits.length);

  return {
    ticketsRuta: visits.length,
    exitosas: visits.filter((v) => v.resultado === 'exitosa').length,
    noExitosas: visits.filter((v) => v.resultado === 'no_exitosa').length,
    pendientes: visits.filter((v) => v.resultado === 'pendiente').length,
    zonasRojas: visits.filter((v) => v.zonaRoja).length,
    totalValorizado: visits.reduce((sum, v) => sum + (v.valorVisita ?? 0), 0),
    proyectadoMaximo: visits.length * fares.successful,
  };
}
