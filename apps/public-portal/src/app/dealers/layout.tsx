import type { Metadata } from 'next';
import { GROUP } from '../../lib/brand';

export const metadata: Metadata = {
  title: '查找经销商',
  description: `查找${GROUP.nameCn}授权经销商与体验中心 — 覆盖全国主要城市的销售、安装与工程服务网络。`,
  alternates: { canonical: '/dealers' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
