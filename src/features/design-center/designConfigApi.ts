const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('dashboard-auth-token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export type BackendConfigResponse = {
  active: {
    id: number;
    name: string;
    config: Record<string, unknown>;
    isActive: boolean;
    isDraft: boolean;
    version: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type BackendConfigVersion = {
  id: number;
  name: string;
  isActive: boolean;
  isDraft: boolean;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ConfigApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function fetchJson<T>(url: string, options?: RequestInit): Promise<ConfigApiResult<T>> {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: { ...authHeaders(), ...options?.headers },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { ok: false, error: `${response.status}: ${text.slice(0, 200)}` };
    }
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function fetchActiveConfig(): Promise<ConfigApiResult<BackendConfigResponse>> {
  return fetchJson<BackendConfigResponse>('/api/config/dashboard-visual');
}

export function saveDraftConfig(config: Record<string, unknown>, name?: string): Promise<ConfigApiResult<BackendConfigVersion>> {
  const qs = name ? `?name=${encodeURIComponent(name)}` : '';
  return fetchJson<BackendConfigVersion>(`/api/config/dashboard-visual/draft${qs}`, {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export function publishConfig(config: Record<string, unknown>, name?: string): Promise<ConfigApiResult<BackendConfigVersion>> {
  const qs = name ? `?name=${encodeURIComponent(name)}` : '';
  return fetchJson<BackendConfigVersion>(`/api/config/dashboard-visual/publish${qs}`, {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export function resetActiveConfig(): Promise<ConfigApiResult<{ status: string; message: string }>> {
  return fetchJson<{ status: string; message: string }>('/api/config/dashboard-visual/reset', {
    method: 'POST',
  });
}

export function fetchConfigHistory(): Promise<ConfigApiResult<BackendConfigVersion[]>> {
  return fetchJson<BackendConfigVersion[]>('/api/config/dashboard-visual/history');
}

export function restoreConfigVersion(configId: number): Promise<ConfigApiResult<BackendConfigVersion>> {
  return fetchJson<BackendConfigVersion>(`/api/config/dashboard-visual/restore/${configId}`, {
    method: 'POST',
  });
}
