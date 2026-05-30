'use client';

import { Database } from 'lucide-react';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function DataSourcePage() {
  return (
    <PlaceholderPage
      icon={Database}
      title="养料仪表盘"
      subtitle="透明展示分身学了我的什么 · 一键 Opt-Out (B2 必交付)"
      pillar="拿捏 · 我的分身"
      phase="P0 IA 占位 · P4 合规强校准时落地"
      features={[
        '日报 / 周报 / 决议历史 训练样本透明展示',
        '每类数据来源独立 Opt-In / Opt-Out 开关',
        '一键擦除我的分身记忆链 (满足数据可携权与遗忘权)',
        '审计 trail: 何时被分身用作训练 / 推理',
      ]}
      relatedDoc="SUMMON-AND-NURTURE"
    />
  );
}
