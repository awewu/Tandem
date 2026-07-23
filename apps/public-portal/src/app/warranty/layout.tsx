import type { Metadata } from 'next';
import { GROUP } from '../../lib/brand';

export const metadata: Metadata = {
  title: '保修注册',
  description: `注册您的${GROUP.nameCn}产品，激活官方质保、获得延保资格、上门优先响应与保养提醒。`,
  alternates: { canonical: '/warranty' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
