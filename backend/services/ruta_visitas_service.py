from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.ruta_visita import RutaVisitaDiaria
from schemas.ruta_visita_schema import SaveDailyVisitsRequest, SaveDailyVisitsResponse
from services.ruta_optimizaciones_service import save_optimization
from services.territory_service import classify_territory


def save_daily_visits(db: Session, request: SaveDailyVisitsRequest) -> SaveDailyVisitsResponse:
    saved = 0
    updated = 0
    rm = 0
    regiones = 0
    warnings: list[str] = []
    visit_count = max(len(request.visitas), 1)
    route = request.resumen_ruta

    for visit in request.visitas:
        ticket_id = (visit.ticket_id or visit.referencia).strip()
        existing = db.scalar(
            select(RutaVisitaDiaria).where(
                RutaVisitaDiaria.ticket_id == ticket_id,
                RutaVisitaDiaria.fecha_visita == request.fecha_visita,
            )
        )
        territory, comuna, region, warning = classify_territory(
            visit.comuna, visit.region, visit.lat, visit.lon
        )
        if warning:
            warnings.append(f"{ticket_id}: {warning}")
        if territory == "rm":
            rm += 1
        else:
            regiones += 1

        record = existing or RutaVisitaDiaria(
            ticket_id=ticket_id,
            fecha_visita=request.fecha_visita,
            fecha_carga=request.fecha_carga,
        )
        record.referencia = visit.referencia
        record.nombre = visit.nombre
        record.rut = visit.rut
        record.direccion_original = visit.direccion_original
        record.direccion = visit.direccion
        record.comuna = comuna
        record.region = region
        record.territorio = territory
        record.lat = visit.lat
        record.lon = visit.lon
        record.peligro = visit.peligro
        record.estado = visit.estado
        record.observacion = visit.observacion
        record.cantidad_reclamos = visit.cantidad_reclamos
        record.tickets_json = visit.tickets
        record.fecha_carga = request.fecha_carga
        record.visitador = request.visitador
        record.valor_visita = visit.valor_visita
        record.valor_no_exitosa = visit.valor_no_exitosa
        record.valor_calculado = visit.valor_calculado
        record.distancia_km = (route.distance_m / 1000 / visit_count) if route else 0
        record.combustible_litros = (route.fuel_liters / visit_count) if route else 0
        record.combustible_costo = (route.fuel_cost / visit_count) if route else 0
        record.tiempo_conduccion_s = (route.travel_duration_s / visit_count) if route else 0
        record.tiempo_atencion_s = (route.service_duration_s / visit_count) if route else 0
        record.tiempo_total_s = (route.duration_s / visit_count) if route else 0

        if existing:
            updated += 1
        else:
            db.add(record)
            saved += 1

    if route:
        save_optimization(db, request.fecha_visita, request.visitador, route)

    db.commit()
    return SaveDailyVisitsResponse(
        saved=saved,
        updated=updated,
        rm=rm,
        regiones=regiones,
        warnings=warnings,
    )


def list_daily_visits(
    db: Session,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    territorio: str | None = None,
    comuna: str | None = None,
    region: str | None = None,
    visitador: str | None = None,
) -> list[RutaVisitaDiaria]:
    statement = select(RutaVisitaDiaria).order_by(
        RutaVisitaDiaria.fecha_visita.desc(), RutaVisitaDiaria.id.desc()
    )
    if fecha_desde:
        statement = statement.where(RutaVisitaDiaria.fecha_visita >= fecha_desde)
    if fecha_hasta:
        statement = statement.where(RutaVisitaDiaria.fecha_visita <= fecha_hasta)
    if territorio:
        statement = statement.where(RutaVisitaDiaria.territorio == territorio)
    if comuna:
        statement = statement.where(RutaVisitaDiaria.comuna == comuna)
    if region:
        statement = statement.where(RutaVisitaDiaria.region == region)
    if visitador:
        statement = statement.where(RutaVisitaDiaria.visitador == visitador)
    return list(db.scalars(statement).all())
