import { useCallback, useMemo, useState } from 'react';
import { DEFAULT_DESIGN_PRESET } from './defaultDesignPreset';
import type { DesignConfig } from './designTypes';
import { clearDesignConfig, createDefaultDesignConfig, loadDesignConfig, normalizeDesignConfig, saveDesignConfig } from './designStorage';

export function useDesignConfig() {
  const [savedConfig, setSavedConfig] = useState<DesignConfig | null>(() => loadDesignConfig());
  const [draftConfig, setDraftConfig] = useState<DesignConfig>(() => savedConfig ?? createDefaultDesignConfig());
  const [isPreviewActive, setIsPreviewActive] = useState(false);

  const activeConfig = isPreviewActive ? draftConfig : savedConfig;
  const hasActiveConfig = Boolean(activeConfig);

  const updateDraft = useCallback((updater: (current: DesignConfig) => DesignConfig) => {
    setDraftConfig((current) => {
      const next = normalizeDesignConfig(updater(current));
      return next ?? current;
    });
  }, []);

  const saveDraft = useCallback(() => {
    const normalized = normalizeDesignConfig(draftConfig);
    if (!normalized) return;
    saveDesignConfig(normalized);
    setSavedConfig(normalized);
    setDraftConfig(normalized);
    setIsPreviewActive(false);
  }, [draftConfig]);

  const previewDraft = useCallback(() => {
    setIsPreviewActive(true);
  }, []);

  const stopPreview = useCallback(() => {
    setIsPreviewActive(false);
    setDraftConfig(savedConfig ?? createDefaultDesignConfig());
  }, [savedConfig]);

  const resetConfig = useCallback(() => {
    clearDesignConfig();
    setSavedConfig(null);
    setDraftConfig(createDefaultDesignConfig());
    setIsPreviewActive(false);
  }, []);


  const resetLayout = useCallback(() => {
    const defaults = createDefaultDesignConfig();
    setDraftConfig((current) => ({
      ...current,
      sections: defaults.sections,
      widgets: defaults.widgets,
    }));
  }, []);
  return useMemo(
    () => ({
      preset: DEFAULT_DESIGN_PRESET,
      savedConfig,
      draftConfig,
      activeConfig,
      hasActiveConfig,
      isPreviewActive,
      updateDraft,
      saveDraft,
      previewDraft,
      stopPreview,
      resetConfig,
      resetLayout,
    }),
    [activeConfig, draftConfig, hasActiveConfig, isPreviewActive, previewDraft, resetConfig, resetLayout, saveDraft, savedConfig, stopPreview, updateDraft],
  );
}
