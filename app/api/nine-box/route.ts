import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { classifyNineBox } from '@/lib/types/okr-tti';
import { requireAuth } from '@/lib/auth/require-auth';

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

    // group by ownerId (KR owners 即 TTI 涉及人)
    const owners = new Set<string>();
    krs.forEach((k) => owners.add(k.ownerId));

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

        // 纵轴 = KPI 完成率. KPI 表尚未建 (CHARTER §5 M2a), 暂返 0.
        // M2a 完成后, 此处改为: const kpiScore = await store.kpis.getCompletionRate(userId, fiscalYear)
        const kpiScore = 0;

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
        kpiReady: false, // CHARTER §5 M2a 完成后置 true
        ttiReady: true,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
