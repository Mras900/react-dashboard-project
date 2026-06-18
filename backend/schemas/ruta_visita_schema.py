from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class RutaVisitaInput(BaseModel):
    ticket_id: str | None = None
    referencia: str
    nombre: str | None = None
    rut: str | None = None
    direccion_original: str | None = None
    direccion: str | None = None
    comuna: str | None = None
    region: str | None = None
    lat: float | None = None
    lon: float | None = None
    peligro: bool = False
    estado: Literal["pendiente", "exitosa", "no_exitosa"] = "pendiente"
    observacion: str | None = None
    cantidad_reclamos: int = 0
    tickets: list[str] = Field(default_factory=list)
    valor_visita: float = 0
    valor_no_exitosa: float = 0
    valor_calculado: float = 0


class RutaResumenInput(BaseModel):
    inicio_label: str | None = None
    inicio_lat: float | None = None
    inicio_lon: float | None = None
    geometry: dict[str, Any] | None = None
    distance_m: float = 0
    duration_s: float = 0
    travel_duration_s: float = 0
    service_duration_s: float = 0
    service_minutes_per_stop: int = 10
    fuel_efficiency_km_l: float = 0
    fuel_price: float = 0
    fuel_liters: float = 0
    fuel_cost: float = 0


class SaveDailyVisitsRequest(BaseModel):
    fecha_carga: date
    fecha_visita: date
    visitador: str
    visitas: list[RutaVisitaInput]
    resumen_ruta: RutaResumenInput | None = None


class SaveDailyVisitsResponse(BaseModel):
    ok: bool = True
    saved: int
    updated: int
    rm: int
    regiones: int
    warnings: list[str] = Field(default_factory=list)


class RutaVisitaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: str
    referencia: str
    nombre: str | None
    rut: str | None
    direccion_original: str | None
    direccion: str | None
    comuna: str | None
    region: str | None
    territorio: str
    lat: float | None
    lon: float | None
    peligro: bool
    estado: str
    observacion: str | None
    cantidad_reclamos: int
    tickets_json: list
    fecha_carga: date
    fecha_visita: date
    visitador: str | None
    valor_calculado: float
    distancia_km: float
    combustible_litros: float
    combustible_costo: float
    tiempo_total_s: float
    created_at: datetime
    updated_at: datetime


class SaveOptimizationRequest(RutaResumenInput):
    fecha_visita: date
    visitador: str


class RutaOptimizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha_visita: date
    visitador: str | None
    inicio_label: str | None
    inicio_lat: float | None
    inicio_lon: float | None
    geometry_json: dict | None
    distance_m: float
    distance_km: float
    duration_s: float
    travel_duration_s: float
    service_duration_s: float
    service_minutes_per_stop: int
    fuel_efficiency_km_l: float
    fuel_price: float
    fuel_liters: float
    fuel_cost: float
    created_at: datetime
