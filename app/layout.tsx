import type { Metadata, Viewport } from 'next';
import { Inter, Inter_Tight } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import AppRail from '@/components/app-rail';
import SubSidebar from '@/components/sub-sidebar';
import { RightPaneProvider } from '@/components/right-pane';
import { CommandPalette } from '@/components/command-palette';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { Toaster } from '@/components/toaster';
import { ErrorBoundary } from '@/components/error-boundary';
import { ApiHydrator } from '@/components/api-hydrator';
import { PwaRegister } from '@/components/pwa-register';
import { MobileTopBar } from '@/components/mobile-top-bar';
import { MobileTabBar } from '@/components/mobile-tab-bar';
import { BossAiMount } from '@/components/boss-ai';
import { PageViewTracker } from '@/components/page-view-tracker';

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
            <ApiHydrator />
            {/*
              Responsive shell:
              - md+ : 桌面三栏 (AppRail + SubSidebar + main)
              - <md : 顶栏 + 全屏 main + 底部 tab bar (Kimi/GPT 移动端风格)
                     AppRail / SubSidebar 在 mobile 视口下隐藏.
            */}
            <div className="flex h-screen w-screen flex-col overflow-hidden bg-[rgb(var(--surface-2))] md:flex-row">
              {/* Desktop only */}
              <div className="hidden md:contents">
                <AppRail />
                <SubSidebar />
              </div>

              {/* Mobile only top bar */}
              <MobileTopBar />

              <main className="flex-1 overflow-y-auto bg-[rgb(var(--surface-1))] pb-[56px] md:overflow-hidden md:pb-0">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>

              {/* Mobile only bottom tab bar */}
              <MobileTabBar />
            </div>
            <CommandPalette />
            <KeyboardShortcuts />
            <Toaster />
            <PwaRegister />
            {/* §SELF-USE-FIRST 埋点 · page.view 自动追踪 */}
            <PageViewTracker />
            {/* §灵魂入口 · Tandem AI = 老板的搭子 · 全应用浮动问老板 · ⌘J */}
            <BossAiMount />
          </RightPaneProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
