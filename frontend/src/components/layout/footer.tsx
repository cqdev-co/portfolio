import Link from 'next/link';
import { DATA } from '@/data/resume';

export function Footer() {
  return (
    <footer className="w-full py-3.5 border-t border-border">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center">
          <p className="text-caption text-muted-foreground">
            &copy; {new Date().getFullYear()} {DATA.name}. All rights reserved.
          </p>
        </div>
        <div className="flex space-x-4">
          <Link
            href="/privacy"
            className="text-caption text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-caption text-muted-foreground hover:text-foreground transition-colors"
          >
            Terms
          </Link>
          <Link
            href="/sitemap"
            className="text-caption text-muted-foreground hover:text-foreground transition-colors"
          >
            Sitemap
          </Link>
        </div>
      </div>
    </footer>
  );
}
