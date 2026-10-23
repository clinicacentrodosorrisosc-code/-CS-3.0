import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type ModuleErrorBoundaryProps = {
  children: React.ReactNode;
};

type ModuleErrorBoundaryState = {
  error: Error | null;
};

/**
 * Keeps a single failing route from unmounting the complete application
 * workspace. The original error remains available in the browser console for
 * diagnosis while the operator gets a clear, recoverable state instead of a
 * blank panel.
 */
export class ModuleErrorBoundary extends React.Component<ModuleErrorBoundaryProps, ModuleErrorBoundaryState> {
  state: ModuleErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Erro ao renderizar módulo:', error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="module-error-state" role="alert" aria-live="assertive">
        <span className="module-error-state__icon"><AlertTriangle size={20} /></span>
        <div>
          <h2>Não foi possível abrir esta área</h2>
          <p>O restante do sistema continua disponível. Tente abrir novamente; se o problema persistir, a mensagem técnica já foi registrada para análise.</p>
          <button type="button" onClick={this.handleRetry}>
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </div>
      </section>
    );
  }
}
