'use client';

/**
 * UpgradeProposalBanner
 *
 * 宪章 §15 autonomy 守门: cron (`scanPersonaUpgrades`) 会为高风险阶段
 * (assistant→deputy / deputy→partner) 写入一条 `upgrade_proposal` growthArea.
 * 这些阶段**不能静默自动升**, 必须员工本人看到 + 读懂 autonomy 扩张边界后点确认.
 *
 * 本组件负责:
 *   1. 扫描 `persona.growthAreas` 找到 status='identified' 且 category='upgrade_proposal' 的条目
 *   2. 用加重样式展示 (amber/rose), 说明新阶段会扩张到什么权限
 *   3. 提供 "确认升级" (POST) 和 "暂不升级" (DELETE) 两个按钮
 *   4. 操作成功后回调 refresh
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Check, X, Bot, Sparkles } from 'lucide-react';
import type { Persona, PersonaStage } from '@/lib/types/persona';

interface AutonomyChange {
  title: string;
  desc: string;
  color: 'amber' | 'rose';
}

const AUTONOMY_CHANGE: Record<PersonaStage, AutonomyChange | null> = {
  newborn: null,
  apprentice: null,
  // deputy 是新权限边界扩张的第一跳 — 黄区代行
  assistant: {
    title: '升级到 🦅 副手 = 开启"黄区会议短承诺"代行权',
    desc:
      '确认后, 分身可在工作时段内对黄区议题 (中等风险) 代你做出 ≤ 1 工作日的承诺 (例如: "明天之前给你方案"). 仍有 24h 否决窗口, 红区(薪资/法律/投诉)永禁.',
    color: 'amber',
  },
  // partner 是跨企业权限扩张 — 尤其需谨慎
  deputy: {
    title: '升级到 🐉 搭档 = 开启"跨企业代行"权 (除红区)',
    desc:
      '确认后, 分身可在跨企业会议中代你参会表态 (第 17 条: 客户/合作伙伴会议需双方书面同意 + 双倍水印). 24h 否决窗口保留. 这是员工尊严铁律下的最高 autonomy, 请谨慎评估.',
    color: 'rose',
  },
  partner: null,
};

export function UpgradeProposalBanner({
  persona,
  onChanged,
}: {
  persona: Persona;
  onChanged: () => void | Promise<void>;
}) {
  const proposal = persona.growthAreas.find(
    (g) => g.category === 'upgrade_proposal' && g.status === 'identified'
  );
  if (!proposal) return null;

  const change = AUTONOMY_CHANGE[persona.stage];
  if (!change) return null;

  const cls =
    change.color === 'rose'
      ? 'border-rose-300 bg-gradient-to-br from-rose-50 via-white to-rose-50'
      : 'border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-50';
  const iconCls =
    change.color === 'rose' ? 'text-rose-600' : 'text-amber-600';
  const confirmBtnCls =
    change.color === 'rose'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : 'bg-amber-600 hover:bg-amber-700 text-white';

  async function confirmUpgrade() {
    const sure = window.confirm(
      `${change!.title}\n\n${change!.desc}\n\n确认升级? (可随时在控制台回退)`
    );
    if (!sure) return;
    const res = await fetch('/api/tandem/persona/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId: persona.id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(`升级失败: ${err.error ?? res.statusText}`);
      return;
    }
    await onChanged();
  }

  async function dismiss() {
    const res = await fetch(
      `/api/tandem/persona/upgrade?personaId=${encodeURIComponent(persona.id)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(`暂不升级失败: ${err.error ?? res.statusText}`);
      return;
    }
    await onChanged();
  }

  return (
    <Card className={cls}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ${iconCls}`}
          >
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                <Sparkles className="h-3 w-3" /> autonomy 守门
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                <Bot className="h-3 w-3" /> 由 cron 识别 ·{' '}
                {new Date(proposal.identifiedAt).toLocaleString()}
              </span>
            </div>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">
              {change.title}
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-700">
              {change.desc}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-white/70 bg-white/70 px-3 py-2 text-[11px] text-slate-600">
          <strong className="text-slate-800">宪章 §15:</strong> 升级必须由员工本人确认,
          AI 不会自动扩张代行边界. 点「暂不升级」不会降档, 只会关掉本次提醒 —
          你可以之后在「进化进度」页随时手动触发.
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void confirmUpgrade()} className={confirmBtnCls} size="sm">
            <Check className="mr-1 h-3.5 w-3.5" />
            确认升级
          </Button>
          <Button onClick={() => void dismiss()} variant="outline" size="sm">
            <X className="mr-1 h-3.5 w-3.5" />
            暂不升级
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
