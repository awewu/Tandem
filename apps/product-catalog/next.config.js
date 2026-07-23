/** @type {import('next').NextConfig} */
const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:5500';
module.exports = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_TARGET}/api/:path*` }];
  },
};
