from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
KNOWN_PATHS = {
    "red_zones": [ROOT / "public/data/map-layers/zonas_rojas.geojson"],
    "geo_layer": [
        ROOT / "public/data/map-layers/chile_comunas_simplified.geojson",
        ROOT / "public/data/map-layers/chile_comunas.geojson",
        ROOT / "public/data/map-layers/regiones.geojson",
        ROOT / "public/data/map-layers/regiones-chile.geojson",
        ROOT / "public/data/map-layers/comunas.kml.geojson",
    ],
    "census": [
        ROOT / "data/processed/censo_comunas_rm_2024.json",
        ROOT / "data/processed/censo_comunas_chile_2024.json",
        ROOT / "backend/data/censo_comunas_2024.json",
        ROOT / "backend/data/reference/censo_comunas_2024.json",
        ROOT / "public/data/reference/censo_comunas_2024.json",
        ROOT / "data/processed/censo_comunas_rm_2024.csv",
        ROOT / "data/processed/censo_comunas_chile_2024.csv",
    ],
}


def _sanitize(value: Any) -> Any:
    if isinstance(value, list):
        return [_sanitize(item) for item in value]
    if isinstance(value, dict):
        return {key: _sanitize(item) for key, item in value.items() if key.lower() not in {"rut", "telefono", "email", "correo", "cliente", "nombre", "direccion", "calle", "numero"}}
    return value


def _norm(value: Any) -> str:
    import unicodedata
    text = str(value or "").strip().lower()
    return unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode("ascii")


def _find_existing(paths: list[Path]) -> Path | None:
    return next((path for path in paths if path.exists()), None)


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _extract_population(row: dict[str, Any]) -> tuple[str | None, int | None]:
    comuna = row.get("comuna") or row.get("Comuna") or row.get("nombre") or row.get("NOM_COM") or row.get("name")
    for key in ("poblacion", "población", "population", "total", "PERSONAS", "personas", "Poblacion"):
        value = row.get(key)
        if value not in (None, ""):
            try:
                return str(comuna) if comuna else None, int(float(str(value).replace(".", "").replace(",", ".")))
            except ValueError:
                continue
    return str(comuna) if comuna else None, None


def _load_population_map() -> tuple[dict[str, int], Path | None]:
    path = _find_existing(KNOWN_PATHS["census"])
    if not path:
        return {}, None
    rows: list[dict[str, Any]] = []
    if path.suffix.lower() == ".csv":
        try:
            with path.open(encoding="utf-8-sig", newline="") as handle:
                rows = list(csv.DictReader(handle))
        except Exception:
            rows = []
    else:
        payload = _read_json(path)
        if isinstance(payload, list):
            rows = [item for item in payload if isinstance(item, dict)]
        elif isinstance(payload, dict):
            values = payload.get("features") or payload.get("data") or payload.get("rows") or []
            if isinstance(values, list):
                for item in values:
                    if isinstance(item, dict):
                        rows.append(item.get("properties", item))
    result: dict[str, int] = {}
    for row in rows:
        comuna, population = _extract_population(row)
        if comuna and population:
            result[_norm(comuna)] = population
    return result, path


def load_reference_sources() -> dict[str, Any]:
    population, census_path = _load_population_map()
    red_zone_path = _find_existing(KNOWN_PATHS["red_zones"])
    geo_paths = [str(path.relative_to(ROOT)) for path in KNOWN_PATHS["geo_layer"] if path.exists()]
    return {
        "population": population,
        "census_path": str(census_path.relative_to(ROOT)) if census_path else None,
        "red_zones_path": str(red_zone_path.relative_to(ROOT)) if red_zone_path else None,
        "geo_layers": geo_paths,
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }


def get_population_by_commune(comuna: str) -> int | None:
    sources = load_reference_sources()
    return sources["population"].get(_norm(comuna))


def _red_zone_communes() -> Counter[str]:
    path = _find_existing(KNOWN_PATHS["red_zones"])
    counts: Counter[str] = Counter()
    if not path:
        return counts
    payload = _read_json(path)
    features = payload.get("features", []) if isinstance(payload, dict) else []
    for feature in features:
        props = feature.get("properties", {}) if isinstance(feature, dict) else {}
        comuna = props.get("comuna") or props.get("Comuna") or props.get("NOM_COM") or props.get("name") or props.get("nombre")
        if comuna:
            counts[_norm(comuna)] += 1
    return counts


def get_red_zones_summary(filters: dict | None = None) -> dict[str, Any]:
    counts = _red_zone_communes()
    path = _find_existing(KNOWN_PATHS["red_zones"])
    comuna = _norm((filters or {}).get("comuna"))
    filtered = {key: value for key, value in counts.items() if not comuna or key == comuna}
    return {
        "available": path is not None,
        "path": str(path.relative_to(ROOT)) if path else None,
        "total_zones": sum(filtered.values()),
        "communes": filtered,
        "top_communes": sorted(filtered.items(), key=lambda item: item[1], reverse=True)[:10],
    }


def get_source_references(filters: dict | None = None) -> list[dict[str, Any]]:
    sources = load_reference_sources()
    refs = [
        {
            "source_id": "censo_2024",
            "title": "Censo 2024 / poblacion comunal",
            "type": "census",
            "path": sources["census_path"],
            "used_for": "calculo de tasa de reclamos por 100.000 habitantes",
            "available": bool(sources["census_path"] and sources["population"]),
        },
        {
            "source_id": "zonas_rojas",
            "title": "Zonas rojas operativas",
            "type": "geojson",
            "path": sources["red_zones_path"],
            "used_for": "identificacion de riesgo operativo territorial",
            "available": bool(sources["red_zones_path"]),
        },
    ]
    refs.extend({
        "source_id": Path(path).stem,
        "title": f"Capa geografica {Path(path).name}",
        "type": "geo_layer",
        "path": path,
        "used_for": "referencia geografica dashboard",
        "available": True,
    } for path in sources["geo_layers"])
    return refs


def calculate_population_rates(metrics: dict, filters: dict | None = None) -> dict[str, Any]:
    population, _ = _load_population_map()
    warnings = []
    if not population:
        return {"population_available": False, "items": [], "warnings": ["No se encontro archivo de poblacion/censo para calcular tasas normalizadas"]}
    items = []
    for row in metrics.get("comunas_con_mas_reclamos", []) or []:
        if not isinstance(row, dict):
            continue
        comuna = row.get("comuna")
        pop = population.get(_norm(comuna)) if comuna else None
        reclamos = int(row.get("reclamos") or 0)
        alta = int(row.get("prioridad_alta") or 0)
        if not pop:
            warnings.append(f"Sin poblacion para {comuna}")
            continue
        items.append({
            "comuna": comuna,
            "region": row.get("region"),
            "poblacion": pop,
            "reclamos": reclamos,
            "prioridad_alta": alta,
            "claims_per_100k": (reclamos / pop) * 100000 if pop else None,
            "high_priority_per_100k": (alta / pop) * 100000 if pop else None,
        })
    items.sort(key=lambda item: item.get("claims_per_100k") or 0, reverse=True)
    return {"population_available": True, "items": _sanitize(items), "warnings": warnings}


def calculate_territorial_risk(metrics: dict, filters: dict | None = None) -> dict[str, Any]:
    red_counts = _red_zone_communes()
    items = []
    max_claims = max([int(row.get("reclamos") or 0) for row in metrics.get("comunas_con_mas_reclamos", []) if isinstance(row, dict)] or [0])
    no_exitosa = int(metrics.get("visitas_no_exitosas") or 0)
    for row in metrics.get("comunas_con_mas_reclamos", []) or []:
        if not isinstance(row, dict):
            continue
        comuna = row.get("comuna")
        red_zones = red_counts.get(_norm(comuna)) if comuna else 0
        reclamos = int(row.get("reclamos") or 0)
        high_volume = max_claims > 0 and reclamos >= max_claims * 0.6
        if high_volume and red_zones and no_exitosa > 0:
            level = "alto"
        elif high_volume or red_zones:
            level = "medio"
        else:
            level = "bajo"
        items.append({"comuna": comuna, "region": row.get("region"), "reclamos": reclamos, "red_zones": red_zones, "risk_level": level})
    return {"red_zones_available": bool(red_counts), "items": _sanitize(items), "warnings": [] if red_counts else ["No se encontro capa de zonas rojas para calcular riesgo territorial"]}


def get_commune_reference_context(filters: dict | None = None) -> str:
    refs = get_source_references(filters)
    red = get_red_zones_summary(filters)
    return json.dumps({"source_references": refs, "red_zones": red}, ensure_ascii=False, default=str)



