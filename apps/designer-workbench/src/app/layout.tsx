import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '../components/AuthProvider';
import NavBar from '../components/NavBar';
import { HubReturnButton } from '@rhautt/shared-auth';

export const metadata: Metadata = { title: '设计师工作台 · 瑞诺瓦' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', background: '#f7f9fc' }}>
        <AuthProvider>
          <NavBar />
          {children}
        </AuthProvider>
        <HubReturnButton />
      </body>
    </html>
  );
}
