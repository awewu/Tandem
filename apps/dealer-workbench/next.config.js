const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  async redirects() {
    return [
      { source: '/queue', destination: '/bim/deepen-queue', permanent: false },
      { source: '/artifacts', destination: '/bim/artifacts', permanent: false },
      { source: '/deepen/:projectId', destination: '/bim/deepen/:projectId', permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: (process.env.API_URL || 'http://localhost:5500') + '/api/:path*' },
      { source: '/wasm/:path*', destination: '/_next/static/wasm/:path*' },
    ];
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: { filename: 'static/wasm/[name][ext]' },
    });
    config.resolve = config.resolve || {};
    config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false };
    return config;
  },
};

module.exports = nextConfig;
