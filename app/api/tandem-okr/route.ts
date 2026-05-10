import { NextResponse, type NextRequest } from 'next/server';
import { getStore } from '@/lib/boot';

/**
 * GET /api/tandem-okr?cycleId=...&ownerId=...
 *
 * 返回:
 *   objectives  Objective[] + nested keyResults[]
 *   ttis        TTI[]  (按 ownerId/cycleId 过滤, 双轨独立 — KPI 与 TTI 平行)
 *   cycles      Cycle[]
 *
 * Q5 Tita 对标: 一次拉全 OKR 树 (含 TTI), 前端无须二次请求.
 *
 * 路由命名带 tandem- 前缀, 避免与现存 /app/okr/ UI 路由的潜在 API 冲突.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycleId');
    const ownerId = searchParams.get('ownerId');
    const store = getStore();

    let objectives = await store.objectives.list();
    if (cycleId) objectives = objectives.filter((o) => o.cycleId === cycleId);
    if (ownerId) objectives = objectives.filter((o) => o.ownerId === ownerId);

    const allKrs = await store.keyResults.list();
    const enriched = objectives.map((obj) => ({
      ...obj,
      keyResults: allKrs.filter((kr) => kr.objectiveId === obj.id),
    }));

    let ttis = await store.ttis.list();
    if (cycleId) ttis = ttis.filter((t) => t.cycleId === cycleId);
    if (ownerId) ttis = ttis.filter((t) => t.ownerId === ownerId);

    const cycles = await store.cycles.list();
    return NextResponse.json({ objectives: enriched, ttis, cycles });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();
    const obj = await store.objectives.create({
      cycleId: body.cycleId,
      level: body.level ?? 'individual',
      parentObjectiveId: body.parentObjectiveId,
      ownerId: body.ownerId,
      title: body.title,
      description: body.description,
      visibility: body.visibility ?? 'public',
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ objective: obj });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
