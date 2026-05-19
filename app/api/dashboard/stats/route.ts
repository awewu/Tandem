import { NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { requireAuth } from '@/lib/auth/require-auth';

/**
 * GET /api/dashboard/stats
 *
 * Tandem 主页统计 (聚合 in-memory store).
 */
export async function GET(req: Request) {
  const auth = requireAuth(req as any);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const s = getStore();

  const [memories, decisionCards, personas, objectives, keyResults, ttis] = await Promise.all([
    s.memories.list(),
    s.decisionCards.list(),
    s.personas.list(),
    s.objectives.list(),
    s.keyResults.list(),
    s.ttis.list(),
  ]);

  // 决议卡分类统计
  const committed = decisionCards.filter((d) => d.convergenceState === 'COMMIT').length;
  const escalated = decisionCards.filter((d) => d.convergenceState === 'ESCALATED').length;
  const vetoed = decisionCards.filter((d) => d.convergenceState === 'VETOED').length;

  // 17min 达成率
  const finished = decisionCards.filter(
    (d) => d.convergenceState === 'COMMIT' || d.convergenceState === 'VETOED'
  );
  const inTime = finished.filter((d) => (d.elapsedSeconds ?? 0) <= 17 * 60).length;
  const inTimeRate = finished.length ? inTime / finished.length : 0;

  // D 选项使用率
  const dUsed = finished.filter((d) => d.selected === 'D').length;
  const dRate = finished.length ? dUsed / finished.length : 0;

  // Memory 类型聚合
  const memoryByType = {
    sop: memories.filter((m) => m.type === 'sop').length,
    case: memories.filter((m) => m.type === 'case').length,
    redline: memories.filter((m) => m.type === 'redline').length,
    value: memories.filter((m) => m.type === 'value').length,
  };

  // KR 健康度
  const krOnTrack = keyResults.filter((k) => k.riskStatus === 'on_track').length;

  // Persona stage 分布
  const personaByStage = personas.reduce<Record<string, number>>((acc, p) => {
    acc[p.stage] = (acc[p.stage] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    decisionCards: {
      total: decisionCards.length,
      committed,
      escalated,
      vetoed,
      inTimeRate,
      dRate,
    },
    memories: {
      total: memories.length,
      byType: memoryByType,
    },
    okr: {
      objectives: objectives.length,
      keyResults: keyResults.length,
      keyResultsOnTrack: krOnTrack,
      ttis: ttis.length,
    },
    personas: {
      total: personas.length,
      byStage: personaByStage,
    },
    recentDecisions: decisionCards
      .slice()
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
      .slice(0, 5)
      .map((d) => ({
        id: d.id,
        title: d.title,
        state: d.convergenceState,
        elapsedSeconds: d.elapsedSeconds,
        selected: d.selected,
        createdAt: d.createdAt,
      })),
  });
}
