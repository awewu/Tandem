import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getPrimaryPersona } from '@/lib/persona/persona-lookup';
import { computeStageProgress } from '@/lib/persona/learning-collector';
import { withApiLog } from '@/lib/api-log/with-api-log';

/**
 * GET /api/persona/[userId]/progress
 * 返回 Persona 的阶段进化进度 (用于 StageProgressDashboard)
 */
async function GETApiHandler(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  await boot();
  const persona = await getPrimaryPersona(params.userId);
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

export const GET = withApiLog(GETApiHandler, { route: '/api/persona/[userId]/progress' });
