'use client';

import { Brain } from 'lucide-react';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function MyRetrosPage() {
  return (
    <PlaceholderPage
      icon={Brain}
      title="我的复盘库"
      subtitle="季度自检 + KR 落地复盘 + AI 反向提问"
      pillar="拿捏 · 技能与成长"
      phase="P6 长尾 · 持续沉淀"
      features={[
        '主分身定时 prompt: "你今天解了 KR-3 卡点, 写 50 字复盘?"',
        'KR 落地后 X 天主分身自动催复盘 (retro-pending)',
        '季度自检模板 (我做对了什么 / 我可以更好什么 / 下季度押注)',
        '复盘内容默认私有, 可选择沉淀为公司案例 (走 §8 签批)',
      ]}
      relatedDoc="MANIFESTO"
    />
  );
}
