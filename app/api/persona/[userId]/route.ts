import { NextResponse, type NextRequest } from 'next/server';
import { getStore } from '@/lib/boot';
import { computeBossCaptureScore, checkUpgradeEligibility } from '@/lib/persona/evolution';

export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const store = getStore();
    const list = await store.personas.list({ userId: params.userId } as never);
    const persona = list[0];
    if (!persona) {
      return NextResponse.json({ error: 'persona not found' }, { status: 404 });
    }
    const score = computeBossCaptureScore(persona);
    const upgrade = checkUpgradeEligibility(persona);
    return NextResponse.json({
      persona: { ...persona, bossCaptureScore: score },
      upgrade,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const body = await req.json();
    const store = getStore();
    const list = await store.personas.list({ userId: params.userId } as never);
    const persona = list[0];
    if (!persona) {
      return NextResponse.json({ error: 'persona not found' }, { status: 404 });
    }
    const updated = await store.personas.update(persona.id, {
      ...body,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ persona: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
