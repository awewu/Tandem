/**
 * POST /api/me/expert-panel
 *
 * C · 专家团: 一个议题并行交给若干专业视角 (设计/PM/技术/营销/战略) 各起一份草稿。
 * Body: { topic: string; modes: string[] }
 * 返回: { ok, topic, drafts: [{ mode, label, ok, draft, error? }] }
 *
 * 受控铁律见 lib/persona/expert-panel.ts: 只产出草稿, 不写库、不对外、不拍板。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { rateLimit, POLICIES } from '@/lib/infra/rate-limit';
import { runExpertPanel, EXPERT_MODES } from '@/lib/persona/expert-panel';

export const dynamic = 'force-dynamic';

const VALID_MODES = new Set(EXPERT_MODES.map((m) => m.id));

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // 并行多 LLM 调用, 限流防滥用
  const rl = await rateLimit({ key: `expert-panel:${auth.userId}`, ...POLICIES.api() });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'rate_limited · 请稍候再召唤专家团' }, { status: 429 });
  }

  let body: { topic?: unknown; modes?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) {
    return NextResponse.json({ ok: false, error: 'topic 必填' }, { status: 400 });
  }
  const modes = Array.isArray(body.modes)
    ? (body.modes as unknown[]).filter((m): m is string => typeof m === 'string' && VALID_MODES.has(m))
    : [];
  if (modes.length === 0) {
    return NextResponse.json({ ok: false, error: '至少选择一个专业视角' }, { status: 400 });
  }
  // 防一次召唤过多 (成本/延迟有界)
  const capped = modes.slice(0, 5);

  try {
    const result = await runExpertPanel(topic, capped, {
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
