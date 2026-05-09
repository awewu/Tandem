/**
 * POST /api/im/messages/[id]/promote-to-memory
 *
 * 把一条 IM 消息沉淀为 Memory 升级提议 (差异化 §2.2 第 3 条).
 *
 * Body:
 *   {
 *     triggeredBy: string;      必填 — 提议人
 *     proposedType?: string;    sop|case|redline|value|lesson, 默认 lesson
 *     proposedTitle?: string;   默认从消息正文截前 50 字
 *     level?: string;           team|dept|company, 默认 team
 *   }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { promoteImMessageToMemory } from '@/lib/im/service';

interface Params {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: Params) {
  await boot();
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.triggeredBy) {
      return NextResponse.json({ error: 'triggeredBy required' }, { status: 400 });
    }
    const result = await promoteImMessageToMemory({
      messageId: params.id,
      triggeredBy: body.triggeredBy,
      proposedType: body.proposedType,
      proposedTitle: body.proposedTitle,
      level: body.level,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
