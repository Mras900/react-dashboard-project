from typing import Any

import requests


OSRM_BASE_URL = "https://router.project-osrm.org"


def _coords_to_osrm(coords: list[dict[str, float]]) -> str:
    return ";".join(f"{coord['lon']},{coord['lat']}" for coord in coords)


def osrm_table(coords: list[dict[str, float]]) -> list[list[float | None]] | None:
    if len(coords) < 2:
        return None

    coords_str = _coords_to_osrm(coords)
    url = f"{OSRM_BASE_URL}/table/v1/driving/{coords_str}?annotations=duration"

    try:
        response = requests.get(url, timeout=20)
        data = response.json()
        if data.get("code") == "Ok":
            return data.get("durations")
    except Exception:
        return None

    return None


def osrm_route_geometry(coords: list[dict[str, float]]) -> dict[str, Any]:
    empty_response = {"geometry": None, "distance_m": 0, "duration_s": 0}

    if len(coords) < 2:
        return empty_response

    coords_str = _coords_to_osrm(coords)
    url = f"{OSRM_BASE_URL}/route/v1/driving/{coords_str}?overview=full&geometries=geojson&steps=false"

    try:
        response = requests.get(url, timeout=25)
        data = response.json()
        if data.get("code") == "Ok" and data.get("routes"):
            route = data["routes"][0]
            return {
                "geometry": route.get("geometry"),
                "distance_m": route.get("distance", 0),
                "duration_s": route.get("duration", 0),
            }
    except Exception:
        return empty_response

    return empty_response
