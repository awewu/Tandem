'use client';

import { ShieldCheck } from 'lucide-react';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function SkillGatewayAuditPage() {
  return (
    <PlaceholderPage
      icon={ShieldCheck}
      title="Skill Gateway 审计"
      subtitle="4 道闸调用日志 · Steward 月度审计专用"
      pillar="搭子 · 个人 AI 接入"
      phase="P4 合规强校准时落地"
      features={[
        '① Baseline-Guard — 是否违反公司 Memory 红线',
        '② OKR Drift Detection — 跟当前 active OKR 对齐度',
        '③ Data Scope — RBAC 4 级 (个人/团队/部门/公司)',
        '④ Action Scope — 红区拒 / 黄区签批 / 绿区+ProxyAction 24h 否决',
        '所有 prompt + tool calls + 拦截原因留痕',
        '导出 CSV / JSON 给 Steward 月度审计',
      ]}
      relatedDoc="MANIFESTO"
      fallback={{ label: '查看 LLM Usage Log', href: '/admin/usage' }}
    />
  );
}
