import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { classifyNineBox } from '@/lib/types/okr-tti';
import { requireAuth } from '@/lib/auth/require-auth';
import { computeKpiCompletion } from '@/lib/types/kpi';

/**
 * GET /api/nine-box?cycleId=...
 *
 * 9-box 双轨投影 (见 docs/CHARTER-KPI-TTI.md §4):
 *   - 纵轴 kpiScore = KPI bonus 完成率 (年度底线, 与奖金挂钩, 来自 ERP 采集)
 *   - 横轴 ttiScore = (TTI 完成率 + 360 评分均值) / 2
 *       · TTI = OKR KR 平均完成率 (0-1)
 *       · 360 = 该人作为 subject 的 Review360Submission.overallScore 平均, 归一化 1-5 → 0-1
 *       · 任一缺失时, 取另一项; 全无则 0
 *
 * P1-4 (2026-05-22): 横轴改成 360+TTI 均分 (与 CHARTER 一致).
 */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await boot();
    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycleId');
    const store = getStore();

    const allKrs = await store.keyResults.list();
    const krs = cycleId
      ? (await store.objectives.list())
          .filter((o) => o.cycleId === cycleId)
          .map((o) => o.id)
          .reduce((acc: typeof allKrs, oid) => acc.concat(allKrs.filter((k) => k.objectiveId === oid)), [])
      : allKrs;

    // KPI 数据 (CHARTER §5 M2a 已交付): 取 bonus scope, 当前 cycleId 过滤
    // 注: KPI cycleId 与 OKR cycleId 是同一个 ID 空间 (都来自 store.cycles 主表)
    const allKpis = (await store.kpis.list()).filter(
      (k) => !cycleId || k.cycleId === cycleId,
    );
    const bonusKpisByAssignee = new Map<string, typeof allKpis>();
    for (const k of allKpis) {
      if (k.scope !== 'bonus') continue;
      const arr = bonusKpisByAssignee.get(k.assigneeId) ?? [];
      arr.push(k);
      bonusKpisByAssignee.set(k.assigneeId, arr);
    }
    const kpiReady = allKpis.length > 0;

    // 360 评分 (按 subjectId 聚合 overallScore 均值, 归一化 1-5 → 0-1)
    const allSubmissions = (await store.review360Submissions.list()).filter(
      (s) => !cycleId || s.cycleId === cycleId,
    );
    const reviewByUser = new Map<string, number[]>();
    for (const sub of allSubmissions) {
      if (sub.overallScore == null) continue;
      const arr = reviewByUser.get(sub.subjectId) ?? [];
      arr.push(sub.overallScore);
      reviewByUser.set(sub.subjectId, arr);
    }

    // 9-box 人选 = KR owners ∪ KPI assignees ∪ 360 subjects
    const owners = new Set<string>();
    krs.forEach((k) => owners.add(k.ownerId));
    Array.from(bonusKpisByAssignee.keys()).forEach((a) => owners.add(a));
    Array.from(reviewByUser.keys()).forEach((s) => owners.add(s));

    const people = await Promise.all(
      Array.from(owners).map(async (userId) => {
        const ownKrs = krs.filter((k) => k.ownerId === userId);

        // TTI 完成率 = KR 平均进度 (0-1)
        const ttiCompletion =
          ownKrs.length === 0
            ? null
            : ownKrs.reduce((sum, k) => {
                if (k.targetValue === k.startValue) return sum + 1;
                const r = (k.currentValue - k.startValue) / (k.targetValue - k.startValue);
                return sum + Math.max(0, Math.min(1, r));
              }, 0) / ownKrs.length;

        // 360 评分 (1-5 归一化到 0-1: (avg - 1) / 4)
        const myReviews = reviewByUser.get(userId) ?? [];
        const review360Normalized = myReviews.length === 0
          ? null
          : Math.max(0, Math.min(1, (myReviews.reduce((s, n) => s + n, 0) / myReviews.length - 1) / 4));

        // 横轴 = (TTI + 360) / 2; 任一缺失则取另一项; 全无 → 0
        let ttiScore = 0;
        if (ttiCompletion != null && review360Normalized != null) {
          ttiScore = (ttiCompletion + review360Normalized) / 2;
        } else if (ttiCompletion != null) {
          ttiScore = ttiCompletion;
        } else if (review360Normalized != null) {
          ttiScore = review360Normalized;
        }

        // 纵轴 = KPI 加权完成率 (bonus scope, weight 加权; monitor 不参与)
        const myBonusKpis = bonusKpisByAssignee.get(userId) ?? [];
        let kpiScore = 0;
        if (myBonusKpis.length > 0) {
          const totalW = myBonusKpis.reduce((s, k) => s + k.weight, 0);
          if (totalW > 0) {
            const sum = myBonusKpis.reduce(
              (s, k) => s + k.weight * computeKpiCompletion(k),
              0,
            );
            // 允许超额成绩参与 9-box, 但顶到 1 (>100% 算 high)
            kpiScore = Math.min(1, sum / totalW);
          }
        }

        // best-effort 姓名解析: 没注册账号就回退到 userId
        let name = userId;
        try {
          const user = await store.auth.users.findById(userId);
          if (user?.name) name = user.name;
        } catch {
          /* noop */
        }

        return {
          userId,
          name,
          kpiScore,
          ttiScore,
          krCount: ownKrs.length,
          ttiCount: ownKrs.length, // V2 兼容: 旧字段名, 等同 krCount
          cell: classifyNineBox(kpiScore, ttiScore),
        };
      })
    );

    const cycles = await store.cycles.list();
    return NextResponse.json({
      people,
      cycles,
      // 状态指示器: 前端用于显示"KPI 数据待接入"提示
      dataSources: {
        kpiReady, // CHARTER §5 M2a-Core 已完成, 看是否有真实 KPI 数据
        ttiReady: true,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
