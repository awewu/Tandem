import type { Metadata } from 'next';
import { GROUP } from '../../lib/brand';

export const metadata: Metadata = {
  title: '产品系列',
  description: `${GROUP.nameCn}产品系列 — 热泵、中央热水、中央空调、新风净化、净水与智控系统，Rheem · Ruud · EverHot 授权运营。`,
  alternates: { canonical: '/products' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
