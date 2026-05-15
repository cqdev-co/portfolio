import { WallpaperGenerator } from '@/components/wallpaper/wallpaper-generator';

export const metadata = {
  title: 'Wallpaper Generator',
  description:
    'Generate beautiful gradient wallpapers using mathematical algorithms and AI-powered color generation.',
};

export default function WallpaperPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Wallpaper Generator
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mathematical gradient generation with AI-powered color palettes
        </p>
      </div>

      <hr className="border-border mb-8" />

      <WallpaperGenerator />
    </div>
  );
}
