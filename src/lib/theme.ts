export type DashboardTheme = 'default' | 'dark-premium';

export const THEME_KEY = 'dashboard-theme';

export function applyDashboardTheme(theme: DashboardTheme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const isDark = theme === 'dark-premium';

  root.dataset.theme = theme;
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_KEY, theme);
  }
}

export function loadStoredTheme(): DashboardTheme {
  if (typeof window === 'undefined') return 'default';

  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === 'dark-premium' ? 'dark-premium' : 'default';
}
