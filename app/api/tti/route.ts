import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycleId');
    const ownerId = searchParams.get('ownerId');
    const store = getStore();

    let ttis = await store.ttis.list();
    if (cycleId) ttis = ttis.filter((t) => t.cycleId === cycleId);
    if (ownerId) ttis = ttis.filter((t) => t.ownerId === ownerId);

    return NextResponse.json({ ttis });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    const store = getStore();
    const tti = await store.ttis.create({
      cycleId: body.cycleId,
      ownerId: body.ownerId,
      title: body.title,
      description: body.description,
      successCriteria: body.successCriteria ?? '',
      startValue: body.startValue,
      targetValue: body.targetValue,
      currentValue: body.currentValue ?? body.startValue ?? 0,
      unit: body.unit,
      completionRate: 0,
      // 宪章 §4 铁律: TTI 永不挂钩任何金钱回报 (含系数浮动). 不接受外部覆盖.
      affectsCompensation: false,
      notes: body.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ tti });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
