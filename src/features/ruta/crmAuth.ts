export interface CrmSession {
  authHeader: string;
  baseUrl: string;
  connectedAt: string;
}

const CRM_SESSION_KEY = 'ruta-crm-session';

const normalizeBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/+$/, '');

const buildAuthHeader = (username: string, password: string) => `Basic ${btoa(`${username}:${password}`)}`;
const CRM_AUTH_MESSAGES = [
  'Usuario o contraseña incorrectos',
  'Sin permisos para acceder al CRM',
  'No se pudo conectar al CRM',
];

function mapCrmErrorStatus(status: number): string {
  if (status === 401) return 'Usuario o contraseña incorrectos';
  if (status === 403) return 'Sin permisos para acceder al CRM';

  return 'No se pudo conectar al CRM';
}

export async function validarCredenciales(username: string, password: string, baseUrl: string): Promise<void> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const authHeader = buildAuthHeader(username, password);
  const validationUrl = `${normalizedBaseUrl}/ServiceRequestCollection?$top=1&$format=json`;

  try {
    const response = await fetch(validationUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(mapCrmErrorStatus(response.status));
    }
  } catch (error) {
    if (error instanceof Error && CRM_AUTH_MESSAGES.includes(error.message)) {
      throw error;
    }

    throw new Error('No se pudo conectar al CRM');
  }
}

export async function guardarSesion(username: string, password: string, baseUrl: string): Promise<CrmSession> {
  const session: CrmSession = {
    authHeader: buildAuthHeader(username, password),
    baseUrl: normalizeBaseUrl(baseUrl),
    connectedAt: new Date().toISOString(),
  };

  window.sessionStorage.setItem(CRM_SESSION_KEY, JSON.stringify(session));

  return session;
}

export function obtenerSesion(): CrmSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawSession = window.sessionStorage.getItem(CRM_SESSION_KEY);

    if (!rawSession) return null;

    const session = JSON.parse(rawSession) as Partial<CrmSession>;

    if (!session.authHeader || !session.baseUrl || !session.connectedAt) return null;

    return {
      authHeader: session.authHeader,
      baseUrl: session.baseUrl,
      connectedAt: session.connectedAt,
    };
  } catch {
    return null;
  }
}

export function cerrarSesion(): void {
  if (typeof window === 'undefined') return;

  window.sessionStorage.removeItem(CRM_SESSION_KEY);
}
