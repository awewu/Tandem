import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { skillRegistry } from '@/lib/taf/skills';

/**
 * GET /api/tandem-skills?q=<query>&limit=5
 * 列出或检索 Tandem skill registry
 */
export async function GET(req: NextRequest) {
  await boot();
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const limit = Number(searchParams.get('limit') ?? 20);

  const list = query ? skillRegistry.search(query, limit) : skillRegistry.list().slice(0, limit);

  return NextResponse.json({
    count: list.length,
    skills: list.map((s) => ({
      id: s.id,
      description: s.description,
      tags: s.tags,
      zone: s.zone,
      proxyAllowed: s.proxyAllowed,
      estimatedTokens: s.estimatedTokens,
      schema: s.schema,
    })),
  });
}
