'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';

export function WeeklyRecapWidget() {
  const [recap, setRecap] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    fetch('/api/ai/weekly-recap')
      .then((r) => r.json())
      .then((data) => {
        if (data.recap?.content) {
          setRecap(data.recap.content);
        }
        setFetched(true);
      })
      .catch(() => setFetched(true));
  }, []);

  const generateRecap = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/weekly-recap', { method: 'POST' });
      const data = await response.json();
      setRecap(data.recap);
    } catch {
      setRecap('Unable to generate recap. Ensure Ollama is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Weekly Recap
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={generateRecap}
          disabled={loading}
          className="text-xs"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
          )}
          {loading ? 'Generating...' : 'Generate'}
        </Button>
      </CardHeader>
      <CardContent>
        {!fetched ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading...
          </div>
        ) : recap ? (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {recap}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              No weekly recap yet. Generate one to see your financial summary.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={generateRecap}
              disabled={loading}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-500" />
              Generate Weekly Recap
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
