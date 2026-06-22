import { APP_VIEWS, type AppViewKey, type AuthRole } from '../auth/authTypes';

export function UserPermissionsEditor({
  permissions,
  role,
  onChange,
}: {
  permissions: AppViewKey[];
  role: AuthRole;
  onChange: (permissions: AppViewKey[]) => void;
}) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="mb-2 text-sm font-bold text-[#172448]">Pestañas permitidas</legend>
      {APP_VIEWS.map((view) => {
        const disabled = role === 'admin' || view.key === 'usuarios';
        const checked = role === 'admin' || permissions.includes(view.key);
        return (
          <label key={view.key} className="flex min-h-10 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#172448]">
            <input
              checked={checked}
              disabled={disabled}
              onChange={(event) => onChange(
                event.target.checked
                  ? [...permissions, view.key]
                  : permissions.filter((permission) => permission !== view.key),
              )}
              type="checkbox"
            />
            {view.label}
          </label>
        );
      })}
    </fieldset>
  );
}
