/**
 * GET  /api/okr/checkins?scope=objective|kr&scopeId=...   — list check-ins
 * POST /api/okr/checkins
 *   body: { scope, scopeId, progressBefore, progressAfter, confidenceBefore,
 *           confidenceAfter, achievements, blockers, nextSteps, mood }
 *   authorId 强制 = sessionUser.id
 *
 * 校验:
 *   - 仅 owner / coOwner / collaborator 可 POST (V1: owner only)
 *
 * CHARTER-KPI-TTI §3.3 (信任铁律):
 *   主管不能修改下属的 TTI progress / blockers / nextSteps —— 由 owner-only POST 守卫强制.
 *   admin/champion 可在 demo 模式下覆写 (auth.demo === true), 生产环境 demo 默认关闭.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { executeAction, type KrCheckinResult, type ObjectiveCheckinResult } from '@/lib/ontology';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope');
    const scopeId = searchParams.get('scopeId');
    const store = getStore();
    let all = await store.checkIns.list();
    if (scope) all = all.filter((c) => c.scope === scope);
    if (scopeId) all = all.filter((c) => c.scopeId === scopeId);
    all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return NextResponse.json({ checkIns: all });
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
    const { scope, scopeId } = body;
    if (!scope || !scopeId || (scope !== 'objective' && scope !== 'kr')) {
      return NextResponse.json(
        { error: 'scope (objective|kr) and scopeId required' },
        { status: 400 },
      );
    }
    // ── scope === 'kr' → 走 ON-1 声明式 Action Type (单一真值: lib/ontology/actions/kr-checkin) ──
    // 原先散在这里的 KR 校验+主写+rollup+事件 全部收编进 executeAction('kr.checkin'),
    // 副作用只声明一次; IM/日历/中央 AI 均调同一动作 (根治 Issue 4 类耦合)。
    if (scope === 'kr') {
      const r = await executeAction<KrCheckinResult>(
        'kr.checkin',
        {
          krId: scopeId,
          currentValue: body.currentValue,
          confidenceAfter: body.confidenceAfter,
          confidenceBefore: body.confidenceBefore,
          progressBefore: body.progressBefore,
          progressAfter: body.progressAfter,
          achievements: body.achievements,
          blockers: body.blockers,
          nextSteps: body.nextSteps,
          mood: body.mood,
        },
        { actorUserId: auth.userId, isProxy: false, demo: auth.demo },
      );
      if (!r.ok) {
        const code = r.blocked?.code;
        const status = code === 'not_found' ? 404 : code === 'forbidden' ? 403 : code === 'invalid' ? 400 : 403;
        return NextResponse.json(
          { error: r.blocked?.reasons.join('; ') ?? 'check-in blocked' },
          { status },
        );
      }
      // lineage (被 rollup 重算的 Objective 链) 从副作用输出读出, 保持原响应体形状
      const rolledUp = r.sideEffects.find((s) => s.name === 'okr.rollup.propagate')?.data ?? [];
      return NextResponse.json({ checkIn: r.result!.checkIn, rolledUp });
    }

    // ── scope === 'objective' → 走 ON-1 声明式 Action Type (单一真值: lib/ontology/actions/objective-checkin) ──
    // 与 kr.checkin 对齐: 校验+主写+rollup 全收编进 executeAction('objective.checkin'),
    // 副作用 (向父链 rollup + 事件) 只声明一次 (根治散写)。
    const r = await executeAction<ObjectiveCheckinResult>(
      'objective.checkin',
      {
        objectiveId: scopeId,
        confidenceAfter: body.confidenceAfter,
        confidenceBefore: body.confidenceBefore,
        progressBefore: body.progressBefore,
        progressAfter: body.progressAfter,
        achievements: body.achievements,
        blockers: body.blockers,
        nextSteps: body.nextSteps,
        mood: body.mood,
      },
      { actorUserId: auth.userId, isProxy: false, demo: auth.demo },
    );
    if (!r.ok) {
      const code = r.blocked?.code;
      const status = code === 'not_found' ? 404 : code === 'forbidden' ? 403 : code === 'invalid' ? 400 : 403;
      return NextResponse.json(
        { error: r.blocked?.reasons.join('; ') ?? 'check-in blocked' },
        { status },
      );
    }
    const rolledUp = r.sideEffects.find((s) => s.name === 'okr.rollup.propagate')?.data ?? [];
    return NextResponse.json({ checkIn: r.result!.checkIn, rolledUp });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
