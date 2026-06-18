import os
from functools import lru_cache
from pathlib import Path

import geopandas as gpd
from dotenv import load_dotenv
from shapely.geometry import Point


BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BACKEND_DIR / ".env")


@lru_cache(maxsize=1)
def load_red_zones():
    red_zones_path = os.getenv("RED_ZONES_GEOJSON", "zonas_rojas.geojson")
    geojson_path = Path(red_zones_path)

    if not geojson_path.is_absolute():
        geojson_path = BACKEND_DIR / geojson_path

    if not geojson_path.exists():
        return None

    try:
        gdf = gpd.read_file(geojson_path)
        if gdf.crs is None:
            gdf.set_crs(epsg=4326, inplace=True)
        elif gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)
        return gdf
    except Exception:
        return None


def is_point_in_red_zone(lat: float | None, lon: float | None) -> bool:
    if lat is None or lon is None:
        return False

    red_zones = load_red_zones()
    if red_zones is None:
        return False

    try:
        point = Point(lon, lat)
        return bool(red_zones.contains(point).any())
    except Exception:
        return False
