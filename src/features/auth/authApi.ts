import type { AppViewKey, AuthRole, AuthUser, LoginResponse } from './authTypes';

const TOKEN_KEY = 'dashboard-auth-token';

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'detail' in payload && typeof payload.detail === 'string') {
    return payload.detail;
  }
  return fallback;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(getErrorMessage(payload, 'No se pudo completar la solicitud.'));
  return payload as T;
}

export const authStorage = {
  getToken: () => sessionStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export const loginRequest = (username: string, password: string) =>
  request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const getMe = (token: string) => request<AuthUser>('/api/auth/me', {}, token);
export const logoutRequest = (token: string) => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }, token);
export const listUsers = (token: string) => request<AuthUser[]>('/api/admin/users', {}, token);

export const createUser = (
  token: string,
  payload: { username: string; displayName: string; password: string; role: AuthRole; permissions: AppViewKey[] },
) => request<AuthUser>('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) }, token);

export const updateUser = (
  token: string,
  userId: number,
  payload: { displayName?: string; role?: AuthRole; isActive?: boolean },
) => request<AuthUser>(`/api/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(payload) }, token);

export const updateUserPassword = (token: string, userId: number, password: string) =>
  request<{ ok: boolean }>(
    `/api/admin/users/${userId}/password`,
    { method: 'PUT', body: JSON.stringify({ password }) },
    token,
  );

export const updateUserPermissions = (token: string, userId: number, permissions: AppViewKey[]) =>
  request<AuthUser>(
    `/api/admin/users/${userId}/permissions`,
    { method: 'PUT', body: JSON.stringify({ permissions }) },
    token,
  );
