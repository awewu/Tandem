import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import Sidebar from '@/components/sidebar';
import { CommandPalette } from '@/components/command-palette';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { Toaster } from '@/components/toaster';
import { ErrorBoundary } from '@/components/error-boundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '拿捏 — 工作不会找拿捏',
  description: '拿捏 · 工作不会找拿捏',
};

export const viewport = {
  charset: 'utf-8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
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
      </body>
    </html>
  );
}
