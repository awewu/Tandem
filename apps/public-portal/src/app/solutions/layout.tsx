import type { Metadata } from 'next';
import { GROUP } from '../../lib/brand';

export const metadata: Metadata = {
  title: '系统解决方案',
  description: `${GROUP.nameCn}系统解决方案 — 中央热水、采暖制冷、空气品质、水处理与智控五大系统族集成交付。`,
  alternates: { canonical: '/solutions' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
