/**
 * KPI 奖金计算 · CHARTER-KPI-TTI §5 M3
 *
 * GET  /api/kpi/cycles/[id]/bonus
 *   返回该周期内所有 KpiBonusPayout (含已 commit + 草稿).
 *
 * POST /api/kpi/cycles/[id]/bonus
 *   Body: {
 *     baseBonuses: Record<assigneeId, number>,  // HR 配置的基础奖金
 *     commit?: boolean,                          // false=试算/draft, true=正式下发
 *     note?: string,                             // 备注
 *     assigneeId?: string,                       // 限定单人计算 (可选, 默认全员)
 *   }
 *   返回 { payouts: KpiBonusPayout[] }
 *
 * 权限: kpi.write (HR/admin)
 *
 * 业务铁律 (CHARTER §2.0 + §2.3):
 *   - 仅 scope=bonus 的 KPI 参与计算; monitor 完全不参与
 *   - 周期必须 active 才能试算; closed 周期可重新计算 (用于修正)
 *   - commit=true 时, finalBonus 锁定, 状态 committed=true
 *   - 计算公式: finalBonus = baseBonus * min(1.5, weightedCompletion)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { audit } from '@/lib/audit/log';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { computeBonusPayout, type KpiBonusPayout } from '@/lib/types/kpi';
import { resolveOkrCycle } from '@/lib/domain/cycle/performance-cycle';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id: cycleId } = await params;

  const store = getStore();
  const cycle = await withTenantScope(store.kpiCycles, auth.tenantId).get(cycleId);
  if (!cycle) {
    return NextResponse.json({ error: 'cycle_not_found' }, { status: 404 });
  }

  const payouts = (await withTenantScope(store.kpiBonusPayouts, auth.tenantId).list()).filter(
    (p) => p.cycleId === cycleId,
  );
  payouts.sort((a, b) => b.finalBonus - a.finalBonus);
  return NextResponse.json({ payouts });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!hasKpiPermission(auth, 'kpi.write')) {
    return NextResponse.json({ error: 'forbidden: kpi.write required' }, { status: 403 });
  }
  const { id: cycleId } = await params;

  try {
    const body = await req.json();
    const baseBonuses: Record<string, number> = body.baseBonuses ?? {};
    const commit = body.commit === true;
    const note: string | undefined = body.note;
    const restrictAssignee: string | undefined = body.assigneeId;
    // OKR 进度门槛闸 (机会#1): commit 时, OKR 进度低于阈值的人冻结奖金, 不予下发,
    // 直至 OKR 进度回升或 HR 显式 override。默认开启, 阈值 0.2 (20%)。draft 试算不拦截。
    const gateEnabled: boolean = body.okrGate?.enabled !== false;
    const gateThreshold: number =
      typeof body.okrGate?.threshold === 'number' ? body.okrGate.threshold : 0.2;
    const overrideAssignees = new Set<string>(
      Array.isArray(body.okrGate?.override) ? body.okrGate.override : [],
    );

    const store = getStore();
    const cycle = await withTenantScope(store.kpiCycles, auth.tenantId).get(cycleId);
    if (!cycle) {
      return NextResponse.json({ error: 'cycle_not_found' }, { status: 404 });
    }
    if (cycle.status === 'draft') {
      return NextResponse.json(
        { error: 'cycle_draft: 周期未激活, 暂无 actuals 数据, 无法计算奖金' },
        { status: 400 },
      );
    }

    // 拿 KPI 数据 (仅 bonus scope)
    const allKpis = (await withTenantScope(store.kpis, auth.tenantId).list()).filter(
      (k) =>
        k.cycleId === cycleId &&
        k.scope === 'bonus' &&
        (!restrictAssignee || k.assigneeId === restrictAssignee),
    );
    const subjects = await withTenantScope(store.kpiSubjects, auth.tenantId).list();
    const subjectCodeById = new Map(subjects.map((s) => [s.id, s.code]));
    const lookup = (id: string) => subjectCodeById.get(id) ?? '';

    // 按 assignee 分组
    const byAssignee = new Map<string, typeof allKpis>();
    for (const k of allKpis) {
      const arr = byAssignee.get(k.assigneeId) ?? [];
      arr.push(k);
      byAssignee.set(k.assigneeId, arr);
    }

    // OKR 进度门槛闸: 解析本 KPI 周期对应的 OKR 主周期, 算每位被考核人的 OKR 进度 (KR 平均)
    const okrProgressByOwner = new Map<string, number>();
    if (gateEnabled) {
      const okrCycle = await resolveOkrCycle(store, cycleId, 'kpi');
      if (okrCycle) {
        const objIds = new Set(
          (await withTenantScope(store.objectives, auth.tenantId).list())
            .filter((o) => o.cycleId === okrCycle.id)
            .map((o) => o.id),
        );
        const krAgg = new Map<string, { sum: number; n: number }>();
        for (const kr of await withTenantScope(store.keyResults, auth.tenantId).list()) {
          if (!objIds.has(kr.objectiveId) || !kr.ownerId) continue;
          const r =
            kr.targetValue === kr.startValue
              ? 1
              : Math.max(0, Math.min(1, (kr.currentValue - kr.startValue) / (kr.targetValue - kr.startValue)));
          const cur = krAgg.get(kr.ownerId) ?? { sum: 0, n: 0 };
          cur.sum += r;
          cur.n += 1;
          krAgg.set(kr.ownerId, cur);
        }
        for (const [owner, agg] of Array.from(krAgg.entries())) {
          okrProgressByOwner.set(owner, agg.n > 0 ? agg.sum / agg.n : 0);
        }
      }
    }

    // 已有 payouts (用于 upsert)
    const existing = (await withTenantScope(store.kpiBonusPayouts, auth.tenantId).list()).filter(
      (p) => p.cycleId === cycleId,
    );
    const existingByAssignee = new Map(existing.map((p) => [p.assigneeId, p]));

    const now = new Date().toISOString();
    const results: KpiBonusPayout[] = [];
    const frozen: Array<{ assigneeId: string; okrProgress: number; finalBonus: number }> = [];

    for (const [assigneeId, kpis] of Array.from(byAssignee.entries())) {
      const prev = existingByAssignee.get(assigneeId);
      // baseBonus: 显式传入优先; 未传入则沿用该人已有 payout 的 baseBonus, 否则 0。
      // (修复脚手枪: 此前未传 baseBonuses 的试算会把已下发/已算好的金额覆盖成 0)
      const baseBonus =
        baseBonuses[assigneeId] != null
          ? Number(baseBonuses[assigneeId])
          : prev?.baseBonus ?? 0;
      const { weightedCompletion, finalBonus, contributions } = computeBonusPayout(
        kpis,
        baseBonus,
        lookup,
      );

      // 一旦 committed=true, 不允许在非 commit 模式覆盖 (防止误操作回退)
      if (prev?.committed && !commit) {
        results.push(prev);
        continue;
      }

      // OKR 进度门槛: commit 时, OKR 进度低于阈值且未 override → 冻结, 保持 draft 不下发
      const okrProgress = okrProgressByOwner.get(assigneeId);
      const gated =
        commit &&
        gateEnabled &&
        okrProgress != null &&
        okrProgress < gateThreshold &&
        !overrideAssignees.has(assigneeId);
      const effectiveCommit = commit && !gated;
      if (gated) {
        frozen.push({ assigneeId, okrProgress: okrProgress ?? 0, finalBonus });
      }

      const payoutData = {
        cycleId,
        assigneeId,
        baseBonus,
        weightedCompletion,
        finalBonus,
        contributions,
        calculatedAt: now,
        calculatedBy: auth.userId,
        committed: effectiveCommit,
        committedAt: effectiveCommit ? now : undefined,
        note: gated
          ? `[OKR进度${Math.round((okrProgress ?? 0) * 100)}%<${Math.round(gateThreshold * 100)}% 冻结] ${note ?? ''}`.trim()
          : note,
        tenantId: auth.tenantId,
      };

      let payout: KpiBonusPayout;
      if (prev) {
        payout = await store.kpiBonusPayouts.update(prev.id, payoutData);
      } else {
        payout = await store.kpiBonusPayouts.create(payoutData as Omit<KpiBonusPayout, 'id'>);
      }
      results.push(payout);

      await audit(payout.committed ? 'kpi.bonus_committed' : 'kpi.bonus_calculated', auth.userId, {
        targetId: payout.id,
        targetType: 'kpi_bonus_payout',
        metadata: {
          cycleId,
          assigneeId,
          baseBonus,
          weightedCompletion,
          finalBonus,
          kpiCount: kpis.length,
          gated,
          okrProgress: okrProgress ?? null,
        },
      });
    }

    return NextResponse.json({
      payouts: results,
      summary: {
        total: results.length,
        committed: results.filter((p) => p.committed).length,
        totalFinalBonus: results.reduce((s, p) => s + p.finalBonus, 0),
        committedFinalBonus: results.filter((p) => p.committed).reduce((s, p) => s + p.finalBonus, 0),
        averageWeightedCompletion:
          results.length > 0
            ? results.reduce((s, p) => s + p.weightedCompletion, 0) / results.length
            : 0,
        okrGate: {
          enabled: gateEnabled,
          threshold: gateThreshold,
          frozenCount: frozen.length,
          frozen,
        },
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
