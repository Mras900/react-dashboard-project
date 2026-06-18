from datetime import date

from pydantic import BaseModel, Field


class DashboardKpis(BaseModel):
    tickets: int = 0
    visitas: int = 0
    exitosas: int = 0
    no_exitosas: int = 0
    pendientes: int = 0
    zonas_rojas: int = 0
    facturacion_visitas: float = 0
    combustible_costo: float = 0
    km: float = 0
    tiempo_total_s: float = 0


class DashboardTerritoryMetric(BaseModel):
    nombre: str
    visitas: int = 0
    tickets: int = 0
    exitosas: int = 0
    no_exitosas: int = 0
    pendientes: int = 0
    zonas_rojas: int = 0
    facturacion: float = 0
    combustible_costo: float = 0
    km: float = 0
    lat: float | None = None
    lon: float | None = None


class DashboardEvidence(BaseModel):
    ticket_id: str
    referencia: str
    fecha_visita: date
    comuna: str | None
    region: str | None
    territorio: str
    estado: str
    valor_calculado: float
    visitador: str | None


class DashboardVisitsResponse(BaseModel):
    kpis: DashboardKpis
    por_comuna: list[DashboardTerritoryMetric] = Field(default_factory=list)
    por_region: list[DashboardTerritoryMetric] = Field(default_factory=list)
    evidencia: list[DashboardEvidence] = Field(default_factory=list)
