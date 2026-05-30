'use client';

import { FileLock } from 'lucide-react';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function CompliancePage() {
  return (
    <PlaceholderPage
      icon={FileLock}
      title="合规与红线"
      subtitle="季度必修 · 过期自动锁权限 (P4 加固)"
      pillar="拿捏 · 学习中心"
      phase="P2 MVP / P4 强校准"
      features={[
        '数据安全 (来自 /memories?type=redline)',
        '反贿赂与廉洁 (来自 /intranet/ethics)',
        '信息保密',
        '安全生产',
        '过期 → 红线类锁权限 / 其他类仅提醒 (D1 决策)',
      ]}
    />
  );
}
