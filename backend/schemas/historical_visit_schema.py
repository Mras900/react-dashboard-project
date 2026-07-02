from datetime import date
from typing import Any

from pydantic import BaseModel, Field


# --- IMPORT ---

class HistoricalImportResponse(BaseModel):
    imported: int = 0
    skipped_duplicates: int = 0
    errors: int = 0
    source_years_detected: list[int] = Field(default_factory=list)
    rows_by_year: dict[str, int] = Field(default_factory=dict)
    rows_by_comuna: list[dict[str, Any]] = Field(default_factory=list)
    rows_by_estado: dict[str, int] = Field(default_factory=dict)
    rows_by_prioridad: dict[str, int] = Field(default_factory=dict)
    message: str = ""


# --- SUMMARY ---

class HistoricalSummaryResponse(BaseModel):
    total: int = 0
    by_year: dict[str, int] = Field(default_factory=dict)
    by_month: dict[str, int] = Field(default_factory=dict)
    by_comuna: list[dict[str, Any]] = Field(default_factory=list)
    by_prioridad: dict[str, int] = Field(default_factory=dict)
    by_estado: dict[str, int] = Field(default_factory=dict)
    by_categoria_incidente: dict[str, int] = Field(default_factory=dict)
    by_categoria_causa: dict[str, int] = Field(default_factory=dict)
    by_producto: list[dict[str, Any]] = Field(default_factory=list)
    promedio_dias_visita_respuesta: float | None = None


# --- COMPARE ---

class CompareYearMetric(BaseModel):
    year: int
    total: int = 0
    by_comuna: list[dict[str, Any]] = Field(default_factory=list)
    by_prioridad: dict[str, int] = Field(default_factory=dict)
    by_estado: dict[str, int] = Field(default_factory=dict)
    by_categoria_incidente: dict[str, int] = Field(default_factory=dict)
    by_mes: dict[str, int] = Field(default_factory=dict)


class HistoricalCompareResponse(BaseModel):
    year_a: CompareYearMetric
    year_b: CompareYearMetric
    diferencia_absoluta: int = 0
    variacion_porcentual: float | None = None
    top_comunas_aumento: list[dict[str, Any]] = Field(default_factory=list)
    top_comunas_baja: list[dict[str, Any]] = Field(default_factory=list)
    top_categorias_aumento: list[dict[str, Any]] = Field(default_factory=list)
    top_estados: dict[str, dict[str, int]] = Field(default_factory=dict)
    top_prioridades: dict[str, dict[str, int]] = Field(default_factory=dict)
    resumen_textual_base: str = ""


# --- AI CONTEXT (sin PII) ---

class HistoricalAiContextResponse(BaseModel):
    totales: dict[str, int] = Field(default_factory=dict)
    variaciones: dict[str, float | None] = Field(default_factory=dict)
    top_comunas: list[dict[str, Any]] = Field(default_factory=list)
    top_categorias: list[dict[str, Any]] = Field(default_factory=list)
    tendencias_mensuales: dict[str, dict[str, int]] = Field(default_factory=dict)
    hallazgos_principales: list[str] = Field(default_factory=list)
