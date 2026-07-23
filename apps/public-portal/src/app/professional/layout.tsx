import type { Metadata } from 'next';
import { GROUP } from '../../lib/brand';

export const metadata: Metadata = {
  title: '专业通道 · 经销商 / 设计师',
  description: `${GROUP.nameCn}专业人员通道 — 经销商 / 设计师 / 安装工专属工作台、授权经销商申请、培训认证与技术支持。`,
  alternates: { canonical: '/professional' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
