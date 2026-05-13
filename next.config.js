/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // Desktop (Tauri) builds: emit a fully static frontend to dist/.
  // The backend that used to live in app/api/* has been ported to Rust
  // commands in src-tauri/src/main.rs and is dispatched through
  // lib/hermes-api.ts (which detects the Tauri runtime and calls invoke()).
  // Web/dev runs continue to use the Next.js API routes.
  output: process.env.TAURI === '1' ? 'export' : undefined,
  distDir: process.env.TAURI === '1' ? 'dist' : '.next',
  // When TAURI=1, scripts/build-static.mjs temporarily moves app/api/ out
  // of the way so static export does not see the dynamic API routes.
  // Dev server must NOT be running during the static build (file locks).
  images: {
    unoptimized: true,
  },
  // Performance optimizations for dev mode
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  // Reduce compilation time
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  async redirects() {
    return [
      { source: '/decision-card/:id', destination: '/convergence/:id', permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/hermes/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;