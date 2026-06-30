# Auditoria tema claro/oscuro

## 1. Implementacion actual del tema

No existe `tailwind.config.*` en el repo. El modo oscuro de Tailwind se define desde CSS con `@custom-variant`:

```txt
src/index.css:2:@custom-variant dark (&:where(.dark, .dark *, [data-theme="dark-premium"], [data-theme="dark-premium"] *));
```

`index.html` no trae clase ni atributo de tema en `html` o `body`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Visor de Facturacion y Reclamos</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Los CSS globales cargados son:

```txt
src/main.tsx:3:import 'leaflet/dist/leaflet.css';
src/main.tsx:6:import './index.css';
src/main.tsx:7:import './command-center.css';
```

El tema principal del dashboard vive en `src/components/Dashboard.tsx`:

```txt
src\components\Dashboard.tsx:83:type DashboardTheme = 'default' | 'dark-premium';
src\components\Dashboard.tsx:163:const THEME_STORAGE_KEY = 'dashboard-theme';
src\components\Dashboard.tsx:2094:    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
src\components\Dashboard.tsx:2095:    return storedTheme === 'dark-premium' ? 'dark-premium' : 'default';
src\components\Dashboard.tsx:2252:    const isDarkPremium = dashboardTheme === 'dark-premium';
src\components\Dashboard.tsx:2254:    root.dataset.theme = dashboardTheme;
src\components\Dashboard.tsx:2255:    root.classList.toggle('dark', isDarkPremium);
src\components\Dashboard.tsx:2256:    window.localStorage.setItem(THEME_STORAGE_KEY, dashboardTheme);
```

Login usa misma clave, pero solo aplica `data-theme`, no clase `dark`:

```txt
src\features\auth\TailAdminLogin.tsx:5:const THEME_KEY = 'dashboard-theme';
src\features\auth\TailAdminLogin.tsx:16:    localStorage.getItem(THEME_KEY) === 'default' ? 'default' : 'dark-premium',
src\features\auth\TailAdminLogin.tsx:20:    document.documentElement.dataset.theme = theme;
src\features\auth\TailAdminLogin.tsx:21:    localStorage.setItem(THEME_KEY, theme);
```

Hay un shell TailAdmin separado con otro storage key y otro modelo (`light` / `dark`), sin aplicar tema global:

```txt
src\features\layout\TailAdminDashboardShell.tsx:28:const THEME_KEY = 'tailadmin-dashboard-shell-theme';
src\features\layout\TailAdminDashboardShell.tsx:45:    localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark',
src\features\layout\TailAdminDashboardShell.tsx:49:    localStorage.setItem(THEME_KEY, theme);
```

`src/index.css` define variables base para claro y oscuro:

```txt
:root {
  color-scheme: light;
  --bg-main: #f4f7fb;
  --bg-card: #ffffff;
  --border-main: #e2e8f0;
  --text-main: #071b4d;
  --cc-bg: #f8fafc;
  --cc-surface: #ffffff;
  --cc-border: #e2e8f0;
  --cc-text: #0f172a;
  --cc-muted: #64748b;
}

.dark,
[data-theme="dark-premium"] {
  color-scheme: dark;
  --bg-main: #0d1117;
  --bg-card: #111827;
  --border-main: #1f2937;
  --text-main: #eaf0f8;
  --cc-bg: #070b14;
  --cc-surface: #0b1020;
  --cc-border: #22304d;
  --cc-text: #e5edf8;
  --cc-muted: #94a3b8;
}
```

`src/command-center.css` tambien aplica muchas reglas por `[data-theme="dark-premium"]`, especialmente a `.cc-*`, mapas, tablas, ruta, importador y dashboard. Esto crea un segundo sistema global encima de Tailwind.

## 2. Componentes y respuesta al tema

| Componente / bloque | Archivo principal | Responde al tema |
|---|---|---|
| Sidebar principal | `src/components/Dashboard.tsx`, `src/features/layout/TailAdminSidePanel.tsx` | Parcial. Sidebar nuevo usa `dark:`, pero TailAdminSidePanel aun tiene colores oscuros fijos. |
| Header / topbar | `src/features/layout/TailAdminTopbar.tsx` | Parcial. Recibe `isDarkPremium`, pero clases visuales son oscuras fijas. |
| Filtros / Dashboard territorial | `src/components/Dashboard.tsx`, `src/command-center.css` | Parcial. Hay clases claras/oscuras y CSS global, pero tambien overrides inline y `.cc-filter`. |
| Cards KPI | `src/features/ui-tailadmin/TailAdminKpiCard.tsx`, `src/components/Dashboard.tsx` | No completo. Varias cards fuerzan `bg-[#111827]`, `text-[#EAF0F8]`, `border-white/[0.08]`. |
| Mapa de reclamos | `src/components/Dashboard.tsx`, `src/command-center.css` | Parcial. Leaflet tiene piel oscura via CSS, pero controles/leyendas mezclan `bg-white` y overrides. |
| Resumen operativo | `src/components/Dashboard.tsx`, `src/features/layout/TailAdminRightPanel.tsx` | Parcial. Usa `cc-*` y parte de TailAdmin conserva tokens fijos. |
| Graficos | `src/components/charts/widgets/*`, `src/features/design-center/ConfigurableChartCard.tsx` | Parcial. Widgets principales usan variables; `ConfigurableChartCard` aun hardcodea tooltip/grid. |
| Tabla evidencia por comuna | `src/components/Dashboard.tsx`, `src/index.css`, `src/command-center.css` | Parcial. CSS global corrige algo, pero JSX conserva `bg-white`, `text-[#172448]`, `bg-slate-50`. |
| Ruta Visitador | `src/features/ruta/RutaVisitadorView.tsx` | Parcial. Inputs/cards base responden; paneles de zonas rojas/mapa fuerzan slate oscuro. |
| Asistente IA | `src/features/ai/AiAssistantPanel.tsx`, `src/components/Dashboard.tsx` | Parcial/no auditado a fondo. Hereda entorno, pero puede ser afectado por portales/modales y `.cc-*`. |
| Reportes | `src/features/reports/ReportsView.tsx` | Parcial. Tiene CSS scoped para claro/oscuro, pero JSX conserva cards `bg-slate-950/60`. |
| Facturacion | `src/components/Dashboard.tsx` | Parcial. Tiene hotfix scoped, pero tabla/acciones aun declaran clases oscuras. |
| Configuraciones | `src/components/Dashboard.tsx` | Parcial. Tiene hotfix scoped, pero subcards conservan clases oscuras. |

## 3. Patrones problematicos encontrados

### Patron A: color hardcodeado sin variante `dark:`

Ejemplos:

```txt
src\features\layout\TailAdminTopbar.tsx:56:... border-white/[0.08] bg-white/[0.04] ... text-[#EAF0F8] ...
src\features\layout\TailAdminTopbar.tsx:68:... border-white/[0.08] bg-white/[0.04] ... text-[#EAF0F8] ...
src\features\layout\TailAdminSidePanel.tsx:39:... border-white/[0.08] bg-white/[0.04] text-[#7A90A8] ...
src\features\ui-tailadmin\TailAdminKpiCard.tsx:45:    icon: 'bg-white/[0.04] text-[#EAF0F8] border-white/[0.08]',
src\components\Dashboard.tsx:535:... bg-slate-950 ... text-white ...
src\features\ruta\RutaVisitadorView.tsx:1433:... border-slate-700 bg-slate-950/80 ...
src\features\reports\ReportsView.tsx:187:... border-slate-700 bg-slate-950/70 ... text-slate-100 ...
```

Impacto: bloques quedan oscuros incluso en tema claro.

### Patron B: clase `dark:` depende de root correcto

Hoy `Dashboard.tsx` si alterna `.dark` en `document.documentElement`, pero `TailAdminLogin.tsx` solo aplica `data-theme`. Como `@custom-variant` tambien reconoce `[data-theme="dark-premium"]`, muchas clases funcionan igual; aun asi hay dos mecanismos y riesgo de desincronizacion al cargar, salir de login o usar shells alternos.

```txt
src\components\Dashboard.tsx:2254:    root.dataset.theme = dashboardTheme;
src\components\Dashboard.tsx:2255:    root.classList.toggle('dark', isDarkPremium);
src\features\auth\TailAdminLogin.tsx:20:    document.documentElement.dataset.theme = theme;
```

### Patron C: estilos inline fijos

Ejemplos:

```txt
src\components\Dashboard.tsx:1345:          background: #ffffff;
src\components\Dashboard.tsx:1351:          background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(11, 18, 32, 0.98));
src\components\Dashboard.tsx:3447:          background: #ffffff !important;
src\components\Dashboard.tsx:3453:          background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(13, 19, 36, 0.98)) !important;
src\features\ruta\RutaVisitadorView.tsx:615:          `<button id="${buttonId}" style="margin-top:8px;background:#0f5fcf;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;">Convertir a zona activa</button>`,
```

Impacto: Tailwind no puede ajustar estos colores; solo CSS posterior con `!important` puede ganar.

### Patron D: variables CSS + overrides superpuestos

Hay variables correctas en `index.css`, pero tambien reglas globales que fuerzan clases por substring:

```txt
src\index.css:111:[data-theme="dark-premium"] .bg-white,
src\index.css:112:[data-theme="dark-premium"] [class*="bg-white"],
src\index.css:128:[data-theme="dark-premium"] header,
src\index.css:129:[data-theme="dark-premium"] section[class*="bg-white"],
src\index.css:216:[data-theme="dark-premium"] input,
src\index.css:230:[data-theme="dark-premium"] table thead {
```

Y `command-center.css` agrega otro paquete de overrides:

```txt
src\command-center.css:4190:[data-theme="dark-premium"] .cc-main,
src\command-center.css:4191:[data-theme="dark-premium"] .cc-page {
src\command-center.css:4215:[data-theme="dark-premium"] .cc-map-panel,
src\command-center.css:4216:[data-theme="dark-premium"] .cc-chart-card,
src\command-center.css:4277:[data-theme="dark-premium"] table {
src\command-center.css:4319:[data-theme="dark-premium"] .cc-kpi-card-pro,
```

Impacto: dificil predecir ganador entre JSX, `index.css`, `command-center.css` e inline `<style>`.

### Patron E: librerias externas con tema propio

Recharts y Leaflet estan en uso:

```txt
package.json:20:    "react-leaflet": "latest",
package.json:21:    "recharts": "^3.8.1",
src\main.tsx:3:import 'leaflet/dist/leaflet.css';
src\components\Dashboard.tsx:32:import { GeoJSON, LayersControl, MapContainer, TileLayer, useMap, ZoomControl } from 'react-leaflet';
src\components\charts\widgets\BarChartWidget.tsx:3:  BarChart,
src\components\charts\widgets\LineChartWidget.tsx:3:  AreaChart,
src\features\design-center\ConfigurableChartCard.tsx:2:import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
```

Widgets principales de charts usan variables:

```txt
src\components\charts\widgets\BarChartWidget.tsx:26:          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
src\components\charts\widgets\BarChartWidget.tsx:30:          <Bar dataKey="value" fill="var(--chart-primary)" radius={[0, 6, 6, 0]} />
src\components\charts\widgets\LineChartWidget.tsx:30:          <Area type="monotone" dataKey="value" fill="var(--chart-primary-soft)" stroke="var(--chart-primary)" />
```

Pero `ConfigurableChartCard` aun hardcodea estilos claros:

```txt
src\features\design-center\ConfigurableChartCard.tsx:29:    const tooltipStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' };
src\features\design-center\ConfigurableChartCard.tsx:39:            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
src\features\design-center\ConfigurableChartCard.tsx:53:            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
```

## 4. Resultado de greps

Comando usado para top 10:

```powershell
$patterns = 'bg-(gray|slate|zinc|neutral|stone)-[789]|bg-white|bg-gray-[123]|text-gray-9|style=\{\{.*(color|background|bg)'
$matches = rg -n $patterns src --glob '*.tsx' --glob '*.jsx' 2>$null
$matches | ForEach-Object { ($_ -split ':')[0] } | Group-Object | Sort-Object Count -Descending | Select-Object -First 10 Count,Name
```

Salida:

```txt
Count Name
----- ----
   55 src\components\Dashboard.tsx
   31 src\features\ruta\RutaVisitadorView.tsx
   17 src\components\charts\Dashboard.tsx
   14 src\features\reports\ReportsView.tsx
   10 src\features\ruta\ArqueoRutaView.tsx
   10 src\features\design-center\DesignCenterView.tsx
    7 src\features\layout\DashboardLayoutGrid.tsx
    6 src\features\users\UserFormModal.tsx
    6 src\features\design-center\CardSettings.tsx
    6 src\features\mapa\MapView.tsx
```

Salida representativa de colores hardcodeados en archivos criticos:

```txt
src\components\Dashboard.tsx:507:  return <section className={`cc-card rounded-lg border border-slate-200 bg-white ${className}`}>{children}</section>;
src\components\Dashboard.tsx:832:        <div className="cc-donut-center absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
src\components\Dashboard.tsx:1106:                className="h-12 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-[#071b4d] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
src\components\Dashboard.tsx:1406:            <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-4 text-sm font-black text-slate-100 disabled:cursor-not-allowed disabled:opacity-55" disabled title="Correccion persistente pendiente de endpoint seguro" type="button"><Download size={16} /> Exportar revision</button>
src\components\Dashboard.tsx:1461:                <thead className="bg-slate-950/80 text-[11px] uppercase text-slate-400">
src\components\Dashboard.tsx:1730:            <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
src\components\Dashboard.tsx:3039:        <Panel className="cc-map-panel flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
src\components\Dashboard.tsx:3571:      <aside className="cc-sidebar no-print fixed inset-y-0 left-0 z-30 flex w-16 flex-col items-center border-r border-slate-200 bg-white py-4 dark:border-[#22304D] dark:bg-[#0B1020]">
src\features\ruta\RutaVisitadorView.tsx:1433:              <label className="mt-4 flex h-12 items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/80 px-4">
src\features\ruta\RutaVisitadorView.tsx:1543:              <div className="absolute left-4 right-4 top-16 z-[500] max-h-[70%] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/95 shadow-xl md:left-auto md:right-4 md:w-[320px] md:max-h-[85%]">
src\features\ruta\RutaVisitadorView.tsx:1575:                        className={`w-full rounded-lg border px-3 py-2 text-left transition ${selectedRedZoneId === zone.id ? 'border-red-400 bg-red-950/60' : 'border-slate-800 bg-slate-900/80 hover:bg-slate-900'}`}
src\features\reports\ReportsView.tsx:187:            <a className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-4 text-sm font-black text-slate-100" href="#informe-ejecutivo">
src\features\reports\ReportsView.tsx:243:            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
src\features\reports\ReportsView.tsx:329:                <article key={chart.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
src\features\ui-tailadmin\TailAdminKpiCard.tsx:45:    icon: 'bg-white/[0.04] text-[#EAF0F8] border-white/[0.08]',
src\features\layout\TailAdminTopbar.tsx:56:          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-black text-[#EAF0F8] shadow-sm transition hover:border-[#1B4FD8]/60 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50 2xl:px-4"
```

## 5. Estado de librerias externas

- Recharts: en uso. Widgets `BarChartWidget`, `LineChartWidget`, `PieChartWidget`, `DonutChartWidget` ya usan variables CSS para grilla, tooltip y colores principales. `ConfigurableChartCard` no; usa `#fff` y `#e2e8f0`.
- Leaflet / React-Leaflet: en uso. `leaflet.css` importado globalmente. Hay skins oscuros en `index.css` y `command-center.css` bajo `[data-theme="dark-premium"]`. La logica de mapa no parece involucrada; problema es visual de controles/leyendas/overlays.
- ApexCharts / Chart.js: no detectados en `package.json` ni en imports relevantes.

## 6. Bug principal

Root cause: hay mezcla de tres mecanismos de tema (`data-theme`, clase `.dark` y CSS `cc-*`) junto con componentes que fuerzan colores oscuros/claros, por eso el toggle cambia solo parte de la UI y otras superficies quedan congeladas.

Detalles:

1. El dashboard actual si aplica `.dark` y `data-theme` a `document.documentElement`, pero Login y TailAdmin shell tienen caminos separados.
2. Muchos componentes no dependen del root; declaran colores fijos en JSX o `<style>`.
3. `index.css` y `command-center.css` tienen overrides globales por substring (`[class*="bg-white"]`) que pueden tapar clases locales.
4. Recharts/Leaflet requieren colores por props/CSS propio; no heredan Tailwind automaticamente.
5. El primer render puede depender de cuando React monta `Dashboard.tsx`; antes de eso solo `index.html` no trae tema inicial.

## 7. Plan de correccion recomendado

1. [CRITICO] Centralizar aplicacion de tema en un helper o efecto unico que siempre sincronice `data-theme`, clase `.dark`, `color-scheme` y `localStorage('dashboard-theme')` en `document.documentElement`.
2. [CRITICO] Aplicar ese sync antes o durante el primer render de App/Dashboard para evitar estado inicial inconsistente. Mantener `dark-premium` como valor interno.
3. [ALTO] Migrar componentes TailAdmin fijos (`TailAdminTopbar`, `TailAdminSidePanel`, `TailAdminKpiCard`, `TailAdminRightPanel`) a clases claro/oscuro o variables `--cc-*`.
4. [ALTO] Reducir overrides globales agresivos en `index.css` y `command-center.css`; preferir variables en `.cc-*` en vez de `[class*="bg-white"]`.
5. [ALTO] Limpiar `Dashboard.tsx`, `RutaVisitadorView.tsx` y `ReportsView.tsx` donde hay `bg-slate-950/*`, `text-slate-100`, `border-slate-800` usados como superficie general.
6. [MEDIO] Pasar `ConfigurableChartCard` a variables CSS para tooltip, grilla, ejes y texto.
7. [MEDIO] Revisar overlays Leaflet/leyendas, no la logica de mapas: controles, popups, legends y paneles flotantes.
8. [BAJO] Agregar QA visual manual claro/oscuro por pestaña y posible smoke con screenshot si se habilita navegador.

## 8. Archivos a modificar en fase de fix

- `src/components/Dashboard.tsx`: mantener estado actual, pero limpiar superficies hardcodeadas e inline `<style>` scoped de Dashboard/Facturacion/Configuraciones.
- `src/index.css`: consolidar variables claro/oscuro y limitar overrides globales por substring.
- `src/command-center.css`: mover `.cc-*` a variables y eliminar duplicados oscuros que pisan claro.
- `src/features/layout/TailAdminTopbar.tsx`: reemplazar `bg-white/[0.04]`, `text-[#EAF0F8]`, `border-white/[0.08]` por clases claro/oscuro o variables.
- `src/features/layout/TailAdminSidePanel.tsx`: mismo ajuste visual.
- `src/features/ui-tailadmin/TailAdminKpiCard.tsx`: convertir card base y tonos a tema reactivo.
- `src/features/layout/TailAdminRightPanel.tsx`: revisar `cc-*`/colores fijos del resumen lateral.
- `src/features/ruta/RutaVisitadorView.tsx`: corregir paneles flotantes de mapa/zona roja y tablas visuales; no tocar busqueda, optimizacion ni capas.
- `src/features/reports/ReportsView.tsx`: corregir cards/report library oscuras fijas; no tocar endpoints IA ni generadores.
- `src/features/design-center/ConfigurableChartCard.tsx`: usar variables CSS en Recharts.

Observado pero no recomendado tocar en fix actual si se mantiene alcance estricto:

- `src/features/auth/TailAdminLogin.tsx`: usa `data-theme` sin `.dark`. Como auth/login esta fuera de alcance, dejar para fase separada o solo tocar si se autoriza sync comun.

## 9. Archivos a no tocar

- Backend completo.
- Base de datos y modelos.
- Endpoints API.
- Importador Excel/CSV.
- Normalizadores.
- Logica RM/Regiones.
- Servicios de ruta.
- Logica de mapas/capas Leaflet.
- Logica IA y payloads.
- Auth/login, salvo autorizacion explicita para sincronizar clase root.

## 10. Riesgo estimado

Riesgo medio. El fix debe ser visual, pero hay muchas reglas globales con `!important` y selectores amplios; cambiar una puede mejorar tema claro y degradar oscuro si no se valida por pestaña. Recomendado: cambios chicos por archivo, build + TypeScript + revision visual claro/oscuro en Dashboard, Ruta diaria, Reportes, Facturacion y Configuraciones.
