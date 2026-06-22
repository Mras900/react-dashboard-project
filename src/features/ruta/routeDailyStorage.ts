const STORAGE_KEY = 'dashboard-route-daily-visits';

function normalizeTicket(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export interface RouteDailyVisit {
  id: string;
  fechaRuta: string;
  ticket: string;
  rut?: string;
  idTicket?: string;
  direccion?: string;
  comuna?: string;
  lat?: number;
  lng?: number;
  estadoVisita?: string;
  resultado: 'exitosa' | 'no_exitosa' | 'pendiente';
  observacion?: string;
  zonaRoja?: boolean;
  tarifaAplicada?: number;
  valorVisita?: number;
  ordenRuta?: number;
  createdAt: string;
  updatedAt: string;
}

function readAll(): RouteDailyVisit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RouteDailyVisit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(visits: RouteDailyVisit[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
}

function deduplicateByFechaAndTicket(visits: RouteDailyVisit[]): RouteDailyVisit[] {
  const seen = new Map<string, RouteDailyVisit>();
  for (const v of visits) {
    const key = v.fechaRuta + '|' + normalizeTicket(v.ticket);
    if (!v.ticket) continue;
    if (!seen.has(key) || v.updatedAt >= seen.get(key)!.updatedAt) {
      seen.set(key, v);
    }
  }
  return [...seen.values()];
}

export function getRouteDailyVisits(): RouteDailyVisit[] {
  return readAll();
}

export function saveRouteDailyVisits(fechaRuta: string, newVisits: RouteDailyVisit[]): void {
  const all = readAll();
  const others = all.filter((v) => v.fechaRuta !== fechaRuta);
  const clean = newVisits.filter((v) => normalizeTicket(v.ticket));
  const deduped = deduplicateByFechaAndTicket(clean);
  writeAll([...others, ...deduped]);
}

export function upsertRouteDailyVisit(visit: RouteDailyVisit): void {
  if (!normalizeTicket(visit.ticket)) return;

  const all = readAll();
  const ticketKey = normalizeTicket(visit.ticket);
  const idx = all.findIndex(
    (v) => v.fechaRuta === visit.fechaRuta && normalizeTicket(v.ticket) === ticketKey,
  );
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...visit, updatedAt: new Date().toISOString() };
  } else {
    all.push({ ...visit, createdAt: visit.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  writeAll(all);
}

export function clearRouteDailyVisitsByDate(fechaRuta: string): void {
  const all = readAll();
  writeAll(all.filter((v) => v.fechaRuta !== fechaRuta));
}

export function getRouteVisitsByDateRange(startDate: string, endDate: string): RouteDailyVisit[] {
  const all = readAll();
  return all.filter((v) => v.fechaRuta >= startDate && v.fechaRuta <= endDate);
}

export function dispatchRouteDailyUpdate(fechaRuta?: string, source?: string): void {
  try {
    window.dispatchEvent(new CustomEvent('dashboard-route-daily-updated', {
      detail: fechaRuta ? { fechaRuta, source: source || 'desconocido' } : undefined,
    }));
  } catch {
    // Silently fail — event is non-critical
  }
}
