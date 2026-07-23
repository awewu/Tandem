/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        // C 端默认首页 = rhautt.com 官网落地页（挂 AI 问诊入口），URL 保持 /
        { source: '/', destination: '/index-ready.html' },
      ],
      afterFiles: [
        { source: '/api/:path*', destination: (process.env.API_URL || 'http://localhost:5500') + '/api/:path*' },
      ],
    };
  },
};
module.exports = nextConfig;
