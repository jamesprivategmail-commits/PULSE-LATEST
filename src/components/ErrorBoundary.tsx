import React, { ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    window.location.href = '/';
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div id="error-boundary-container" className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white p-6 select-none">
          <div className="max-w-md w-full bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              Pulse encountered an unexpected state. You can reload the stream or return to the main feed.
            </p>

            {this.state.error?.message && (
              <div className="w-full mb-6 p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl text-left overflow-x-auto">
                <p className="text-xs font-mono text-zinc-400 break-words line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                id="error-reload-btn"
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-white text-black hover:bg-zinc-200 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
              <button
                id="error-reset-btn"
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Home Feed
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
