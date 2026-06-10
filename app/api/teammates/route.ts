/**
 * GET /api/teammates
 *
 * AI 同事目录 (对标 Asana AI Teammate).
 *
 * 列出当前用户可对话的 AI 角色 + 各自能力/指标. 每个角色都带 entry URL,
 * 员工像看团队成员一样浏览 → 一键召唤.
 *
 * 第一版包含:
 *   - 中央 AI (CompanyBrain) — 公司层参谋, 所有人可问
 *   - 我的搭子 (Personal Persona) — 个人分身, stage/delegation/教训计数
 *
 * 后续可扩: 三大部 AI (governance/hr/strategy), 部门 AI.
 *
 * fail-soft: 任一 teammate 数据失败退化为空指标, 不挂整个 API.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { requireAuth } from '@/lib/auth/require-auth';
import { REFLEXION_TAG } from '@/lib/persona/reflexion';
import type { DecisionCard } from '@/lib/types/decision-card';
import type { MemoryEntry } from '@/lib/types/memory';

export const runtime = 'nodejs';

interface TeammateCard {
  id: string;
  kind: 'central' | 'persona' | 'governance' | 'department';
  name: string;
  subtitle: string;
  avatar?: string;
  capabilities: string[];
  /** 风险标签 (绿/黄/红区) */
  zone: 'green' | 'mixed' | 'red';
  stats: {
    label: string;
    value: string | number;
  }[];
  entryUrl: string;
  status: 'active' | 'disabled';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const teammates: TeammateCard[] = [];

  // ── 中央 AI ──
  try {
    const sinceMs = Date.now() - 7 * 86400_000;
    const all = (await store.decisionCards.list()) as DecisionCard[];
    const recent = all.filter((c) => {
      const t = new Date(c.createdAt ?? 0).getTime();
      return t >= sinceMs;
    });
    const adopted = recent.filter((c) => c.convergenceState === 'COMMIT').length;
    const vetoed = recent.filter((c) => c.convergenceState === 'VETOED').length;
    const total = adopted + vetoed;
    const adoptRate = total > 0 ? Math.round((adopted / total) * 100) : null;

    teammates.push({
      id: 'central',
      kind: 'central',
      name: '中央 AI · CompanyBrain',
      subtitle: '公司层参谋, 多步推理 + 真值感知, 不替任何人决定',
      capabilities: ['OKR 真值感知', 'S2 多步深推理', '公司知识检索', '红线兜底', '反思自学'],
      zone: 'green',
      stats: [
        { label: '近 7 天议事', value: recent.length },
        { label: '采纳率', value: adoptRate != null ? `${adoptRate}%` : '—' },
      ],
      entryUrl: '/',  // BossAI 全局浮窗, 任何页都可打开
      status: 'active',
    });
  } catch {
    teammates.push({
      id: 'central',
      kind: 'central',
      name: '中央 AI · CompanyBrain',
      subtitle: '公司层参谋',
      capabilities: ['OKR 感知', '深推理', '知识检索'],
      zone: 'green',
      stats: [{ label: '指标', value: '—' }],
      entryUrl: '/',
      status: 'active',
    });
  }

  // ── 我的搭子 ──
  try {
    const personas = await store.personas.list({ userId: auth.userId } as never);
    const persona = personas[0];
    if (persona) {
      // 近 30 天学到的教训数
      let lessonCount = 0;
      try {
        const memories = (await store.memories.list()) as MemoryEntry[];
        const since30 = Date.now() - 30 * 86400_000;
        lessonCount = memories.filter(
          (m) =>
            m.ownershipLevel === 'personal' &&
            m.ownerUserId === auth.userId &&
            m.type === 'lesson' &&
            (m.tags ?? []).includes(REFLEXION_TAG) &&
            new Date(m.createdAt ?? 0).getTime() >= since30,
        ).length;
      } catch { /* fail-soft */ }

      const delegLevel = (persona as { delegationLevel?: string }).delegationLevel ?? 'draft_only';
      const stage = (persona as { stage?: string }).stage ?? 'apprentice';
      const learningActive = (persona as { learningActive?: boolean }).learningActive ?? false;

      teammates.push({
        id: persona.id,
        kind: 'persona',
        name: '我的 AI 搭子',
        subtitle: `Stage: ${stage} · Delegation: ${delegLevel}`,
        capabilities: ['IM 代理回复', '日历感知', '议事室代行', '反思教训自动召回'],
        zone: delegLevel === 'commit_long' ? 'red' : delegLevel === 'commit_short' || delegLevel === 'cross_company' ? 'mixed' : 'green',
        stats: [
          { label: '阶段', value: stage },
          { label: '本月新学教训', value: lessonCount },
        ],
        entryUrl: '/persona/evolution',
        status: learningActive ? 'active' : 'disabled',
      });
    } else {
      teammates.push({
        id: 'no-persona',
        kind: 'persona',
        name: '我的 AI 搭子',
        subtitle: '尚未创建分身',
        capabilities: ['创建后可代行 IM / 议事 / 日历'],
        zone: 'green',
        stats: [{ label: '状态', value: '未创建' }],
        entryUrl: '/persona/training',
        status: 'disabled',
      });
    }
  } catch (err) {
    /* fail-soft: persona 段失败不影响中央 AI */
  }

  return NextResponse.json({
    teammates,
    generatedAt: new Date().toISOString(),
  });
}
