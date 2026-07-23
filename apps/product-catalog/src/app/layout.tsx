import type { Metadata } from 'next';
import './globals.css';
import { HubReturnButton } from '@rhautt/shared-auth';

export const metadata: Metadata = { title: '产品目录 · 瑞诺瓦' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, background: 'var(--surface-1)' }}>
        {children}
        <HubReturnButton />
      </body>
    </html>
  );
}
