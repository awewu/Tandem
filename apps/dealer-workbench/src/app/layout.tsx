import type { Metadata } from 'next';
import './globals.css';
import DealerNav from '../components/DealerNav';
import DealerTopBar from '../components/DealerTopBar';

export const metadata: Metadata = { title: '瑞诺瓦 AI 舒适家' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
      <body>
        <div className="layout">
          <DealerNav />
          <DealerTopBar />
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
