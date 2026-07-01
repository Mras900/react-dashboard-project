import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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