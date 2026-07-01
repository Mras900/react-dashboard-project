import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './index.css';
import './command-center.css';
import App from './App';
import { TooltipProvider } from '@/components/ui/tooltip';
import { applyDashboardTheme, loadStoredTheme } from './lib/theme';

applyDashboardTheme(loadStoredTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </React.StrictMode>,
);
