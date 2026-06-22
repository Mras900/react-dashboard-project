import { X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { AppViewKey, AuthRole, AuthUser } from '../auth/authTypes';
import { UserPermissionsEditor } from './UserPermissionsEditor';

export type UserFormValues = {
  username: string;
  displayName: string;
  password: string;
  role: AuthRole;
  permissions: AppViewKey[];
};

export function UserFormModal({
  user,
  onClose,
  onSave,
}: {
  user?: AuthUser;
  onClose: () => void;
  onSave: (values: UserFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<UserFormValues>({
    username: user?.username ?? '',
    displayName: user?.displayName ?? '',
    password: '',
    role: user?.role ?? 'user',
    permissions: user?.permissions ?? ['dashboard', 'rm', 'regiones'],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave(values);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <form className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5" onSubmit={submit}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#071b4d]">{user ? 'Editar usuario' : 'Crear usuario'}</h2>
            <p className="mt-1 text-sm font-medium text-[#466083]">Define identidad, rol y acceso por pestaña.</p>
          </div>
          <button aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <X size={19} />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-bold text-[#172448]">
            Usuario
            <input
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-blue-500"
              disabled={Boolean(user)}
              minLength={3}
              onChange={(event) => setValues((current) => ({ ...current, username: event.target.value }))}
              required
              value={values.username}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[#172448]">
            Nombre visible
            <input
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-blue-500"
              onChange={(event) => setValues((current) => ({ ...current, displayName: event.target.value }))}
              required
              value={values.displayName}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[#172448]">
            Rol
            <select
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-blue-500"
              onChange={(event) => setValues((current) => ({ ...current, role: event.target.value as AuthRole }))}
              value={values.role}
            >
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[#172448]">
            {user ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            <input
              autoComplete="new-password"
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-blue-500"
              minLength={8}
              onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
              required={!user}
              type="password"
              value={values.password}
            />
          </label>
        </div>

        <div className="mt-5">
          <UserPermissionsEditor
            onChange={(permissions) => setValues((current) => ({ ...current, permissions }))}
            permissions={values.permissions}
            role={values.role}
          />
        </div>

        {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-[#172448]" onClick={onClose} type="button">Cancelar</button>
          <button className="h-10 rounded-lg bg-[#073B91] px-4 text-sm font-bold text-white disabled:opacity-60" disabled={saving} type="submit">
            {saving ? 'Guardando…' : 'Guardar usuario'}
          </button>
        </div>
      </form>
    </div>
  );
}
