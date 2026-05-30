'use client';

import { ShieldCheck } from 'lucide-react';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function DelegationPage() {
  return (
    <PlaceholderPage
      icon={ShieldCheck}
      title="实习权限"
      subtitle="L0-L3 实习等级 + 绿黄红三区 (MANIFESTO §9 + ACADEMY §1.3)"
      pillar="拿捏 · 我的分身"
      phase="P0 IA 占位 · P4 合规强校准时落地"
      features={[
        'L0 新手 🥚 (report_only) · 只输出 brief / 报告, 不代行',
        'L1 上手 🐣 (draft) · 可起草 (邮件/IM/文档), 必须人工发送',
        'L2 熟手 🐤 (auto+24h_veto) · 可代发, 24h 内可撤回',
        'L3 老手 🦅 / 拿手 🐉 (auto) · 黄区动作可代行 (24h 否决窗仍生效)',
        '🟢 绿区 (SOP 确认 / 状态查询) · 任意 L 可代行',
        '🟡 黄区 (排期 / 判断选择) · L2+ 起步 · 起草+签批',
        '🔴 红区 (客户谈判 / 面试 / 绩效) · 严禁代行任何 L',
        '所有代行产出强制 "AI 代理" 水印',
        '晋升铁律: 跨级晋升必须直属上级 + Steward 双签批',
        '学籍锁定: 必修过期 → 自动降一级 (academy.delegation_locked)',
      ]}
      relatedDoc="MANIFESTO"
      fallback={{ label: '查看代行审计日志', href: '/persona/me/proxy-actions' }}
    />
  );
}
