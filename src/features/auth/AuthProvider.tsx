import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authStorage, getMe, loginRequest, logoutRequest } from './authApi';
import type { AppViewKey, AuthUser } from './authTypes';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (viewKey: AppViewKey) => boolean;
  isAdmin: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => authStorage.getToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));

  const clearSession = useCallback(() => {
    authStorage.clear();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    getMe(token)
      .then(setUser)
      .catch(clearSession)
      .finally(() => setIsLoading(false));
  }, [clearSession, token]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await loginRequest(username, password);
    authStorage.setToken(response.access_token);
    setToken(response.access_token);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    if (token) await logoutRequest(token).catch(() => undefined);
    clearSession();
  }, [clearSession, token]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(token && user),
    login,
    logout,
    hasPermission: (viewKey) => user?.role === 'admin' || Boolean(user?.permissions.includes(viewKey)),
    isAdmin: user?.role === 'admin',
  }), [isLoading, login, logout, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
