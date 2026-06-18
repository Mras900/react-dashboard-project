import time
import re
from typing import Any

from geopy.exc import GeocoderServiceError, GeocoderTimedOut, GeocoderUnavailable
from geopy.geocoders import Nominatim


def clean_crm_address(address: str | None) -> str:
    if not address:
        return ""

    cleaned = address.strip()
    cleaned = cleaned.replace(" / ", ", ")
    cleaned = cleaned.replace("/", ", ")
    cleaned = re.sub(r"(?i)(,\s*CL|\s+CL)\s*$", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"\s*,\s*", ", ", cleaned)
    cleaned = re.sub(r"(,\s*){2,}", ", ", cleaned)
    cleaned = cleaned.strip(" ,")

    if cleaned.islower():
        cleaned = cleaned.title()

    if cleaned and "chile" not in cleaned.lower():
        cleaned = f"{cleaned}, Chile"

    return cleaned


def _add_unique(values: list[str], value: str | None) -> None:
    if not value:
        return

    normalized = value.strip()
    if normalized and normalized not in values:
        values.append(normalized)


def add_common_address_variants(query: str) -> list[str]:
    variants: list[str] = []
    base = f" {query.strip()} "
    replacements = [
        (r"\bPJE\s+", "Pasaje "),
        (r"\bAVDA\s+", "Avenida "),
        (r"\bAV\s+", "Avenida "),
        (r"\bSTA\s+", "Santa "),
        (r"\bSTO\s+", "Santo "),
        (r"\bNRO\b", ""),
        (r"N°", ""),
        (r"\bNO\s+", ""),
        (r"\s+DE SOL\s+", " DEL SOL "),
    ]

    for pattern, replacement in replacements:
        candidate = re.sub(pattern, replacement, base, flags=re.IGNORECASE)
        candidate = re.sub(r"\s+", " ", candidate).strip()
        if candidate != query:
            _add_unique(variants, candidate)

    return variants


def build_address_queries(address: str) -> list[str]:
    queries: list[str] = []
    original = address.strip()
    clean = clean_crm_address(original)
    clean_without_country = re.sub(r"(?i),?\s*Chile\s*$", "", clean).strip(" ,")
    no_cl = re.sub(r"(?i)(,\s*CL|\s+CL)\s*$", "", original).replace(" / ", ", ").replace("/", ", ").strip(" ,")
    slash_as_comma = original.replace(" / ", ", ").replace("/", ", ")

    _add_unique(queries, original)
    _add_unique(queries, clean)
    _add_unique(queries, f"{clean_without_country}, Región Metropolitana, Chile" if clean_without_country else "")
    _add_unique(queries, f"{clean_without_country}, Santiago, Chile" if clean_without_country else "")
    _add_unique(queries, no_cl)
    _add_unique(queries, slash_as_comma)

    parts = [part.strip() for part in clean_without_country.split(",") if part.strip()]
    if len(parts) >= 2:
        _add_unique(queries, f"{parts[0]}, {parts[1]}, Chile")

    for query in list(queries):
        for variant in add_common_address_variants(query):
            _add_unique(queries, variant)

    return queries


def geocode_address(direccion: str | None) -> dict[str, float | str] | None:
    if not direccion:
        return None

    geolocator = Nominatim(user_agent="carozzi_ruta_backend", timeout=8)
    intentos = build_address_queries(direccion)

    for intento in intentos:
        try:
            loc = geolocator.geocode(intento)
            if loc:
                raw = getattr(loc, "raw", {}) if loc else {}
                return {
                    "lat": float(loc.latitude),
                    "lon": float(loc.longitude),
                    "label": _get_display_name(raw, loc),
                    "query_used": intento,
                }
            time.sleep(0.4)
        except (GeocoderTimedOut, GeocoderUnavailable, GeocoderServiceError):
            time.sleep(0.4)
            continue
        except Exception:
            return None

    return None


def search_address_suggestions(query: str | None) -> list[dict[str, float | str]]:
    if not query:
        return []

    query_limpia = query.strip()

    if len(query_limpia) < 4:
        return []

    geolocator = Nominatim(user_agent="carozzi_ruta_backend", timeout=8)
    intentos = build_address_queries(query_limpia)

    suggestions: list[dict[str, float | str]] = []
    seen = set[str]()

    for intento in intentos:
        try:
            results = geolocator.geocode(intento, exactly_one=False, limit=5)
            if not results:
                time.sleep(0.4)
                continue

            for loc in results:
                raw = getattr(loc, "raw", {}) if loc else {}
                display_name = _get_display_name(raw, loc)
                lat = float(loc.latitude)
                lon = float(loc.longitude)
                dedupe_key = f"{lat:.6f},{lon:.6f}"

                if not display_name or dedupe_key in seen:
                    continue

                seen.add(dedupe_key)
                suggestions.append(
                    {
                        "label": display_name,
                        "lat": lat,
                        "lon": lon,
                        "query_used": intento,
                    }
                )

                if len(suggestions) >= 5:
                    return suggestions

            time.sleep(0.4)
        except (GeocoderTimedOut, GeocoderUnavailable, GeocoderServiceError):
            time.sleep(0.4)
            continue
        except Exception:
            return []

    return suggestions


def _get_display_name(raw: Any, loc: Any) -> str:
    if isinstance(raw, dict) and isinstance(raw.get("display_name"), str):
        return raw["display_name"]

    return str(loc.address) if getattr(loc, "address", None) else ""
