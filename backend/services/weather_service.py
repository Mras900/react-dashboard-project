from datetime import datetime, timezone
from typing import Any

import requests

OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5"
TIMEOUT_SECONDS = 8

RISK_REASONS: dict[str, list[str]] = {}


def _to_kmh(ms: float | None) -> float | None:
    return round(ms * 3.6, 1) if ms is not None else None


def _wind_direction(deg: float | None) -> str:
    if deg is None:
        return ""
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return dirs[round(deg / 45) % 8]


def get_weather_presentation(icon: str | None, weather_id: int | None) -> dict[str, str]:
    if not icon:
        if weather_id is None:
            return {"icon": "🌡️", "label": "Condición no disponible"}
        icon = ""
    icon_s = icon or ""

    if icon_s.startswith("01"):
        return {"icon": "☀️" if "d" in icon_s else "🌙", "label": "Despejado"}
    if icon_s.startswith("02"):
        return {"icon": "🌤️", "label": "Parcialmente despejado"}
    if icon_s.startswith("03"):
        return {"icon": "☁️", "label": "Nubes dispersas"}
    if icon_s.startswith("04"):
        return {"icon": "☁️", "label": "Nublado"}
    if icon_s.startswith("09"):
        return {"icon": "🌧️", "label": "Lluvia"}
    if icon_s.startswith("10"):
        return {"icon": "🌦️", "label": "Lluvia ligera"}
    if icon_s.startswith("11"):
        return {"icon": "⛈️", "label": "Tormenta"}
    if icon_s.startswith("13"):
        return {"icon": "❄️", "label": "Nieve"}
    if icon_s.startswith("50"):
        return {"icon": "🌫️", "label": "Niebla"}

    # Fallback: weather id
    if weather_id is not None:
        if 200 <= weather_id < 300:
            return {"icon": "⛈️", "label": "Tormenta"}
        if 300 <= weather_id < 400:
            return {"icon": "🌦️", "label": "Llovizna"}
        if 500 <= weather_id < 600:
            return {"icon": "🌧️", "label": "Lluvia"}
        if 600 <= weather_id < 700:
            return {"icon": "❄️", "label": "Nieve"}
        if 700 <= weather_id < 800:
            return {"icon": "🌫️", "label": "Niebla"}
        if weather_id == 800:
            return {"icon": "☀️", "label": "Despejado"}
        if weather_id > 800 and weather_id < 900:
            return {"icon": "☁️", "label": "Nublado"}

    return {"icon": "🌡️", "label": "Condición no disponible"}


def determine_weather_risk(
    weather_id: int | None,
    precipitation_mm: float | None,
    precip_prob: float | None,
    wind_kmh: float | None,
    wind_gust_kmh: float | None,
    temp_max: float | None,
    temp_min: float | None,
) -> dict[str, Any]:
    reasons: list[str] = []
    level: str = "normal"

    # Storm
    if weather_id is not None and 200 <= weather_id < 300:
        reasons.append("Tormenta eléctrica en la zona")
        level = "alto"

    # Rain
    if weather_id is not None and (500 <= weather_id < 600 or 300 <= weather_id < 400):
        reasons.append("Lluvia en la zona")
        if level != "alto":
            level = "precaucion"

    # Fog
    if weather_id is not None and 700 <= weather_id < 800:
        reasons.append("Niebla / baja visibilidad")
        if level != "alto":
            level = "precaucion"

    # Precipitation amount
    if precipitation_mm is not None:
        if precipitation_mm >= 10:
            reasons.append(f"Lluvia acumulada {precipitation_mm:.0f} mm")
            level = "alto"
        elif precipitation_mm >= 3:
            reasons.append(f"Lluvia acumulada {precipitation_mm:.0f} mm")
            if level != "alto":
                level = "precaucion"

    # Precip probability
    if precip_prob is not None:
        if precip_prob >= 70:
            reasons.append(f"Probabilidad lluvia {precip_prob:.0f}%")
            if level != "alto":
                level = "precaucion"

    # Wind
    if wind_kmh is not None:
        if wind_kmh >= 45:
            reasons.append(f"Viento {wind_kmh:.0f} km/h")
            level = "alto"
        elif wind_kmh >= 30:
            reasons.append(f"Viento {wind_kmh:.0f} km/h")
            if level != "alto":
                level = "precaucion"

    # Wind gusts
    if wind_gust_kmh is not None:
        if wind_gust_kmh >= 55:
            reasons.append(f"Ráfagas {wind_gust_kmh:.0f} km/h")
            level = "alto"
        elif wind_gust_kmh >= 40:
            reasons.append(f"Ráfagas {wind_gust_kmh:.0f} km/h")
            if level != "alto":
                level = "precaucion"

    # Temperature
    if temp_max is not None and temp_max >= 34:
        reasons.append(f"Temperatura máxima {temp_max:.0f} °C")
        if level != "alto":
            level = "precaucion"

    if temp_min is not None:
        if temp_min <= 0:
            reasons.append(f"Temperatura bajo cero ({temp_min:.0f} °C)")
            level = "alto"
        elif temp_min <= 2:
            reasons.append(f"Temperatura mínima {temp_min:.0f} °C")
            if level != "alto":
                level = "precaucion"

    if not reasons:
        reasons.append("Sin alertas climáticas significativas.")

    return {
        "riskLevel": level,
        "riskReasons": reasons,
        "riskLabel": (
            f"{'⚠️ Alerta operativa' if level == 'alto' else '⚡ Precaución' if level == 'precaucion' else '✅ Normal'}"
            f": clima puede afectar la ruta. Alerta operativa calculada según condiciones meteorológicas."
        ),
    }


def fetch_openweather_current(lat: float, lon: float, api_key: str) -> dict[str, Any] | None:
    url = f"{OPENWEATHER_BASE}/weather"
    params = {"lat": lat, "lon": lon, "units": "metric", "lang": "es", "appid": api_key}
    try:
        resp = requests.get(url, params=params, timeout=TIMEOUT_SECONDS)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException:
        return None


def fetch_openweather_forecast(lat: float, lon: float, api_key: str) -> dict[str, Any] | None:
    url = f"{OPENWEATHER_BASE}/forecast"
    params = {"lat": lat, "lon": lon, "units": "metric", "lang": "es", "appid": api_key}
    try:
        resp = requests.get(url, params=params, timeout=TIMEOUT_SECONDS)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException:
        return None


def extract_rain(data: dict[str, Any]) -> float:
    rain = data.get("rain") or {}
    return rain.get("1h") or rain.get("3h") or 0.0


def extract_snow(data: dict[str, Any]) -> float:
    snow = data.get("snow") or {}
    return snow.get("1h") or snow.get("3h") or 0.0


def build_unavailable_response(message: str, location_name: str = "", date_str: str = "") -> dict[str, Any]:
    return {
        "source": "unavailable",
        "locationName": location_name,
        "date": date_str,
        "isCurrent": False,
        "temperatureCurrent": None,
        "temperatureMax": None,
        "temperatureMin": None,
        "humidity": None,
        "precipitationCurrent": None,
        "precipitationSum": None,
        "precipitationProbabilityMax": None,
        "windSpeedCurrent": None,
        "windSpeedMax": None,
        "windGusts": None,
        "weatherCode": None,
        "conditionLabel": "Sin datos",
        "conditionIcon": "🌡️",
        "riskLevel": "sin_datos",
        "riskLabel": "Sin datos meteorológicos",
        "riskReasons": [],
        "alertTitle": None,
        "alertDescription": None,
        "alertSource": None,
        "message": message,
    }


def build_weather_response(
    lat: float, lon: float, date_str: str, location_name: str, api_key: str
) -> dict[str, Any]:
    if not api_key:
        return build_unavailable_response(
            "OpenWeather no está configurado. Puedes continuar cargando la ruta.",
            location_name, date_str,
        )

    # Fetch current
    current_data = fetch_openweather_current(lat, lon, api_key)

    # Fetch forecast
    forecast_data = fetch_openweather_forecast(lat, lon, api_key)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    is_today = date_str == today

    main_data: dict[str, Any] = {}
    weather_info: dict[str, Any] = {}
    wind_info: dict[str, Any] = {}
    temp_current: float | None = None
    humidity: float | None = None
    precip_current: float | None = None
    icon: str | None = None
    weather_id: int | None = None
    condition_label = "Sin datos"
    condition_icon = "🌡️"
    wind_speed_current: float | None = None
    wind_gusts: float | None = None
    temp_max: float | None = None
    temp_min: float | None = None
    precip_sum: float | None = None
    precip_prob: float | None = None

    # Current weather (primary for today)
    if current_data:
        main_data = current_data.get("main", {})
        weather_info = (current_data.get("weather") or [{}])[0]
        wind_info = current_data.get("wind", {})
        temp_current = main_data.get("temp")
        humidity = main_data.get("humidity")
        precip_current = extract_rain(current_data) + extract_snow(current_data)
        icon = weather_info.get("icon")
        weather_id = weather_info.get("id")
        wind_speed_current = _to_kmh(wind_info.get("speed"))
        wind_gusts = _to_kmh(wind_info.get("gust"))
        pres = get_weather_presentation(icon, weather_id)
        condition_label = pres["label"]
        condition_icon = pres["icon"]
        temp_max = main_data.get("temp_max")
        temp_min = main_data.get("temp_min")

    # Forecast (for future dates or complement)
    if forecast_data:
        forecast_list = forecast_data.get("list", [])
        # Find the closest forecast point for the requested date
        date_target = date_str
        for entry in forecast_list:
            entry_dt = entry.get("dt_txt", "")
            entry_date = entry_dt[:10] if entry_dt else ""
            if entry_date == date_target:
                f_main = entry.get("main", {})
                f_weather = (entry.get("weather") or [{}])[0]
                f_wind = entry.get("wind", {})
                f_rain = extract_rain(entry)
                f_snow = extract_snow(entry)
                f_pop = entry.get("pop")

                if not is_today:
                    temp_current = f_main.get("temp")
                    humidity = f_main.get("humidity")
                    precip_current = f_rain + f_snow
                    icon = f_weather.get("icon")
                    weather_id = f_weather.get("id")
                    wind_speed_current = _to_kmh(f_wind.get("speed"))
                    wind_gusts = _to_kmh(f_wind.get("gust"))
                    pres = get_weather_presentation(icon, weather_id)
                    condition_label = pres["label"]
                    condition_icon = pres["icon"]
                    temp_max = f_main.get("temp_max")
                    temp_min = f_main.get("temp_min")

                if f_pop is not None:
                    precip_prob = f_pop * 100

                # Sum precipitation for the day
                day_precip = f_rain + f_snow
                precip_sum = (precip_sum or 0) + day_precip
                break

    if not current_data and not forecast_data:
        return build_unavailable_response(
            "No se pudo obtener el clima. Puedes continuar cargando la ruta.",
            location_name, date_str,
        )

    risk = determine_weather_risk(
        weather_id, precip_sum or precip_current, precip_prob,
        wind_speed_current, wind_gusts,
        temp_max or temp_current, temp_min,
    )

    return {
        "source": "openweather",
        "locationName": location_name,
        "date": date_str,
        "isCurrent": is_today,
        "temperatureCurrent": round(temp_current, 1) if temp_current is not None else None,
        "temperatureMax": round(temp_max, 1) if temp_max is not None else None,
        "temperatureMin": round(temp_min, 1) if temp_min is not None else None,
        "humidity": round(humidity) if humidity is not None else None,
        "precipitationCurrent": round(precip_current, 1) if precip_current else None,
        "precipitationSum": round(precip_sum, 1) if precip_sum else None,
        "precipitationProbabilityMax": round(precip_prob) if precip_prob is not None else None,
        "windSpeedCurrent": round(wind_speed_current, 1) if wind_speed_current is not None else None,
        "windSpeedMax": round(wind_speed_current, 1) if wind_speed_current is not None else None,
        "windGusts": round(wind_gusts, 1) if wind_gusts is not None else None,
        "weatherCode": weather_id,
        "conditionLabel": condition_label,
        "conditionIcon": condition_icon,
        "riskLevel": risk["riskLevel"],
        "riskLabel": risk["riskLabel"],
        "riskReasons": risk["riskReasons"],
        "alertTitle": None,
        "alertDescription": None,
        "alertSource": None,
        "message": None,
    }
