'use client';

import { Layers } from 'lucide-react';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function ProductsPage() {
  return (
    <PlaceholderPage
      icon={Layers}
      title="产品学院"
      subtitle="深入学习公司各产品线 + 行业知识"
      pillar="拿捏 · 学习中心"
      phase="P2 MVP · 即将上线"
      features={[
        '产品 A/B/C 深潜 (内容来自 /knowledge?cat=products)',
        '行业知识与竞品对比',
        'AI 课程生成器: 文档 → 讲解 + 5 题 + 摘要卡',
        '完成 → 产品 Mode Proficiency +5',
      ]}
    />
  );
}
