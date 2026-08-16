import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';

type State = { hasError: boolean };
export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Admin UI error', error, info);
  }
  render(): ReactNode {
    return this.state.hasError ? (
      <main className="auth-page">
        <section className="panel auth-card">
          <h1>Something went wrong</h1>
          <p className="muted">Reload the dashboard to continue.</p>
          <button className="primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </section>
      </main>
    ) : (
      this.props.children
    );
  }
}
