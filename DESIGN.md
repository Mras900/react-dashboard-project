---
name: Visor de Facturación y Reclamos
description: Dashboard operativo de facturación, reclamos, visitas y rutas por comuna con análisis geográfico en tiempo real.
colors:
  primary: "#0f5fcf"
  primary-data: "#0f5fcf"
  secondary-data: "#2f8fe8"
  tertiary-data: "#8cc8f5"
  data-light: "#d8ebfb"
  success: "#10b981"
  success-soft: "#d1fae5"
  success-text: "#065f46"
  warning: "#f59e0b"
  warning-soft: "#fef3c7"
  warning-text: "#92400e"
  danger: "#ef4444"
  danger-soft: "#fee2e2"
  danger-text: "#991b1b"
  neutral-dark: "#1f2937"
  neutral-base: "#6b7280"
  neutral-muted: "#9ca3af"
  neutral-light: "#e5e7eb"
  neutral-surface: "#f9fafb"
  surface: "#ffffff"
  background: "#f4f7fb"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0px"
  metric-lg:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  metric-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0px"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0px"
  body-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0px"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.02em"
  label-caps:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.65rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "18px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "40px"
components:
  app-shell:
    backgroundColor: "{colors.background}"
    textColor: "{colors.neutral-dark}"
    typography: "{typography.body}"
  sidebar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.neutral-base}"
    width: "64px"
  sidebar-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    size: "40px"
  header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.neutral-dark}"
    height: "72px"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.neutral-light}"
    textColor: "{colors.neutral-dark}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.neutral-dark}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  card-muted:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-base}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  input:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-dark}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success-text}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning-text}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger-text}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  map-layer-low:
    backgroundColor: "{colors.data-light}"
    textColor: "{colors.neutral-dark}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  map-layer-mid:
    backgroundColor: "{colors.tertiary-data}"
    textColor: "{colors.neutral-dark}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  chart-series-primary:
    backgroundColor: "{colors.primary-data}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  chart-series-secondary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  muted-label:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.neutral-base}"
    typography: "{typography.label}"
  route-stop-pending:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning-text}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  route-stop-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success-text}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  route-stop-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger-text}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
---

# Design System: The Operations Center

## 1. Overview

**Creative North Star: The Operations Center**

Este dashboard es el centro operativo para visualizar facturación, reclamos, visitas, rutas y análisis geográfico por comuna. La interfaz debe ser clara, sobria, rápida de leer y centrada en datos. Cada elemento debe ayudar a tomar decisiones, no decorar.

## 2. Reglas principales del producto

### Dashboard principal

El dashboard principal debe abrir directamente con:

- Header superior.
- Barra de filtros.
- Selector RM / Regiones.
- KPIs principales.
- Mapa grande como elemento central.
- Cards territoriales.
- Franja KPI horizontal.
- Gráficos inferiores.
- Tabla o evidencia si ya existe en el diseño actual.

El dashboard principal no debe mostrar el constructor de KPI ni la vista de reportes administrativos.

### Configuraciones

La pestaña **Configuraciones** debe centralizar:

- Constructor de KPI.
- Reportes.
- Parámetros futuros de reglas de negocio, exportación, capas y metas.

No mantener **Gráficos** ni **Reportes** como pestañas independientes.

## 3. Layout responsive

### 2xl o mayor

Mostrar:

- Sidebar izquierda.
- Contenido central.
- Panel derecho “Vista previa: Regiones”.

El bloque superior puede usar el patrón:

`KPIs izquierda | Mapa centro | Cards derecha | Panel regiones`

### Menor a 2xl

Ocultar el panel derecho de regiones. Debe abrirse mediante botón o modal si ya existe una vista ampliada.

### Notebook / 1366px

El mapa debe tener prioridad. Si las cards territoriales quedan angostas, deben bajar debajo del mapa en tres columnas.

No forzar cuatro columnas grandes en pantallas de notebook.

### Tablet y móvil

Todo debe pasar a una columna. El mapa debe conservar altura mínima útil.

## 4. Texto y legibilidad

Usar labels cortos:

- “Top reclamos” en vez de “Comuna más reclamada”.
- “Top facturación” en vez de “Top comuna por facturación”.
- “Cobertura” en vez de “Cobertura comunas”.

No truncar nombres importantes como **Puente Alto**. Es preferible permitir dos líneas antes que mostrar textos cortados como `Puen...`.

Si una card es angosta, el badge debe bajar debajo del valor y no competir horizontalmente.

No usar `font-black` en todo. Reservar peso fuerte para valores principales.

## 5. Colors

Azul se usa para datos, acciones principales y estados activos. Verde para éxito/completado. Ámbar para atención o pendiente. Rojo para error, alerta o prioridad alta. Los neutros sostienen la interfaz sin competir con los datos.

Regla de rareza: el color primario debe aparecer poco y con intención. No saturar toda la pantalla de azul.

## 6. Components

### Sidebar

Debe ser blanca, compacta y fija. Navegación esperada:

- Dashboard.
- Configuraciones.
- Ruta visitador.
- Alertas.
- Mapa.
- Ayuda abajo.

### Header

Debe mostrar título, subtítulo, botones de descarga, campana y avatar. Fondo blanco, bordes suaves y altura estable.

### Cards

Cards blancas, bordes sutiles, padding consistente y sombras mínimas. No crear nested cards innecesarias.

### Map card

El mapa debe ser dominante. Debe tener título, subtítulo, leyenda de capas y controles visibles. No reducir demasiado el mapa para acomodar paneles secundarios.

## 7. Ruta visitador

La vista **Ruta visitador** debe funcionar como un centro operativo diario para planificar visitas, consultar reclamos y controlar la valorización del día.

Debe priorizar:

- Login CRM seguro sin credenciales hardcodeadas.
- Consulta por ticket.
- Consulta por RUT.
- Carga masiva de tickets.
- Mapa de paradas.
- Zonas rojas.
- Optimización de ruta.
- Estados de visita: pendiente, exitosa y no exitosa.
- Valorización por tramo.
- Exportación CSV.

### Layout esperado

La vista debe organizarse así:

- Sidebar izquierda para búsqueda, carga, punto de inicio y acciones.
- Área central con KPIs y mapa dominante.
- Panel o tabla inferior con paradas, observaciones y valorización.

### Reglas visuales

- Pendiente usa ámbar.
- Exitosa usa verde.
- No exitosa usa rojo.
- Zona roja usa badge rojo.
- Sin coordenadas usa estado gris o advertencia.
- El mapa debe mantener altura mínima de 360px.
- En notebook, la lista de paradas debe bajar bajo el mapa si no hay ancho suficiente.
- En móvil, todo debe pasar a una columna.
- No truncar nombres de clientes, comunas o direcciones críticas si son datos principales.
- Los botones de acción deben ser claros: buscar, cargar, optimizar, exportar y cerrar sesión.

### Seguridad CRM

- No guardar usuario ni contraseña en código.
- No usar credenciales dentro de `vite.config.ts`.
- No usar `localStorage` para credenciales.
- Usar `sessionStorage` solo para sesión temporal.
- No imprimir credenciales en consola.
- El login debe mostrar error claro cuando el CRM responda 401, 403 o error de conexión.

## 8. Codex contract

Cuando Codex modifique componentes visuales debe:

1. Leer este archivo antes de editar.
2. Mantener la lógica de negocio existente.
3. No instalar librerías nuevas.
4. No romper Leaflet ni react-leaflet.
5. No romper reportes ni KPIs personalizados.
6. No mover cálculos de negocio salvo que sea necesario para tipado.
7. Corregir responsive y textos cortados.
8. No dejar credenciales hardcodeadas.
9. Ejecutar o indicar `npm run dev` y `npm run build`.
