import type { Metadata } from 'next';
import { GROUP } from '../../lib/brand';

export const metadata: Metadata = {
  title: '选型 / 能耗测算',
  description: `${GROUP.nameCn}在线测算工具 — 根据户型与使用场景，估算系统选型与能耗参考。`,
  alternates: { canonical: '/calculator' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
