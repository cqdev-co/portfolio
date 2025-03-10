import { DATA } from "@/data/resume";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full py-4 border-t border-gray-200 dark:border-gray-800 text-xs">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} {DATA.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
              Privacy
            </Link>
            <Link href="/terms" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
              Terms
            </Link>
            <Link href="/sitemap" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
              Sitemap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
} 