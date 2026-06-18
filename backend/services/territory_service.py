import json
import unicodedata
from functools import lru_cache
from pathlib import Path

from shapely.geometry import Point, shape


RM_COMUNAS = {
    "ALHUE", "BUIN", "CALERA DE TANGO", "CERRILLOS", "CERRO NAVIA", "COLINA",
    "CONCHALI", "CURACAVI", "EL BOSQUE", "EL MONTE", "ESTACION CENTRAL",
    "HUECHURABA", "INDEPENDENCIA", "ISLA DE MAIPO", "LA CISTERNA", "LA FLORIDA",
    "LA GRANJA", "LA PINTANA", "LA REINA", "LAMPA", "LAS CONDES", "LO BARNECHEA",
    "LO ESPEJO", "LO PRADO", "MACUL", "MAIPU", "MARIA PINTO", "MELIPILLA",
    "NUNOA", "PADRE HURTADO", "PAINE", "PEDRO AGUIRRE CERDA", "PENAFLOR",
    "PENALOLEN", "PIRQUE", "PROVIDENCIA", "PUDAHUEL", "PUENTE ALTO",
    "QUILICURA", "QUINTA NORMAL", "RECOLETA", "RENCA", "SAN BERNARDO",
    "SAN JOAQUIN", "SAN JOSE DE MAIPO", "SAN MIGUEL", "SAN PEDRO", "SAN RAMON",
    "SANTIAGO", "TALAGANTE", "TILTIL", "VITACURA",
}


def normalize_name(value: str | None) -> str:
    normalized = unicodedata.normalize("NFD", value or "")
    return " ".join(
        "".join(character for character in normalized if unicodedata.category(character) != "Mn")
        .upper()
        .strip()
        .split()
    )


@lru_cache(maxsize=1)
def _load_commune_shapes() -> list[tuple[object, str, str]]:
    project_root = Path(__file__).resolve().parents[2]
    candidates = [
        project_root / "public" / "data" / "map-layers" / "chile_comunas_simplified.geojson",
        project_root / "public" / "data" / "map-layers" / "chile_comunas.geojson",
    ]
    path = next((candidate for candidate in candidates if candidate.exists()), None)
    if path is None:
        return []

    with path.open("r", encoding="utf-8") as geojson_file:
        payload = json.load(geojson_file)

    result: list[tuple[object, str, str]] = []
    for feature in payload.get("features", []):
        properties = feature.get("properties") or {}
        comuna = properties.get("COMUNA") or properties.get("Comuna") or properties.get("comuna") or ""
        region = properties.get("REGION") or properties.get("Region") or properties.get("region") or ""
        geometry = feature.get("geometry")
        if geometry:
            result.append((shape(geometry), str(comuna), str(region)))
    return result


def classify_territory(
    comuna: str | None,
    region: str | None,
    lat: float | None,
    lon: float | None,
) -> tuple[str, str | None, str | None, str | None]:
    normalized_comuna = normalize_name(comuna)
    if normalized_comuna:
        territory = "rm" if normalized_comuna in RM_COMUNAS else "regiones"
        return territory, comuna, region, None

    if lat is not None and lon is not None:
        point = Point(lon, lat)
        for polygon, matched_comuna, matched_region in _load_commune_shapes():
            if polygon.contains(point) or polygon.touches(point):
                territory = "rm" if normalize_name(matched_comuna) in RM_COMUNAS else "regiones"
                return territory, matched_comuna or comuna, matched_region or region, None

    return "regiones", comuna, region, "No fue posible clasificar la comuna; se asignó territorio regiones."
