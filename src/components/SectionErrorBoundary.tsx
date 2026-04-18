import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  sectionLabel: string;
  onRetry: () => void;
  onGoHome: () => void;
  onSignOut: () => void;
};

type State = {
  hasError: boolean;
  message: string;
};

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("SectionErrorBoundary", error);
    this.setState({ message: error.message || "Unknown section render error" });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Section Recovery</p>
        <h3 className="mt-1 text-lg font-semibold text-rose-800">{this.props.sectionLabel} hit a render error</h3>
        <p className="mt-2 text-sm text-rose-700">
          This section failed to load. Try retrying this section or move to a safe view.
        </p>
        {!!this.state.message && (
          <p className="mt-2 rounded-md bg-white/70 px-3 py-2 text-xs font-mono text-rose-700">{this.state.message}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={this.props.onRetry}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Retry Section
          </button>
          <button
            type="button"
            onClick={this.props.onGoHome}
            className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
          >
            Go To Dashboard
          </button>
          <button
            type="button"
            onClick={this.props.onSignOut}
            className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }
}