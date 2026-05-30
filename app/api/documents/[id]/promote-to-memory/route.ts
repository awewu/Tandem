/**
 * POST /api/documents/[id]/promote-to-memory
 *
 * DOC-2 (charter §四 文档板块): 把一个文档沉淀为 Memory 升级提议, 走宪章 §8.1 三级签批.
 *
 * Body:
 *   {
 *     triggeredBy: string;      必填 — 提议人 (走 requireAuth 自动注入也可)
 *     proposedType?: string;    sop|case|redline|value|lesson, 默认 lesson
 *     proposedTitle?: string;   默认沿用文档 title
 *     level?: string;           team|dept|company, 默认 team
 *     isEmergencyTrack?: boolean; 默认 false (走 7 天公示); true 走 24h 紧急通道
 *   }
 *
 * Returns 201:
 *   { promotionId, materialId, documentId }
 *
 * 复用 lib/im/service.ts 的 promoteImMessageToMemory 设计模式 (IM-2),
 * 这是文档板块兑现 charter 的第一条 "飞书做不到" 能力.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { promoteDocumentToMemory } from '@/lib/services/document-promotion';

interface Params {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  await boot();

  let body: {
    triggeredBy?: string;
    proposedType?: 'sop' | 'case' | 'redline' | 'value' | 'lesson';
    proposedTitle?: string;
    level?: 'team' | 'dept' | 'company';
    isEmergencyTrack?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // 优先使用 auth.userId, body.triggeredBy 兼容旧测试调用
  const triggeredBy = body.triggeredBy ?? auth.userId;
  if (!triggeredBy) {
    return NextResponse.json({ error: 'triggeredBy required' }, { status: 400 });
  }

  try {
    const result = await promoteDocumentToMemory({
      documentId: params.id,
      triggeredBy,
      proposedType: body.proposedType,
      proposedTitle: body.proposedTitle,
      level: body.level,
      isEmergencyTrack: body.isEmergencyTrack,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    const code = msg.includes('not found') ? 404 : msg.includes('已发起过') ? 409 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
