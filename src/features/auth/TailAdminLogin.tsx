import { Eye, EyeOff, LockKeyhole, Moon, Navigation, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from './useAuth';

const THEME_KEY = 'dashboard-theme';
type LoginTheme = 'default' | 'dark-premium';

export function TailAdminLogin() {
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
    <main className="min-h-screen bg-[#0D1117] text-[#EAF0F8]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_520px]">
        <section className="relative hidden overflow-hidden border-r border-white/[0.08] bg-[#0B1220] lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(27,79,216,0.24),transparent_34rem)]" />
          <div className="relative flex h-full flex-col justify-between p-10 xl:p-12">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-[#1B4FD8] text-white shadow-lg shadow-blue-950/30">
                <Navigation size={25} />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#7A90A8]">Operaciones</p>
                <h1 className="text-2xl font-black text-[#EAF0F8]">Visor de Reclamos</h1>
              </div>
            </div>

            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7A90A8]">Dashboard administrativo</p>
              <h2 className="mt-4 text-4xl font-black leading-tight text-[#EAF0F8] xl:text-5xl">
                Control territorial de reclamos, facturacion y rutas.
              </h2>
              <p className="mt-5 max-w-lg text-base font-medium leading-7 text-[#7A90A8]">
                Accede al panel operativo, mapas, KPIs, importacion de datos y seguimiento de ruta desde una experiencia segura y consistente.
              </p>
            </div>

            <div className="grid max-w-2xl grid-cols-3 gap-3">
              {[
                ['RM', 'Mapa comunal'],
                ['CSV/XLSX', 'Importacion'],
                ['Ruta', 'Visitador'],
              ].map(([label, detail]) => (
                <div key={label} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-lg font-black text-[#EAF0F8]">{label}</p>
                  <p className="mt-1 text-xs font-semibold text-[#7A90A8]">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 lg:hidden">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1B4FD8] text-white">
                  <Navigation size={22} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7A90A8]">Operaciones</p>
                  <h1 className="text-lg font-black text-[#EAF0F8]">Visor de Reclamos</h1>
                </div>
              </div>

              <button
                aria-label={theme === 'dark-premium' ? 'Cambiar a tema claro' : 'Cambiar a modo oscuro'}
                className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#111827] px-3 text-xs font-bold text-[#EAF0F8] transition hover:border-[#1B4FD8]"
                onClick={() => setTheme((current) => (current === 'dark-premium' ? 'default' : 'dark-premium'))}
                type="button"
              >
                {theme === 'dark-premium' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark-premium' ? 'Tema claro' : 'Modo oscuro'}
              </button>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#111827] p-6 shadow-2xl shadow-black/30 sm:p-8">
              <div className="mb-7">
                <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/[0.08] bg-[#0D1117] text-[#1B4FD8]">
                  <ShieldCheck size={22} />
                </span>
                <h2 className="text-2xl font-black text-[#EAF0F8]">Iniciar sesion</h2>
                <p className="mt-2 text-sm font-medium text-[#7A90A8]">Usa tus credenciales internas para continuar.</p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <label className="grid gap-2 text-sm font-bold text-[#EAF0F8]">
                  Usuario
                  <span className="relative">
                    <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A90A8]" size={18} />
                    <input
                      autoComplete="username"
                      autoFocus
                      className="h-12 w-full rounded-lg border border-white/[0.08] bg-[#0D1117] pl-10 pr-3 text-sm font-semibold text-[#EAF0F8] outline-none transition placeholder:text-[#7A90A8] focus:border-[#1B4FD8] focus:ring-4 focus:ring-[#1B4FD8]/15"
                      onChange={(event) => setUsername(event.target.value)}
                      required
                      value={username}
                    />
                  </span>
                </label>

                <label className="grid gap-2 text-sm font-bold text-[#EAF0F8]">
                  Contrasena
                  <span className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A90A8]" size={18} />
                    <input
                      autoComplete="current-password"
                      className="h-12 w-full rounded-lg border border-white/[0.08] bg-[#0D1117] pl-10 pr-12 text-sm font-semibold text-[#EAF0F8] outline-none transition placeholder:text-[#7A90A8] focus:border-[#1B4FD8] focus:ring-4 focus:ring-[#1B4FD8]/15"
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                    />
                    <button
                      aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                      className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[#7A90A8] transition hover:bg-white/[0.06] hover:text-[#EAF0F8]"
                      onClick={() => setShowPassword((current) => !current)}
                      type="button"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>

                {error ? (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  className="flex h-12 w-full items-center justify-center rounded-lg bg-[#1B4FD8] px-4 text-sm font-black text-white shadow-lg shadow-blue-950/30 transition hover:bg-[#245ee9] disabled:cursor-wait disabled:opacity-60"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? 'Ingresando...' : 'Ingresar al dashboard'}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
