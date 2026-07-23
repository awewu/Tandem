/** @type {import('next').NextConfig} */
// 开发环境：把同源 /api/* 转发到 NestJS(5500)，规避浏览器 CORS（生产由反向代理承担）。
const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:5500';
module.exports = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_TARGET}/api/:path*` }];
  },
  webpack: (config) => {
    // ThatOpen / web-ifc 依赖 .wasm，以 asset/resource 方式加载。
    config.module.rules.push({ test: /\.wasm$/, type: 'asset/resource' });
    return config;
  },
};
