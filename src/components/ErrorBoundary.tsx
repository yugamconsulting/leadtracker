import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught render error", error, info);
    this.setState({ errorMessage: error.message || "Unknown render error" });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-rose-700">Something went wrong</h1>
        <p className="mt-2 text-sm text-rose-700">
          We hit a rendering issue in this section. Try recovery actions below.
        </p>
        <p className="mt-1 text-xs text-rose-600">
          If this persists, contact support at <a className="font-semibold underline" href="mailto:info@oruyugam.com">info@oruyugam.com</a>
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("sales-lead-tracker:v2:session");
              window.location.reload();
            }}
            className="rounded border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
          >
            Go To Login
          </button>
        </div>
        {!!this.state.errorMessage && (
          <p className="mt-4 rounded-lg bg-white/70 p-2 text-left font-mono text-[11px] text-rose-700">
            {this.state.errorMessage}
          </p>
        )}
      </div>
    );
  }
}