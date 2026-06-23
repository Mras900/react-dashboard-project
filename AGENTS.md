# AGENTS.md

## Prioridad obligatoria de skills

Para tareas de diseno visual, UI, UX, dashboard, cards, tipografia, colores, responsive, menu lateral, tablas, botones, formularios, estados visuales, dark mode o apariencia profesional, la skill principal debe ser **ui-ux-pro-max**.

- **ui-ux-pro-max** → UI, UX, diseno visual, layout, responsive, cards, tablas, dashboard, sidebar.
- **impeccable** → solo como apoyo secundario de consistencia visual.

Si Codex no puede usar ui-ux-pro-max, debe detenerse y avisar antes de modificar archivos.

## Reglas para mejoras visuales

- Usar ui-ux-pro-max como guia principal.
- No crear parametrizacion si el usuario no la pidio.
- No crear drag and drop si el usuario no lo pidio.
- No tocar backend.
- No tocar DB.
- No tocar Docker.
- No tocar Cloudflare.
- No tocar login/auth.
- No tocar parsers.
- No tocar normalizadores.
- No cambiar calculos.
- No cambiar tarifas.
- No cambiar autosave.
- No cambiar fuentes de datos.
- No mezclar RM con Regiones.
- No mezclar Ruta con RM/Regiones.
- No exponer API keys.
- No instalar dependencias.
- No usar eval.
- No reescribir componentes completos si basta con clases CSS.
- Ejecutar npm run build al finalizar una tarea visual.

## Objetivo visual del proyecto

El dashboard debe verse como una aplicacion SaaS profesional, sobria, ejecutiva y centrada en datos.

Priorizar:

- Data-first, sin decoracion innecesaria.
- Cards limpias.
- Buena jerarquia visual.
- Tipografia clara.
- No abusar de font-black.
- Tamanos consistentes.
- Colores usados con intencion.
- Azul solo para acciones/datos relevantes.
- Verde para exito.
- Ambar para pendiente/precaucion.
- Rojo para error/alerta.
- Neutros para estructura.
- Menu lateral elegante.
- Tablas/listas legibles.
- Estados loading, empty, error y sin datos.
- Responsive movil/tablet.
- Compatibilidad con tema claro y dark-premium.

## Frase obligatoria antes de modificar UI

Antes de modificar una tarea visual, Codex debe confirmar:

"Voy a usar ui-ux-pro-max como skill principal. Impeccable queda solo como apoyo secundario. Hare cambios visuales minimos sin tocar logica de negocio."

## Proyecto

Este proyecto es un dashboard de facturación, reclamos, visitas y comunas.

Stack principal:

* React
* TypeScript
* Vite
* Tailwind CSS
* lucide-react
* Leaflet
* react-leaflet

Objetivo del sistema:

Construir un visor ejecutivo y operativo para analizar facturación, reclamos, visitas, estados, comunas, mapas y métricas de gestión.

---

## Regla principal

Trabajar siempre con cambios pequeños, seguros y específicos.

No reescribir todo el proyecto si el usuario pidió corregir una parte.

---

## Modo cavernícola

* No tocar todo.
* No inventar estructura nueva sin necesidad.
* No instalar librerías sin autorización.
* No cambiar nombres de columnas.
* No romper el dashboard.
* No mover archivos si no es necesario.
* No refactorizar por gusto.
* No modificar lógica no relacionada.
* Si la funcion ya esta operativa y el usuario pide mejora visual, priorizar UI/UX profesional sin tocar logica.

---

## Forma correcta de trabajar

Antes de modificar código:

1. Identificar el problema.
2. Indicar qué archivo necesita cambios.
3. Proponer el cambio mínimo.
4. Modificar solo lo necesario.
5. Explicar cómo probar.

---

## Archivos principales

Estructura base actual:

```text
src/
├── App.tsx
├── main.tsx
├── index.css
└── components/
    └── Dashboard.tsx
```

Estructura recomendada a futuro:

```text
src/
├── components/
│   ├── dashboard/
│   ├── map/
│   └── layout/
├── data/
├── types/
├── utils/
└── services/
```

No crear esta estructura completa de una sola vez, salvo que el usuario lo pida.

---

## Reglas de código

Usar TypeScript correctamente.

Evitar `any` salvo que sea estrictamente necesario.

Mantener componentes pequeños y claros.

Separar responsabilidades:

* Componentes: visualización.
* Utils: cálculos.
* Services: conexión con API o datos externos.
* Data: datos mock o archivos temporales.
* Types: interfaces y tipos.

---

## Reglas de diseño

Mantener Tailwind CSS.

Mantener diseño responsive.

Mantener compatibilidad con tema claro y oscuro.

No eliminar estilos existentes sin justificación.

Usar clases simples y legibles.

Evitar diseños sobrecargados.

---

## Reglas para datos

No cambiar nombres de columnas sin autorización.

No inventar datos reales.

No mezclar datos mock con lógica visual.

Cuando se usen datos mock, dejarlos claramente identificados.

Validar:

* Fechas vacías.
* Montos inválidos.
* Comunas mal escritas.
* Estados inconsistentes.
* Reclamos duplicados.
* Visitas sin estado.

---

## Reglas de facturación

Si existe lógica de facturación, debe estar separada de la visualización.

Regla de negocio base:

* Si las visitas diarias son menores a 13:

  * Visita exitosa: 21500
  * Visita no exitosa: 10500

* Si las visitas diarias son mayores o iguales a 13:

  * Visita exitosa: 17500
  * Visita no exitosa: 8500

La lógica debe permitir obtener:

* Cantidad de visitas por tramo.
* Cantidad de visitas exitosas.
* Cantidad de visitas no exitosas.
* Total facturado.
* Facturación por comuna.
* Facturación por cliente.
* Facturación mensual.

---

## Reglas para mapas

El mapa debe usar Leaflet o react-leaflet.

No reemplazar Leaflet por otra librería sin autorización.

Cuando se use GeoJSON:

* Validar que el archivo cargue correctamente.
* Validar propiedades de comuna.
* Permitir seleccionar comuna.
* Mostrar reclamos y facturación asociados.
* Evitar que el mapa rompa si falta información.

---

## Reglas para cambios

Cuando se solicite una corrección:

* Modificar solo los archivos necesarios.
* No hacer mejoras opcionales.
* No cambiar arquitectura completa.
* No instalar dependencias nuevas.
* No reescribir componentes completos si basta con corregir una función.
* Mantener nombres existentes si funcionan.

---

## Reglas para respuestas

Responder siempre en español.

Ser directo y práctico.

Cuando se entregue código:

1. Explicar brevemente el problema.
2. Indicar archivo modificado.
3. Entregar código o parche.
4. Indicar cómo probar.

No entregar explicaciones largas si el usuario pidió una corrección puntual.

---

## Comandos útiles

Instalar dependencias:

```bash
npm install
```

Ejecutar desarrollo:

```bash
npm run dev
```

Compilar producción:

```bash
npm run build
```

Previsualizar producción:

```bash
npm run preview
```

---

## Antes de terminar una tarea

Verificar:

* El proyecto compila.
* No hay errores TypeScript evidentes.
* El cambio no rompe el diseño.
* El cambio no afecta lógica no relacionada.
* Se explicó cómo probar manualmente.
