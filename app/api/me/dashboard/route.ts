/**
 * GET /api/me/dashboard?userId=...
 *
 * "我的工作台" 聚合 endpoint, 服务于首页双栏
 *   - 左栏 "事半功倍 · 我的待办": 需要我立刻行动的事
 *   - 右栏 "拿捏老板 · 我的训练": 我在 Tandem 里的产出/积累
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import {
  PROMOTION_REQUIRED_ROLES,
  type MemoryPromotionRequest,
  type MemorySignerRole,
} from '@/lib/types/memory';
import {
  checkUpgradeEligibility,
  computeBossCaptureScore,
} from '@/lib/persona/evolution';

const VETO_WINDOW_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  await boot();
  const userId = new URL(req.url).searchParams.get('userId') ?? 'demo-user';
  const store = getStore();

  // 解析当前用户在 Tandem 里有哪些角色 (用于匹配 Memory promotion 签字者)
  // V1 简化: demo-user 默认拥有所有角色 (方便单人 demo 看到全部待办)
  // 生产: 应来源于 OrgMembership / Steward 表
  const myRoles = await resolveMyRoles(store, userId);

  // -- 并行拉数据 -----------------------------------------------------------
  const [
    promotions,
    personasList,
    keyResults,
    ttis,
    decisionCards,
    memories,
  ] = await Promise.all([
    store.promotions.list(),
    store.personas.list(),
    store.keyResults.list(),
    store.ttis.list(),
    store.decisionCards.list(),
    store.memories.list(),
  ]);

  // -- 左栏: 我的待办 --------------------------------------------------------
  const myPersona =
    personasList.find((p) => p.userId === userId) ?? null;

  // 1. 待我签字的 Memory promotion
  const promotionsAwaitingMySignature = (promotions as MemoryPromotionRequest[])
    .filter((p) => p.status === 'pending')
    .map((p) => {
      const level = p.level ?? 'company';
      const required = PROMOTION_REQUIRED_ROLES[level] ?? [];
      const myRequiredRoles = required.filter((r) => myRoles.includes(r));
      if (myRequiredRoles.length === 0) return null;
      const history = p.signers?.history ?? [];
      const alreadySignedRoles = new Set(history.map((s) => s.role));
      const pendingRoles = myRequiredRoles.filter(
        (r) => !alreadySignedRoles.has(r)
      );
      if (pendingRoles.length === 0) return null;
      return {
        id: p.id,
        title: p.proposedTitle,
        level,
        slaDeadline: p.slaDeadline,
        myPendingRoles: pendingRoles,
        overdue: p.slaDeadline
          ? new Date(p.slaDeadline).getTime() < Date.now()
          : false,
      };
    })
    .filter(Boolean);

  // 2. 待确认的 Persona 升阶
  let personaUpgradeAvailable: {
    fromStage: string;
    toStage: string;
    bossCaptureScore: number;
    reason?: string;
  } | null = null;
  if (myPersona) {
    const check = checkUpgradeEligibility(myPersona);
    if (check.eligible && check.nextStage && check.requiresUserConfirmation) {
      personaUpgradeAvailable = {
        fromStage: myPersona.stage,
        toStage: check.nextStage,
        bossCaptureScore: computeBossCaptureScore(myPersona),
        reason: check.reason,
      };
    }
  }

  // 3. 我 owner 的 KR 风险
  const myKrAtRisk = keyResults
    .filter((k) => k.ownerId === userId && k.riskStatus !== 'on_track')
    .map((k) => ({
      id: k.id,
      title: k.title,
      currentValue: k.currentValue,
      targetValue: k.targetValue,
      startValue: k.startValue,
      progress:
        k.targetValue === k.startValue
          ? 1
          : Math.max(
              0,
              Math.min(
                1,
                (k.currentValue - k.startValue) /
                  (k.targetValue - k.startValue)
              )
            ),
      riskStatus: k.riskStatus,
    }));

  // 4. owner 当前进行中 TTI
  const myTtiInProgress = ttis
    .filter((t) => t.ownerId === userId && t.completionRate < 1)
    .map((t) => ({
      id: t.id,
      title: t.title,
      completionRate: t.completionRate,
    }));

  // 5. 24h 否决窗口内我刚 COMMIT 的决议
  const now = Date.now();
  const myRecentCommitsInVetoWindow = decisionCards
    .filter((d) => d.createdBy === userId && d.convergenceState === 'COMMIT')
    .filter((d) => {
      const t = d.createdAt ? new Date(d.createdAt).getTime() : 0;
      return now - t < VETO_WINDOW_MS;
    })
    .slice(0, 5)
    .map((d) => ({
      id: d.id,
      title: d.title,
      committedAt: d.createdAt,
      vetoableUntilMs:
        new Date(d.createdAt).getTime() + VETO_WINDOW_MS,
      remainingMs: Math.max(
        0,
        new Date(d.createdAt).getTime() + VETO_WINDOW_MS - now
      ),
    }));

  // -- 右栏: 我的创造 ------------------------------------------------------------------------------------------------------------------
  const myPromotions = (promotions as MemoryPromotionRequest[]).filter(
    (p) => p.createdBy === userId
  );
  const myMemoryContributions = {
    total: myPromotions.filter((p) => p.status === 'approved').length,
    pending: myPromotions.filter((p) => p.status === 'pending').length,
    rejected: myPromotions.filter((p) => p.status === 'rejected').length,
  };
  void memories; // 保留 import 占位 (V1 不直接按 memory 过滤贡献者)

  const myRecentDecisions = decisionCards
    .filter((d) => d.createdBy === userId)
    .slice()
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 5)
    .map((d) => ({
      id: d.id,
      title: d.title,
      state: d.convergenceState,
      selected: d.selected,
      createdAt: d.createdAt,
    }));

  // 本周 learning items: 取 persona.learningHistory 长度估算 (best-effort)
  void ONE_WEEK_MS; // V1: persona 未持久化 learningHistory, 暂置 0
  const weeklyLearningCount = 0;

  return NextResponse.json({
    userId,
    user: { id: userId, name: userId },
    todos: {
      promotionsAwaitingMySignature,
      personaUpgradeAvailable,
      myKrAtRisk,
      myTtiInProgress,
      myRecentCommitsInVetoWindow,
      totalCount:
        promotionsAwaitingMySignature.length +
        (personaUpgradeAvailable ? 1 : 0) +
        myKrAtRisk.length +
        myTtiInProgress.length +
        myRecentCommitsInVetoWindow.length,
    },
    creation: {
      persona: myPersona
        ? {
            id: myPersona.id,
            stage: myPersona.stage,
            bossCaptureScore: computeBossCaptureScore(myPersona),
            learningActive: myPersona.learningActive ?? false,
          }
        : null,
      myMemoryContributions,
      myRecentDecisions,
      weeklyLearningCount,
    },
  });
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

type StoreLike = ReturnType<typeof getStore>;

async function resolveMyRoles(
  store: StoreLike,
  userId: string
): Promise<MemorySignerRole[]> {
  // V1 简化 demo: demo-user 拥有全部角色, 方便单人体验所有待办  // 生产应基于 OrgMembership + Steward 表eward repo
  if (userId === 'demo-user' || userId === 'owner') {
    return [
      'team_leader',
      'dept_leader',
      'kr_owner',
      'steward',
      'ceo',
      'clevel',
    ] as MemorySignerRole[];
  }
  // 尝试从 stewards 表读 (单点查询)
  try {
    const found = await store.stewards.get(userId);
    if (found) return ['steward'];
  } catch {
    /* noop */
  }
  return [];
}
