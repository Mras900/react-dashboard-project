import { useEffect, useState } from 'react';
import type { ChartConfig } from './chart-types';
import { defaultCharts } from './default-charts';

const STORAGE_KEY = 'dashboard-saved-charts';

export function useSavedCharts() {
  const [charts, setCharts] = useState<ChartConfig[]>(() => {
    if (typeof window === 'undefined') return defaultCharts;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) as ChartConfig[] : defaultCharts;
    } catch {
      return defaultCharts;
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
    }
  }, [charts]);

  const addChart = (chart: ChartConfig) => {
    setCharts((current) => [...current, chart]);
  };

  const updateChart = (chart: ChartConfig) => {
    setCharts((current) => current.map((item) => item.id === chart.id ? chart : item));
  };

  const duplicateChart = (id: string) => {
    setCharts((current) => {
      const source = current.find((item) => item.id === id);
      if (!source) return current;

      return [
        ...current,
        {
          ...source,
          id: `${source.id}-copy-${Date.now()}`,
          title: `${source.title} copia`,
        },
      ];
    });
  };

  const removeChart = (id: string) => {
    setCharts((current) => current.filter((item) => item.id !== id));
  };

  return {
    charts,
    setCharts,
    addChart,
    updateChart,
    duplicateChart,
    removeChart,
  };
}
