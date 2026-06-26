from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Iterable

import pandas as pd


DEFAULT_CENSO = Path("data/processed/censo_comunas_rm_2024.csv")
DEFAULT_GEOJSON = Path("data/processed/comunas_rm_censo2024.geojson")
DEFAULT_OUTPUT = Path("data/processed")
DEFAULT_TS_OUTPUT = Path("src/data/reclamosCensoRM2026.ts")

OUTPUT_BASENAME = "reclamos_censo_rm_2026"
NO_CLAIMS = "Sin reclamos"
LEVELS = [NO_CLAIMS, "Bajo", "Medio", "Alto", "Crítico"]
INTENSITY_LEVELS = [NO_CLAIMS, "Baja", "Media", "Alta", "Crítica"]

RECLAMOS_FILE_PRIORITY = [
    "consolidado2026_limpio.xlsx",
    "consolidado2026_limpio.csv",
    "reclamos_2026.xlsx",
    "reclamos_rm_2026.xlsx",
    "tickets_diarios.xlsx",
    "tickets_diarios.csv",
    "carga_diaria.xlsx",
    "carga_diaria.csv",
]

COLUMN_CANDIDATES = {
    "codigo_comuna": ["codigo_comuna", "cod_comuna", "comuna_codigo", "cut"],
    "comuna": ["comuna", "ciudad", "nombre_comuna", "nom_comuna"],
    "ticket": ["ticket", "id_ticket", "n_ticket", "numero_ticket", "tracking", "folio", "id"],
    "prioridad": ["prioridad", "priority"],
    "cliente": ["cliente", "nombre_cliente", "rut_cliente", "id_cliente"],
    "calle": ["calle", "direccion_calle"],
    "numero": ["numero", "número", "num", "numero_direccion"],
    "direccion": ["direccion", "dirección", "domicilio"],
    "fecha_visita": ["fecha_visita", "fecha visita"],
    "fecha_recepcion": ["fecha_recepcion", "fecha recepción", "fecha recepcion", "createdat", "created_at"],
    "retiro_muestra": ["retiro_muestra", "retiro muestra"],
    "fecha_envio": ["fecha_envio", "fecha envío", "fecha envio"],
    "fecha": ["fecha"],
    "estado_visita": ["estado_visita", "estado visita", "estado"],
    "km": ["km", "kilometros", "kilómetros"],
    "traslado": ["traslado"],
    "tarifa_ruta": ["tarifa_ruta", "tarifa ruta"],
    "facturacion": [
        "precio_neto_traslado",
        "precio neto traslado",
        "precio_neto_mas_traslado",
        "precio neto + traslado",
        "facturacion_total",
        "facturación_total",
        "facturacion",
        "factura",
        "precio_neto",
        "precio neto",
        "valor_envio",
        "valor envío",
        "monto",
    ],
    "region": ["region", "región"],
}

CENSO_COLUMNS = [
    "codigo_region",
    "region",
    "codigo_comuna",
    "comuna",
    "poblacion_2024",
    "hogares_2024",
    "viviendas_2024",
    "hombres_2024",
    "mujeres_2024",
    "edad_0_14",
    "edad_15_29",
    "edad_30_44",
    "edad_45_64",
    "edad_65_mas",
    "promedio_personas_hogar",
    "viviendas_por_hogar",
    "porcentaje_mujeres",
    "porcentaje_hombres",
    "porcentaje_adultos_mayores",
    "porcentaje_menores_15",
    "macrozona_rm",
]


class RunLog:
    def __init__(self) -> None:
        self.warnings: list[str] = []
        self.outputs: list[str] = []
        self.detected_columns: dict[str, str | None] = {}
        self.comunas_sin_match: list[str] = []

    def warn(self, message: str) -> None:
        self.warnings.append(message)
        print(f"[ADVERTENCIA] {message}")


def normalize_text(value: object) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    text = str(value).strip()
    text = re.sub(r"\s+", " ", text)
    text = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in text if not unicodedata.combining(ch))


def _normalize_key(value: object) -> str:
    text = normalize_text(value).lower()
    text = text.replace("+", " mas ")
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return re.sub(r"_+", "_", text).strip("_")


def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    renamed = {_column: _normalize_key(_column) for _column in df.columns}
    replacements = {
        "fecha_visita": "fecha_visita",
        "fecha_recepcion": "fecha_recepcion",
        "fecha_envio": "fecha_envio",
        "retiro_muestra": "retiro_muestra",
        "precio_neto_mas_traslado": "precio_neto_traslado",
        "precio_neto_traslado": "precio_neto_traslado",
        "region": "region",
        "numero": "numero",
        "estado_visita": "estado_visita",
    }
    renamed = {original: replacements.get(new, new) for original, new in renamed.items()}
    return df.rename(columns=renamed)


def normalize_comuna_name(value: object) -> str:
    text = normalize_text(value).upper()
    text = text.replace(".", " ").replace(",", " ")
    text = re.sub(r"\s+", " ", text).strip()
    fixes = {
        "NUNOA": "NUNOA",
        "ÑUNOA": "NUNOA",
        "SAN JOSE MAIPO": "SAN JOSE DE MAIPO",
        "SAN JOSE DE MAIPO": "SAN JOSE DE MAIPO",
        "ESTACION CENTRAL": "ESTACION CENTRAL",
        "PEDRO AGUIRRE CERDA": "PEDRO AGUIRRE CERDA",
        "LO BARNECHEA": "LO BARNECHEA",
        "LA CISTERNA": "LA CISTERNA",
        "LA FLORIDA": "LA FLORIDA",
        "SAN BERNARDO": "SAN BERNARDO",
        "SAN RAMON": "SAN RAMON",
        "SAN JOAQUIN": "SAN JOAQUIN",
        "QUINTA NORMAL": "QUINTA NORMAL",
        "CERRO NAVIA": "CERRO NAVIA",
        "LO PRADO": "LO PRADO",
        "PADRE HURTADO": "PADRE HURTADO",
    }
    return fixes.get(text, text)


def find_column(columns: Iterable[str], candidates: Iterable[str], required: bool = False) -> str | None:
    normalized = {_normalize_key(column): column for column in columns}
    normalized_candidates = [_normalize_key(candidate) for candidate in candidates]
    for candidate in normalized_candidates:
        if candidate in normalized:
            return normalized[candidate]
    for candidate in normalized_candidates:
        for key, column in normalized.items():
            if key == candidate or key.endswith(f"_{candidate}") or candidate in key:
                return column
    if required:
        print("[ERROR] No se detecto columna requerida.")
        print(f"        Candidatas: {normalized_candidates}")
        print(f"        Columnas disponibles: {list(columns)}")
    return None


def money_to_number(value: object) -> float:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return 0.0
    if isinstance(value, int | float):
        return float(value) if math.isfinite(float(value)) else 0.0
    text = normalize_text(value)
    if not text:
        return 0.0
    text = text.replace("$", "").replace("CLP", "").replace("clp", "").replace(" ", "")
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    else:
        text = text.replace(".", "")
    text = re.sub(r"[^0-9.-]", "", text)
    try:
        parsed = float(text)
    except ValueError:
        return 0.0
    return parsed if math.isfinite(parsed) else 0.0


def date_to_datetime(value: object) -> pd.Timestamp | pd.NaT:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return pd.NaT
    if isinstance(value, int | float) and value > 20_000:
        return pd.to_datetime("1899-12-30") + pd.to_timedelta(float(value), unit="D")
    return pd.to_datetime(value, errors="coerce", dayfirst=True)


def build_address_key(row: pd.Series) -> str:
    parts = [
        row.get("comuna_norm", ""),
        normalize_text(row.get("direccion", "")),
        normalize_text(row.get("calle", "")),
        normalize_text(row.get("numero", "")),
    ]
    return normalize_comuna_name(" ".join(part for part in parts if part))


def detect_reclamos_file(input_paths: list[Path]) -> Path | None:
    candidates: list[Path] = []
    for base in input_paths:
        if base.is_file() and base.suffix.lower() in {".xlsx", ".xls", ".csv"}:
            candidates.append(base)
        elif base.exists():
            candidates.extend(path for path in base.glob("*") if path.suffix.lower() in {".xlsx", ".xls", ".csv"})

    candidates = [
        path
        for path in candidates
        if "censo" not in path.name.lower()
        and "poblacion" not in path.name.lower()
        and "comunas" not in path.name.lower()
        and path.name.lower() != f"{OUTPUT_BASENAME}.csv"
    ]
    if not candidates:
        return None

    by_name = {path.name.lower(): path for path in candidates}
    for name in RECLAMOS_FILE_PRIORITY:
        if name.lower() in by_name:
            return by_name[name.lower()]

    keyword_candidates = [
        path
        for path in candidates
        if any(keyword in path.name.lower() for keyword in ["reclamo", "ticket", "consolidado", "carga_diaria"])
    ]
    if not keyword_candidates:
        return None
    return sorted(keyword_candidates, key=lambda path: path.stat().st_mtime, reverse=True)[0]


def load_reclamos(file_path: Path) -> pd.DataFrame:
    suffix = file_path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(file_path, dtype=object)
    if suffix in {".xlsx", ".xls"}:
        sheets = pd.read_excel(file_path, sheet_name=None, dtype=object)
        if not sheets:
            return pd.DataFrame()
        sheet_name, df = max(sheets.items(), key=lambda item: len(item[1]))
        print(f"Hoja de reclamos usada: {sheet_name}")
        return df
    raise ValueError(f"Formato no soportado: {file_path.suffix}")


def load_censo(file_path: Path) -> pd.DataFrame:
    df = pd.read_csv(file_path, dtype={"codigo_region": "string", "codigo_comuna": "string"})
    df = normalize_column_names(df)
    df["codigo_comuna"] = df["codigo_comuna"].astype("string").str.replace(r"\.0$", "", regex=True).str.strip()
    df["comuna_norm"] = df["comuna"].map(normalize_comuna_name)
    for column in CENSO_COLUMNS:
        if column not in df.columns:
            df[column] = pd.NA
    return df


def load_geojson(file_path: Path) -> dict[str, object] | None:
    if not file_path.exists():
        return None
    return json.loads(file_path.read_text(encoding="utf-8"))


def _normalize_priority(value: object) -> str:
    text = normalize_text(value).lower()
    if "alta" in text or text in {"a", "high", "urgente"}:
        return "alta"
    if "media" in text or text in {"m", "medium"}:
        return "media"
    if "baja" in text or text in {"b", "low"}:
        return "baja"
    return "sin_prioridad"


def _normalize_visit_status(value: object) -> str:
    text = normalize_text(value).lower()
    if any(word in text for word in ["complet", "realiz", "finaliz", "entreg"]):
        return "completada"
    if any(word in text for word in ["no realiz", "fallid", "rechaz", "cancel"]):
        return "no_realizada"
    if any(word in text for word in ["pend", "program", "agend"]):
        return "pendiente"
    return "sin_estado"


def prepare_reclamos(df: pd.DataFrame, run_log: RunLog) -> pd.DataFrame:
    df = normalize_column_names(df.dropna(how="all")).copy()
    columns = list(df.columns)
    detected = {key: find_column(columns, values) for key, values in COLUMN_CANDIDATES.items()}
    run_log.detected_columns = detected

    comuna_col = detected["comuna"]
    if not comuna_col:
        raise ValueError("No se detecto columna de comuna en el archivo de reclamos.")

    ticket_col = detected["ticket"]
    if not ticket_col:
        run_log.warn("No se detecto ticket; se creara identificador por fila.")

    fact_col = detected["facturacion"]
    if not fact_col:
        run_log.warn("No se detecto facturacion/monto; facturacion_total quedara en 0.")

    prioridad_col = detected["prioridad"]
    if not prioridad_col:
        run_log.warn("No se detecto prioridad; se usara 'Sin prioridad'.")

    prepared = pd.DataFrame(index=df.index)
    prepared["codigo_comuna"] = (
        df[detected["codigo_comuna"]].astype("string").str.replace(r"\.0$", "", regex=True).str.strip()
        if detected["codigo_comuna"]
        else pd.NA
    )
    prepared["comuna_original"] = df[comuna_col].fillna("").astype(str).str.strip()
    prepared["comuna_norm"] = prepared["comuna_original"].map(normalize_comuna_name)
    prepared["ticket"] = df[ticket_col].fillna("").astype(str).str.strip() if ticket_col else [f"fila_{idx + 1}" for idx in range(len(df))]
    prepared.loc[prepared["ticket"] == "", "ticket"] = [f"fila_{idx + 1}" for idx in range(len(prepared))]
    prepared["prioridad_norm"] = df[prioridad_col].map(_normalize_priority) if prioridad_col else "sin_prioridad"
    prepared["cliente_norm"] = df[detected["cliente"]].map(normalize_comuna_name) if detected["cliente"] else ""
    prepared["cliente_original"] = df[detected["cliente"]].fillna("").astype(str).str.strip() if detected["cliente"] else ""
    prepared["direccion"] = df[detected["direccion"]].fillna("").astype(str).str.strip() if detected["direccion"] else ""
    prepared["calle"] = df[detected["calle"]].fillna("").astype(str).str.strip() if detected["calle"] else ""
    prepared["numero"] = df[detected["numero"]].fillna("").astype(str).str.strip() if detected["numero"] else ""
    prepared["direccion_norm"] = prepared.apply(build_address_key, axis=1)
    prepared["estado_visita_norm"] = df[detected["estado_visita"]].map(_normalize_visit_status) if detected["estado_visita"] else "sin_estado"
    prepared["facturacion_total"] = df[fact_col].map(money_to_number) if fact_col else 0.0
    prepared["km"] = df[detected["km"]].map(money_to_number) if detected["km"] else 0.0
    prepared["traslado"] = df[detected["traslado"]].map(money_to_number) if detected["traslado"] else 0.0
    prepared["tarifa_ruta"] = df[detected["tarifa_ruta"]].map(money_to_number) if detected["tarifa_ruta"] else 0.0
    prepared["costo_total_estimado"] = prepared["facturacion_total"] + prepared["traslado"] + prepared["tarifa_ruta"]

    date_source = next(
        (detected[key] for key in ["fecha_visita", "fecha_recepcion", "retiro_muestra", "fecha_envio", "fecha"] if detected[key]),
        None,
    )
    if date_source:
        prepared["fecha_base"] = df[date_source].map(date_to_datetime)
    else:
        run_log.warn("No se detecto fecha; se procesara como periodo_sin_fecha.")
        prepared["fecha_base"] = pd.NaT

    prepared["anio"] = prepared["fecha_base"].dt.year
    prepared["mes"] = prepared["fecha_base"].dt.to_period("M").astype(str).replace("NaT", "periodo_sin_fecha")
    prepared["semana_iso"] = prepared["fecha_base"].dt.strftime("%G-W%V").fillna("periodo_sin_fecha")
    prepared["dia"] = prepared["fecha_base"].dt.strftime("%Y-%m-%d").fillna("periodo_sin_fecha")
    prepared["fecha_base_texto"] = prepared["fecha_base"].dt.strftime("%Y-%m-%d")
    return prepared[prepared["comuna_norm"] != ""].copy()


def aggregate_by_comuna(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["comuna_norm"])

    work = df.copy()
    client_counts = work[work["cliente_norm"] != ""].groupby(["comuna_norm", "cliente_norm"]).size()
    address_counts = work[work["direccion_norm"] != ""].groupby(["comuna_norm", "direccion_norm"]).size()
    recurrent_clients = client_counts[client_counts > 1].groupby(level=0).size().rename("clientes_reincidentes")
    recurrent_addresses = address_counts[address_counts > 1].groupby(level=0).size().rename("direcciones_reincidentes")

    grouped = work.groupby("comuna_norm", dropna=False).agg(
        reclamos_totales=("ticket", "size"),
        tickets_unicos=("ticket", pd.Series.nunique),
        clientes_unicos=("cliente_norm", lambda values: values[values != ""].nunique()),
        direcciones_unicas=("direccion_norm", lambda values: values[values != ""].nunique()),
        facturacion_total=("facturacion_total", "sum"),
        prioridad_alta=("prioridad_norm", lambda values: int((values == "alta").sum())),
        prioridad_media=("prioridad_norm", lambda values: int((values == "media").sum())),
        prioridad_baja=("prioridad_norm", lambda values: int((values == "baja").sum())),
        sin_prioridad=("prioridad_norm", lambda values: int((values == "sin_prioridad").sum())),
        visitas_completadas=("estado_visita_norm", lambda values: int((values == "completada").sum())),
        visitas_pendientes=("estado_visita_norm", lambda values: int((values == "pendiente").sum())),
        visitas_no_realizadas=("estado_visita_norm", lambda values: int((values == "no_realizada").sum())),
        km_total=("km", "sum"),
        traslado_total=("traslado", "sum"),
        costo_total_estimado=("costo_total_estimado", "sum"),
        primera_fecha_visita=("fecha_base", "min"),
        ultima_fecha_visita=("fecha_base", "max"),
    )
    grouped = grouped.join(recurrent_clients, how="left").join(recurrent_addresses, how="left").reset_index()
    grouped[["clientes_reincidentes", "direcciones_reincidentes"]] = grouped[
        ["clientes_reincidentes", "direcciones_reincidentes"]
    ].fillna(0)
    grouped["promedio_por_reclamo"] = _safe_div(grouped["facturacion_total"], grouped["reclamos_totales"])
    grouped["porcentaje_prioridad_alta"] = _safe_div(grouped["prioridad_alta"], grouped["reclamos_totales"], 100)
    grouped["indice_reincidencia_comunal"] = _safe_div(
        grouped["clientes_reincidentes"] + grouped["direcciones_reincidentes"],
        grouped["reclamos_totales"],
        100,
    )
    grouped["primera_fecha_visita"] = grouped["primera_fecha_visita"].dt.strftime("%Y-%m-%d")
    grouped["ultima_fecha_visita"] = grouped["ultima_fecha_visita"].dt.strftime("%Y-%m-%d")
    return grouped


def aggregate_by_period(df: pd.DataFrame, period_type: str) -> pd.DataFrame:
    key = {"dia": "dia", "semana": "semana_iso", "mes": "mes"}.get(period_type)
    if not key or df.empty:
        return pd.DataFrame()
    grouped = df.groupby(key, dropna=False).agg(
        total_reclamos=("ticket", "size"),
        total_facturacion=("facturacion_total", "sum"),
        tickets_unicos=("ticket", pd.Series.nunique),
        prioridad_alta_total=("prioridad_norm", lambda values: int((values == "alta").sum())),
    )
    grouped = grouped.reset_index().rename(columns={key: "periodo_label"})
    grouped["periodo_tipo"] = period_type
    return grouped


def merge_with_censo(df_reclamos: pd.DataFrame, df_censo: pd.DataFrame, run_log: RunLog) -> pd.DataFrame:
    by_code = pd.DataFrame()
    if "codigo_comuna" in df_reclamos.columns and df_reclamos["codigo_comuna"].notna().any():
        by_code = df_reclamos[df_reclamos["codigo_comuna"].notna()].copy()
        by_code["codigo_comuna"] = by_code["codigo_comuna"].astype("string")

    aggregated = aggregate_by_comuna(df_reclamos)
    merged = df_censo.copy()
    if not by_code.empty:
        code_agg = by_code.groupby("codigo_comuna", as_index=False).agg(reclamos_codigo=("ticket", "size"))
        code_matches = code_agg.merge(df_censo[["codigo_comuna", "comuna_norm"]], on="codigo_comuna", how="left")
        code_map = code_matches.dropna(subset=["comuna_norm"])[["codigo_comuna", "comuna_norm"]]
        if not code_map.empty:
            df_reclamos = df_reclamos.merge(code_map, on="codigo_comuna", how="left", suffixes=("", "_censo"))
            df_reclamos["comuna_norm"] = df_reclamos["comuna_norm_censo"].fillna(df_reclamos["comuna_norm"])
            aggregated = aggregate_by_comuna(df_reclamos.drop(columns=["comuna_norm_censo"], errors="ignore"))

    merged = merged.merge(aggregated, on="comuna_norm", how="left")
    reclamo_comunas = set(df_reclamos["comuna_norm"].dropna())
    censo_comunas = set(df_censo["comuna_norm"].dropna())
    sin_match = sorted(comuna for comuna in reclamo_comunas - censo_comunas if comuna)
    run_log.comunas_sin_match = sorted(set(run_log.comunas_sin_match).union(sin_match))
    if run_log.comunas_sin_match:
        run_log.warn(f"Comunas sin match censal: {', '.join(run_log.comunas_sin_match)}")
    return merged


def _safe_div(numerator: pd.Series | float | int, denominator: pd.Series | float | int, multiplier: float = 1.0) -> pd.Series:
    num = pd.to_numeric(numerator, errors="coerce")
    den = pd.to_numeric(denominator, errors="coerce")
    if isinstance(num, pd.Series) and not isinstance(den, pd.Series):
        den = pd.Series(den, index=num.index)
    elif isinstance(den, pd.Series) and not isinstance(num, pd.Series):
        num = pd.Series(num, index=den.index)
    elif not isinstance(num, pd.Series) and not isinstance(den, pd.Series):
        num = pd.Series([num])
        den = pd.Series([den])
    return (num / den.where(den != 0) * multiplier).replace([math.inf, -math.inf], 0).fillna(0)


def _min_max(series: pd.Series) -> pd.Series:
    values = pd.to_numeric(series, errors="coerce").fillna(0)
    min_value = values.min()
    max_value = values.max()
    if max_value == min_value:
        return pd.Series([0.0] * len(values), index=values.index)
    return ((values - min_value) / (max_value - min_value) * 100).clip(0, 100)


def _level_from_score(score: float, has_claims: bool, intensity: bool = False) -> str:
    if not has_claims:
        return NO_CLAIMS
    if score <= 25:
        return "Baja" if intensity else "Bajo"
    if score <= 50:
        return "Media" if intensity else "Medio"
    if score <= 75:
        return "Alta" if intensity else "Alto"
    return "Crítica" if intensity else "Crítico"


def calculate_territorial_metrics(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    metric_zero_cols = [
        "reclamos_totales",
        "tickets_unicos",
        "clientes_unicos",
        "direcciones_unicas",
        "facturacion_total",
        "promedio_por_reclamo",
        "prioridad_alta",
        "prioridad_media",
        "prioridad_baja",
        "sin_prioridad",
        "porcentaje_prioridad_alta",
        "visitas_completadas",
        "visitas_pendientes",
        "visitas_no_realizadas",
        "km_total",
        "traslado_total",
        "costo_total_estimado",
        "clientes_reincidentes",
        "direcciones_reincidentes",
        "indice_reincidencia_comunal",
    ]
    for column in metric_zero_cols:
        if column not in out.columns:
            out[column] = 0
        out[column] = pd.to_numeric(out[column], errors="coerce").fillna(0)

    total_reclamos = float(out["reclamos_totales"].sum())
    total_facturacion = float(out["facturacion_total"].sum())
    poblacion_total = float(pd.to_numeric(out["poblacion_2024"], errors="coerce").fillna(0).sum())

    out["reclamos_por_100k_habitantes"] = _safe_div(out["reclamos_totales"], out["poblacion_2024"], 100_000)
    out["reclamos_por_10k_hogares"] = _safe_div(out["reclamos_totales"], out["hogares_2024"], 10_000)
    out["facturacion_por_100k_habitantes"] = _safe_div(out["facturacion_total"], out["poblacion_2024"], 100_000)
    out["facturacion_por_10k_hogares"] = _safe_div(out["facturacion_total"], out["hogares_2024"], 10_000)
    out["reclamos_por_1000_viviendas"] = _safe_div(out["reclamos_totales"], out["viviendas_2024"], 1_000)
    out["porcentaje_participacion_reclamos_rm"] = _safe_div(out["reclamos_totales"], total_reclamos, 100)
    out["porcentaje_participacion_facturacion_rm"] = _safe_div(out["facturacion_total"], total_facturacion, 100)
    out["densidad_reclamos_hogar"] = _safe_div(out["reclamos_totales"], out["hogares_2024"])
    out["cobertura_poblacional_comuna"] = _safe_div(out["poblacion_2024"], poblacion_total, 100)
    return out


def calculate_criticidad(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    tasa = _min_max(out["reclamos_por_100k_habitantes"])
    prioridad = _min_max(out["porcentaje_prioridad_alta"])
    reincidencia = _min_max(out["indice_reincidencia_comunal"])
    facturacion = _min_max(out["porcentaje_participacion_facturacion_rm"])
    out["criticidad_score"] = (0.35 * tasa + 0.25 * prioridad + 0.20 * reincidencia + 0.20 * facturacion).round(2)
    out.loc[out["reclamos_totales"] == 0, "criticidad_score"] = 0
    out["riesgo_operativo_score"] = out["criticidad_score"]
    out["intensidad_territorial_score"] = tasa.round(2)
    out.loc[out["reclamos_totales"] == 0, "intensidad_territorial_score"] = 0
    out["criticidad_nivel"] = [
        _level_from_score(score, claims > 0) for score, claims in zip(out["criticidad_score"], out["reclamos_totales"], strict=False)
    ]
    out["riesgo_operativo_nivel"] = out["criticidad_nivel"]
    out["intensidad_territorial_nivel"] = [
        _level_from_score(score, claims > 0, intensity=True)
        for score, claims in zip(out["intensidad_territorial_score"], out["reclamos_totales"], strict=False)
    ]
    return out


def calculate_rankings(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    ranking_columns = {
        "ranking_volumen_reclamos": "reclamos_totales",
        "ranking_intensidad_100k": "reclamos_por_100k_habitantes",
        "ranking_facturacion": "facturacion_total",
        "ranking_prioridad_alta": "porcentaje_prioridad_alta",
        "ranking_criticidad": "criticidad_score",
        "ranking_reincidencia": "indice_reincidencia_comunal",
    }
    for ranking, column in ranking_columns.items():
        out[ranking] = out[column].rank(method="min", ascending=False).astype(int)
        out.loc[out[column] <= 0, ranking] = 0
    out["ranking_cantidad_label"] = out["ranking_volumen_reclamos"].map(lambda value: f"#{value} en cantidad" if value else NO_CLAIMS)
    out["ranking_intensidad_label"] = out["ranking_intensidad_100k"].map(lambda value: f"#{value} en intensidad" if value else NO_CLAIMS)
    out["ranking_riesgo_label"] = out["ranking_criticidad"].map(lambda value: f"#{value} en riesgo" if value else NO_CLAIMS)
    return out


def _build_user_text(row: pd.Series) -> tuple[str, str, str, str]:
    if float(row["reclamos_totales"]) <= 0:
        return (
            "Sin reclamos en el periodo seleccionado.",
            "",
            "Sin acción requerida.",
            f"{row['comuna']}: sin reclamos",
        )
    if row["criticidad_nivel"] in {"Alto", "Crítico"}:
        lectura = f"{row['comuna']} requiere atención prioritaria por su riesgo operativo y concentración de señales."
        motivo = "Alta combinación de intensidad territorial, prioridad alta, reincidencia o facturación."
        recomendacion = "Priorizar revisión y seguimiento en esta comuna."
    elif row["intensidad_territorial_nivel"] in {"Alta", "Crítica"}:
        lectura = f"{row['comuna']} destaca porque sus reclamos pesan más considerando el tamaño de la comuna."
        motivo = "La intensidad territorial está por sobre el resto de comunas RM."
        recomendacion = "Monitorear y revisar capacidad operativa local."
    else:
        lectura = f"{row['comuna']} presenta carga territorial controlada para el periodo seleccionado."
        motivo = "No concentra niveles críticos frente al resto de comunas RM."
        recomendacion = "Monitorear, pero no requiere acción urgente."
    etiqueta = f"{row['comuna']}: {int(row['reclamos_totales'])} reclamos · {row['riesgo_operativo_nivel']}"
    return lectura, motivo, recomendacion, etiqueta


def add_user_friendly_fields(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    fields = out.apply(_build_user_text, axis=1, result_type="expand")
    fields.columns = ["lectura_usuario", "motivo_criticidad", "recomendacion_operativa", "etiqueta_mapa"]
    return pd.concat([out, fields], axis=1)


def calculate_macrozona_summary(df: pd.DataFrame) -> list[dict[str, object]]:
    summaries: list[dict[str, object]] = []
    total_reclamos = float(df["reclamos_totales"].sum())
    total_facturacion = float(df["facturacion_total"].sum())
    for macrozona, group in df.groupby("macrozona_rm", dropna=False):
        label = str(macrozona or "Sin zona")
        top = group.sort_values(["reclamos_totales", "criticidad_score"], ascending=False).head(1)
        comuna_principal = str(top["comuna"].iloc[0]) if not top.empty else ""
        reclamos = float(group["reclamos_totales"].sum())
        nivel = _level_from_score(float(group["criticidad_score"].mean()), reclamos > 0)
        summaries.append(
            {
                "macrozona": label,
                "comunas": int(len(group)),
                "comunas_con_reclamos": int((group["reclamos_totales"] > 0).sum()),
                "reclamos_totales": int(reclamos),
                "facturacion_total": round(float(group["facturacion_total"].sum()), 2),
                "poblacion_2024": int(pd.to_numeric(group["poblacion_2024"], errors="coerce").fillna(0).sum()),
                "hogares_2024": int(pd.to_numeric(group["hogares_2024"], errors="coerce").fillna(0).sum()),
                "viviendas_2024": int(pd.to_numeric(group["viviendas_2024"], errors="coerce").fillna(0).sum()),
                "reclamos_por_100k_habitantes": round(float(_safe_div(reclamos, group["poblacion_2024"].sum(), 100_000).iloc[0]), 4),
                "reclamos_por_10k_hogares": round(float(_safe_div(reclamos, group["hogares_2024"].sum(), 10_000).iloc[0]), 4),
                "porcentaje_participacion_reclamos_rm": round(float(_safe_div(reclamos, total_reclamos, 100).iloc[0]), 4),
                "porcentaje_participacion_facturacion_rm": round(float(_safe_div(group["facturacion_total"].sum(), total_facturacion, 100).iloc[0]), 4),
                "criticidad_promedio": round(float(group["criticidad_score"].mean()), 2),
                "riesgo_operativo_nivel": nivel,
                "comuna_principal": comuna_principal,
                "lectura_usuario": f"{label} concentra {int(reclamos)} reclamos en {int((group['reclamos_totales'] > 0).sum())} comunas.",
            }
        )
    return summaries


def _top_value(df: pd.DataFrame, column: str, value_col: str = "comuna") -> str:
    if df.empty or df[column].max() <= 0:
        return ""
    return str(df.sort_values(column, ascending=False).iloc[0][value_col])


def _concentration(df: pd.DataFrame, column: str, top_n: int) -> float:
    total = float(df[column].sum())
    if total <= 0:
        return 0.0
    return round(float(df.sort_values(column, ascending=False).head(top_n)[column].sum()) / total * 100, 4)


def calculate_resumen_general(df: pd.DataFrame, reclamos: pd.DataFrame, run_log: RunLog) -> dict[str, object]:
    total_reclamos = int(df["reclamos_totales"].sum())
    total_facturacion = round(float(df["facturacion_total"].sum()), 2)
    comunas_con_reclamos = int((df["reclamos_totales"] > 0).sum())
    poblacion_alcanzada = float(df.loc[df["reclamos_totales"] > 0, "poblacion_2024"].sum())
    poblacion_total = float(df["poblacion_2024"].sum())
    macrozonas = calculate_macrozona_summary(df)
    zona = max(macrozonas, key=lambda item: (float(item["reclamos_totales"]), float(item["criticidad_promedio"])), default={})
    comuna_critica = _top_value(df, "criticidad_score")
    top_intensidad = _top_value(df, "reclamos_por_100k_habitantes")
    top_reclamos = _top_value(df, "reclamos_totales")
    return {
        "total_reclamos_rm": total_reclamos,
        "total_facturacion_rm": total_facturacion,
        "total_tickets_unicos": int(reclamos["ticket"].nunique()) if not reclamos.empty else 0,
        "total_clientes_unicos": int(reclamos.loc[reclamos["cliente_norm"] != "", "cliente_norm"].nunique()) if not reclamos.empty else 0,
        "total_direcciones_unicas": int(reclamos.loc[reclamos["direccion_norm"] != "", "direccion_norm"].nunique()) if not reclamos.empty else 0,
        "total_comunas_con_reclamos": comunas_con_reclamos,
        "total_comunas_rm": int(len(df)),
        "cobertura_comunal_pct": round(comunas_con_reclamos / len(df) * 100, 4) if len(df) else 0,
        "alcance_territorial_pct": round(comunas_con_reclamos / len(df) * 100, 4) if len(df) else 0,
        "cobertura_poblacional_pct": round(poblacion_alcanzada / poblacion_total * 100, 4) if poblacion_total else 0,
        "prioridad_alta_total": int(df["prioridad_alta"].sum()),
        "prioridad_media_total": int(df["prioridad_media"].sum()),
        "prioridad_baja_total": int(df["prioridad_baja"].sum()),
        "sin_prioridad_total": int(df["sin_prioridad"].sum()),
        "porcentaje_prioridad_alta": round(float(_safe_div(df["prioridad_alta"].sum(), total_reclamos, 100).iloc[0]), 4),
        "top_comuna_reclamos": top_reclamos,
        "top_comuna_facturacion": _top_value(df, "facturacion_total"),
        "top_comuna_intensidad": top_intensidad,
        "top_comuna_criticidad": comuna_critica,
        "zona_rm_mas_afectada": str(zona.get("macrozona", "")),
        "concentracion_top3_reclamos_pct": _concentration(df, "reclamos_totales", 3),
        "concentracion_top5_reclamos_pct": _concentration(df, "reclamos_totales", 5),
        "concentracion_top5_facturacion_pct": _concentration(df, "facturacion_total", 5),
        "comunas_sin_match": run_log.comunas_sin_match,
        "macrozona": str(zona.get("macrozona", "")),
        "macrozonas": macrozonas,
        "cards_usuario": [
            {
                "id": "comunaCritica",
                "titulo": "Comuna crítica",
                "valor": comuna_critica or NO_CLAIMS,
                "nivel": str(df.sort_values("criticidad_score", ascending=False).iloc[0]["riesgo_operativo_nivel"]) if total_reclamos else NO_CLAIMS,
                "descripcion": "Requiere atención prioritaria" if total_reclamos else "Sin reclamos en el periodo",
                "tooltip": "Combina cantidad de reclamos, prioridad alta, reincidencia e intensidad territorial.",
            },
            {
                "id": "intensidadTerritorial",
                "titulo": "Intensidad territorial",
                "valor": top_intensidad or NO_CLAIMS,
                "nivel": "Comparativa RM" if total_reclamos else NO_CLAIMS,
                "descripcion": "Reclamos ajustados por tamaño comunal.",
                "tooltip": "Compara los reclamos con el tamaño de la comuna.",
            },
            {
                "id": "concentracionReclamos",
                "titulo": "Concentración de reclamos",
                "valor": f"{_concentration(df, 'reclamos_totales', 5):.1f}%",
                "nivel": "Top 5",
                "descripcion": "Participación de las cinco comunas con más reclamos.",
                "tooltip": "Muestra si los reclamos están concentrados o repartidos.",
            },
            {
                "id": "zonaRmMasAfectada",
                "titulo": "Zona RM más afectada",
                "valor": str(zona.get("macrozona", NO_CLAIMS)),
                "nivel": str(zona.get("riesgo_operativo_nivel", NO_CLAIMS)),
                "descripcion": "Zona con mayor carga territorial.",
                "tooltip": "Agrupa comunas por Zona RM.",
            },
            {
                "id": "riesgoOperativo",
                "titulo": "Riesgo operativo",
                "valor": comuna_critica or NO_CLAIMS,
                "nivel": str(df.sort_values("criticidad_score", ascending=False).iloc[0]["riesgo_operativo_nivel"]) if total_reclamos else NO_CLAIMS,
                "descripcion": "Prioridad operativa sugerida.",
                "tooltip": "Combina cantidad, prioridad alta, reincidencia e intensidad.",
            },
            {
                "id": "alcanceTerritorial",
                "titulo": "Alcance territorial",
                "valor": f"{round(comunas_con_reclamos / len(df) * 100, 1) if len(df) else 0}%",
                "nivel": f"{comunas_con_reclamos} de {len(df)} comunas",
                "descripcion": "Cobertura comunal de la carga.",
                "tooltip": "Indica qué parte del territorio RM aparece en los reclamos cargados.",
            },
        ],
        "explicaciones": {
            "intensidadTerritorial": "La intensidad compara los reclamos con el tamaño de la comuna. Así evitamos que las comunas grandes siempre aparezcan arriba solo por tener más habitantes.",
            "riesgoOperativo": "Combina cantidad de reclamos, prioridad alta, reincidencia e intensidad territorial.",
            "concentracion": "Muestra si los reclamos están concentrados en pocas comunas o repartidos en varias zonas.",
            "alcanceTerritorial": "Indica qué parte del territorio o población RM está representada en los reclamos cargados.",
        },
        "filtros_disponibles": {
            "zonas_rm": sorted(df["macrozona_rm"].dropna().astype(str).unique().tolist()),
            "comunas": sorted(df["comuna"].dropna().astype(str).unique().tolist()),
            "periodos": sorted(reclamos["mes"].dropna().astype(str).unique().tolist()) if not reclamos.empty else [],
        },
    }


def _period_bounds(reclamos: pd.DataFrame, period_label: str, key: str) -> tuple[str, str]:
    subset = reclamos[reclamos[key] == period_label]
    dates = subset["fecha_base"].dropna()
    if dates.empty:
        return period_label, period_label
    return str(dates.min().date()), str(dates.max().date())


def _period_reading(total: int, top3: float) -> str:
    if total <= 0:
        return "Hay baja carga territorial para el periodo seleccionado."
    if top3 >= 70:
        return "Los reclamos del periodo están concentrados en pocas comunas. Conviene priorizar la comuna crítica."
    return "El volumen está repartido en varias comunas, sin una concentración territorial relevante."


def calculate_resumen_temporal(reclamos: pd.DataFrame, censo: pd.DataFrame, period_type: str, run_log: RunLog) -> list[dict[str, object]]:
    key = {"dia": "dia", "semana": "semana_iso", "mes": "mes"}[period_type]
    if reclamos.empty:
        return []
    records: list[dict[str, object]] = []
    for label, subset in reclamos.groupby(key, dropna=False):
        if not str(label):
            label = "periodo_sin_fecha"
        merged = merge_with_censo(subset, censo, run_log)
        metrics = add_user_friendly_fields(calculate_rankings(calculate_criticidad(calculate_territorial_metrics(merged))))
        macro = calculate_macrozona_summary(metrics)
        zona = max(macro, key=lambda item: float(item["reclamos_totales"]), default={})
        fecha_inicio, fecha_fin = _period_bounds(subset, str(label), key)
        total = int(metrics["reclamos_totales"].sum())
        top3 = _concentration(metrics, "reclamos_totales", 3)
        records.append(
            {
                "periodo_tipo": period_type,
                "periodo_label": str(label),
                "fecha_inicio": fecha_inicio,
                "fecha_fin": fecha_fin,
                "total_reclamos": total,
                "total_facturacion": round(float(metrics["facturacion_total"].sum()), 2),
                "tickets_unicos": int(subset["ticket"].nunique()),
                "comunas_afectadas": int((metrics["reclamos_totales"] > 0).sum()),
                "comuna_top_reclamos": _top_value(metrics, "reclamos_totales"),
                "comuna_top_intensidad": _top_value(metrics, "reclamos_por_100k_habitantes"),
                "comuna_critica": _top_value(metrics, "criticidad_score"),
                "zona_rm_mas_afectada": str(zona.get("macrozona", "")),
                "prioridad_alta_total": int(metrics["prioridad_alta"].sum()),
                "porcentaje_prioridad_alta": round(float(_safe_div(metrics["prioridad_alta"].sum(), total, 100).iloc[0]), 4),
                "concentracion_top3_reclamos_pct": top3,
                "concentracion_top5_reclamos_pct": _concentration(metrics, "reclamos_totales", 5),
                "cobertura_comunal_pct": round(float((metrics["reclamos_totales"] > 0).sum()) / len(metrics) * 100, 4),
                "alcance_territorial_pct": round(float((metrics["reclamos_totales"] > 0).sum()) / len(metrics) * 100, 4),
                "lectura_usuario_periodo": _period_reading(total, top3),
            }
        )
    return records


def enrich_geojson(geojson_path: Path, metrics_df: pd.DataFrame) -> dict[str, object] | None:
    geojson = load_geojson(geojson_path)
    if geojson is None:
        return None
    lookup = {
        normalize_comuna_name(row["comuna"]): row
        for _, row in metrics_df.iterrows()
    }
    for feature in geojson.get("features", []):
        properties = feature.setdefault("properties", {})
        name = properties.get("comuna") or properties.get("COMUNA") or properties.get("NOM_COMUNA") or properties.get("Comuna")
        row = lookup.get(normalize_comuna_name(name))
        if row is None:
            continue
        for column in [
            "codigo_comuna",
            "comuna",
            "macrozona_rm",
            "reclamos_totales",
            "facturacion_total",
            "reclamos_por_100k_habitantes",
            "reclamos_por_10k_hogares",
            "porcentaje_prioridad_alta",
            "criticidad_score",
            "criticidad_nivel",
            "intensidad_territorial_score",
            "intensidad_territorial_nivel",
            "riesgo_operativo_score",
            "riesgo_operativo_nivel",
            "etiqueta_mapa",
            "lectura_usuario",
        ]:
            properties[column] = _json_value(row.get(column))
    return geojson


def _snake_to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


def _json_value(value: object) -> object:
    if value is None or value is pd.NA:
        return None
    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.strftime("%Y-%m-%d")
    if isinstance(value, float):
        if not math.isfinite(value):
            return 0
        return int(value) if value.is_integer() else round(value, 4)
    if isinstance(value, int | str | bool):
        return value
    if pd.isna(value):
        return None
    return value


def to_camel_case_records(df: pd.DataFrame) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for record in df.to_dict(orient="records"):
        records.append({_snake_to_camel(key): _json_value(value) for key, value in record.items() if key != "comuna_norm"})
    return records


def _camelize_object(value: object) -> object:
    if isinstance(value, list):
        return [_camelize_object(item) for item in value]
    if isinstance(value, dict):
        return {_snake_to_camel(str(key)): _camelize_object(item) for key, item in value.items()}
    return _json_value(value)


def export_csv_json(
    metrics: pd.DataFrame,
    resumen: dict[str, object],
    diario: list[dict[str, object]],
    semanal: list[dict[str, object]],
    mensual: list[dict[str, object]],
    geojson: dict[str, object] | None,
    output_dir: Path,
    run_log: RunLog,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / f"{OUTPUT_BASENAME}.csv"
    json_path = output_dir / f"{OUTPUT_BASENAME}.json"
    resumen_path = output_dir / f"{OUTPUT_BASENAME}_resumen.json"
    diario_path = output_dir / f"{OUTPUT_BASENAME}_diario.json"
    semanal_path = output_dir / f"{OUTPUT_BASENAME}_semanal.json"
    mensual_path = output_dir / f"{OUTPUT_BASENAME}_mensual.json"

    metrics.to_csv(csv_path, index=False, encoding="utf-8-sig", quoting=csv.QUOTE_MINIMAL)
    json_path.write_text(json.dumps(to_camel_case_records(metrics), ensure_ascii=False, indent=2), encoding="utf-8")
    resumen_path.write_text(json.dumps(_camelize_object(resumen), ensure_ascii=False, indent=2), encoding="utf-8")
    diario_path.write_text(json.dumps(_camelize_object(diario), ensure_ascii=False, indent=2), encoding="utf-8")
    semanal_path.write_text(json.dumps(_camelize_object(semanal), ensure_ascii=False, indent=2), encoding="utf-8")
    mensual_path.write_text(json.dumps(_camelize_object(mensual), ensure_ascii=False, indent=2), encoding="utf-8")

    for path in [csv_path, json_path, resumen_path, diario_path, semanal_path, mensual_path]:
        run_log.outputs.append(str(path))

    if geojson is not None:
        geojson_path = output_dir / "comunas_rm_censo_reclamos_2026.geojson"
        geojson_path.write_text(json.dumps(geojson, ensure_ascii=False), encoding="utf-8")
        run_log.outputs.append(str(geojson_path))


def export_typescript(
    metrics: pd.DataFrame,
    resumen: dict[str, object],
    diario: list[dict[str, object]],
    semanal: list[dict[str, object]],
    mensual: list[dict[str, object]],
    output_path: Path,
    run_log: RunLog,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    content = "\n".join(
        [
            f"export const reclamosCensoRM2026 = {json.dumps(to_camel_case_records(metrics), ensure_ascii=False, indent=2)} as const;",
            "",
            f"export const resumenTerritorialRM2026 = {json.dumps(_camelize_object(resumen), ensure_ascii=False, indent=2)} as const;",
            "",
            f"export const resumenDiarioTerritorialRM2026 = {json.dumps(_camelize_object(diario), ensure_ascii=False, indent=2)} as const;",
            "",
            f"export const resumenSemanalTerritorialRM2026 = {json.dumps(_camelize_object(semanal), ensure_ascii=False, indent=2)} as const;",
            "",
            f"export const resumenMensualTerritorialRM2026 = {json.dumps(_camelize_object(mensual), ensure_ascii=False, indent=2)} as const;",
            "",
            "export type ReclamoCensoRM2026 = typeof reclamosCensoRM2026[number];",
            "export type ResumenTerritorialRM2026 = typeof resumenTerritorialRM2026;",
            "export type ResumenDiarioTerritorialRM2026 = typeof resumenDiarioTerritorialRM2026[number];",
            "export type ResumenSemanalTerritorialRM2026 = typeof resumenSemanalTerritorialRM2026[number];",
            "export type ResumenMensualTerritorialRM2026 = typeof resumenMensualTerritorialRM2026[number];",
            "",
        ]
    )
    output_path.write_text(content, encoding="utf-8")
    run_log.outputs.append(str(output_path))


def validate_output(metrics: pd.DataFrame, reclamos: pd.DataFrame, run_log: RunLog) -> None:
    if len(metrics) != 52:
        run_log.warn(f"La salida contiene {len(metrics)} comunas RM; se esperaban 52.")
    if metrics["codigo_comuna"].duplicated().any():
        run_log.warn("Hay duplicados por codigo_comuna en salida.")
    if int(metrics["reclamos_totales"].sum()) != len(reclamos):
        run_log.warn("El total agregado de reclamos no coincide con las filas validas.")
    fact_original = round(float(reclamos["facturacion_total"].sum()), 2) if not reclamos.empty else 0
    fact_output = round(float(metrics["facturacion_total"].sum()), 2)
    if fact_original != fact_output:
        run_log.warn(f"La facturacion agregada ({fact_output}) no coincide con el archivo ({fact_original}).")

    records_json = json.dumps(to_camel_case_records(metrics), ensure_ascii=False)
    if re.search(r"\bNaN\b|\bInfinity\b|-Infinity", records_json):
        run_log.warn("JSON contiene NaN o Infinity.")


def _print_top(df: pd.DataFrame, column: str, title: str) -> None:
    print(f"\n{title}")
    for _, row in df.sort_values(column, ascending=False).head(10).iterrows():
        print(f"- {row['comuna']}: {_json_value(row[column])}")


def _print_summary(reclamos_file: Path, reclamos: pd.DataFrame, metrics: pd.DataFrame, resumen: dict[str, object], run_log: RunLog) -> None:
    print("\n=== Resumen final cruce territorial ===")
    print(f"Archivo de reclamos usado: {reclamos_file}")
    print("Columnas detectadas:")
    for key, value in run_log.detected_columns.items():
        print(f"- {key}: {value}")
    print(f"Total filas reclamos: {len(reclamos)}")
    print(f"Total reclamos validos: {len(reclamos)}")
    print(f"Total comunas con reclamos: {int((metrics['reclamos_totales'] > 0).sum())}")
    print(f"Total comunas RM en salida: {len(metrics)}")
    print(f"Total facturacion: {float(metrics['facturacion_total'].sum()):,.0f}")
    _print_top(metrics, "reclamos_totales", "Top 10 por reclamos")
    _print_top(metrics, "reclamos_por_100k_habitantes", "Top 10 por intensidad territorial")
    _print_top(metrics, "criticidad_score", "Top 10 por riesgo operativo")
    _print_top(metrics, "facturacion_total", "Top 10 por facturacion")
    print(f"\nZona RM mas afectada: {resumen.get('zona_rm_mas_afectada', '')}")
    print(f"Comuna critica: {resumen.get('top_comuna_criticidad', '')}")
    print(f"Concentracion Top 5: {resumen.get('concentracion_top5_reclamos_pct', 0)}%")
    print(f"Comunas sin match censal: {', '.join(run_log.comunas_sin_match) if run_log.comunas_sin_match else 'Ninguna'}")
    print("\nArchivos generados:")
    for output in run_log.outputs:
        print(f"- {output}")
    print("\nAdvertencias:")
    print("\n".join(f"- {warning}" for warning in run_log.warnings) if run_log.warnings else "- Ninguna")
    print("\nProximo paso sugerido: importar src/data/reclamosCensoRM2026.ts en una capa de adaptadores del dashboard y conectar nuevas tarjetas sin reemplazar los KPI actuales.")


def build_metrics(reclamos: pd.DataFrame, censo: pd.DataFrame, run_log: RunLog) -> pd.DataFrame:
    merged = merge_with_censo(reclamos, censo, run_log)
    metrics = calculate_territorial_metrics(merged)
    metrics = calculate_criticidad(metrics)
    metrics = calculate_rankings(metrics)
    metrics = add_user_friendly_fields(metrics)
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Cruza reclamos/facturacion con Censo RM 2024.")
    parser.add_argument("--censo", type=Path, default=DEFAULT_CENSO)
    parser.add_argument("--geojson", type=Path, default=DEFAULT_GEOJSON)
    parser.add_argument("--reclamos", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--typescript-output", type=Path, default=DEFAULT_TS_OUTPUT)
    args = parser.parse_args()

    run_log = RunLog()
    if not args.censo.exists():
        print(f"[ERROR] No existe archivo censal RM: {args.censo}")
        sys.exit(1)

    reclamos_file = args.reclamos or detect_reclamos_file([Path("data/raw/reclamos"), Path("data/raw"), Path("data/processed")])
    if reclamos_file is None or not reclamos_file.exists():
        print("[ERROR] Debe guardar el archivo de reclamos en data/raw/reclamos/ o pasarlo con --reclamos")
        sys.exit(1)

    print(f"Inicio cruce territorial: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    censo = load_censo(args.censo)
    raw_reclamos = load_reclamos(reclamos_file)
    reclamos = prepare_reclamos(raw_reclamos, run_log)
    metrics = build_metrics(reclamos, censo, run_log)
    resumen = calculate_resumen_general(metrics, reclamos, run_log)
    diario = calculate_resumen_temporal(reclamos, censo, "dia", run_log)
    semanal = calculate_resumen_temporal(reclamos, censo, "semana", run_log)
    mensual = calculate_resumen_temporal(reclamos, censo, "mes", run_log)
    geojson = enrich_geojson(args.geojson, metrics)

    validate_output(metrics, reclamos, run_log)
    export_csv_json(metrics, resumen, diario, semanal, mensual, geojson, args.output, run_log)
    export_typescript(metrics, resumen, diario, semanal, mensual, args.typescript_output, run_log)
    _print_summary(reclamos_file, reclamos, metrics, resumen, run_log)


if __name__ == "__main__":
    main()






