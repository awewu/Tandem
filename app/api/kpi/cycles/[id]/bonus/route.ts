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
import { computeBonusPayout, type KpiBonusPayout } from '@/lib/types/kpi';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id: cycleId } = await params;

  const store = getStore();
  const cycle = await store.kpiCycles.get(cycleId);
  if (!cycle || cycle.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: 'cycle_not_found' }, { status: 404 });
  }

  const payouts = (await store.kpiBonusPayouts.list()).filter(
    (p) => p.tenantId === auth.tenantId && p.cycleId === cycleId,
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

    const store = getStore();
    const cycle = await store.kpiCycles.get(cycleId);
    if (!cycle || cycle.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: 'cycle_not_found' }, { status: 404 });
    }
    if (cycle.status === 'draft') {
      return NextResponse.json(
        { error: 'cycle_draft: 周期未激活, 暂无 actuals 数据, 无法计算奖金' },
        { status: 400 },
      );
    }

    // 拿 KPI 数据 (仅 bonus scope)
    const allKpis = (await store.kpis.list()).filter(
      (k) =>
        k.tenantId === auth.tenantId &&
        k.cycleId === cycleId &&
        k.scope === 'bonus' &&
        (!restrictAssignee || k.assigneeId === restrictAssignee),
    );
    const subjects = (await store.kpiSubjects.list()).filter(
      (s) => s.tenantId === auth.tenantId,
    );
    const subjectCodeById = new Map(subjects.map((s) => [s.id, s.code]));
    const lookup = (id: string) => subjectCodeById.get(id) ?? '';

    // 按 assignee 分组
    const byAssignee = new Map<string, typeof allKpis>();
    for (const k of allKpis) {
      const arr = byAssignee.get(k.assigneeId) ?? [];
      arr.push(k);
      byAssignee.set(k.assigneeId, arr);
    }

    // 已有 payouts (用于 upsert)
    const existing = (await store.kpiBonusPayouts.list()).filter(
      (p) => p.tenantId === auth.tenantId && p.cycleId === cycleId,
    );
    const existingByAssignee = new Map(existing.map((p) => [p.assigneeId, p]));

    const now = new Date().toISOString();
    const results: KpiBonusPayout[] = [];

    for (const [assigneeId, kpis] of Array.from(byAssignee.entries())) {
      const baseBonus = Number(baseBonuses[assigneeId] ?? 0);
      const { weightedCompletion, finalBonus, contributions } = computeBonusPayout(
        kpis,
        baseBonus,
        lookup,
      );

      const prev = existingByAssignee.get(assigneeId);
      // 一旦 committed=true, 不允许在非 commit 模式覆盖 (防止误操作回退)
      if (prev?.committed && !commit) {
        results.push(prev);
        continue;
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
        committed: commit,
        committedAt: commit ? now : undefined,
        note,
        tenantId: auth.tenantId,
      };

      let payout: KpiBonusPayout;
      if (prev) {
        payout = await store.kpiBonusPayouts.update(prev.id, payoutData);
      } else {
        payout = await store.kpiBonusPayouts.create(payoutData as Omit<KpiBonusPayout, 'id'>);
      }
      results.push(payout);

      await audit(commit ? 'kpi.bonus_committed' : 'kpi.bonus_calculated', auth.userId, {
        targetId: payout.id,
        targetType: 'kpi_bonus_payout',
        metadata: {
          cycleId,
          assigneeId,
          baseBonus,
          weightedCompletion,
          finalBonus,
          kpiCount: kpis.length,
        },
      });
    }

    return NextResponse.json({
      payouts: results,
      summary: {
        total: results.length,
        committed: results.filter((p) => p.committed).length,
        totalFinalBonus: results.reduce((s, p) => s + p.finalBonus, 0),
        averageWeightedCompletion:
          results.length > 0
            ? results.reduce((s, p) => s + p.weightedCompletion, 0) / results.length
            : 0,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
