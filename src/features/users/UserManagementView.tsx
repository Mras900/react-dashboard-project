import { Plus, ShieldCheck, UserCog } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createUser, listUsers, updateUser, updateUserPassword, updateUserPermissions } from '../auth/authApi';
import type { AuthUser } from '../auth/authTypes';
import { useAuth } from '../auth/useAuth';
import { UserFormModal, type UserFormValues } from './UserFormModal';

export function UserManagementView() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setUsers(await listUsers(token));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const saveNewUser = async (values: UserFormValues) => {
    if (!token) return;
    await createUser(token, values);
    await loadUsers();
  };

  const saveExistingUser = async (values: UserFormValues) => {
    if (!token || !editingUser) return;
    await updateUser(token, editingUser.id, { displayName: values.displayName, role: values.role });
    await updateUserPermissions(token, editingUser.id, values.permissions);
    if (values.password) await updateUserPassword(token, editingUser.id, values.password);
    await loadUsers();
  };

  const toggleActive = async (user: AuthUser) => {
    if (!token) return;
    setError('');
    try {
      await updateUser(token, user.id, { isActive: !user.isActive });
      await loadUsers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar el estado.');
    }
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#071b4d]"><UserCog size={22} /> Usuarios y permisos</h2>
          <p className="mt-1 text-sm font-medium text-[#466083]">Administra accesos por pestaña sin modificar la operación del dashboard.</p>
        </div>
        <button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#073B91] px-4 text-sm font-bold text-white" onClick={() => setShowCreate(true)} type="button">
          <Plus size={17} /> Crear usuario
        </button>
      </section>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-[#466083]">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Permisos</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-4 py-8 text-center font-semibold text-slate-500" colSpan={5}>Cargando usuarios…</td></tr>
              ) : users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#172448]">{user.displayName}</p>
                    <p className="text-xs font-medium text-[#466083]">@{user.username}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold">{user.role === 'admin' ? 'Administrador' : 'Usuario'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {user.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="max-w-sm px-4 py-3 text-xs font-semibold text-[#466083]">
                    {user.role === 'admin' ? 'Todas las pestañas' : user.permissions.join(', ') || 'Sin permisos'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-[#073B91]" onClick={() => setEditingUser(user)} type="button">Editar</button>
                      <button
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-[#172448] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={user.id === currentUser?.id}
                        onClick={() => void toggleActive(user)}
                        type="button"
                      >
                        {user.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && users.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm font-semibold text-[#466083]">
            <ShieldCheck size={20} /> No hay usuarios registrados.
          </div>
        ) : null}
      </section>

      {showCreate ? <UserFormModal onClose={() => setShowCreate(false)} onSave={saveNewUser} /> : null}
      {editingUser ? <UserFormModal user={editingUser} onClose={() => setEditingUser(null)} onSave={saveExistingUser} /> : null}
    </div>
  );
}
