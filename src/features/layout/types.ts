import type { ReactNode } from 'react';

export type DashboardWidgetId = string;

export type GridLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
};

export type GridLayouts = Record<string, GridLayoutItem[]>;

export type DashboardWidget = {
  id: DashboardWidgetId;
  title: string;
  visible: boolean;
  content: ReactNode;
};

export type StoredDashboardLayout = {
  layouts: GridLayouts;
  hiddenWidgetIds: DashboardWidgetId[];
};
