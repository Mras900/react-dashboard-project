from __future__ import annotations

import html
from typing import Any

from services.ai_provider import ask_ai
from services.dashboard_context import MONTH_NAMES, get_dashboard_context, get_dashboard_metrics, sanitize_ai_context

TERRITORY_LABELS = {
    "rm": "Region Metropolitana",
    "regiones": "Regiones",
    "nacional": "Nacional",
    "all": "Nacional",
}


def _clean_filters(filters: dict[str, Any]) -> dict[str, Any]:
    territorio = str(filters.get("territorio") or "rm").strip().lower()
    if territorio not in {"rm", "regiones", "nacional", "all"}:
        territorio = "rm"
    year = int(filters.get("year") or 2026)
    month = int(filters.get("month") or 1)
    month = min(max(month, 1), 12)
    return {
        **filters,
        "territorio": territorio,
        "year": year,
        "month": month,
    }


def build_monthly_report_data(filters: dict) -> dict[str, Any]:
    clean = _clean_filters(filters)
    metrics = get_dashboard_metrics(clean)
    territorio = clean["territorio"]
    year = clean["year"]
    month = clean["month"]
    month_name = MONTH_NAMES.get(month, str(month))
    territory_label = TERRITORY_LABELS.get(territorio, territorio)
    report_id = f"{territorio}-{year}-{month:02d}"
    return {
        "ok": True,
        "report_id": report_id,
        "title": f"Informe mensual de reclamos - {territory_label} - {month_name} {year}",
        "filters": clean,
        "metrics": sanitize_ai_context(metrics),
    }


def _fmt_number(value: Any) -> str:
    try:
        return f"{float(value):,.0f}".replace(",", ".")
    except (TypeError, ValueError):
        return "0"


def _bullet_counts(counts: Any) -> str:
    if not isinstance(counts, dict) or not counts:
        return "- campo no disponible"
    return "\n".join(f"- {key}: {_fmt_number(value)}" for key, value in counts.items())


def _bullet_communes(rows: Any) -> str:
    if not isinstance(rows, list) or not rows:
        return "- Sin comunas con datos para el periodo."
    lines = []
    for row in rows[:8]:
        if not isinstance(row, dict):
            continue
        lines.append(
            f"- {row.get('comuna', 'Sin ubicacion')} ({row.get('region', 'Sin region')}): "
            f"{_fmt_number(row.get('reclamos'))} reclamos, "
            f"{_fmt_number(row.get('prioridad_alta'))} alta prioridad, "
            f"facturacion estimada ${_fmt_number(row.get('facturacion'))}"
        )
    return "\n".join(lines) if lines else "- Sin comunas con datos para el periodo."


def build_monthly_report_markdown(data: dict, ai_analysis: str | None = None) -> str:
    metrics = data.get("metrics", {}) if isinstance(data.get("metrics"), dict) else {}
    filters = data.get("filters", {}) if isinstance(data.get("filters"), dict) else {}
    territory_label = TERRITORY_LABELS.get(str(filters.get("territorio") or "rm"), str(filters.get("territorio") or "rm"))
    month_name = MONTH_NAMES.get(int(filters.get("month") or 0), str(filters.get("month") or ""))
    year = filters.get("year") or "campo no disponible"
    no_data_note = "\n> No hay datos disponibles para los filtros seleccionados.\n" if metrics.get("sin_datos") else ""
    observations = metrics.get("observaciones_agregadas")
    observation_block = "\n".join(f"- {item}" for item in observations) if isinstance(observations, list) and observations else "- campo no disponible"
    ai_block = ai_analysis or "Analisis IA no incluido."

    return f"""# Informe mensual de reclamos

## Territorio
{territory_label}

## Mes analizado
{month_name} {year}{no_data_note}

## 1. Alcance y limitaciones
Este informe usa solo datos disponibles en el backend del dashboard. Si un campo no existe o no tiene registros para el periodo, se declara como campo no disponible. No se incluyen datos personales cuando la vista se genera con ocultamiento de datos sensibles.

## 2. Resumen ejecutivo
- Reclamos totales: {_fmt_number(metrics.get('reclamos_totales'))}
- Facturacion estimada: ${_fmt_number(metrics.get('facturacion_estimada'))}
- Tickets unicos: {_fmt_number(metrics.get('tickets_unicos'))}
- Reclamos prioridad alta: {_fmt_number(metrics.get('reclamos_prioridad_alta'))}

{ai_block}

## 3. Magnitud del periodo
- Rango usado: {metrics.get('rango_fechas_usado', {}).get('fecha_desde') or 'campo no disponible'} a {metrics.get('rango_fechas_usado', {}).get('fecha_hasta') or 'campo no disponible'}
- Visitas totales: {_fmt_number(metrics.get('visitas_totales'))}
- Facturacion por visitas: ${_fmt_number(metrics.get('facturacion_visitas'))}

## 4. Distribucion por prioridad
{_bullet_counts(metrics.get('distribucion_prioridad'))}

## 5. Estado de visitas
- Exitosas: {_fmt_number(metrics.get('visitas_exitosas'))}
- No exitosas: {_fmt_number(metrics.get('visitas_no_exitosas'))}
- Pendientes: {_fmt_number(metrics.get('visitas_pendientes'))}

## 6. Comunas criticas
{_bullet_communes(metrics.get('comunas_criticas'))}

## 7. Productos o motivos criticos
- Principales motivos: {metrics.get('principales_motivos') or 'campo no disponible'}
- Principales productos: {metrics.get('principales_productos') or 'campo no disponible'}

## 8. Observaciones relevantes
{observation_block}

## 9. Reincidencia y patrones repetidos
La reincidencia se aproxima con tickets unicos versus reclamos totales. Si se requiere detalle por cliente o domicilio, el campo se mantiene oculto por proteccion de datos personales.

## 10. Analisis geografico
{_bullet_communes(metrics.get('comunas_con_mas_reclamos'))}

## 11. Conclusiones
Las conclusiones deben interpretarse dentro del rango filtrado. No se infieren cifras fuera del periodo ni del territorio seleccionado.

## 12. Recomendaciones
- Priorizar seguimiento en comunas con mayor volumen y alta prioridad.
- Revisar causas de visitas no exitosas antes de reprogramar rutas.
- Mantener control de facturacion estimada contra respaldo operativo.
"""


def generate_monthly_report(filters: dict, include_ai_analysis: bool = True) -> dict[str, Any]:
    data = build_monthly_report_data(filters)
    ai_analysis = None
    if include_ai_analysis:
        context = get_dashboard_context(data["filters"])
        result = ask_ai(
            prompt=(
                "Genera un analisis ejecutivo breve para un informe mensual operativo. "
                "Usa solo el contexto, no inventes cifras. Incluye riesgos y recomendaciones."
            ),
            context=context,
            provider="auto",
        )
        ai_analysis = result.get("answer") or "Analisis IA no disponible."
        data["ai_provider"] = result.get("provider")
        data["ai_model"] = result.get("model")
        data["fallback"] = bool(result.get("fallback"))
    data["markdown"] = build_monthly_report_markdown(data, ai_analysis=ai_analysis)
    return data


def markdown_to_basic_html(markdown: str, title: str) -> str:
    lines = []
    in_list = False
    for raw_line in markdown.splitlines():
        line = raw_line.rstrip()
        if not line:
            if in_list:
                lines.append("</ul>")
                in_list = False
            continue
        if line.startswith("# "):
            if in_list:
                lines.append("</ul>")
                in_list = False
            lines.append(f"<h1>{html.escape(line[2:])}</h1>")
        elif line.startswith("## "):
            if in_list:
                lines.append("</ul>")
                in_list = False
            lines.append(f"<h2>{html.escape(line[3:])}</h2>")
        elif line.startswith("- "):
            if not in_list:
                lines.append("<ul>")
                in_list = True
            lines.append(f"<li>{html.escape(line[2:])}</li>")
        elif line.startswith("> "):
            if in_list:
                lines.append("</ul>")
                in_list = False
            lines.append(f"<blockquote>{html.escape(line[2:])}</blockquote>")
        else:
            if in_list:
                lines.append("</ul>")
                in_list = False
            lines.append(f"<p>{html.escape(line)}</p>")
    if in_list:
        lines.append("</ul>")
    body = "\n".join(lines)
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>{html.escape(title)}</title>
<style>
body {{ font-family: Arial, sans-serif; margin: 32px; color: #172448; line-height: 1.55; }}
h1 {{ color: #071b4d; }}
h2 {{ margin-top: 24px; color: #073B91; }}
blockquote {{ border-left: 4px solid #f59e0b; background: #fff7ed; padding: 12px 16px; }}
li {{ margin: 6px 0; }}
</style>
</head>
<body>
{body}
</body>
</html>"""
