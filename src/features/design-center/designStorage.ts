import { DEFAULT_DESIGN_PRESET } from './defaultDesignPreset';
import {
  DESIGN_CONFIG_VERSION,
  DESIGN_STORAGE_KEY,
  type DesignConfig,
  type DesignKpiConfig,
  type DesignKpiId,
  type DesignSectionConfig,
  type DesignSectionId,
  type DesignTokens,
  type DesignWidgetConfig,
  type DesignWidgetId,
} from './designTypes';
import {
  isDesignColorOption,
  isDesignRadiusOption,
  isDesignSectionId,
  isDesignSpacingMode,
  isDesignWidgetSize,
} from './safeOptions';
import {
  isAllowedKpiAccent,
  isAllowedKpiAggregation,
  isAllowedKpiDatasetScope,
  isAllowedKpiField,
  isAllowedKpiIcon,
  isAllowedKpiSource,
} from './kpiRegistry';

const widgetIds = new Set<DesignWidgetId>(DEFAULT_DESIGN_PRESET.widgets.map((widget) => widget.id));
const sectionIds = new Set<DesignSectionId>(DEFAULT_DESIGN_PRESET.sections.map((section) => section.id));
const protectedKpiIds = new Set<DesignKpiId>(DEFAULT_DESIGN_PRESET.kpis.map((kpi) => kpi.id));
const maxTextLength = 90;

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > 0 && text.length <= maxTextLength ? text : fallback;
}

function cleanOrder(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 999 ? value : fallback;
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

function validateSections(value: unknown): DesignSectionConfig[] | null {
  if (value === undefined) return DEFAULT_DESIGN_PRESET.sections.map((section) => ({ ...section }));
  if (!Array.isArray(value)) return null;
  const byId = new Map<DesignSectionId, DesignSectionConfig>();

  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const section = item as Record<string, unknown>;
    if (typeof section.id !== 'string' || !sectionIds.has(section.id as DesignSectionId)) return null;
    if (typeof section.visible !== 'boolean') return null;

    const fallback = DEFAULT_DESIGN_PRESET.sections.find((presetSection) => presetSection.id === section.id);
    if (!fallback) return null;
    byId.set(section.id as DesignSectionId, {
      id: section.id as DesignSectionId,
      label: cleanText(section.label, fallback.label),
      visible: section.visible,
      order: cleanOrder(section.order, fallback.order),
    });
  }

  return DEFAULT_DESIGN_PRESET.sections.map((section) => byId.get(section.id) ?? { ...section });
}


function isCustomKpiId(value: unknown): value is DesignKpiId {
  return typeof value === 'string' && value.startsWith('customConfigKpi:') && value.length <= 80;
}

function validateKpis(value: unknown): DesignKpiConfig[] | null {
  if (value === undefined) return DEFAULT_DESIGN_PRESET.kpis.map((kpi) => ({ ...kpi }));
  if (!Array.isArray(value)) return null;
  const byId = new Map<DesignKpiId, DesignKpiConfig>();

  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const kpi = item as Record<string, unknown>;
    const id = kpi.id as DesignKpiId;
    const isProtected = typeof id === 'string' && protectedKpiIds.has(id);
    const isCustom = isCustomKpiId(id);
    if (!isProtected && !isCustom) return null;

    const fallback = DEFAULT_DESIGN_PRESET.kpis.find((presetKpi) => presetKpi.id === id);
    const source = isAllowedKpiSource(kpi.source) ? kpi.source : fallback?.source;
    const field = isAllowedKpiField(source, kpi.field) ? kpi.field : fallback?.field;
    const aggregation = isAllowedKpiAggregation(kpi.aggregation) ? kpi.aggregation : fallback?.aggregation;
    const datasetScope = isAllowedKpiDatasetScope(kpi.datasetScope) ? kpi.datasetScope : fallback?.datasetScope ?? 'all';

    if (isCustom && (!source || !field || !aggregation)) return null;

    byId.set(id, {
      id,
      title: cleanText(kpi.title, fallback?.title ?? 'KPI personalizado'),
      description: typeof kpi.description === 'string' ? cleanText(kpi.description, fallback?.description ?? '') : fallback?.description,
      icon: isAllowedKpiIcon(kpi.icon) ? kpi.icon : fallback?.icon ?? 'chart',
      accent: isAllowedKpiAccent(kpi.accent) ? kpi.accent : fallback?.accent ?? 'blue',
      visible: typeof kpi.visible === 'boolean' ? kpi.visible : fallback?.visible ?? true,
      order: cleanOrder(kpi.order, fallback?.order ?? 100),
      section: isDesignSectionId(kpi.section) ? kpi.section : fallback?.section ?? 'bottom',
      size: isDesignWidgetSize(kpi.size) ? kpi.size : fallback?.size ?? 'small',
      protected: isProtected,
      source,
      field,
      aggregation,
      datasetScope,
    });
  }

  const protectedKpis = DEFAULT_DESIGN_PRESET.kpis.map((kpi) => byId.get(kpi.id) ?? { ...kpi });
  const customKpis = [...byId.values()].filter((kpi) => !kpi.protected);
  return [...protectedKpis, ...customKpis];
}
function validateWidgets(value: unknown): DesignWidgetConfig[] | null {
  if (!Array.isArray(value)) return null;
  const byId = new Map<DesignWidgetId, DesignWidgetConfig>();

  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const widget = item as Record<string, unknown>;
    if (typeof widget.id !== 'string' || !widgetIds.has(widget.id as DesignWidgetId)) return null;
    if (typeof widget.visible !== 'boolean') return null;

    const fallback = DEFAULT_DESIGN_PRESET.widgets.find((presetWidget) => presetWidget.id === widget.id);
    if (!fallback) return null;
    byId.set(widget.id as DesignWidgetId, {
      id: widget.id as DesignWidgetId,
      title: cleanText(widget.title ?? widget.label, fallback.title),
      description: typeof widget.description === 'string' ? cleanText(widget.description, fallback.description ?? '') : fallback.description,
      visible: widget.visible,
      order: cleanOrder(widget.order, fallback.order),
      section: isDesignSectionId(widget.section) ? widget.section : fallback.section,
      size: isDesignWidgetSize(widget.size) ? widget.size : fallback.size,
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
  const sections = validateSections(config.sections);
  const widgets = validateWidgets(config.widgets);
  const kpis = validateKpis(config.kpis);
  if (!tokens || !sections || !widgets || !kpis) return null;

  return {
    version: DESIGN_CONFIG_VERSION,
    texts: {
      dashboardTitle: cleanText(texts.dashboardTitle, DEFAULT_DESIGN_PRESET.texts.dashboardTitle),
      dashboardSubtitle: cleanText(texts.dashboardSubtitle, DEFAULT_DESIGN_PRESET.texts.dashboardSubtitle),
    },
    tokens,
    sections,
    widgets,
    kpis,
  };
}

export function createDefaultDesignConfig(): DesignConfig {
  return {
    version: DESIGN_CONFIG_VERSION,
    texts: { ...DEFAULT_DESIGN_PRESET.texts },
    tokens: { ...DEFAULT_DESIGN_PRESET.tokens },
    sections: DEFAULT_DESIGN_PRESET.sections.map((section) => ({ ...section })),
    widgets: DEFAULT_DESIGN_PRESET.widgets.map((widget) => ({ ...widget })),
    kpis: DEFAULT_DESIGN_PRESET.kpis.map((kpi) => ({ ...kpi })),
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
