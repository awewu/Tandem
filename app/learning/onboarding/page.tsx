'use client';

import { PartyPopper } from 'lucide-react';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function OnboardingPage() {
  return (
    <PlaceholderPage
      icon={PartyPopper}
      title="入职必修"
      subtitle="新员工第一周必学 · 30/60/90 天目标"
      pillar="拿捏 · 学习中心"
      phase="P2 MVP · 即将上线"
      features={[
        '公司文化与价值观',
        '组织架构 (来自 /organization)',
        '产品线总览 (AI 自动生成自 /knowledge)',
        'IT / 办公环境与工具',
        '30/60/90 天目标 → 自动生成 KR-onboarding',
      ]}
    />
  );
}
