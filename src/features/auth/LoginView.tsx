import { Eye, EyeOff, LockKeyhole, Moon, Navigation, Sun, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from './useAuth';

type LoginTheme = 'default' | 'dark-premium';
const THEME_KEY = 'dashboard-theme';

export function LoginView() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<LoginTheme>(() =>
    localStorage.getItem(THEME_KEY) === 'default' ? 'default' : 'dark-premium',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-4 text-[#172448]">
      <button
        aria-label={theme === 'dark-premium' ? 'Cambiar a tema claro' : 'Cambiar a modo oscuro'}
        className="theme-toggle absolute right-4 top-4 flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold"
        onClick={() => setTheme((current) => current === 'dark-premium' ? 'default' : 'dark-premium')}
        type="button"
      >
        {theme === 'dark-premium' ? <Sun size={17} /> : <Moon size={17} />}
        {theme === 'dark-premium' ? 'Tema claro' : 'Modo oscuro'}
      </button>

      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#073B91] text-white">
            <Navigation size={23} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#071b4d]">Visor de Reclamos</h1>
            <p className="text-sm font-medium text-[#466083]">Acceso interno seguro</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5 text-sm font-bold text-[#172448]">
            Usuario
            <span className="relative">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-[#466083]" size={18} />
              <input
                autoComplete="username"
                autoFocus
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setUsername(event.target.value)}
                required
                value={username}
              />
            </span>
          </label>

          <label className="grid gap-1.5 text-sm font-bold text-[#172448]">
            Contraseña
            <span className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-[#466083]" size={18} />
              <input
                autoComplete="current-password"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setPassword(event.target.value)}
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-[#466083]"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}

          <button
            className="flex h-11 w-full items-center justify-center rounded-lg bg-[#073B91] px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
}
