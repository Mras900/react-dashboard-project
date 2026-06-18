import json
import math
from functools import lru_cache
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session
from shapely.geometry import Point, shape

from models.red_zone import RedZone
from schemas.red_zone_schema import RedZoneCreate, RedZoneUpdate


SEVERITY_INTENSITY = {"baja": 0.3, "media": 0.55, "alta": 0.8, "critica": 1.0}


def _normalize_property(properties: dict, *keys: str) -> str | None:
    for key in keys:
        value = properties.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


@lru_cache(maxsize=1)
def _load_historical_red_zone_features() -> list[dict]:
    project_root = Path(__file__).resolve().parents[2]
    geojson_path = project_root / "public" / "data" / "map-layers" / "zonas_rojas.geojson"
    if not geojson_path.exists():
        return []

    with geojson_path.open("r", encoding="utf-8") as geojson_file:
        payload = json.load(geojson_file)

    features: list[dict] = []
    for feature in payload.get("features", []):
        geometry = feature.get("geometry")
        if not geometry:
            continue

        polygon = shape(geometry)
        properties = feature.get("properties") or {}
        centroid = polygon.centroid if not polygon.is_empty else None
        features.append(
            {
                "shape": polygon,
                "name": _normalize_property(properties, "NombreZona", "NOMBRE", "Nombre", "NAME", "name") or "Zona roja histórica",
                "comuna": _normalize_property(properties, "Comuna", "COMUNA", "comuna", "NOM_COMUNA", "NOM_COM"),
                "region": _normalize_property(properties, "Region", "REGION", "region", "NOM_REGION", "NOM_REG", "REGIÓN", "NOMBRE_REG"),
                "lat": float(centroid.y) if centroid is not None else None,
                "lon": float(centroid.x) if centroid is not None else None,
            }
        )
    return features


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_earth_m = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_earth_m * c


def _build_zone_summary(
    *,
    zone_id: int | None,
    name: str,
    source: str,
    comuna: str | None,
    region: str | None,
    distance_m: float,
    radius_m: float | None,
    severity: str | None,
    lat: float | None,
    lon: float | None,
) -> dict:
    return {
        "id": zone_id,
        "name": name,
        "source": source,
        "comuna": comuna,
        "region": region,
        "distance_m": round(distance_m, 1),
        "radius_m": radius_m,
        "severity": severity,
        "lat": lat,
        "lon": lon,
    }


def list_red_zones(
    db: Session,
    comuna: str | None = None,
    region: str | None = None,
    status: str | None = None,
) -> list[RedZone]:
    statement = select(RedZone).order_by(RedZone.updated_at.desc())
    if comuna:
        statement = statement.where(RedZone.comuna == comuna)
    if region:
        statement = statement.where(RedZone.region == region)
    if status:
        statement = statement.where(RedZone.status == status)
    return list(db.scalars(statement).all())


def create_red_zone(db: Session, payload: RedZoneCreate) -> RedZone:
    record = RedZone(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_red_zone(db: Session, zone_id: int, payload: RedZoneUpdate) -> RedZone | None:
    record = db.get(RedZone, zone_id)
    if record is None:
        return None
    for key, value in payload.model_dump().items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record


def delete_red_zone(db: Session, zone_id: int) -> bool:
    record = db.get(RedZone, zone_id)
    if record is None:
        return False
    db.delete(record)
    db.commit()
    return True


def list_heat_points(db: Session) -> list[dict]:
    zones = list_red_zones(db, status="active")
    return [
        {
            "id": zone.id,
            "name": zone.name,
            "lat": zone.lat,
            "lon": zone.lon,
            "intensity": SEVERITY_INTENSITY.get(zone.severity, 0.5),
            "severity": zone.severity,
            "radius_m": zone.radius_m,
        }
        for zone in zones
        if zone.lat is not None and zone.lon is not None
    ]


def validate_red_zone_point(db: Session, lat: float, lon: float, nearby_threshold_m: float = 500) -> dict:
    point = Point(lon, lat)
    inside_zones: list[dict] = []
    nearby_zones: list[dict] = []
    nearest_zone: dict | None = None
    nearest_distance = float("inf")

    active_zones = list_red_zones(db, status="active")
    for zone in active_zones:
        if zone.display_mode == "polygon" and zone.polygon_geojson:
            try:
                polygon = shape(zone.polygon_geojson)
                if polygon.contains(point) or polygon.touches(point):
                    summary = _build_zone_summary(
                        zone_id=zone.id,
                        name=zone.name,
                        source=zone.source,
                        comuna=zone.comuna,
                        region=zone.region,
                        distance_m=0,
                        radius_m=zone.radius_m,
                        severity=zone.severity,
                        lat=zone.lat,
                        lon=zone.lon,
                    )
                    inside_zones.append(summary)
                    if nearest_zone is None:
                        nearest_zone = summary
                        nearest_distance = 0
            except Exception:
                continue
            continue

        if zone.lat is None or zone.lon is None:
            continue

        center_distance = _haversine_meters(lat, lon, zone.lat, zone.lon)
        boundary_distance = max(0.0, center_distance - zone.radius_m)
        summary = _build_zone_summary(
            zone_id=zone.id,
            name=zone.name,
            source=zone.source,
            comuna=zone.comuna,
            region=zone.region,
            distance_m=boundary_distance if boundary_distance > 0 else center_distance,
            radius_m=zone.radius_m,
            severity=zone.severity,
            lat=zone.lat,
            lon=zone.lon,
        )

        if center_distance <= zone.radius_m:
            inside_zones.append(summary)
        elif boundary_distance <= nearby_threshold_m:
            nearby_zones.append(summary)

        candidate_distance = boundary_distance if boundary_distance > 0 else center_distance
        if candidate_distance < nearest_distance:
            nearest_distance = candidate_distance
            nearest_zone = summary

    for historical_zone in _load_historical_red_zone_features():
        polygon = historical_zone["shape"]
        if polygon.contains(point) or polygon.touches(point):
            summary = _build_zone_summary(
                zone_id=None,
                name=historical_zone["name"],
                source="historical_polygon",
                comuna=historical_zone["comuna"],
                region=historical_zone["region"],
                distance_m=0,
                radius_m=None,
                severity="historica",
                lat=historical_zone["lat"],
                lon=historical_zone["lon"],
            )
            inside_zones.append(summary)
            if nearest_zone is None or nearest_distance > 0:
                nearest_zone = summary
                nearest_distance = 0

    if inside_zones:
        return {
            "ok": True,
            "status": "inside",
            "message": "Visita en zona roja",
            "lat": lat,
            "lon": lon,
            "inside_zones": inside_zones,
            "nearby_zones": nearby_zones,
            "nearest_zone": nearest_zone,
        }

    if nearby_zones:
        nearby_zones.sort(key=lambda item: item["distance_m"])
        return {
            "ok": True,
            "status": "nearby",
            "message": "Dirección cercana a zona roja",
            "lat": lat,
            "lon": lon,
            "inside_zones": [],
            "nearby_zones": nearby_zones,
            "nearest_zone": nearest_zone or nearby_zones[0],
        }

    return {
        "ok": True,
        "status": "safe",
        "message": "Dirección fuera de zonas rojas",
        "lat": lat,
        "lon": lon,
        "inside_zones": [],
        "nearby_zones": [],
        "nearest_zone": nearest_zone,
    }
