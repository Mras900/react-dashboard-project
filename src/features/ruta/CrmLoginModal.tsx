import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { guardarSesion, type CrmSession } from './crmAuth';

const DEFAULT_CRM_URL = '/crm/sap/c4c/odata/v1/c4codataapi';

type CrmLoginModalProps = {
  onConnected: (session: CrmSession) => void;
};

export function CrmLoginModal({ onConnected }: CrmLoginModalProps) {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_CRM_URL);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const session = await guardarSesion(username, password, baseUrl);
      setPassword('');
      onConnected(session);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo conectar al CRM');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-160px)] place-items-center p-4">
      <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <LockKeyhole size={22} />
          </span>
          <div>
            <h2 className="text-xl font-bold text-[#071b4d]">Conectar al CRM</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Ingresa tus credenciales para habilitar la sesión de Ruta visitador durante esta pestaña.
            </p>
          </div>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-xs font-bold text-slate-700">URL CRM</span>
            <input
              className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setBaseUrl(event.target.value)}
              required
              type="text"
              value={baseUrl}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-bold text-slate-700">Usuario</span>
            <input
              autoComplete="username"
              className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setUsername(event.target.value)}
              required
              type="text"
              value={username}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-bold text-slate-700">Contraseña</span>
            <div className="flex h-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
              <input
                autoComplete="current-password"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm font-medium text-slate-900 outline-none"
                onChange={(event) => setPassword(event.target.value)}
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="flex w-10 items-center justify-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error ? (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <button
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0f5fcf] px-4 text-sm font-bold text-white transition hover:bg-[#0d47a1] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            <ShieldCheck size={18} />
            {loading ? 'Conectando...' : 'Conectar al CRM'}
          </button>
        </form>
      </section>
    </div>
  );
}
