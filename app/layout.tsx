import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { RightPaneProvider } from '@/components/right-pane';
import { Toaster } from '@/components/toaster';
import { PwaRegister } from '@/components/pwa-register';
import { AppShell } from '@/components/app-shell';
import { PageViewTracker } from '@/components/page-view-tracker';
import { ClientErrorReporter } from '@/components/client-error-reporter';

// 字体策略 (2026-06-09 生产硬化):
//   不再使用 next/font/google — Google Fonts CDN 在国内云主机/容器构建中频繁 ECONNRESET,
//   会直接 fail build. globals.css + tailwind.config.ts 已写完整 fallback 链
//   (Inter → -apple-system / Segoe UI Variable Text → PingFang SC / Microsoft YaHei UI),
//   未注入 --font-sans / --font-display 时 CSS 变量为空, 浏览器自动落到下一项, 视觉无损.
//   如未来要锁定 Inter, 改用 next/font/local 把 woff2 放 public/fonts/ 而非走外网.

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
