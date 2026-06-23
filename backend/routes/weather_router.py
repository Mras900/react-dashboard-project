import os
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from services.weather_service import build_unavailable_response, build_weather_response

router = APIRouter(prefix="/api/weather", tags=["weather"])

LOCATION_NAMES: dict[str, tuple[float, float]] = {
    "Santiago": (-33.4489, -70.6693),
    "San Bernardo": (-33.5922, -70.6996),
    "Puente Alto": (-33.6117, -70.5758),
    "Maipú": (-33.5107, -70.7562),
    "Viña del Mar": (-33.0245, -71.5518),
    "Valparaíso": (-33.0472, -71.6127),
    "Rancagua": (-34.1708, -70.7406),
    "Talca": (-35.4264, -71.6554),
    "Concepción": (-36.827, -73.0498),
    "Chillán": (-36.6066, -72.1034),
    "Puerto Montt": (-41.4693, -72.9424),
    "Temuco": (-38.7359, -72.5904),
    "Antofagasta": (-23.65, -70.4),
    "La Serena": (-29.9078, -71.2543),
    "Iquique": (-20.213, -70.1494),
}


@router.get("/route")
def get_route_weather(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    date: str = Query(..., min_length=10, max_length=10),
    locationName: str = Query(default=""),
) -> dict[str, Any]:
    # Validate date format
    parts = date.split("-")
    if len(parts) != 3 or not all(p.isdigit() for p in parts):
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD.")
    year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
    if not (1 <= month <= 12 and 1 <= day <= 31):
        raise HTTPException(status_code=400, detail="Fecha inválida.")

    api_key = (os.getenv("OPENWEATHER_API_KEY") or "").strip()
    name = locationName or ""

    return build_weather_response(lat, lon, date, name, api_key)
