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
import { requireAuth } from '@/lib/auth/require-auth';
import {
  PROMOTION_REQUIRED_ROLES,
  type MemoryPromotionRequest,
} from '@/lib/types/memory';
import {
  checkUpgradeEligibility,
  computeBossCaptureScore,
} from '@/lib/persona/evolution';
import { deriveSigningAuthority } from '@/lib/governance/signing-authority';

const VETO_WINDOW_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * EVO-7 phase 2 (2026-05-12): 修复 AUDIT-2026-05-10.md §2.2 P1.
 *
 * 旧行为: 信任 `?userId=任何值`, 任何人可看任何人的 dashboard.
 * 新行为: 强制走 requireAuth, userId 锁定为 session 主体.
 *         保留 demo 模式下 `?userId=demo-user` 兼容 e2e/dev.
 */
export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const queryUserId = new URL(req.url).searchParams.get('userId');
  // demo 模式允许 ?userId= 覆盖 (方便单机看不同身份); 生产模式锁定 session
  const userId =
    auth.demo && queryUserId ? queryUserId : auth.userId;
  const store = getStore();

  // 签批角色按每条 promotion 的 level 动态派生，不再全局一次性拉取

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

  // 1. 待我签字的 Memory promotion—按每条 level 动态派生签批角色
  const promotionsAwaitingMySignature = (
    await Promise.all(
      (promotions as MemoryPromotionRequest[])
        .filter((p) => p.status === 'pending')
        .map(async (p) => {
          const level = p.level ?? 'company';
          const required = PROMOTION_REQUIRED_ROLES[level] ?? [];
          const { roles: myRoles } = await deriveSigningAuthority({ userId, level });
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
    )
  ).filter(Boolean);

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

