/**
 * POST /api/memories/promote-text
 *
 * 沉淀闭环 (A): 把一段文本 (搭子对话产出 / 沙盒结论) 沉淀为 Memory 升级提议,
 * 走宪章 §8.1 三级签批. 复用 lib/services/text-promotion.ts.
 *
 * Body:
 *   {
 *     body: string;            必填 — 沉淀正文
 *     title?: string;          默认从正文截前 50 字
 *     proposedType?: string;   sop|case|redline|value|lesson, 默认 lesson
 *     level?: string;          team|dept|company, 默认 team
 *     source?: string;         来源标识, 例 'chat:作战室'
 *     originRef?: string;      来源引用 (例 chat sessionId)
 *     isEmergencyTrack?: boolean;
 *   }
 *
 * Returns 201: { promotionId, materialId }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { promoteTextToMemory } from '@/lib/services/text-promotion';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  await boot();

  let body: {
    body?: string;
    title?: string;
    proposedType?: 'sop' | 'case' | 'redline' | 'value' | 'lesson';
    level?: 'team' | 'dept' | 'company';
    source?: string;
    originRef?: string;
    isEmergencyTrack?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body.body || !body.body.trim()) {
    return NextResponse.json({ error: 'body required' }, { status: 400 });
  }

  try {
    const result = await promoteTextToMemory({
      body: body.body,
      title: body.title,
      proposerId: auth.userId,
      proposedType: body.proposedType,
      level: body.level,
      source: body.source ?? 'text',
      originRef: body.originRef,
      isEmergencyTrack: body.isEmergencyTrack,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
