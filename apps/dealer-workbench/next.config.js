const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async rewrites() {
    return [
      { source: '/api/:path*', destination: (process.env.API_URL || 'http://localhost:5500') + '/api/:path*' },
    ];
  },
};

module.exports = nextConfig;
