import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, MapPin, Route } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import { getRouteDailyVisits, upsertRouteDailyVisit, dispatchRouteDailyUpdate } from './routeDailyStorage';
import type { RouteDailyVisit } from './routeDailyStorage';
import { getFareTable } from './rutaUtils';

type AuditStatus = 'borrador' | 'pendiente' | 'parcial' | 'cerrada';

function getAuditStatus(visits: RouteDailyVisit[]): { status: AuditStatus; label: string; cssClass: string } {
  if (visits.length === 0) return { status: 'borrador', label: 'Borrador', cssClass: 'cc-audit-status-badge-muted' };
  const pending = visits.filter((v) => v.resultado === 'pendiente').length;
  const total = visits.length;
  if (pending === total) return { status: 'pendiente', label: 'Pendiente de auditoría', cssClass: 'cc-audit-status-badge-amber' };
  if (pending === 0) return { status: 'cerrada', label: 'Cerrada', cssClass: 'cc-audit-status-badge-green' };
  return { status: 'parcial', label: 'Auditada parcialmente', cssClass: 'cc-audit-status-badge-cyan' };
}

function formatInt(v: number) { return v.toLocaleString('es-CL'); }
function formatCurr(v: number) { return v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }); }

export function ArqueoRutaView() {
  const today = new Date().toISOString().slice(0, 10);
  const [auditDate, setAuditDate] = useState(today);
  const [refreshKey, setRefreshKey] = useState(0);

  const allVisits = getRouteDailyVisits();
  const dayVisits = useMemo(
    () => allVisits.filter((v) => v.fechaRuta === auditDate).sort((a, b) => (a.ordenRuta ?? 0) - (b.ordenRuta ?? 0)),
    [allVisits, auditDate, refreshKey],
  );
  const auditStatus = useMemo(() => getAuditStatus(dayVisits), [dayVisits]);
  const fares = useMemo(() => getFareTable(dayVisits.length), [dayVisits.length]);

  const successfulCount = dayVisits.filter((v) => v.resultado === 'exitosa').length;
  const unsuccessfulCount = dayVisits.filter((v) => v.resultado === 'no_exitosa').length;
  const pendingCount = dayVisits.filter((v) => v.resultado === 'pendiente').length;
  const redZoneCount = dayVisits.filter((v) => v.zonaRoja).length;
  const projectedMax = dayVisits.length * fares.successful;
  const totalAudited = successfulCount * fares.successful + unsuccessfulCount * fares.unsuccessful;
  const difference = totalAudited - projectedMax;

  const stopsWithCoords = dayVisits.filter((v) => v.lat != null && v.lng != null);
  const mapPoints: Array<[number, number]> = stopsWithCoords.map((v) => [v.lat!, v.lng!]);

  const updateResult = useCallback(
    (visit: RouteDailyVisit, newResult: 'exitosa' | 'no_exitosa' | 'pendiente') => {
      const fareTable = getFareTable(dayVisits.length);
      const valor = newResult === 'exitosa' ? fareTable.successful : newResult === 'no_exitosa' ? fareTable.unsuccessful : 0;
      upsertRouteDailyVisit({
        ...visit,
        resultado: newResult,
        tarifaAplicada: valor,
        valorVisita: valor,
        updatedAt: new Date().toISOString(),
      });
      setRefreshKey((k) => k + 1);
      dispatchRouteDailyUpdate(auditDate, 'arqueo-ruta');
    },
    [auditDate, dayVisits.length],
  );

  const updateObservation = useCallback(
    (visit: RouteDailyVisit, obs: string) => {
      upsertRouteDailyVisit({ ...visit, observacion: obs, updatedAt: new Date().toISOString() });
      setRefreshKey((k) => k + 1);
      dispatchRouteDailyUpdate(auditDate, 'arqueo-ruta');
    },
    [auditDate],
  );

  const totalVisitsByDate = allVisits.filter((v) => v.fechaRuta === auditDate).length;

  return (
    <div className="cc-audit-shell">
      <div className="cc-audit-header cc-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'rgba(34,211,238,0.09)', color: 'var(--cc-cyan, #0891b2)' }}>
            <ClipboardCheck size={21} />
          </span>
          <div>
            <h2 className="cc-section-title text-xl font-black" style={{ letterSpacing: '-0.025em' }}>Arqueo Ruta</h2>
            <p className="cc-muted text-xs font-semibold">Revisión, aprobación y valorización de visitas cargadas.</p>
          </div>
        </div>
        <span className={'cc-badge-pro ' + auditStatus.cssClass.replace('cc-audit-', 'cc-')}>{auditStatus.label}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="cc-card cc-audit-date-card flex items-center gap-3 rounded-xl border p-4">
          <MapPin size={18} style={{ color: 'var(--cc-cyan, #0891b2)' }} />
          <div>
            <p className="cc-audit-kpi-label text-xs font-bold">Fecha de arqueo</p>
            <input
              className="cc-route-input mt-1 h-9 px-3 text-sm font-bold rounded-lg border"
              type="date"
              value={auditDate}
              onChange={(e) => setAuditDate(e.target.value)}
            />
          </div>
          <div className="ml-auto text-right">
            <p className="cc-audit-kpi-label text-xs font-bold">Visitas en fecha</p>
            <p className="cc-audit-kpi-value text-lg font-black">{formatInt(totalVisitsByDate)}</p>
          </div>
        </div>
      </div>

      <section className="cc-audit-kpi-grid">
        {([
          ['Tickets', formatInt(dayVisits.length), ''],
          ['Exitosas', formatInt(successfulCount), 'green'],
          ['No exitosas', formatInt(unsuccessfulCount), 'red'],
          ['Pendientes', formatInt(pendingCount), 'amber'],
          ['Zonas rojas', formatInt(redZoneCount), 'red'],
          ['Proyectado máximo', formatCurr(projectedMax), 'cyan'],
        ] as const).map(([label, value, tone]) => (
          <section key={label} className="cc-kpi-card-pro" data-tone={tone || undefined}>
            <p className="cc-kpi-label-pro">{label}</p>
            <p className={`cc-kpi-value-pro mt-1${tone ? ' cc-audit-kpi-value-' + tone : ''}`} data-tone={tone || undefined}>{value}</p>
          </section>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="cc-audit-list rounded-xl border">
          <div className="border-b border-[var(--cc-border-soft)] px-4 py-3">
            <h3 className="cc-section-title-pro">Visitas del día</h3>
            <p className="cc-muted text-xs font-semibold">Selecciona resultado y agrega observaciones.</p>
          </div>

          {dayVisits.length === 0 ? (
            <div className="cc-empty-state-pro m-4">
              No hay visitas cargadas para este día.
              <p className="cc-muted mt-1 text-xs font-semibold">Carga tickets desde Ruta Visitador o selecciona otra fecha.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--cc-border-soft)]">
              {dayVisits.map((visit, idx) => (
                <article key={visit.id + '-' + visit.fechaRuta} className="cc-list-card-pro grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_200px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="cc-route-stop-number rounded-md px-2 py-1 text-xs font-bold">#{idx + 1}</span>
                      <span className="cc-text text-sm font-bold">{visit.ticket}</span>
                      {visit.zonaRoja ? <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Zona roja</span> : null}
                      {visit.comuna ? <span className="cc-route-stop-meta text-xs">{visit.comuna}</span> : null}
                    </div>
                    {visit.direccion ? <p className="cc-route-stop-name mt-1 text-sm font-medium">{visit.direccion}</p> : null}
                    {visit.rut ? <p className="cc-route-stop-meta mt-1 text-xs">RUT: {visit.rut}</p> : null}
                    {visit.observacion ? <p className="cc-route-stop-meta mt-1 text-xs">Obs: {visit.observacion}</p> : null}
                  </div>
                  <div className="grid gap-2">
                    <select
                      className="cc-route-input h-9 px-2 text-xs font-bold rounded-lg border"
                      value={visit.resultado}
                      onChange={(e) => updateResult(visit, e.target.value as 'exitosa' | 'no_exitosa' | 'pendiente')}
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="exitosa">Exitosa</option>
                      <option value="no_exitosa">No exitosa</option>
                    </select>
                    <input
                      className="cc-route-input h-9 px-2 text-xs rounded-lg border"
                      placeholder="Observación"
                      value={visit.observacion ?? ''}
                      onChange={(e) => updateObservation(visit, e.target.value)}
                    />
                    <p className="cc-route-stop-meta text-xs font-bold">
                      {visit.resultado === 'exitosa' ? formatCurr(fares.successful) : visit.resultado === 'no_exitosa' ? formatCurr(fares.unsuccessful) : '$0'}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 self-start">
          <div className="cc-audit-map-card rounded-xl border">
            <div className="flex items-center gap-2 border-b border-[var(--cc-border-soft)] px-4 py-3">
              <MapPin size={16} style={{ color: 'var(--cc-cyan, #0891b2)' }} />
              <h3 className="cc-text text-sm font-black">Mapa de arqueo</h3>
            </div>
            <div style={{ height: '280px' }} className="overflow-hidden rounded-xl">
              {mapPoints.length > 0 ? (
                <MapContainer center={mapPoints[0]} zoom={12} className="h-full w-full" zoomControl={false} scrollWheelZoom={false}>
                  <ZoomControl position="topleft" />
                  <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {mapPoints.map((pt, i) => (
                    <CircleMarker key={i} center={pt} radius={7} pathOptions={{ color: '#2563eb', fillColor: '#22d3ee', fillOpacity: 0.7, weight: 2 }}>
                      <Popup>{dayVisits[i]?.ticket || ''}</Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              ) : (
                <div className="cc-audit-empty-state flex h-full items-center justify-center text-xs font-bold">
                  Las visitas de este día no tienen coordenadas disponibles.
                </div>
              )}
            </div>
          </div>

          <div className="cc-audit-valuation-card rounded-xl border p-4">
            <h3 className="cc-section-title-pro">Totales de valorización</h3>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="cc-route-stop-meta">Tramo actual</span>
                <span className="cc-text font-bold">{dayVisits.length >= 13 ? '13+ tickets' : 'Menos de 13'}</span>
              </div>
              <div className="flex justify-between">
                <span className="cc-route-stop-meta">Tarifa exitosa</span>
                <span className="font-bold" style={{ color: 'var(--cc-green, #10b981)' }}>{formatCurr(fares.successful)}</span>
              </div>
              <div className="flex justify-between">
                <span className="cc-route-stop-meta">Tarifa no exitosa</span>
                <span className="font-bold" style={{ color: 'var(--cc-red, #dc2626)' }}>{formatCurr(fares.unsuccessful)}</span>
              </div>
              <div className="cc-route-divider border-t pt-2" />
              <div className="flex justify-between">
                <span className="cc-route-stop-meta">Proyectado máximo</span>
                <span className="font-bold" style={{ color: 'var(--cc-cyan, #0891b2)' }}>{formatCurr(projectedMax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="cc-route-stop-meta">{'Subtotal exitosas (' + successfulCount + ')'}</span>
                <span className="font-bold" style={{ color: 'var(--cc-green, #10b981)' }}>{formatCurr(successfulCount * fares.successful)}</span>
              </div>
              <div className="flex justify-between">
                <span className="cc-route-stop-meta">{'Subtotal no exitosas (' + unsuccessfulCount + ')'}</span>
                <span className="font-bold" style={{ color: 'var(--cc-red, #dc2626)' }}>{formatCurr(unsuccessfulCount * fares.unsuccessful)}</span>
              </div>
              <div className="cc-route-divider border-t pt-2" />
              <div className="flex justify-between">
                <span className="cc-text font-bold">Total auditado</span>
                <span className="font-extrabold" style={{ color: 'var(--cc-green, #10b981)' }}>{formatCurr(totalAudited)}</span>
              </div>
              <div className="flex justify-between">
                <span className="cc-route-stop-meta">Diferencia</span>
                <span className="font-extrabold" style={{ color: difference < 0 ? 'var(--cc-orange, #f97316)' : 'var(--cc-green, #10b981)' }}>
                  {difference < 0 ? '- ' : '+ '}{formatCurr(Math.abs(difference))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
