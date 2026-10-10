import { Component } from "react";
import { TriangleAlert } from "lucide-react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Chief Rice Trader crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="grain-card p-6 max-w-md w-full text-center flex flex-col items-center gap-3">
            <TriangleAlert size={28} className="text-[var(--warn)]" />
            <h2 className="text-lg font-semibold tracking-tight text-[var(--ink)]">This page couldn't open</h2>
            <p className="text-sm text-[var(--ink-muted)] break-words">{String(this.state.error?.message || this.state.error)}</p>
            <div className="flex gap-2 mt-2">
              <button className="btn-outline" onClick={() => (window.location.href = "/")}>
                Go to home
              </button>
              <button className="btn-primary" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
