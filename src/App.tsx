import { AppErrorBoundary } from './components/AppErrorBoundary';
import Dashboard from './components/Dashboard';
import { AuthProvider } from './features/auth/AuthProvider';
import { LoginView } from './features/auth/LoginView';
import { useAuth } from './features/auth/useAuth';

function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb] text-sm font-semibold text-[#466083]">Validando sesión…</div>;
  }

  return isAuthenticated ? <Dashboard /> : <LoginView />;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </AppErrorBoundary>
  );
}