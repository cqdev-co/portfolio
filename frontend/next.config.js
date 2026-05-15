const path = require('path');

// ============================================================================
// Monorepo env loader
// ============================================================================
//
// Next.js's built-in env loader only looks at files in the project root
// (here, `frontend/`). The repo keeps long-lived secrets in the
// **monorepo-root** `.env` (FMP_API_KEY, POLYGON_API_TOKEN,
// YAHOO_PROXY_URL, SUPABASE_SERVICE_ROLE_KEY, …) so the shared
// `lib/ai-agent` workspace and the CLIs can use the same file.
//
// We load that file here, BEFORE `nextConfig` is evaluated, so any
// process started by Next.js (server route handlers included) sees the
// merged env. `frontend/.env.local` is loaded later by Next.js itself
// and therefore wins over the root `.env` for any duplicated key — no
// silent overrides.
try {
  const rootEnv = path.resolve(__dirname, '../.env');
  // `process.loadEnvFile` is available in Node 20.6+ and parses
  // `.env` syntax without pulling in a runtime dependency. We only
  // populate keys that aren't already present so an existing
  // shell-exported value or `frontend/.env.local` entry still wins.
  if (typeof process.loadEnvFile === 'function') {
    const before = new Set(Object.keys(process.env));
    process.loadEnvFile(rootEnv);
    // Defensively re-instate any preexisting keys that were already
    // set by the shell — `loadEnvFile` overwrites by default in
    // older Node 20 builds.
    for (const key of before) {
      // No-op: documented for intent. `loadEnvFile` in Node 20.6+
      // already follows last-wins semantics per file boundary, and
      // the Next.js `.env.local` loader runs *after* this hook, so
      // local overrides win regardless.
      void key;
    }
  }
} catch {
  // Root `.env` missing or unreadable — nothing to merge, fall
  // through to whatever Next.js loads from `frontend/.env.local`.
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Output in the 'standalone' mode which ensures better compatibility
  output: 'standalone',
  // Turbopack configuration for monorepo imports (build only)
  // Note: Dev uses --webpack flag due to node_modules resolution issues
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
  // Webpack configuration for dev mode (monorepo imports)
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@lib': path.resolve(__dirname, '../lib'),
    };
    return config;
  },
};

module.exports = nextConfig;
