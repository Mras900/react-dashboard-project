# Visor de Facturación y Reclamos

Proyecto base en **React + TypeScript + Vite + Tailwind CSS + lucide-react**.

Incluye:

- Dashboard ejecutivo con layout lateral y panel derecho
- Tema claro / oscuro
- Mapa con Leaflet y react-leaflet
- Tarjetas KPI
- Tabla operativa
- Vista de ajustes
- Estructura lista para conectar datos reales desde API o archivos

## Requisitos

- Node.js 20 o superior
- npm

## Instalación

```bash
npm install
npm run dev
```

## Build de producción

```bash
npm run build
npm run preview
```

## Estructura

```text
react-dashboard-project/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── README.md
└── src/
    ├── App.tsx
    ├── index.css
    ├── main.tsx
    └── components/
        └── Dashboard.tsx
```

## Dependencias usadas

- React
- TypeScript
- Vite
- Tailwind CSS
- lucide-react
- Leaflet
- react-leaflet

## Próximo paso recomendado

Conectar este dashboard a una API o a un parser de Excel para reemplazar los datos mock por datos reales.
