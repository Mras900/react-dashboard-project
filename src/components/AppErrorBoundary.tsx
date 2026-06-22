import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error inesperado en la interfaz', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">No se pudo mostrar el dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ocurrió un error inesperado. Puedes recargar la aplicación sin perder los datos guardados.
          </p>
          <button
            className="mt-5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
            onClick={() => window.location.reload()}
            type="button"
          >
            Recargar aplicación
          </button>
        </section>
      </main>
    );
  }
}
