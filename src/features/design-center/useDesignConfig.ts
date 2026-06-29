import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_DESIGN_PRESET } from './defaultDesignPreset';
import type { DesignConfig } from './designTypes';
import {
  clearDesignConfig,
  createDefaultDesignConfig,
  loadDesignConfig,
  loadDesignConfigFromBackend,
  normalizeDesignConfig,
  saveDesignConfig,
  type BackendMeta,
  type ConfigSource,
} from './designStorage';
import {
  publishConfig as apiPublishConfig,
  resetActiveConfig as apiResetActiveConfig,
  restoreConfigVersion as apiRestoreConfigVersion,
  saveDraftConfig as apiSaveDraftConfig,
  fetchConfigHistory,
} from './designConfigApi';

export function useDesignConfig() {
  const [savedConfig, setSavedConfig] = useState<DesignConfig | null>(() => loadDesignConfig());
  const [draftConfig, setDraftConfig] = useState<DesignConfig>(() => savedConfig ?? createDefaultDesignConfig());
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [configSource, setConfigSource] = useState<ConfigSource>('default');
  const [backendMeta, setBackendMeta] = useState<BackendMeta | null>(null);
  const [backendInitialized, setBackendInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadDesignConfigFromBackend();
      if (cancelled) return;
      setBackendInitialized(true);
      if (result.config) {
        setSavedConfig(result.config);
        setDraftConfig(result.config);
        setConfigSource(result.source);
        setBackendMeta(result.backendMeta);
      } else {
        setConfigSource(result.source);
        setBackendMeta(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
    setConfigSource('default');
    setBackendMeta(null);
  }, []);

  const resetLayout = useCallback(() => {
    const defaults = createDefaultDesignConfig();
    setDraftConfig((current) => ({
      ...current,
      sections: defaults.sections,
      widgets: defaults.widgets,
    }));
  }, []);

  const resetKpis = useCallback(() => {
    const defaults = createDefaultDesignConfig();
    setDraftConfig((current) => ({
      ...current,
      kpis: defaults.kpis,
    }));
  }, []);

  const resetCharts = useCallback(() => {
    const defaults = createDefaultDesignConfig();
    setDraftConfig((current) => ({
      ...current,
      charts: defaults.charts,
    }));
  }, []);

  const saveDraftToBackend = useCallback(async (name?: string): Promise<{ ok: boolean; error?: string }> => {
    const normalized = normalizeDesignConfig(draftConfig);
    if (!normalized) return { ok: false, error: 'Configuracion invalida' };
    const result = await apiSaveDraftConfig(normalized as unknown as Record<string, unknown>, name);
    if (result.ok) return { ok: true };
    return { ok: false, error: result.error };
  }, [draftConfig]);

  const publishToBackend = useCallback(async (name?: string): Promise<{ ok: boolean; error?: string; meta?: BackendMeta }> => {
    const normalized = normalizeDesignConfig(draftConfig);
    if (!normalized) return { ok: false, error: 'Configuracion invalida' };
    const result = await apiPublishConfig(normalized as unknown as Record<string, unknown>, name);
    if (!result.ok) return { ok: false, error: result.error };
    saveDesignConfig(normalized);
    setSavedConfig(normalized);
    setDraftConfig(normalized);
    setIsPreviewActive(false);
    setConfigSource('backend');
    const meta: BackendMeta = {
      id: result.data.id,
      name: result.data.name,
      version: result.data.version,
      createdBy: result.data.createdBy,
      createdAt: result.data.createdAt,
      updatedAt: result.data.updatedAt,
    };
    setBackendMeta(meta);
    return { ok: true, meta };
  }, [draftConfig]);

  const resetOnBackend = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const result = await apiResetActiveConfig();
    if (!result.ok) return { ok: false, error: result.error };
    clearDesignConfig();
    setSavedConfig(null);
    setDraftConfig(createDefaultDesignConfig());
    setIsPreviewActive(false);
    setConfigSource('default');
    setBackendMeta(null);
    return { ok: true };
  }, []);

  const restoreVersion = useCallback(async (configId: number): Promise<{ ok: boolean; error?: string }> => {
    const result = await apiRestoreConfigVersion(configId);
    if (!result.ok) return { ok: false, error: result.error };
    const refetch = await loadDesignConfigFromBackend();
    if (refetch.config) {
      saveDesignConfig(refetch.config);
      setSavedConfig(refetch.config);
      setDraftConfig(refetch.config);
      setConfigSource(refetch.source);
      setBackendMeta(refetch.backendMeta);
    }
    setIsPreviewActive(false);
    return { ok: true };
  }, []);

  const refetchFromBackend = useCallback(async () => {
    const result = await loadDesignConfigFromBackend();
    if (result.config) {
      setSavedConfig(result.config);
      setDraftConfig(result.config);
      setConfigSource(result.source);
      setBackendMeta(result.backendMeta);
    } else {
      setConfigSource(result.source);
      setBackendMeta(null);
    }
  }, []);

  return useMemo(
    () => ({
      preset: DEFAULT_DESIGN_PRESET,
      savedConfig,
      draftConfig,
      activeConfig,
      hasActiveConfig,
      isPreviewActive,
      configSource,
      backendMeta,
      backendInitialized,
      updateDraft,
      saveDraft,
      previewDraft,
      stopPreview,
      resetConfig,
      resetLayout,
      resetKpis,
      resetCharts,
      saveDraftToBackend,
      publishToBackend,
      resetOnBackend,
      restoreVersion,
      refetchFromBackend,
      fetchConfigHistory,
    }),
    [
      activeConfig, draftConfig, hasActiveConfig, isPreviewActive,
      configSource, backendMeta, backendInitialized,
      previewDraft, resetConfig, resetLayout, resetKpis, resetCharts,
      saveDraft, savedConfig, stopPreview, updateDraft,
      saveDraftToBackend, publishToBackend, resetOnBackend, restoreVersion, refetchFromBackend,
    ],
  );
}
