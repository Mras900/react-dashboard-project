import { DEFAULT_DESIGN_PRESET } from './defaultDesignPreset';
import {
  DESIGN_CONFIG_VERSION,
  DESIGN_STORAGE_KEY,
  type DesignConfig,
  type DesignTokens,
  type DesignWidgetConfig,
  type DesignWidgetId,
} from './designTypes';
import { isDesignColorOption, isDesignRadiusOption, isDesignSpacingMode } from './safeOptions';

const widgetIds = new Set<DesignWidgetId>(DEFAULT_DESIGN_PRESET.widgets.map((widget) => widget.id));
const maxTextLength = 90;

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > 0 && text.length <= maxTextLength ? text : fallback;
}

function validateTokens(value: unknown): DesignTokens | null {
  if (!value || typeof value !== 'object') return null;
  const tokens = value as Record<string, unknown>;

  if (
    !isDesignColorOption(tokens.primaryColor) ||
    !isDesignColorOption(tokens.backgroundColor) ||
    !isDesignColorOption(tokens.cardColor) ||
    !isDesignColorOption(tokens.textColor) ||
    !isDesignRadiusOption(tokens.borderRadius) ||
    !isDesignSpacingMode(tokens.spacingMode)
  ) {
    return null;
  }

  return {
    primaryColor: tokens.primaryColor,
    backgroundColor: tokens.backgroundColor,
    cardColor: tokens.cardColor,
    textColor: tokens.textColor,
    borderRadius: tokens.borderRadius,
    spacingMode: tokens.spacingMode,
  };
}

function validateWidgets(value: unknown): DesignWidgetConfig[] | null {
  if (!Array.isArray(value)) return null;
  const byId = new Map<DesignWidgetId, DesignWidgetConfig>();

  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const widget = item as Record<string, unknown>;
    if (typeof widget.id !== 'string' || !widgetIds.has(widget.id as DesignWidgetId)) return null;
    if (typeof widget.visible !== 'boolean') return null;

    const fallback = DEFAULT_DESIGN_PRESET.widgets.find((presetWidget) => presetWidget.id === widget.id)?.label ?? widget.id;
    byId.set(widget.id as DesignWidgetId, {
      id: widget.id as DesignWidgetId,
      label: cleanText(widget.label, fallback),
      visible: widget.visible,
    });
  }

  return DEFAULT_DESIGN_PRESET.widgets.map((widget) => byId.get(widget.id) ?? { ...widget });
}

export function normalizeDesignConfig(value: unknown): DesignConfig | null {
  if (!value || typeof value !== 'object') return null;
  const config = value as Record<string, unknown>;
  if (config.version !== DESIGN_CONFIG_VERSION) return null;
  if (!config.texts || typeof config.texts !== 'object') return null;

  const texts = config.texts as Record<string, unknown>;
  const tokens = validateTokens(config.tokens);
  const widgets = validateWidgets(config.widgets);
  if (!tokens || !widgets) return null;

  return {
    version: DESIGN_CONFIG_VERSION,
    texts: {
      dashboardTitle: cleanText(texts.dashboardTitle, DEFAULT_DESIGN_PRESET.texts.dashboardTitle),
      dashboardSubtitle: cleanText(texts.dashboardSubtitle, DEFAULT_DESIGN_PRESET.texts.dashboardSubtitle),
    },
    tokens,
    widgets,
  };
}

export function createDefaultDesignConfig(): DesignConfig {
  return {
    version: DESIGN_CONFIG_VERSION,
    texts: { ...DEFAULT_DESIGN_PRESET.texts },
    tokens: { ...DEFAULT_DESIGN_PRESET.tokens },
    widgets: DEFAULT_DESIGN_PRESET.widgets.map((widget) => ({ ...widget })),
  };
}

export function loadDesignConfig(): DesignConfig | null {
  if (typeof window === 'undefined') return null;

  const stored = window.localStorage.getItem(DESIGN_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as unknown;
    const config = normalizeDesignConfig(parsed);
    if (!config) {
      window.localStorage.removeItem(DESIGN_STORAGE_KEY);
      return null;
    }

    return config;
  } catch {
    window.localStorage.removeItem(DESIGN_STORAGE_KEY);
    return null;
  }
}

export function saveDesignConfig(config: DesignConfig) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeDesignConfig(config);
  if (!normalized) return;
  window.localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(normalized));
}

export function clearDesignConfig() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DESIGN_STORAGE_KEY);
}
