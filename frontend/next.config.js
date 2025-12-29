const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Output in the 'standalone' mode which ensures better compatibility
  output: 'standalone',
  // Ignore TypeScript errors during build to fix the issue with PageProps
  typescript: {
    ignoreBuildErrors: true,
  },
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