import type { Metadata, Viewport } from 'next';
// 自托管 Noto Sans SC (拉丁 + 中文) — @fontsource 把 woff2 打进 _next/static, 不走被墙的 Google CDN.
// 刻意用"整包子集"(chinese-simplified + latin) 而非默认的 400.css 分片版:
//   分片版会把中文拆成 ~100 个小 woff2 (4 权重共约 400 个请求), 在 LAN/弱网下大量小请求
//   极易部分失败 → "部分字变了, 部分没变". 整包每权重仅 2 个请求, 全站渲染稳定一致.
import '@fontsource/noto-sans-sc/chinese-simplified-400.css';
import '@fontsource/noto-sans-sc/latin-400.css';
import '@fontsource/noto-sans-sc/chinese-simplified-500.css';
import '@fontsource/noto-sans-sc/latin-500.css';
import '@fontsource/noto-sans-sc/chinese-simplified-600.css';
import '@fontsource/noto-sans-sc/latin-600.css';
import '@fontsource/noto-sans-sc/chinese-simplified-700.css';
import '@fontsource/noto-sans-sc/latin-700.css';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { RightPaneProvider } from '@/components/right-pane';
import { Toaster } from '@/components/toaster';
import { PwaRegister } from '@/components/pwa-register';
import { PwaInstallGuide } from '@/components/pwa-install-guide';
import { AppShell } from '@/components/app-shell';
import { PageViewTracker } from '@/components/page-view-tracker';
import { ClientErrorReporter } from '@/components/client-error-reporter';

// 字体策略 (2026-06-17 修订):
//   不使用 next/font/google — Google Fonts CDN 在国内云主机/容器构建中频繁 ECONNRESET, 会 fail build.
//   主字体 = 自托管 Noto Sans SC (上方 @fontsource import), 字体链置于首位, 拉丁+中文跨平台一致.
//   ⚠️ 历史坑: 字体链里曾混入 var(--font-sans)/var(--font-display), 但这两个变量从未定义。
//   按 CSS 规范, font-family 列表中出现"未定义且无 fallback 的 var()"会让整条声明在
//   computed-value 阶段失效, 回退到 Times New Roman → 全站字体失灵 (Mac 上表现为系统默认 CJK)。
//   故字体链中禁止出现未定义的 var()。如未来要用 next/font 注入变量, 必须带 fallback: var(--x, 'Inter')。

export const metadata: Metadata = {
  title: 'Tandem · 牛马搭子',
  description:
    'Tandem 牛马搭子 — 让 17 分钟达成共识的 AI 协作伙伴. 事半 (企业 OKR) × 拿捏 (员工 AI 成长).',
  applicationName: 'Tandem',
  authors: [{ name: 'Tandem Team' }],
  keywords: ['Tandem', '牛马搭子', 'OKR', '议事室', 'AI 副驾', '企业协作'],
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#C8202C' },
    { media: '(prefers-color-scheme: dark)',  color: '#0E0E0E' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <ThemeProvider>
          <RightPaneProvider>
            {/* 按路由决定是否套内部 chrome (独立 app: /shouchao /hub 全屏无壳) */}
            <AppShell>{children}</AppShell>
            <Toaster />
            <PwaRegister />
            {/* §移动端「不上架当 App 用」· 装机引导 + 装后推送闭环 */}
            <PwaInstallGuide />
            {/* §SELF-USE-FIRST 埋点 · page.view 自动追踪 */}
            <PageViewTracker />
            {/* §观测埋点 · 浏览器错误捕获 (window.onerror + unhandledrejection) */}
            <ClientErrorReporter />
          </RightPaneProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
