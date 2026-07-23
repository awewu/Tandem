import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '../components/AuthProvider';
import NavBar from '../components/NavBar';
import { HubReturnButton } from '@rhautt/shared-auth';

export const metadata: Metadata = { title: '瑞诺瓦 · 技术支持深化端' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: '-apple-system,"PingFang SC",sans-serif', background: '#f7f9fc' }}>
        <AuthProvider>
          <NavBar />
          {children}
        </AuthProvider>
        <HubReturnButton />
      </body>
    </html>
  );
}
