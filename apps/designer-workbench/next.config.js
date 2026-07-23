/** @type {import('next').NextConfig} */
// 开发环境：把同源 /api/* 服务端转发到 NestJS(5500)，规避浏览器跨域 CORS（生产由反向代理承担）。
const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:5500';
module.exports = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_TARGET}/api/:path*` }];
  },
  webpack: (config) => {
    // ThatOpen / web-ifc 依赖 .wasm 文件，需要让 webpack 以 asset/resource 方式加载
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    // react-konva/konva 在打包时会尝试解析可选的原生 'canvas' 包（仅 Node 端需要，
    // 浏览器用 DOM canvas）。未安装该原生依赖时会导致引用它的路由编译 500。
    // 将其别名为 false，跳过打包（浏览器渲染不受影响）。
    config.resolve = config.resolve || {};
    config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false };
    return config;
  },
};
