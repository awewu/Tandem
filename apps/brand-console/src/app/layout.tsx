import type { Metadata } from 'next';
import './globals.css';
import { HubReturnButton } from '@rhautt/shared-auth';
import AuthProvider from '../components/AuthProvider';

export const metadata: Metadata = {
  title: '品牌运营控制台 · Everhot',
  description: '板块一内部 admin：Everhot 产品库编辑 / 上新 / 上下架 / 产品图 DAM / 发布',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <HubReturnButton />
      </body>
    </html>
  );
}
