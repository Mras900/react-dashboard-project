from pydantic import BaseModel


class RutaTicketResponse(BaseModel):
    referencia: str
    ticket_id: str | None = None
    nombre: str | None = None
    rut: str | None = None
    direccion: str | None = None
    direccion_limpia: str | None = None
    telefono: str | None = None
    correo: str | None = None
    cantidad_reclamos: int
    tickets: list[str]
    lat: float | None = None
    lon: float | None = None
    peligro: bool
    customer_id: str | None = None
    geocode_query_used: str | None = None


class OptimizeRouteVisit(BaseModel):
    referencia: str
    nombre: str | None = None
    rut: str | None = None
    direccion: str | None = None
    lat: float | None = None
    lon: float | None = None
    peligro: bool = False
    prioridad: str | None = None
    cantidad_reclamos: int = 1


class OptimizeRouteRequest(BaseModel):
    inicio: str
    inicio_lat: float | None = None
    inicio_lon: float | None = None
    service_minutes_per_stop: int | None = 10
    visitas: list[OptimizeRouteVisit]


class OptimizedRoutePoint(BaseModel):
    orden: int
    tipo: str
    referencia: str
    nombre: str
    rut: str
    direccion: str
    lat: float
    lon: float
    peligro: bool


class OptimizeRouteResponse(BaseModel):
    inicio: str
    puntos: list[OptimizedRoutePoint]
    geometry: dict
    distance_m: float
    duration_s: float
    travel_duration_s: float = 0
    service_duration_s: float = 0
    service_minutes_per_stop: int = 10
    valid_visits_count: int = 0
    detalle: list[dict]
