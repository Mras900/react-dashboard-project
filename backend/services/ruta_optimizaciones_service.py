from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.ruta_optimizacion import RutaOptimizacion
from schemas.ruta_visita_schema import RutaResumenInput, SaveOptimizationRequest


def save_optimization(
    db: Session,
    fecha_visita: date,
    visitador: str,
    summary: RutaResumenInput,
) -> RutaOptimizacion:
    optimization = RutaOptimizacion(
        fecha_visita=fecha_visita,
        visitador=visitador,
        inicio_label=summary.inicio_label,
        inicio_lat=summary.inicio_lat,
        inicio_lon=summary.inicio_lon,
        geometry_json=summary.geometry,
        distance_m=summary.distance_m,
        distance_km=summary.distance_m / 1000,
        duration_s=summary.duration_s,
        travel_duration_s=summary.travel_duration_s,
        service_duration_s=summary.service_duration_s,
        service_minutes_per_stop=summary.service_minutes_per_stop,
        fuel_efficiency_km_l=summary.fuel_efficiency_km_l,
        fuel_price=summary.fuel_price,
        fuel_liters=summary.fuel_liters,
        fuel_cost=summary.fuel_cost,
    )
    db.add(optimization)
    db.flush()
    return optimization


def save_optimization_request(db: Session, request: SaveOptimizationRequest) -> RutaOptimizacion:
    summary = RutaResumenInput(**request.model_dump(exclude={"fecha_visita", "visitador"}))
    optimization = save_optimization(db, request.fecha_visita, request.visitador, summary)
    db.commit()
    db.refresh(optimization)
    return optimization


def list_optimizations(
    db: Session,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    visitador: str | None = None,
) -> list[RutaOptimizacion]:
    statement = select(RutaOptimizacion).order_by(RutaOptimizacion.created_at.desc())
    if fecha_desde:
        statement = statement.where(RutaOptimizacion.fecha_visita >= fecha_desde)
    if fecha_hasta:
        statement = statement.where(RutaOptimizacion.fecha_visita <= fecha_hasta)
    if visitador:
        statement = statement.where(RutaOptimizacion.visitador == visitador)
    return list(db.scalars(statement).all())
