/**
 * POST /api/learning/generate · AI 课程生成器 (真 LLM 接入)
 *
 * 输入: { sourceId, sourceType, userId, category }
 * 输出: { lecture, questions[5], summaryCard[] }
 *
 * P2 接入策略 (混合 · C3 决策):
 *   1. AI 起草 (LLM 生成讲解 + 题目)
 *   2. 人工审核 (HR/Steward 在 /admin/learning 校对)
 *
 * 已接真 LLM (lib/learning/generate.ts):
 *   - scenario='reasoning_complex', responseFormat='json'
 *   - 输入为系统拼装结构化素材 prompt (governed-chat-exempt, 同 okr-bulk-create)
 *   - LLM 失败回退确定性兜底 (isStub=true), 永不断闭环
 *   - 课程内容是 Material 衍生包 (§7), 不入 Memory; 经 HR/Steward 审核后发布
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import type { GenerateLessonInput } from '@/lib/learning/types';
import { generateLesson } from '@/lib/learning/generate';

const VALID_SOURCE_TYPES: GenerateLessonInput['sourceType'][] = ['memory', 'material', 'document'];

export async function POST(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, [...DATA_STEWARD_ROLES, 'champion']);
  if (forbidden) return forbidden;

  let input: GenerateLessonInput;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  if (!input.sourceId || !VALID_SOURCE_TYPES.includes(input.sourceType)) {
    return NextResponse.json({ error: 'sourceId + valid sourceType required' }, { status: 400 });
  }

  // userId 用于个性化/审计; 缺省退到当前登录用户
  const normalized: GenerateLessonInput = { ...input, userId: input.userId || auth.userId };

  const result = await generateLesson(normalized, { tenantId: auth.tenantId });
  if (!result) {
    return NextResponse.json({ error: 'source not found' }, { status: 404 });
  }

  return NextResponse.json({
    generated: result.generated,
    isStub: result.isStub,
    fallbackReason: result.fallbackReason,
    modelUsed: result.modelUsed,
  });
}
