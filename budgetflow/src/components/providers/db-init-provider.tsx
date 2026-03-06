'use client';

import { useEffect, useState } from 'react';

export function DbInitProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch('/api/init')
      .then(() => setReady(true))
      .catch(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground text-sm">
          Initializing BudgetFlow...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
