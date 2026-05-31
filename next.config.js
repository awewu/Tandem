/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 桌面端 (Tauri) = 瘦客户端: webview 加载远端公司 Tandem server (完整 Next.js, 含 API + Postgres),
  // 功能与 web 端 100% 等价. 桌面打包不再静态导出整个应用, 仅打入 scripts/build-desktop-bootstrap.mjs
  // 生成的连接网关页 (dist/index.html). 因此 TAURI=1 静态导出分支已不再用于桌面构建, 保留仅作兜底.
  // Web standalone 自包含部署 / dev undefined.
  output: process.env.TAURI === '1' ? 'export' : process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
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