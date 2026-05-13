import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { QueryProvider } from '@/components/query-provider';
import Sidebar from '@/components/sidebar';
import { CommandPalette } from '@/components/command-palette';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { Toaster } from '@/components/toaster';
import { ErrorBoundary } from '@/components/error-boundary';
import { ApiHydrator } from '@/components/api-hydrator';

export const metadata: Metadata = {
  title: 'Tandem · 牛马搭子',
  description:
    'Tandem 牛马搭子 — 让 17 分钟达成共识的 AI 协作伙伴. 事半 (企业 OKR) × 拿捏 (员工 AI 成长).',
  applicationName: 'Tandem',
  authors: [{ name: 'Tandem Team' }],
  keywords: ['Tandem', '牛马搭子', 'OKR', '议事室', 'AI 副驾', '企业协作'],
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#09090b' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <QueryProvider>
          <ThemeProvider>
            <ApiHydrator />
            <div className="flex h-screen w-screen overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-hidden">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
            <CommandPalette />
            <KeyboardShortcuts />
            <Toaster />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
