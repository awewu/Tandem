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
 *   - 纵轴 kpiScore = KPI 完成率 (年度底线, 与奖金挂钩, 来自 ERP 采集)
 *   - 横轴 ttiScore = TTI 完成率 (战略成长, 与奖金分离, 即 OKR KR 平均进度)
 *
 * 当前状态 (2026-05-20):
 *   - KPI 实表尚未建 (见 CHARTER §5 M2a). 纵轴暂返回 0, UI 会显示"KPI 数据待接入".
 *   - TTI = OKR KR 已通. 横轴用 KR 平均完成率.
 *   - 独立的 `TTI` interface (lib/types/okr-tti.ts:115) 是 V1 遗留, 已 deprecated; 不再用于 9-box.
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

    // 9-box 人选 = KR owners ∪ KPI assignees (任一被纳入)
    const owners = new Set<string>();
    krs.forEach((k) => owners.add(k.ownerId));
    Array.from(bonusKpisByAssignee.keys()).forEach((a) => owners.add(a));

    const people = await Promise.all(
      Array.from(owners).map(async (userId) => {
        const ownKrs = krs.filter((k) => k.ownerId === userId);

        // 横轴 = TTI 完成率 (= 该用户所有 KR 的平均进度)
        const ttiScore =
          ownKrs.length === 0
            ? 0
            : ownKrs.reduce((sum, k) => {
                if (k.targetValue === k.startValue) return sum + 1;
                const r = (k.currentValue - k.startValue) / (k.targetValue - k.startValue);
                return sum + Math.max(0, Math.min(1, r));
              }, 0) / ownKrs.length;

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
