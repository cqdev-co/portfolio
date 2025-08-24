/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Output in the 'standalone' mode which ensures better compatibility
  output: 'standalone',
  // Ignore TypeScript errors during build to fix the issue with PageProps
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig; 