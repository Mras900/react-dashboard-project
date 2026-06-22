import { LockKeyhole } from 'lucide-react';
import type { AppViewKey } from './authTypes';
import { useAuth } from './useAuth';

export function ProtectedView({ viewKey, children }: { viewKey: AppViewKey; children: React.ReactNode }) {
  const { hasPermission } = useAuth();
  if (hasPermission(viewKey)) return <>{children}</>;

  return (
    <section className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <LockKeyhole size={24} />
      </span>
      <h2 className="text-xl font-bold text-[#071b4d]">Acceso restringido</h2>
      <p className="mt-2 text-sm font-semibold text-[#466083]">No tienes permiso para acceder a esta sección.</p>
    </section>
  );
}
