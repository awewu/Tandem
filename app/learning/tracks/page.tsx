'use client';

import { TrendingUp } from 'lucide-react';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function TracksPage() {
  return (
    <PlaceholderPage
      icon={TrendingUp}
      title="专项进阶"
      subtitle="高级路径 · 解锁晋升"
      pillar="拿捏 · 学习中心"
      phase="P2 MVP · 即将上线"
      features={[
        '新晋经理训练营',
        '高级技术准入',
        '跨部门轮岗',
        '完成 → 解锁晋升路径 (E1 决策: 选修加分, 专项解锁晋升)',
      ]}
    />
  );
}
