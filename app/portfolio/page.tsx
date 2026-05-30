'use client';

import { Gift } from 'lucide-react';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function PortfolioPage() {
  return (
    <PlaceholderPage
      icon={Gift}
      title="我的代表作"
      subtitle="沉淀产出 + 公司认可 · 让成长可见"
      pillar="拿捏 · 技能与成长"
      phase="P6 长尾 · 持续沉淀"
      features={[
        '主分身夜间自动汇总当日产出 → 候选代表作',
        '员工手动选择沉淀 (privacy 默认私有)',
        '同事 / 上级可点赞 / 评论 (类 LinkedIn endorse)',
        '离职导出 PDF 摘要 (MANIFESTO §13.3 合理获得物)',
      ]}
      relatedDoc="MANIFESTO"
    />
  );
}
