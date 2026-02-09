'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Global Next.js Error Boundary.
 * Catches any unhandled runtime errors at the app level.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-6 w-6" />
        <h2 className="text-lg font-semibold">Something went wrong</h2>
      </div>

      <p className="text-muted-foreground text-center max-w-md text-sm">
        An unexpected error occurred. Please try again or reload the page.
      </p>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={reset} className="gap-2">
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

      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 max-w-2xl w-full">
          <summary className="text-xs text-muted-foreground cursor-pointer">
            Error details (dev only)
          </summary>
          <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto max-h-48">
            {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}
