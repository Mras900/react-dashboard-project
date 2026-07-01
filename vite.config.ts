import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@floating-ui')) return 'vendor-floating';
          if (id.includes('@headlessui')) return 'vendor-headless';
          if (id.includes('@tremor')) return 'vendor-tremor';
          if (id.includes('react-leaflet') || id.includes('leaflet')) return 'vendor-map';
          if (id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react-dom';
          if (id.includes('/node_modules/react/') || id.includes('\\node_modules\\react\\')) return 'vendor-react';
          if (id.includes('@tanstack')) return 'vendor-table';
          if (id.includes('recharts')) return 'vendor-recharts';
          if (id.includes('d3-') || id.includes('victory')) return 'vendor-charts';
          if (id.includes('motion')) return 'vendor-motion';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('radix-ui') || id.includes('@radix-ui') || id.includes('class-variance-authority') || id.includes('tailwind-merge') || id.includes('clsx')) return 'vendor-ui';
          if (id.includes('xlsx')) return 'vendor-xlsx';
          return 'vendor-core';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/crm': {
        target: 'https://my360730.crm.ondemand.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/crm/, ''),
      },
    },
  },
});

