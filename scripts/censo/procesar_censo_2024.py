from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import sys
import unicodedata
import zipfile
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Any

import pandas as pd

try:
    import pyarrow.parquet as pq
except ImportError:
    pq = None

try:
    import geopandas as gpd
except ImportError:
    gpd = None


INPUT_DEFAULT = Path("data/raw/censo2024")
OUTPUT_DEFAULT = Path("data/processed")
TS_OUTPUT_DEFAULT = Path("src/data/censoComunasRM2024.ts")
AGE_COLUMNS = ["edad_0_14", "edad_15_29", "edad_30_44", "edad_45_64", "edad_65_mas"]
BASE_COLUMNS = [
    "codigo_region",
    "region",
    "codigo_comuna",
    "comuna",
    "poblacion_2024",
    "hogares_2024",
    "viviendas_2024",
    "hombres_2024",
    "mujeres_2024",
    *AGE_COLUMNS,
    "promedio_personas_hogar",
    "viviendas_por_hogar",
    "macrozona_rm",
]

COLUMN_ALIASES = {
    "codigo_region": {"codigo_region", "cod_region", "region_codigo", "codigo_de_region"},
    "region": {"region", "nombre_region", "nom_region", "region_nombre"},
    "codigo_comuna": {"codigo_comuna", "cod_comuna", "comuna_codigo", "codigo_de_comuna"},
    "comuna": {"comuna", "nombre_comuna", "nom_comuna", "comuna_nombre"},
    "sexo": {"sexo", "p_sexo", "genero", "sex"},
    "edad": {"edad", "p_edad", "edad_grupo", "grupo_edad", "tramo_edad", "edad_quinquenal"},
    "hogar": {"hogar", "id_hogar", "idhogar", "folio_hogar", "numero_hogar"},
    "vivienda": {"vivienda", "id_vivienda", "idvivienda", "folio_vivienda", "numero_vivienda"},
}

MACROZONAS_RM = {
    "Centro": ["Santiago", "Independencia", "Recoleta", "Quinta Normal", "Estacion Central", "Pedro Aguirre Cerda", "San Miguel", "San Joaquin", "San Ramon"],
    "Norte": ["Quilicura", "Huechuraba", "Conchali", "Renca", "Colina", "Lampa", "Tiltil"],
    "Sur": ["Puente Alto", "San Bernardo", "La Pintana", "El Bosque", "La Granja", "Lo Espejo", "La Cisterna", "San Jose De Maipo", "Pirque", "Buin", "Paine", "Calera De Tango"],
    "Poniente": ["Maipu", "Pudahuel", "Cerro Navia", "Lo Prado", "Cerrillos", "Padre Hurtado", "Penaflor", "Talagante", "El Monte", "Isla De Maipo", "Melipilla", "Maria Pinto", "Curacavi", "Alhue", "San Pedro"],
    "Oriente": ["Las Condes", "Providencia", "Nunoa", "La Reina", "Penalolen", "Macul", "La Florida", "Vitacura", "Lo Barnechea"],
}


class RunLog:
    def __init__(self) -> None:
        self.found_files: list[str] = []
        self.processed_files: list[str] = []
        self.skipped_files: list[str] = []
        self.detected_columns: dict[str, list[str]] = {}
        self.warnings: list[str] = []
        self.outputs: list[str] = []

    def warn(self, message: str) -> None:
        self.warnings.append(message)
        print(f"[ADVERTENCIA] {message}")

    def processed(self, file_name: str) -> None:
        if file_name not in self.processed_files:
            self.processed_files.append(file_name)

    def skipped(self, file_name: str, reason: str) -> None:
        self.skipped_files.append(f"{file_name}: {reason}")
        print(f"[OMITIDO] {file_name}: {reason}")


def normalize_text(value: object) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    text = re.sub(r"\s+", " ", str(value).strip())
    text = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in text if not unicodedata.combining(ch))


def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    renamed: dict[Any, str] = {}
    for column in df.columns:
        name = normalize_text(column).lower().replace("cod.", "codigo")
        name = re.sub(r"[^a-z0-9]+", "_", name)
        name = re.sub(r"_+", "_", name).strip("_")
        renamed[column] = {
            "cod_comuna": "codigo_comuna",
            "codigo_comuna": "codigo_comuna",
            "cod_region": "codigo_region",
            "codigo_region": "codigo_region",
            "poblacion_censada": "poblacion_2024",
            "hombres": "hombres_2024",
            "mujeres": "mujeres_2024",
        }.get(name, name)
    return df.rename(columns=renamed)


def find_column(columns: Iterable[str], candidates: Iterable[str], required: bool = False) -> str | None:
    normalized = {normalize_text(col).lower().replace(" ", "_"): col for col in columns}
    expanded: list[str] = []
    for candidate in candidates:
        key = normalize_text(candidate).lower().replace(" ", "_")
        expanded.append(key)
        expanded.extend(COLUMN_ALIASES.get(key, set()))
    for candidate in expanded:
        if candidate in normalized:
            return normalized[candidate]
    for candidate in expanded:
        for norm_col, original_col in normalized.items():
            if norm_col.endswith(f"_{candidate}") or candidate in norm_col:
                return original_col
    if required:
        print("[ERROR] No se detecto columna requerida.")
        print(f"        Candidatas: {sorted(set(expanded))}")
        print(f"        Columnas disponibles: {list(columns)}")
        print("        Sugerencia: revisar nombres reales de columnas en la inspeccion.")
    return None


def list_files(input_dir: Path) -> list[Path]:
    files = sorted(path for path in input_dir.iterdir() if path.is_file())
    print("\n=== Archivos encontrados ===")
    for path in files:
        print(f"- {path.name} ({path.stat().st_size:,} bytes)")
    return files


def inspect_zip(zip_path: Path) -> list[str]:
    print(f"\n=== Inspeccion ZIP: {zip_path.name} ===")
    with zipfile.ZipFile(zip_path) as archive:
        infos = archive.infolist()
        for info in infos[:30]:
            print(f"- {info.filename} ({info.file_size:,} bytes)")
        if len(infos) > 30:
            print(f"... {len(infos) - 30} archivos mas")
        return [info.filename for info in infos]


def _read_excel_sheet_with_detected_header(file_path: Path, sheet_name: str) -> pd.DataFrame:
    preview = pd.read_excel(file_path, sheet_name=sheet_name, header=None, nrows=20)
    header_idx = 0
    for idx, row in preview.iterrows():
        values = [normalize_text(value).lower() for value in row.tolist()]
        if (
            any("codigo" in value for value in values)
            and any("comuna" in value for value in values)
            and any("poblacion" in value for value in values)
        ):
            header_idx = int(idx)
            break
    df = pd.read_excel(file_path, sheet_name=sheet_name, header=header_idx)
    return normalize_column_names(df.dropna(how="all"))


def read_excel_population(file_path: Path) -> pd.DataFrame:
    xl = pd.ExcelFile(file_path)
    print(f"\n=== Hojas Excel {file_path.name} ===")
    print(", ".join(xl.sheet_names))
    preferred_sheet = "2" if "2" in xl.sheet_names else xl.sheet_names[-1]
    df = _read_excel_sheet_with_detected_header(file_path, preferred_sheet)
    print(f"\n=== Columnas muestra Excel hoja {preferred_sheet} ===")
    print(list(df.columns))
    print(df.head(5).to_string(index=False))
    return df


def _clean_code(series: pd.Series) -> pd.Series:
    return (
        series.astype("string")
        .str.replace(r"\.0$", "", regex=True)
        .str.strip()
        .replace({"<NA>": pd.NA, "nan": pd.NA, "None": pd.NA, "": pd.NA})
    )


def _safe_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def aggregate_population_from_excel(file_path: Path, run_log: RunLog) -> pd.DataFrame:
    df = read_excel_population(file_path)
    run_log.detected_columns[file_path.name] = list(df.columns)
    codigo_region = find_column(df.columns, ["codigo_region"], required=True)
    region = find_column(df.columns, ["region"], required=True)
    codigo_comuna = find_column(df.columns, ["codigo_comuna"], required=True)
    comuna = find_column(df.columns, ["comuna"], required=True)
    if not all([codigo_region, region, codigo_comuna, comuna]):
        run_log.skipped(file_path.name, "faltan columnas criticas")
        return pd.DataFrame()
    selected = {
        "poblacion_2024": find_column(df.columns, ["poblacion_2024", "poblacion_censada", "total"]),
        "hombres_2024": find_column(df.columns, ["hombres_2024", "hombres", "hombre"]),
        "mujeres_2024": find_column(df.columns, ["mujeres_2024", "mujeres", "mujer"]),
    }
    keep = [codigo_region, region, codigo_comuna, comuna] + [col for col in selected.values() if col]
    out = df[keep].rename(columns={codigo_region: "codigo_region", region: "region", codigo_comuna: "codigo_comuna", comuna: "comuna", **{col: target for target, col in selected.items() if col}})
    out["codigo_region"] = _clean_code(out["codigo_region"])
    out["codigo_comuna"] = _clean_code(out["codigo_comuna"])
    out = out[out["codigo_comuna"].notna() & (out["codigo_comuna"] != "0")]
    out = out[out["comuna"].astype(str).str.lower() != "pais"]
    for col in ["poblacion_2024", "hombres_2024", "mujeres_2024", *AGE_COLUMNS]:
        if col not in out.columns:
            out[col] = pd.NA
        out[col] = _safe_numeric(out[col])
    run_log.processed(file_path.name)
    return out


def read_parquet_from_zip(zip_path: Path, member_hint: str, columns: list[str] | None = None) -> pd.DataFrame:
    if pq is None:
        raise RuntimeError("pyarrow no esta instalado")
    with zipfile.ZipFile(zip_path) as archive:
        member = next(name for name in archive.namelist() if member_hint.lower() in name.lower() and name.endswith(".parquet"))
        with archive.open(member) as raw:
            return pq.read_table(raw, columns=columns).to_pandas()


def read_csv_from_zip(zip_path: Path, columns: list[str] | None = None, chunksize: int = 500_000) -> Iterable[pd.DataFrame]:
    with zipfile.ZipFile(zip_path) as archive:
        member = next(name for name in archive.namelist() if name.lower().endswith(".csv"))
        with archive.open(member) as raw:
            text = io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace")
            yield from pd.read_csv(text, usecols=columns, chunksize=chunksize, low_memory=False)


def read_zip_csv_or_parquet(zip_path: Path, member_hint: str, columns: list[str] | None = None) -> pd.DataFrame:
    with zipfile.ZipFile(zip_path) as archive:
        names = archive.namelist()
    if any(member_hint.lower() in name.lower() and name.endswith(".parquet") for name in names):
        return read_parquet_from_zip(zip_path, member_hint, columns)
    frames = list(read_csv_from_zip(zip_path, columns))
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def _detect_zip_parquet_columns(zip_path: Path, member_hint: str) -> list[str]:
    if pq is None:
        return []
    with zipfile.ZipFile(zip_path) as archive:
        member = next(name for name in archive.namelist() if member_hint.lower() in name.lower() and name.endswith(".parquet"))
        with archive.open(member) as raw:
            return pq.ParquetFile(raw).schema.names


def _aggregate_parquet_batches_from_zip(
    zip_path: Path,
    member_hint: str,
    columns: list[str],
    aggregate_batch: Callable[[pd.DataFrame], pd.DataFrame],
    batch_size: int = 750_000,
) -> pd.DataFrame:
    if pq is None:
        raise RuntimeError("pyarrow no esta instalado")
    frames: list[pd.DataFrame] = []
    with zipfile.ZipFile(zip_path) as archive:
        member = next(name for name in archive.namelist() if member_hint.lower() in name.lower() and name.endswith(".parquet"))
        with archive.open(member) as raw:
            parquet_file = pq.ParquetFile(raw)
            for batch in parquet_file.iter_batches(batch_size=batch_size, columns=columns):
                frames.append(aggregate_batch(batch.to_pandas()))
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True).groupby("codigo_comuna", as_index=False).sum(numeric_only=True)


def aggregate_personas(df_or_path: pd.DataFrame | Path, run_log: RunLog | None = None) -> pd.DataFrame:
    if not isinstance(df_or_path, Path):
        return pd.DataFrame()
    columns = _detect_zip_parquet_columns(df_or_path, "personas")
    if run_log:
        run_log.detected_columns[f"{df_or_path.name}:personas"] = columns
    comuna_col = find_column(columns, ["codigo_comuna", "comuna"], required=True)
    sexo_col = find_column(columns, ["sexo"])
    edad_col = find_column(columns, ["edad", "edad_quinquenal"])
    if not comuna_col:
        return pd.DataFrame()
    use_cols = [comuna_col] + [col for col in [sexo_col, edad_col] if col]

    def aggregate_batch(df: pd.DataFrame) -> pd.DataFrame:
        df = normalize_column_names(df)
        c_comuna = find_column(df.columns, ["codigo_comuna", "comuna"], required=True)
        c_sexo = find_column(df.columns, ["sexo"])
        c_edad = find_column(df.columns, ["edad", "edad_quinquenal"])
        out = pd.DataFrame({"codigo_comuna": _clean_code(df[c_comuna])})
        out["poblacion_2024"] = 1
        if c_sexo:
            sexo = _safe_numeric(df[c_sexo])
            out["hombres_2024"] = (sexo == 1).astype(int)
            out["mujeres_2024"] = (sexo == 2).astype(int)
        if c_edad:
            edad = _safe_numeric(df[c_edad])
            out["edad_0_14"] = edad.between(0, 14, inclusive="both").astype(int)
            out["edad_15_29"] = edad.between(15, 29, inclusive="both").astype(int)
            out["edad_30_44"] = edad.between(30, 44, inclusive="both").astype(int)
            out["edad_45_64"] = edad.between(45, 64, inclusive="both").astype(int)
            out["edad_65_mas"] = (edad >= 65).astype(int)
        return out.groupby("codigo_comuna", as_index=False).sum(numeric_only=True)

    result = _aggregate_parquet_batches_from_zip(df_or_path, "personas", use_cols, aggregate_batch)
    if run_log:
        run_log.processed(f"{df_or_path.name}:personas")
    return result


def aggregate_hogares(df_or_path: pd.DataFrame | Path, run_log: RunLog | None = None) -> pd.DataFrame:
    if isinstance(df_or_path, Path):
        columns = _detect_zip_parquet_columns(df_or_path, "hogares")
        if run_log:
            run_log.detected_columns[f"{df_or_path.name}:hogares"] = columns
        comuna_col = find_column(columns, ["codigo_comuna", "comuna"], required=True)
        hogar_col = find_column(columns, ["hogar"])
        if not comuna_col:
            return pd.DataFrame()
        use_cols = [comuna_col] + ([hogar_col] if hogar_col else [])

        def aggregate_batch(df: pd.DataFrame) -> pd.DataFrame:
            df = normalize_column_names(df)
            c_comuna = find_column(df.columns, ["codigo_comuna", "comuna"], required=True)
            out = pd.DataFrame({"codigo_comuna": _clean_code(df[c_comuna]), "hogares_2024": 1})
            return out.groupby("codigo_comuna", as_index=False).sum(numeric_only=True)

        result = _aggregate_parquet_batches_from_zip(df_or_path, "hogares", use_cols, aggregate_batch)
        if run_log:
            run_log.processed(f"{df_or_path.name}:hogares")
        return result
    df = normalize_column_names(df_or_path)
    comuna_col = find_column(df.columns, ["codigo_comuna", "comuna"], required=True)
    if not comuna_col:
        return pd.DataFrame()
    return pd.DataFrame({"codigo_comuna": _clean_code(df[comuna_col]), "hogares_2024": 1}).groupby("codigo_comuna", as_index=False).sum(numeric_only=True)


def aggregate_viviendas(df_or_path: pd.DataFrame | Path, run_log: RunLog | None = None) -> pd.DataFrame:
    if isinstance(df_or_path, Path):
        columns = _detect_zip_parquet_columns(df_or_path, "viviendas")
        if run_log:
            run_log.detected_columns[f"{df_or_path.name}:viviendas"] = columns
        comuna_col = find_column(columns, ["codigo_comuna", "comuna"], required=True)
        vivienda_col = find_column(columns, ["vivienda"])
        ocupacion_col = find_column(columns, ["p3a_estado_ocupacion", "estado_ocupacion"])
        tipo_col = find_column(columns, ["p2_tipo_vivienda", "tipo_vivienda"])
        cant_per_col = find_column(columns, ["cant_per", "p11a_num_personas"])
        if not comuna_col:
            return pd.DataFrame()
        use_cols = [col for col in [comuna_col, vivienda_col, ocupacion_col, tipo_col, cant_per_col] if col]

        def aggregate_batch(df: pd.DataFrame) -> pd.DataFrame:
            df = normalize_column_names(df)
            c_comuna = find_column(df.columns, ["codigo_comuna", "comuna"], required=True)
            c_ocup = find_column(df.columns, ["p3a_estado_ocupacion", "estado_ocupacion"])
            c_tipo = find_column(df.columns, ["p2_tipo_vivienda", "tipo_vivienda"])
            c_per = find_column(df.columns, ["cant_per", "p11a_num_personas"])
            out = pd.DataFrame({"codigo_comuna": _clean_code(df[c_comuna]), "viviendas_2024": 1})
            if c_ocup:
                ocup = _safe_numeric(df[c_ocup])
                out["viviendas_particulares_ocupadas"] = (ocup == 1).astype(int)
                out["viviendas_particulares_desocupadas"] = (ocup != 1).astype(int)
            if c_tipo:
                out["viviendas_colectivas"] = (_safe_numeric(df[c_tipo]) >= 10).astype(int)
            if c_per:
                out["personas_en_viviendas"] = _safe_numeric(df[c_per]).fillna(0)
            return out.groupby("codigo_comuna", as_index=False).sum(numeric_only=True)

        result = _aggregate_parquet_batches_from_zip(df_or_path, "viviendas", use_cols, aggregate_batch)
        if run_log:
            run_log.processed(f"{df_or_path.name}:viviendas")
        return result
    df = normalize_column_names(df_or_path)
    comuna_col = find_column(df.columns, ["codigo_comuna", "comuna"], required=True)
    if not comuna_col:
        return pd.DataFrame()
    return pd.DataFrame({"codigo_comuna": _clean_code(df[comuna_col]), "viviendas_2024": 1}).groupby("codigo_comuna", as_index=False).sum(numeric_only=True)


def _canonical_comuna(value: object) -> str:
    text = normalize_text(value).title()
    return {
        "Nunoa": "Ñuñoa",
        "San Jose De Maipo": "San José de Maipo",
        "Estacion Central": "Estación Central",
        "San Joaquin": "San Joaquín",
        "San Ramon": "San Ramón",
        "Maipu": "Maipú",
        "Penalolen": "Peñalolén",
        "Conchali": "Conchalí",
        "Alhue": "Alhué",
        "Curacavi": "Curacaví",
        "Maria Pinto": "María Pinto",
    }.get(text, text)


def assign_macrozona_rm(comuna: object) -> str:
    comuna_norm = normalize_text(comuna).title()
    for macrozona, comunas in MACROZONAS_RM.items():
        if comuna_norm in {normalize_text(item).title() for item in comunas}:
            return macrozona
    return "Sin clasificar"


def _safe_div(numerator: pd.Series, denominator: pd.Series, multiplier: float = 1.0) -> pd.Series:
    num = pd.to_numeric(numerator, errors="coerce")
    den = pd.to_numeric(denominator, errors="coerce")
    return (num / den.where(den != 0) * multiplier).round(4)


def build_comuna_dataset(input_dir: Path, output_dir: Path, run_log: RunLog) -> pd.DataFrame:
    del output_dir
    excel_path = input_dir / "D1_Poblacion-censada-por-sexo-y-edad-en-grupos-quinquenales.xlsx"
    combined_zip = input_dir / "viv_hog_per_censo2024.zip"
    base = aggregate_population_from_excel(excel_path, run_log) if excel_path.exists() else pd.DataFrame()
    if base.empty:
        raise RuntimeError("No se pudo construir base comunal desde Excel D1.")
    if combined_zip.exists():
        try:
            personas = aggregate_personas(combined_zip, run_log)
            for col in ["poblacion_2024", "hombres_2024", "mujeres_2024", *AGE_COLUMNS]:
                if col in personas.columns:
                    base = base.drop(columns=[col], errors="ignore").merge(personas[["codigo_comuna", col]], on="codigo_comuna", how="left")
        except Exception as exc:
            run_log.warn(f"No se pudo procesar personas desde {combined_zip.name}: {exc}")
        try:
            base = base.merge(aggregate_hogares(combined_zip, run_log), on="codigo_comuna", how="left")
        except Exception as exc:
            run_log.warn(f"No se pudo procesar hogares desde {combined_zip.name}: {exc}")
        try:
            base = base.merge(aggregate_viviendas(combined_zip, run_log), on="codigo_comuna", how="left")
        except Exception as exc:
            run_log.warn(f"No se pudo procesar viviendas desde {combined_zip.name}: {exc}")
    else:
        run_log.warn("No existe viv_hog_per_censo2024.zip; se usara solo Excel D1.")
    for col in BASE_COLUMNS:
        if col not in base.columns:
            base[col] = pd.NA
    base["codigo_region"] = _clean_code(base["codigo_region"])
    base["codigo_comuna"] = _clean_code(base["codigo_comuna"])
    base["comuna"] = base["comuna"].map(_canonical_comuna)
    base["comuna_norm"] = base["comuna"].map(lambda value: normalize_text(value).upper())
    base["promedio_personas_hogar"] = _safe_div(base["poblacion_2024"], base["hogares_2024"])
    base["viviendas_por_hogar"] = _safe_div(base["viviendas_2024"], base["hogares_2024"])
    base["porcentaje_mujeres"] = _safe_div(base["mujeres_2024"], base["poblacion_2024"], 100)
    base["porcentaje_hombres"] = _safe_div(base["hombres_2024"], base["poblacion_2024"], 100)
    base["porcentaje_adultos_mayores"] = _safe_div(base["edad_65_mas"], base["poblacion_2024"], 100)
    base["porcentaje_menores_15"] = _safe_div(base["edad_0_14"], base["poblacion_2024"], 100)
    if "personas_en_viviendas" in base.columns:
        base["personas_por_vivienda"] = _safe_div(base["personas_en_viviendas"], base["viviendas_2024"])
    is_rm = (base["codigo_region"] == "13") | base["region"].astype(str).str.contains("metropolitana", case=False, na=False)
    base["macrozona_rm"] = pd.NA
    base.loc[is_rm, "macrozona_rm"] = base.loc[is_rm, "comuna"].map(assign_macrozona_rm)
    missing_macro = base.loc[is_rm & (base["macrozona_rm"] == "Sin clasificar"), "comuna"].dropna().tolist()
    if missing_macro:
        run_log.warn(f"Comunas RM sin macrozona: {', '.join(missing_macro)}")
    ordered = [
        *BASE_COLUMNS,
        "viviendas_particulares_ocupadas",
        "viviendas_particulares_desocupadas",
        "viviendas_colectivas",
        "personas_por_vivienda",
        "porcentaje_mujeres",
        "porcentaje_hombres",
        "porcentaje_adultos_mayores",
        "porcentaje_menores_15",
        "comuna_norm",
    ]
    return base[[col for col in ordered if col in base.columns]].sort_values("codigo_comuna")


def process_cartography(zip_path: Path, output_dir: Path, run_log: RunLog) -> None:
    if gpd is None:
        run_log.warn("GeoPandas no esta instalado; se omite cartografia.")
        return
    if not zip_path.exists():
        run_log.warn("No existe Cartografia_censo2024_Pais.zip; se omite cartografia.")
        return
    layers = {"Comunal": output_dir / "comunas_censo2024.geojson", "Regional": output_dir / "regiones_censo2024.geojson"}
    with zipfile.ZipFile(zip_path) as archive:
        names = archive.namelist()
        for hint, target in layers.items():
            member = next((name for name in names if hint.lower() in name.lower() and name.endswith(".parquet")), None)
            if not member:
                run_log.warn(f"No se encontro capa {hint} en cartografia.")
                continue
            try:
                with archive.open(member) as raw:
                    gdf = gpd.read_parquet(raw)
                gdf = normalize_column_names(gdf)
                shape_col = find_column(gdf.columns, ["shape", "geometry", "geom"])
                if shape_col:
                    gdf = gdf.set_geometry(shape_col)
                if gdf.crs is None:
                    gdf = gdf.set_crs("EPSG:4326", allow_override=True)
                else:
                    gdf = gdf.to_crs("EPSG:4326")
                active_geometry = gdf.geometry.name
                gdf[active_geometry] = gdf.geometry.simplify(0.001 if hint == "Comunal" else 0.003, preserve_topology=True)
                if hint == "Comunal":
                    region_col = find_column(gdf.columns, ["codigo_region", "region"], required=True)
                    comuna_col = find_column(gdf.columns, ["codigo_comuna", "cut", "comuna"], required=True)
                    if region_col:
                        gdf["codigo_region"] = _clean_code(gdf[region_col])
                    if comuna_col:
                        gdf["codigo_comuna"] = _clean_code(gdf[comuna_col])
                    gdf.to_file(target, driver="GeoJSON")
                    run_log.outputs.append(str(target))
                    rm = gdf[gdf["codigo_region"] == "13"]
                    if not rm.empty:
                        rm_target = output_dir / "comunas_rm_censo2024.geojson"
                        rm.to_file(rm_target, driver="GeoJSON")
                        run_log.outputs.append(str(rm_target))
                else:
                    gdf.to_file(target, driver="GeoJSON")
                    run_log.outputs.append(str(target))
                run_log.processed(f"{zip_path.name}:{member}")
            except Exception as exc:
                run_log.warn(f"Fallo cartografia {member}: {exc}")


def validate_output(df: pd.DataFrame, run_log: RunLog) -> None:
    if df["codigo_comuna"].duplicated().any():
        run_log.warn("Hay duplicados por codigo_comuna.")
    if df["comuna"].isna().any() or (df["comuna"].astype(str).str.strip() == "").any():
        run_log.warn("Hay comunas sin nombre.")
    for col in ["poblacion_2024", "hogares_2024", "viviendas_2024"]:
        values = pd.to_numeric(df[col], errors="coerce")
        if (values < 0).any():
            run_log.warn(f"Hay valores negativos en {col}.")
        if values.isna().mean() > 0.3:
            run_log.warn(f"{col} esta vacio en mas del 30% de comunas.")
    rm_count = int((df["codigo_region"] == "13").sum())
    if rm_count != 52:
        run_log.warn(f"RM tiene {rm_count} comunas; se esperaban 52.")


def _snake_to_camel(name: str) -> str:
    special = {
        "codigo_region": "codigoRegion",
        "codigo_comuna": "codigoComuna",
        "poblacion_2024": "poblacion2024",
        "hogares_2024": "hogares2024",
        "viviendas_2024": "viviendas2024",
        "hombres_2024": "hombres2024",
        "mujeres_2024": "mujeres2024",
        "edad_0_14": "edad014",
        "edad_15_29": "edad1529",
        "edad_30_44": "edad3044",
        "edad_45_64": "edad4564",
        "edad_65_mas": "edad65Mas",
        "promedio_personas_hogar": "promedioPersonasHogar",
        "viviendas_por_hogar": "viviendasPorHogar",
        "macrozona_rm": "macrozonaRm",
    }
    if name in special:
        return special[name]
    parts = name.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


def _json_records(df: pd.DataFrame) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    clean = df.where(pd.notna(df), None)
    for record in clean.to_dict(orient="records"):
        item: dict[str, object] = {}
        for key, value in record.items():
            if isinstance(value, float) and value.is_integer():
                value = int(value)
            item[_snake_to_camel(key)] = value
        records.append(item)
    return records


def export_csv_json(df: pd.DataFrame, output_dir: Path, run_log: RunLog) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    rm = df[df["codigo_region"] == "13"].copy()
    for path, frame in {
        output_dir / "censo_comunas_chile_2024.csv": df,
        output_dir / "censo_comunas_rm_2024.csv": rm,
    }.items():
        frame.to_csv(path, index=False, encoding="utf-8-sig", quoting=csv.QUOTE_MINIMAL)
        run_log.outputs.append(str(path))
    for path, frame in {
        output_dir / "censo_comunas_chile_2024.json": df,
        output_dir / "censo_comunas_rm_2024.json": rm,
    }.items():
        payload = _json_records(frame.drop(columns=["comuna_norm"], errors="ignore"))
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        run_log.outputs.append(str(path))


def export_typescript(df: pd.DataFrame, output_path: Path, run_log: RunLog) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    rm = df[df["codigo_region"] == "13"].drop(columns=["comuna_norm"], errors="ignore")
    payload = json.dumps(_json_records(rm), ensure_ascii=False, indent=2)
    content = (
        "export const censoComunasRM2024 = "
        f"{payload} as const;\n\n"
        "export type CensoComunaRM2024 = typeof censoComunasRM2024[number];\n"
    )
    output_path.write_text(content, encoding="utf-8")
    run_log.outputs.append(str(output_path))


def _inspect_sources(input_dir: Path, run_log: RunLog) -> None:
    files = list_files(input_dir)
    run_log.found_files = [path.name for path in files]
    for path in files:
        if path.suffix.lower() == ".zip":
            try:
                inspect_zip(path)
            except Exception as exc:
                run_log.warn(f"No se pudo inspeccionar {path.name}: {exc}")
        elif path.suffix.lower() in {".xlsx", ".xls"}:
            try:
                xl = pd.ExcelFile(path)
                print(f"\n=== Excel {path.name}: hojas ===")
                print(", ".join(xl.sheet_names))
            except Exception as exc:
                run_log.warn(f"No se pudo inspeccionar {path.name}: {exc}")


def _print_summary(df: pd.DataFrame, run_log: RunLog) -> None:
    rm = df[df["codigo_region"] == "13"]
    print("\n=== Resumen final ===")
    print(f"Archivos encontrados: {', '.join(run_log.found_files)}")
    print(f"Archivos procesados: {', '.join(run_log.processed_files)}")
    print(f"Archivos omitidos: {', '.join(run_log.skipped_files) if run_log.skipped_files else 'Ninguno'}")
    print("\nColumnas detectadas por fuente:")
    for source, columns in run_log.detected_columns.items():
        print(f"- {source}: {columns}")
    print(f"Total comunas Chile: {len(df)}")
    print(f"Total comunas RM: {len(rm)}")
    for label, frame in [("Chile", df), ("RM", rm)]:
        print(f"Poblacion total {label}: {pd.to_numeric(frame['poblacion_2024'], errors='coerce').sum(skipna=True):,.0f}")
        print(f"Hogares total {label}: {pd.to_numeric(frame['hogares_2024'], errors='coerce').sum(skipna=True):,.0f}")
        print(f"Viviendas total {label}: {pd.to_numeric(frame['viviendas_2024'], errors='coerce').sum(skipna=True):,.0f}")
    missing_macro = rm.loc[rm["macrozona_rm"] == "Sin clasificar", "comuna"].tolist()
    print(f"Comunas RM sin macrozona: {', '.join(missing_macro) if missing_macro else 'Ninguna'}")
    print("\nPrimeras 10 filas:")
    print(df.head(10).to_string(index=False))
    print("\nArchivos generados:")
    for output in run_log.outputs:
        print(f"- {output}")
    print("\nAdvertencias:")
    print("\n".join(f"- {warning}" for warning in run_log.warnings) if run_log.warnings else "- Ninguna")


def main() -> None:
    parser = argparse.ArgumentParser(description="Procesa microdatos Censo Chile 2024 por comuna.")
    parser.add_argument("--input", type=Path, default=INPUT_DEFAULT, help="Carpeta de entrada con archivos censales.")
    parser.add_argument("--output", type=Path, default=OUTPUT_DEFAULT, help="Carpeta de salida para datos procesados.")
    parser.add_argument("--typescript-output", type=Path, default=TS_OUTPUT_DEFAULT, help="Salida TypeScript opcional.")
    args = parser.parse_args()

    run_log = RunLog()
    if not args.input.exists():
        print(f"[ERROR] No existe carpeta de entrada: {args.input}")
        sys.exit(1)
    _inspect_sources(args.input, run_log)
    df = build_comuna_dataset(args.input, args.output, run_log)
    validate_output(df, run_log)
    export_csv_json(df, args.output, run_log)
    export_typescript(df, args.typescript_output, run_log)
    process_cartography(args.input / "Cartografia_censo2024_Pais.zip", args.output, run_log)
    _print_summary(df, run_log)


if __name__ == "__main__":
    main()



