import type { Metadata, Viewport } from 'next';

/**
 * 搭子手抄 · 路由级 layout
 *
 * 给独立笔记产品挂自己的 PWA manifest, 让用户可以把 /shouchao 单独
 * "添加到主屏" 当独立 app 用 (start_url=/shouchao, 独立图标/名称).
 * 复用 root layout 的外壳与全站 service worker (scope=/ 已覆盖 /shouchao).
 */
export const metadata: Metadata = {
  title: '搭子手抄 · AI 笔记',
  description: '员工个人笔记 · 随手记 → AI 加工 → 多端同步. 对标 Notion / Get笔记.',
  applicationName: '搭子手抄',
  manifest: '/shouchao.webmanifest',
  appleWebApp: {
    capable: true,
    title: '搭子手抄',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#C8202C',
  width: 'device-width',
  initialScale: 1,
};

export default function ShouchaoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
