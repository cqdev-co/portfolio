"use client";

import Link from "next/link";

interface Scanner {
  name: string;
  path: string;
  winRate?: string;
}

const scanners: Scanner[] = [
  {
    name: "Unusual Options Scanner", 
    path: "/unusual-options-scanner",
  },
  {
    name: "Penny Stock Scanner",
    path: "/penny-stock-scanner",
  },
];

export default function ScannersPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6 text-foreground">Scanners</h1>
      
      <hr className="border-border mb-8" />
      
      <ul className="space-y-4">
        {scanners.map((scanner) => (
          <li key={scanner.path} className="flex items-center justify-between">
            <Link 
              href={scanner.path}
              className="text-base font-medium text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              {scanner.name}
            </Link>
            {scanner.winRate && (
              <span className="text-sm text-muted-foreground font-mono bg-muted px-2 py-1 rounded-sm">
                {scanner.winRate}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

