export type AppViewKey =
  | 'dashboard'
  | 'rm'
  | 'regiones'
  | 'importaciones'
  | 'configuracion'
  | 'reportes'
  | 'ruta'
  | 'usuarios';

export type AuthRole = 'admin' | 'user';

export type AuthUser = {
  id: number;
  username: string;
  displayName: string;
  role: AuthRole;
  isActive: boolean;
  permissions: AppViewKey[];
};

export type LoginResponse = {
  access_token: string;
  token_type: 'bearer';
  user: AuthUser;
};

export const APP_VIEWS: Array<{ key: AppViewKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard principal' },
  { key: 'rm', label: 'Región Metropolitana' },
  { key: 'regiones', label: 'Regiones' },
  { key: 'importaciones', label: 'Importar datos' },
  { key: 'configuracion', label: 'Configuración' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'ruta', label: 'Ruta visitador' },
  { key: 'usuarios', label: 'Usuarios' },
];
