import type { Metadata, Viewport } from 'next';

/**
 * 外部用户 Hub · 路由级 layout
 *
 * 给合作伙伴落地页挂外部品牌的标题/PWA 元数据 (而非内部 "Tandem · 牛马搭子"),
 * 配合 AppShell 的无 chrome 渲染, 让外部用户看到的是一个独立产品空间。
 */
export const metadata: Metadata = {
  title: '牛马搭子 · 合作伙伴空间',
  description: '瑞合瑞德合作伙伴工作空间 — 搭子手抄等授权应用, 你的数据由你掌控.',
  applicationName: '牛马搭子',
  appleWebApp: {
    capable: true,
    title: '牛马搭子',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#C8202C',
  width: 'device-width',
  initialScale: 1,
};

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return children;
}
