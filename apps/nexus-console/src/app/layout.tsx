import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '../components/Sidebar';
import SessionBar from '../components/SessionBar';

export const metadata: Metadata = {
  title: 'Rhautt Nexus 管理中枢',
  description: '对内工程底座 / 控制平面 —— 非视觉骨架，不吞并任何独立网站',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </head>
      <body>
        <div className="app">
          <div className="top">
            <div className="logo">
              <img src="/images/rysnova-logo.jpg" alt="Rysnova" style={{ height: 22, width: 'auto', objectFit: 'contain' }} />
              <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 500 }}>Nexus 管理中枢（内部）</span>
            </div>
            <div className="spacer" />
            <span className="pill">环境：开发</span>
            <SessionBar />
          </div>
          <Sidebar />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
