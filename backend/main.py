import os
from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import DATABASE_URL, ENV_PATH, DatabaseUnavailableError, check_database_health, create_database_tables, get_db
from dashboard_api import router as dashboard_router
import models  # noqa: F401
from schemas.dashboard_schema import DashboardVisitsResponse
from schemas.red_zone_schema import HeatPointResponse, RedZoneCreate, RedZoneResponse, RedZoneUpdate, ValidatePointResponse
from schemas.ruta_schema import OptimizeRouteRequest, OptimizeRouteResponse, RutaTicketResponse
from schemas.ruta_visita_schema import (
    RutaOptimizationResponse,
    RutaVisitaResponse,
    SaveDailyVisitsRequest,
    SaveDailyVisitsResponse,
    SaveOptimizationRequest,
)
from services.dashboard_service import get_dashboard_visits
from services.crm_service import CrmNotFoundError, CrmServiceError, build_visit_from_rut, build_visit_from_ticket
from services.geocoding_service import search_address_suggestions
from services.route_optimizer import RouteOptimizationError, build_optimized_route_from_request
from services.red_zones_crud_service import create_red_zone, delete_red_zone, list_heat_points, list_red_zones, update_red_zone, validate_red_zone_point
from services.ruta_optimizaciones_service import list_optimizations, save_optimization_request
from services.ruta_visitas_service import list_daily_visits, save_daily_visits
from auth.routes import ensure_initial_admin, router as auth_router
from routes.weather_router import router as weather_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    required = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD']
    optional = ['OPENWEATHER_API_KEY']
    print('[startup] Verificando variables de entorno requeridas...')
    for var in required:
        val = os.getenv(var, '')
        print(f'[startup] {var}={ "OK" if val else "FALTA" }')
        if not val:
            print(f'[startup] ADVERTENCIA: La variable {var} no esta configurada. Revisa backend/.env')
    for var in optional:
        val = os.getenv(var, '')
        print(f'[startup] {var}={ "OK" if val else "no configurada (opcional)" }')
    create_database_tables()
    ensure_initial_admin()
    yield


app = FastAPI(title="Ruta Backend", lifespan=lifespan)
app.include_router(dashboard_router)
app.include_router(auth_router)
app.include_router(weather_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DatabaseUnavailableError)
def database_unavailable_handler(_: Request, error: DatabaseUnavailableError) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "detail": error.message,
            "env_path_checked": error.env_path_checked,
        },
    )


@app.exception_handler(SQLAlchemyError)
def sqlalchemy_error_handler(_: Request, __: SQLAlchemyError) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "detail": "No se pudo conectar a la base de datos configurada.",
            "env_path_checked": str(ENV_PATH),
        },
    )


@app.get("/api/health")
def health() -> dict[str, bool | str]:
    return {
        "ok": True,
        "service": "ruta-backend",
        "database_configured": bool(DATABASE_URL),
    }


@app.get("/api/db/health")
def database_health() -> JSONResponse:
    ok, result = check_database_health()
    if ok:
        return JSONResponse(status_code=200, content={"ok": True, "database": result})
    return JSONResponse(
        status_code=503,
        content={"ok": False, "error": result, "env_path_checked": str(ENV_PATH)},
    )


@app.get("/api/geocode/search")
def search_geocode(q: str = Query(default="")) -> list[dict[str, float | str]]:
    return search_address_suggestions(q)


@app.get("/api/ruta/ticket/{ticket_id}", response_model=RutaTicketResponse)
def get_ruta_ticket(ticket_id: str) -> RutaTicketResponse:
    try:
        return build_visit_from_ticket(ticket_id)
    except CrmNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CrmServiceError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.get("/api/ruta/rut/{rut}", response_model=RutaTicketResponse)
def get_ruta_rut(rut: str) -> RutaTicketResponse:
    try:
        return build_visit_from_rut(rut)
    except CrmNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CrmServiceError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.post("/api/ruta/optimizar", response_model=OptimizeRouteResponse)
def optimize_ruta(request: OptimizeRouteRequest) -> OptimizeRouteResponse:
    try:
        return build_optimized_route_from_request(request)
    except RouteOptimizationError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@app.post("/api/ruta/visitas-diarias", response_model=SaveDailyVisitsResponse)
def post_daily_visits(
    request: SaveDailyVisitsRequest,
    db: Session = Depends(get_db),
) -> SaveDailyVisitsResponse:
    return save_daily_visits(db, request)


@app.get("/api/ruta/visitas-diarias", response_model=list[RutaVisitaResponse])
def get_daily_visits(
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    territorio: str | None = None,
    comuna: str | None = None,
    region: str | None = None,
    visitador: str | None = None,
    db: Session = Depends(get_db),
) -> list:
    return list_daily_visits(
        db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        territorio=territorio,
        comuna=comuna,
        region=region,
        visitador=visitador,
    )


@app.get("/api/dashboard/visitas", response_model=DashboardVisitsResponse)
def get_dashboard_daily_visits(
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    territorio: str | None = None,
    db: Session = Depends(get_db),
) -> DashboardVisitsResponse:
    return get_dashboard_visits(
        db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        territorio=territorio,
    )


@app.post("/api/ruta/optimizaciones", response_model=RutaOptimizationResponse)
def post_optimization(
    request: SaveOptimizationRequest,
    db: Session = Depends(get_db),
):
    return save_optimization_request(db, request)


@app.get("/api/ruta/optimizaciones", response_model=list[RutaOptimizationResponse])
def get_optimizations(
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    visitador: str | None = None,
    db: Session = Depends(get_db),
) -> list:
    return list_optimizations(
        db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        visitador=visitador,
    )


@app.get("/api/red-zones", response_model=list[RedZoneResponse])
def get_red_zones(
    comuna: str | None = None,
    region: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> list:
    return list_red_zones(db, comuna=comuna, region=region, status=status)


@app.post("/api/red-zones", response_model=RedZoneResponse, status_code=201)
def post_red_zone(payload: RedZoneCreate, db: Session = Depends(get_db)):
    return create_red_zone(db, payload)


@app.put("/api/red-zones/{zone_id}", response_model=RedZoneResponse)
def put_red_zone(zone_id: int, payload: RedZoneUpdate, db: Session = Depends(get_db)):
    record = update_red_zone(db, zone_id, payload)
    if record is None:
        raise HTTPException(status_code=404, detail="Zona roja no encontrada")
    return record


@app.delete("/api/red-zones/{zone_id}", status_code=204)
def remove_red_zone(zone_id: int, db: Session = Depends(get_db)):
    if not delete_red_zone(db, zone_id):
        raise HTTPException(status_code=404, detail="Zona roja no encontrada")


@app.get("/api/red-zones/heat-points", response_model=list[HeatPointResponse])
def get_red_zone_heat_points(db: Session = Depends(get_db)) -> list:
    return list_heat_points(db)


@app.get("/api/red-zones/validate-point", response_model=ValidatePointResponse)
def validate_point_against_red_zones(
    lat: float,
    lon: float,
    nearby_threshold_m: float = Query(default=500, ge=0, le=10000),
    db: Session = Depends(get_db),
) -> dict:
    return validate_red_zone_point(db, lat=lat, lon=lon, nearby_threshold_m=nearby_threshold_m)
