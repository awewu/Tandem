import type { Metadata, Viewport } from 'next';
import { Inter, Inter_Tight } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { RightPaneProvider } from '@/components/right-pane';
import { Toaster } from '@/components/toaster';
import { PwaRegister } from '@/components/pwa-register';
import { AppShell } from '@/components/app-shell';
import { PageViewTracker } from '@/components/page-view-tracker';
import { ClientErrorReporter } from '@/components/client-error-reporter';

// Body — Inter, variable weight 100-900, latin + latin-ext only (zh-CN falls back to system PingFang / Microsoft YaHei)
const fontSans = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
});

// Headings — Inter Tight, heavier display cousin of Inter (used for .rheem-display + h1/h2/h3)
const fontDisplay = Inter_Tight({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
  display: 'swap',
  weight: ['600', '700', '800', '900'],
});

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
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontDisplay.variable}`}
    >
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
