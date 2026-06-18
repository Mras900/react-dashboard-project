from datetime import date

from sqlalchemy.orm import Session

from schemas.dashboard_schema import (
    DashboardEvidence,
    DashboardKpis,
    DashboardTerritoryMetric,
    DashboardVisitsResponse,
)
from services.ruta_visitas_service import list_daily_visits


def _aggregate(rows: list, field: str) -> list[DashboardTerritoryMetric]:
    grouped: dict[str, dict] = {}
    for row in rows:
        name = getattr(row, field) or "Sin información"
        current = grouped.setdefault(
            name,
            {
                "nombre": name, "visitas": 0, "ticket_ids": set(), "exitosas": 0,
                "no_exitosas": 0, "pendientes": 0, "zonas_rojas": 0,
                "facturacion": 0.0, "combustible_costo": 0.0, "km": 0.0,
                "lat_total": 0.0, "lon_total": 0.0, "coordinate_count": 0,
            },
        )
        current["visitas"] += 1
        current["ticket_ids"].add(row.ticket_id)
        current["exitosas"] += int(row.estado == "exitosa")
        current["no_exitosas"] += int(row.estado == "no_exitosa")
        current["pendientes"] += int(row.estado == "pendiente")
        current["zonas_rojas"] += int(row.peligro)
        current["facturacion"] += row.valor_calculado or 0
        current["combustible_costo"] += row.combustible_costo or 0
        current["km"] += row.distancia_km or 0
        if row.lat is not None and row.lon is not None:
            current["lat_total"] += row.lat
            current["lon_total"] += row.lon
            current["coordinate_count"] += 1

    result = []
    for item in grouped.values():
        coordinate_count = item.pop("coordinate_count")
        lat_total = item.pop("lat_total")
        lon_total = item.pop("lon_total")
        ticket_ids = item.pop("ticket_ids")
        result.append(
            DashboardTerritoryMetric(
                **item,
                tickets=len(ticket_ids),
                lat=lat_total / coordinate_count if coordinate_count else None,
                lon=lon_total / coordinate_count if coordinate_count else None,
            )
        )
    return sorted(result, key=lambda item: item.visitas, reverse=True)


def get_dashboard_visits(
    db: Session,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    territorio: str | None = None,
) -> DashboardVisitsResponse:
    rows = list_daily_visits(
        db, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta, territorio=territorio
    )
    ticket_ids = {row.ticket_id for row in rows}
    kpis = DashboardKpis(
        tickets=len(ticket_ids),
        visitas=len(rows),
        exitosas=sum(row.estado == "exitosa" for row in rows),
        no_exitosas=sum(row.estado == "no_exitosa" for row in rows),
        pendientes=sum(row.estado == "pendiente" for row in rows),
        zonas_rojas=sum(bool(row.peligro) for row in rows),
        facturacion_visitas=sum(row.valor_calculado or 0 for row in rows),
        combustible_costo=sum(row.combustible_costo or 0 for row in rows),
        km=sum(row.distancia_km or 0 for row in rows),
        tiempo_total_s=sum(row.tiempo_total_s or 0 for row in rows),
    )
    evidencia = [
        DashboardEvidence(
            ticket_id=row.ticket_id,
            referencia=row.referencia,
            fecha_visita=row.fecha_visita,
            comuna=row.comuna,
            region=row.region,
            territorio=row.territorio,
            estado=row.estado,
            valor_calculado=row.valor_calculado,
            visitador=row.visitador,
        )
        for row in rows
    ]
    return DashboardVisitsResponse(
        kpis=kpis,
        por_comuna=_aggregate(rows, "comuna"),
        por_region=_aggregate(rows, "region"),
        evidencia=evidencia,
    )
