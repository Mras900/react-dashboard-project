import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/crm': {
        target: 'https://my360730.crm.ondemand.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/crm/, ''),
      },
    },
  },
});
