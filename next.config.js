const isTauri = process.env.TAURI === '1';
const isStandalone = process.env.NEXT_OUTPUT === 'standalone';
const devDistDir = process.env.NEXT_DIST_DIR;
const shouldPoll = process.env.NEXT_WEBPACK_POLL === '1';
// Windows 部署机内存受限, next build 的 lint/typecheck worker 会 OOM
// (Fatal process out of memory: Zone)。CI verify 阶段已在 Linux runner 上
// 跑过 tsc --noEmit + next lint, 部署构建无需重复检查。仅 package-deploy.ps1 置位。
const skipBuildChecks = process.env.TANDEM_SKIP_BUILD_CHECKS === '1';
// 部署机提交上限仅 20GB (16GB RAM + 4GB 页面文件), 基线已占约 12GB,
// 构建可用提交量不足 4GB。默认按 CPU 核数并发的构建 worker 会撞上提交限制,
// 表现为 Fatal process out of memory: Zone。置位后把构建并发压到单 worker。
const lowMemoryBuild = process.env.TANDEM_LOW_MEMORY_BUILD === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: skipBuildChecks,
  },
  typescript: {
    ignoreBuildErrors: skipBuildChecks,
  },
  // 桌面端 (Tauri) = 瘦客户端: webview 加载远端公司 Tandem server (完整 Next.js, 含 API + Postgres),
  // 功能与 web 端 100% 等价. 桌面打包不再静态导出整个应用, 仅打入 scripts/build-desktop-bootstrap.mjs
  // 生成的连接网关页 (dist/index.html). 因此 TAURI=1 静态导出分支已不再用于桌面构建, 保留仅作兜底.
  // Web standalone 自包含部署 / dev undefined.
  output: isTauri ? 'export' : isStandalone ? 'standalone' : undefined,
  distDir: isTauri ? 'dist' : devDistDir || '.next',
  // When TAURI=1, scripts/build-static.mjs temporarily moves app/api/ out
  // of the way so static export does not see the dynamic API routes.
  // Dev server must NOT be running during the static build (file locks).
  images: {
    unoptimized: true,
  },
  // Performance optimizations for dev mode
  webpack: (config, { dev }) => {
    if (dev && shouldPoll) {
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
    // pdfjs-dist 必须按真实 node 模块从 node_modules 加载, 不能被 webpack 打进 server bundle:
    // 否则 pdfjs 内部动态 import('pdf.worker.mjs') 被改写到 .next/server/vendor-chunks/,
    // 而该 worker chunk 不会被输出 → "Setting up fake worker failed: Cannot find module".
    // 外置后 pdfjs 在 Node 下自行解析 worker, 服务端 PDF 抽取 (lib/infra/document-extract.ts) 恢复正常。
    // @napi-rs/canvas 含原生 .node 二进制, 用于在 Node 端为 pdfjs 提供 DOMMatrix/Path2D/ImageData
    // (见 lib/infra/document-extract.ts ensurePdfGlobals), 必须外置, 否则被 webpack 打包会丢二进制。
    serverComponentsExternalPackages: ['pdfjs-dist', '@napi-rs/canvas'],
    ...(lowMemoryBuild ? { cpus: 1, workerThreads: false } : {}),
  },
  async rewrites() {
    return [
      {
        source: '/api/hermes/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
      {
        // A2A 标准发现路径 → 实际由 app/api/mcp-server/agent-card/route.ts 处理
        source: '/.well-known/agent-card.json',
        destination: '/api/mcp-server/agent-card',
      },
    ];
  },
};

module.exports = nextConfig;
