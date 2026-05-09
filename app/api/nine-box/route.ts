import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { classifyNineBox } from '@/lib/types/okr-tti';

/**
 * GET /api/nine-box?cycleId=...
 *
 * 计算每个用户的 KPI 完成率 (KR currentValue / targetValue 平均) × * TTI 提升率 (TTI completionRate 平均), 输出 9 宫格分类.
 */
export async function GET(req: NextRequest) {
  try {
    await boot();
    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycleId');
    const store = getStore();

    const krs = await store.keyResults.list();
    const ttis = await store.ttis.list();
    const filtered = {
      krs: cycleId
        ? (await store.objectives.list())
            .filter((o) => o.cycleId === cycleId)
            .map((o) => o.id)
            .reduce((acc: typeof krs, oid) => acc.concat(krs.filter((k) => k.objectiveId === oid)), [])
        : krs,
      ttis: cycleId ? ttis.filter((t) => t.cycleId === cycleId) : ttis,
    };

    // group by ownerId
    const owners = new Set<string>();
    filtered.krs.forEach((k) => owners.add(k.ownerId));
    filtered.ttis.forEach((t) => owners.add(t.ownerId));

    const people = await Promise.all(
      Array.from(owners).map(async (userId) => {
        const ownKrs = filtered.krs.filter((k) => k.ownerId === userId);
        const ownTtis = filtered.ttis.filter((t) => t.ownerId === userId);

        const kpiRate =
          ownKrs.length === 0
            ? 0
            : ownKrs.reduce((sum, k) => {
                if (k.targetValue === k.startValue) return sum + 1;
                const r = (k.currentValue - k.startValue) / (k.targetValue - k.startValue);
                return sum + Math.max(0, Math.min(1, r));
              }, 0) / ownKrs.length;

        const ttiRate =
          ownTtis.length === 0
            ? 0
            : ownTtis.reduce((sum, t) => sum + t.completionRate, 0) / ownTtis.length;

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
          kpiScore: kpiRate,
          ttiScore: ttiRate,
          krCount: ownKrs.length,
          ttiCount: ownTtis.length,
          cell: classifyNineBox(kpiRate, ttiRate),
        };
      })
    );

    const cycles = await store.cycles.list();
    return NextResponse.json({ people, cycles });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
