'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Download, Loader2, Sparkles, ImageIcon } from 'lucide-react';

const STYLES = ['rich', 'vibrant', 'sophisticated', 'glass'] as const;
const TYPES = [
  'organic',
  'glass',
  'fluid',
  'linear',
  'radial',
  'perlin',
  'fractal',
  'wave',
] as const;
const RESOLUTIONS = [
  '1080p',
  '1440p',
  '4k',
  '720p',
  'mobile',
  'social',
  'banner',
  'card',
  'square',
  'ultrawide',
] as const;

type Style = (typeof STYLES)[number];
type GradientType = (typeof TYPES)[number];
type Resolution = (typeof RESOLUTIONS)[number];

export function WallpaperGenerator() {
  const [style, setStyle] = useState<Style>('rich');
  const [gradientType, setGradientType] = useState<GradientType>('organic');
  const [resolution, setResolution] = useState<Resolution>('1080p');
  const [complexity, setComplexity] = useState(0.8);
  const [prompt, setPrompt] = useState('');
  const [useOllama, setUseOllama] = useState(false);
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/wallpaper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style,
          type: gradientType,
          resolution,
          complexity,
          output_format: format,
          prompt: useOllama && prompt ? prompt : undefined,
          use_ollama: useOllama && !!prompt,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Generation failed (${res.status})`);
      }

      const blob = await res.blob();
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setImageUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [
    style,
    gradientType,
    resolution,
    complexity,
    format,
    prompt,
    useOllama,
    imageUrl,
  ]);

  const download = useCallback(() => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `wallpaper_${style}_${gradientType}_${resolution}.${format}`;
    a.click();
  }, [imageUrl, style, gradientType, resolution, format]);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* Controls */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Configuration</CardTitle>
          <CardDescription>Customize your gradient wallpaper</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Style */}
          <fieldset className="space-y-2">
            <Label>Style</Label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    style === s
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-accent'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Algorithm */}
          <fieldset className="space-y-2">
            <Label>Algorithm</Label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setGradientType(t)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    gradientType === t
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-accent'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Resolution */}
          <fieldset className="space-y-2">
            <Label>Resolution</Label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as Resolution)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {RESOLUTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </fieldset>

          {/* Complexity */}
          <fieldset className="space-y-2">
            <Label>Complexity: {complexity.toFixed(1)}</Label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={complexity}
              onChange={(e) => setComplexity(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
          </fieldset>

          {/* Format */}
          <fieldset className="space-y-2">
            <Label>Format</Label>
            <div className="flex gap-2">
              {(['png', 'jpeg'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium uppercase transition-colors ${
                    format === f
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-accent'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </fieldset>

          {/* AI Prompt */}
          <fieldset className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              <Label>AI Prompt (Ollama)</Label>
            </div>
            <Input
              placeholder="e.g. serene ocean sunset..."
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (e.target.value) setUseOllama(true);
                else setUseOllama(false);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Requires wp-service with Ollama configured
            </p>
          </fieldset>

          {/* Generate */}
          <Button
            onClick={generate}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 size-4" />
                Generate Wallpaper
              </>
            )}
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Preview</CardTitle>
            {imageUrl && (
              <Button variant="outline" size="sm" onClick={download}>
                <Download className="mr-2 size-4" />
                Download
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Generated wallpaper"
              className="max-h-[600px] w-full rounded-lg border object-contain"
            />
          ) : (
            <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              <p className="text-sm">Your wallpaper will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
