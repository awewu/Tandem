import { NextResponse, type NextRequest } from 'next/server';
import { getStore } from '@/lib/boot';

/**
 * GET /api/tandem-okr?cycleId=...&ownerId=...
 * 列出 Objectives + 嵌套 KRs
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

    const cycles = await store.cycles.list();
    return NextResponse.json({ objectives: enriched, cycles });
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
