import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { computeStageProgress } from '@/lib/persona/learning-collector';

/**
 * GET /api/persona/[userId]/progress
 * 返回 Persona 的阶段进化进度 (用于 StageProgressDashboard)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  await boot();
  const store = getStore();
  const list = await store.personas.list({ userId: params.userId } as never);
  const persona = list[0];
  if (!persona) {
    return NextResponse.json({ error: 'persona not found' }, { status: 404 });
  }

  const progress = await computeStageProgress(persona.id);
  return NextResponse.json({
    persona,
    progress,
    bossCaptureScore: persona.bossCaptureScore,
  });
}
