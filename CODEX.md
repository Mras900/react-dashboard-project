# CODEX.md

## Instrucciones para trabajar con Codex

Este archivo define cómo debe trabajar Codex dentro de este proyecto.

Proyecto:

Dashboard de facturación, reclamos, visitas y comunas desarrollado con:

* React
* TypeScript
* Vite
* Tailwind CSS
* lucide-react
* Leaflet
* react-leaflet

---

## Objetivo

Usar Codex para hacer cambios pequeños, controlados y seguros, evitando gastar tokens de más y evitando que se modifique todo el proyecto sin necesidad.

---

## Modo cavernícola

Codex debe seguir estas reglas simples:

```text
No tocar todo.
No cambiar todo.
No inventar.
No instalar cosas.
No romper.
No refactorizar por gusto.
No modificar archivos no pedidos.
Hacer cambio chico.
Explicar corto.
Probar.
```

---

## Regla de oro

Una tarea = un objetivo = pocos archivos = cambio mínimo.

---

## Cómo debe responder Codex

Para cada tarea, responder con esta estructura:

```text
Problema detectado:
[explicación corta]

Archivos modificados:
[lista de archivos]

Cambio realizado:
[explicación corta]

Cómo probar:
[pasos simples]
```

No entregar explicaciones largas salvo que el usuario lo pida.

---

## Qué NO debe hacer Codex

No debe hacer esto:

* Reescribir todo el proyecto.
* Cambiar arquitectura completa sin autorización.
* Instalar dependencias nuevas sin preguntar.
* Cambiar nombres de columnas.
* Cambiar nombres de campos de datos.
* Cambiar reglas de negocio sin autorización.
* Modificar estilos globales sin necesidad.
* Eliminar componentes existentes sin justificación.
* Mezclar datos mock con lógica de producción.
* Tocar archivos fuera del alcance pedido.
* Hacer refactorizaciones grandes cuando se pidió una corrección pequeña.

---

## Qué SÍ debe hacer Codex

Debe hacer esto:

* Leer primero el archivo relacionado con la tarea.
* Identificar el problema real.
* Proponer cambio mínimo.
* Modificar solo lo necesario.
* Mantener React + TypeScript.
* Mantener Tailwind.
* Mantener diseño responsive.
* Mantener compatibilidad con tema claro y oscuro.
* Mantener Leaflet para mapas.
* Mantener nombres de columnas existentes.
* Indicar cómo probar el cambio.

---

## Flujo recomendado

### Paso 1: Analizar

Antes de modificar, Codex debe analizar el problema.

Prompt recomendado:

```text
Analiza este problema y dime qué archivo debo modificar.
No escribas código todavía.
No modifiques nada.
```

---

### Paso 2: Corregir

Después del análisis, aplicar solo el cambio necesario.

Prompt recomendado:

```text
Corrige solo ese archivo.
No modifiques nada más.
No refactorices.
Haz el cambio mínimo funcional.
```

---

### Paso 3: Probar

Indicar cómo verificar manualmente.

Prompt recomendado:

```text
Indica cómo probar manualmente este cambio.
No agregues nuevas funciones.
```

---

### Paso 4: Mejorar visualmente

Solo cuando ya funcione.

Prompt recomendado:

```text
Ahora mejora solo la visualización.
No cambies la lógica.
No cambies los datos.
```

---

## Prompts rápidos para usar con Codex

### Corregir error visual

```text
Corrige solo el problema visual en el archivo indicado.
No reescribas todo.
No cambies lógica.
No instales librerías.
```

### Corregir cálculo

```text
Corrige solo el cálculo indicado.
No cambies diseño.
No cambies nombres de columnas.
No modifiques otros archivos.
```

### Agregar KPI

```text
Agrega solo el KPI solicitado.
Mantén el diseño actual.
No modifiques la tabla ni el mapa.
No cambies la estructura de datos.
```

### Corregir mapa

```text
Corrige solo el mapa.
Mantén Leaflet.
No cambies los KPIs.
No cambies la tabla.
No instales otra librería de mapas.
```

### Cargar GeoJSON

```text
Agrega carga de GeoJSON solo en el componente de mapa.
Valida errores de carga.
No modifiques otros módulos.
No cambies estilos globales.
```

### Revisar código

```text
Revisa este archivo.
Busca solo errores reales.
Clasifica en bloqueante, importante u opcional.
No escribas código todavía.
```

---

## Reglas para componentes

Los componentes deben ser claros y separados.

Ejemplo recomendado:

```text
Dashboard.tsx       → coordina la vista general
KpiCards.tsx        → muestra indicadores
MapPanel.tsx        → muestra el mapa
ClaimsTable.tsx     → muestra tabla operativa
RightPanel.tsx      → muestra información secundaria
```

No meter todo en un solo archivo si el proyecto crece.

---

## Reglas para utilidades

Los cálculos deben vivir en `utils/`.

Ejemplo:

```text
utils/
├── calculateBilling.ts
├── formatCurrency.ts
└── filters.ts
```

No mezclar cálculos complejos dentro del JSX.

---

## Reglas para tipos

Los tipos deben vivir en `types/`.

Ejemplo:

```ts
export interface VisitRecord {
  id: string;
  fecha: string;
  comuna: string;
  cliente: string;
  estado: string;
  tipoServicio?: string;
  montoFacturado?: number;
}
```

---

## Reglas de facturación

Codex debe respetar esta regla de negocio:

```text
Si las visitas del día son menores a 13:
- Exitosa: 21500
- No exitosa: 10500

Si las visitas del día son mayores o iguales a 13:
- Exitosa: 17500
- No exitosa: 8500
```

La salida debe permitir calcular:

* Visitas totales.
* Visitas exitosas.
* Visitas no exitosas.
* Total facturado.
* Facturación por día.
* Facturación por comuna.
* Facturación por cliente.
* Comparación mensual.

---

## Reglas para mapa

El mapa debe:

* Usar Leaflet o react-leaflet.
* Permitir visualizar comunas.
* Permitir seleccionar comuna.
* Mostrar reclamos por comuna.
* Mostrar facturación por comuna.
* Soportar GeoJSON.
* No romper si una comuna no tiene datos.
* No bloquear el dashboard si falla el GeoJSON.

---

## Reglas para filtros

Los filtros deben permitir, cuando existan datos suficientes:

* Filtrar por cliente.
* Filtrar por comuna.
* Filtrar por mes.
* Filtrar por estado.
* Filtrar por tipo de servicio.
* Filtrar por hora del día, si existe la columna.

No inventar filtros si los datos no tienen esas columnas.

---

## Reglas para accesibilidad

Cuando se modifique UI:

* Mantener contraste suficiente.
* Usar textos legibles.
* Agregar `aria-label` cuando corresponda.
* No depender solo del color para comunicar estados.
* Mantener navegación simple.

---

## Comandos del proyecto

Instalar:

```bash
npm install
```

Desarrollo:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Preview:

```bash
npm run preview
```

---

## Checklist antes de finalizar

Codex debe verificar:

```text
¿Modifiqué solo lo pedido?
¿Evité instalar dependencias?
¿Mantuve TypeScript?
¿Mantuve Tailwind?
¿No rompí mapa, KPIs ni tabla?
¿Expliqué cómo probar?
¿El cambio es mínimo?
```

---

## Frase final esperada

Al terminar, Codex debe cerrar con algo como:

```text
Cambio aplicado de forma mínima. Para probar: ejecutar npm run dev y revisar la vista afectada.
```
