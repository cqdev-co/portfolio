'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback component to render instead of default */
  fallback?: React.ReactNode;
  /** Section name displayed in the error message */
  section?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary component that catches rendering errors
 * and displays a recovery UI instead of crashing the page.
 *
 * Particularly important for:
 * - Scanner pages with real-time data
 * - Position tracker with live pricing
 * - Chat interface with streaming
 *
 * @example
 * ```tsx
 * <ErrorBoundary section="Unusual Options Scanner">
 *   <ScannerPage />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.section ? `: ${this.props.section}` : ''}]`,
      error,
      errorInfo
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 px-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-6 w-6" />
            <h2 className="text-lg font-semibold">
              {this.props.section
                ? `${this.props.section} encountered an error`
                : 'Something went wrong'}
            </h2>
          </div>

          <p className="text-muted-foreground text-center max-w-md text-sm">
            {this.state.error?.message ||
              'An unexpected error occurred. This may be due to a network issue or stale data.'}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 max-w-2xl w-full">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                Error details (dev only)
              </summary>
              <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto max-h-48">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
