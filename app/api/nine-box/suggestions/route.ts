/**
 * 9-box 联动建议 · CHARTER-KPI-TTI §5 M4
 *
 * GET /api/nine-box/suggestions?cycleId=...
 *
 * 根据每个人的 9-box 落点, 生成管理建议:
 *   - star            → 建议 Persona 升级 + 关键保留计划
 *   - high_performer  → 给挑战项目 / 拉 TTI 战略空间
 *   - risk_burnout    → ⚠ 干预决策卡 (拉 TTI 防枯萎)
 *   - growth_star     → 关键培养 / 给 KPI 突破机会
 *   - core_force      → 稳定 + 选项激励
 *   - platform        → 平台期决策卡 (重新点燃)
 *   - misalign        → 调岗讨论决策卡
 *   - low_engagement  → 主管 1on1 决策卡
 *   - must_intervene  → 🚨 紧急干预决策卡
 *
 * 返回:
 *   { suggestions: [{ userId, name, cell, kpiScore, ttiScore, actions: [...] }] }
 *
 * action.kind: 'decision_card' (建议建决策卡) | 'persona_upgrade' (建议升级 Persona)
 * action.draft 包含 title / decisionClass / 推荐 owner / 建议时限
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { classifyNineBox, type NineBoxCell } from '@/lib/types/okr-tti';
import { computeKpiCompletion } from '@/lib/types/kpi';

interface SuggestionAction {
  kind: 'decision_card' | 'persona_upgrade';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  /** decision_card 时的建议字段 */
  draft?: {
    decisionClass: 'simple' | 'complex' | 'strategic';
    suggestedOwner?: string;
    timelineDays: number;
  };
}

interface Suggestion {
  userId: string;
  name?: string;
  cell: NineBoxCell;
  kpiScore: number;
  ttiScore: number;
  actions: SuggestionAction[];
}

const CELL_ACTIONS: Record<
  NineBoxCell,
  (userId: string) => SuggestionAction[]
> = {
  star: (userId) => [
    {
      kind: 'persona_upgrade',
      priority: 'high',
      title: '建议 Persona 升级评估',
      description: `${userId} 在双轨均高分 — 适合启动 Persona 升级 (assistant → deputy 等) + 关键保留计划`,
    },
    {
      kind: 'decision_card',
      priority: 'medium',
      title: '关键保留计划',
      description: '制定升职 / 扩责任 / 高潜池入选方案',
      draft: { decisionClass: 'strategic', timelineDays: 30 },
    },
  ],
  high_performer: (userId) => [
    {
      kind: 'decision_card',
      priority: 'medium',
      title: '给挑战项目 (拉 TTI)',
      description: `${userId} KPI 超额但 TTI 一般 — 给战略项目让 TTI 起来`,
      draft: { decisionClass: 'complex', timelineDays: 60 },
    },
  ],
  risk_burnout: (userId) => [
    {
      kind: 'decision_card',
      priority: 'urgent',
      title: '⚠ 风险枯萎干预',
      description: `${userId} 长期高 KPI + 低 TTI = 重复劳动倦怠风险. 立即给成长机会 / 调整目标`,
      draft: { decisionClass: 'complex', timelineDays: 14 },
    },
  ],
  rising_talent: (userId) => [
    {
      kind: 'decision_card',
      priority: 'high',
      title: '关键培养 — 给 KPI 突破机会',
      description: `${userId} 战略成长好但 KPI 接近达成 — 给资源 / 培训突破底线`,
      draft: { decisionClass: 'complex', timelineDays: 30 },
    },
  ],
  core: () => [], // 稳定 + 自然激励, 不需要主动决策卡
  plateau: (userId) => [
    {
      kind: 'decision_card',
      priority: 'medium',
      title: '平台期 — 重新点燃',
      description: `${userId} 双线中等且稳定 - 调整 TTI 方向或新职责让活力回来`,
      draft: { decisionClass: 'simple', timelineDays: 30 },
    },
  ],
  mismatch: (userId) => [
    {
      kind: 'decision_card',
      priority: 'high',
      title: '人岗错位 — 调岗讨论',
      description: `${userId} TTI 高 + KPI 低 — 高战略意愿但底线不达, 考虑调岗或重塑职责`,
      draft: { decisionClass: 'strategic', timelineDays: 21 },
    },
  ],
  low_engagement: (userId) => [
    {
      kind: 'decision_card',
      priority: 'medium',
      title: '投入不足 — 主管 1on1',
      description: `${userId} 双线偏低但 TTI 略高于 KPI - 安排深度 1on1 找原因`,
      draft: { decisionClass: 'simple', timelineDays: 7 },
    },
  ],
  must_intervene: (userId) => [
    {
      kind: 'decision_card',
      priority: 'urgent',
      title: '🚨 紧急干预',
      description: `${userId} 双线低分 - 立即介入: PIP / 调岗 / 离职辅导 三选一`,
      draft: { decisionClass: 'strategic', timelineDays: 7 },
    },
  ],
};

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, ['manager', 'admin', 'champion', 'steward']);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const cycleId = url.searchParams.get('cycleId');

  const store = getStore();
  const allKrs = await store.keyResults.list();
  const krs = cycleId
    ? (await store.objectives.list())
        .filter((o) => o.cycleId === cycleId)
        .map((o) => o.id)
        .reduce(
          (acc: typeof allKrs, oid) => acc.concat(allKrs.filter((k) => k.objectiveId === oid)),
          [],
        )
    : allKrs;
  const allKpis = (await store.kpis.list()).filter(
    (k) =>
      k.tenantId === auth.tenantId &&
      k.scope === 'bonus' &&
      (!cycleId || k.cycleId === cycleId),
  );

  const krByOwner = new Map<string, typeof allKrs>();
  for (const k of krs) {
    const arr = krByOwner.get(k.ownerId) ?? [];
    arr.push(k);
    krByOwner.set(k.ownerId, arr);
  }
  const kpiByAssignee = new Map<string, typeof allKpis>();
  for (const k of allKpis) {
    const arr = kpiByAssignee.get(k.assigneeId) ?? [];
    arr.push(k);
    kpiByAssignee.set(k.assigneeId, arr);
  }

  const owners = new Set<string>([
    ...Array.from(krByOwner.keys()),
    ...Array.from(kpiByAssignee.keys()),
  ]);

  const suggestions: Suggestion[] = [];

  for (const userId of Array.from(owners)) {
    const ownKrs = krByOwner.get(userId) ?? [];
    const ttiScore =
      ownKrs.length === 0
        ? 0
        : ownKrs.reduce((sum, k) => {
            if (k.targetValue === k.startValue) return sum + 1;
            const r = (k.currentValue - k.startValue) / (k.targetValue - k.startValue);
            return sum + Math.max(0, Math.min(1, r));
          }, 0) / ownKrs.length;

    const myBonusKpis = kpiByAssignee.get(userId) ?? [];
    let kpiScore = 0;
    if (myBonusKpis.length > 0) {
      const totalW = myBonusKpis.reduce((s, k) => s + k.weight, 0);
      if (totalW > 0) {
        const sum = myBonusKpis.reduce(
          (s, k) => s + k.weight * computeKpiCompletion(k),
          0,
        );
        kpiScore = Math.min(1, sum / totalW);
      }
    }

    // 没有任何数据的人跳过 (避免 must_intervene 假警报)
    if (ownKrs.length === 0 && myBonusKpis.length === 0) continue;

    const cell = classifyNineBox(kpiScore, ttiScore);
    const actions = CELL_ACTIONS[cell](userId);

    // best-effort 姓名解析
    let name: string | undefined;
    try {
      const user = await store.auth.users.findById(userId);
      if (user?.name) name = user.name;
    } catch {
      /* noop */
    }

    suggestions.push({ userId, name, cell, kpiScore, ttiScore, actions });
  }

  // 按建议紧急度排序 (urgent > high > medium > low > 无 action)
  const priorityRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  suggestions.sort((a, b) => {
    const ar = Math.min(...a.actions.map((x) => priorityRank[x.priority] ?? 4), 5);
    const br = Math.min(...b.actions.map((x) => priorityRank[x.priority] ?? 4), 5);
    return ar - br;
  });

  return NextResponse.json({ suggestions, total: suggestions.length });
}
