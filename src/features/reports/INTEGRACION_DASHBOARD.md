# Cómo integrar ReportsView en Dashboard.tsx

## 1. Instalar Recharts

```bash
npm install recharts
```

## 2. Importar ReportsView

En tu `Dashboard.tsx`:

```tsx
import { ReportsView } from '../features/reports/ReportsView';
```

## 3. Crear filas para reportes

Cerca de tus `useMemo`:

```tsx
const reportRows = useMemo(
  () =>
    tableRows.map((item) => ({
      comuna: item.comuna,
      region: 'Región Metropolitana',
      mes: sourceSummary.periodLabel,
      prioridad: 'Total',
      visitas: item.visitas,
      ticketsUnicos: item.ticketsUnicos,
      facturacion: item.facturacion,
      alta: item.alta,
      media: item.media,
      baja: item.baja,
      reiteradas: item.reiteradas,
      average: item.average,
      share: item.share,
    })),
  [tableRows],
);
```

## 4. Reemplazar módulo reports

Busca tu condición:

```tsx
activeTab === 'charts'
```

o donde tengas:

```tsx
activeTab === 'reports'
```

Y agrega:

```tsx
) : activeTab === 'reports' ? (
  <ReportsView rmRows={reportRows} />
) : activeTab === 'charts' ? (
```

## 5. Resultado

La vista Reportes tendrá:
- constructor de gráficos
- vista previa
- biblioteca de gráficos guardados
- persistencia con localStorage
