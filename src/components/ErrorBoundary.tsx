import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in app", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-lg rounded-lg border bg-card p-8 shadow">
            <div className="mb-4 flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              An unexpected error occurred while loading the application. Please try refreshing the page.
            </p>
            {this.state.error?.message ? (
              <pre className="mb-6 overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground">
                {this.state.error.message}
              </pre>
            ) : null}
            <Button onClick={this.handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Reload
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
