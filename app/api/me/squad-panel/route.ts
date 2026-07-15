/**
 * POST /api/me/squad-panel
 *
 * M3 · 战斗小组编排 (分身编队 B-037): 主分身 dispatch 员工的**真实技能分身实体**并行起草,
 * 可选主分身合稿; 采纳时回流采纳信号 (独立进化燃料)。
 *
 * Body (action 判别):
 *   { action?: 'generate', topic: string, personaIds?: string[], consolidate?: boolean }
 *     → 并行起草 (+可选合稿), 返回 { ok, ...result, consolidated? }
 *   { action: 'adopt', personaIds: string[] }
 *     → 记录合稿被采纳, 给参与技能分身回流采纳信号, 返回 { ok, adopted }
 *
 * 受控铁律见 lib/persona/expert-panel.ts: 只产出草稿, 不写库、不对外、不拍板。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { rateLimit, POLICIES } from '@/lib/infra/rate-limit';
import { runSquadPanel, consolidateSquadDrafts } from '@/lib/persona/expert-panel';
import { recordSquadAdoption } from '@/lib/persona/evolution';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const dynamic = 'force-dynamic';

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: {
    action?: unknown;
    topic?: unknown;
    personaIds?: unknown;
    consolidate?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = typeof body.action === 'string' ? body.action : 'generate';
  const personaIds = Array.isArray(body.personaIds)
    ? (body.personaIds as unknown[]).filter((p): p is string => typeof p === 'string')
    : undefined;

  // ── adopt: 记录合稿被采纳 → 回流采纳信号 (独立进化) ──
  if (action === 'adopt') {
    if (!personaIds || personaIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'adopt 需要 personaIds' }, { status: 400 });
    }
    try {
      await recordSquadAdoption(personaIds);
      return NextResponse.json({ ok: true, adopted: personaIds.length });
    } catch (err) {
      return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
    }
  }

  // ── generate: 并行起草 (+可选合稿) ──
  // 并行多 LLM 调用, 限流防滥用
  const rl = await rateLimit({ key: `squad-panel:${auth.userId}`, ...POLICIES.api() });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'rate_limited · 请稍候再召唤战斗小组' }, { status: 429 });
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) {
    return NextResponse.json({ ok: false, error: 'topic 必填' }, { status: 400 });
  }

  try {
    const result = await runSquadPanel(auth.userId, topic, {
      tenantId: auth.tenantId,
      personaIds,
    });

    if (result.drafts.length === 0) {
      return NextResponse.json({
        ok: true,
        ...result,
        hint: '你还没有技能分身, 先去拿捏 fork 一个专业分身再召唤战斗小组。',
      });
    }

    // 可选: 主分身合稿
    if (body.consolidate === true) {
      const merged = await consolidateSquadDrafts(auth.userId, topic, result.drafts);
      return NextResponse.json({ ok: true, ...result, consolidation: merged });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/me/squad-panel' });
