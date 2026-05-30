/**
 * POST /api/okr/bulk-create/options
 *
 * "AI 批量创建 OKR · 一键全景图" v0 (charter §2 第 2 条 3+1 兑现 + vs Tita 2025 H2 #1 缺口).
 *
 * Body:
 *   {
 *     cycleName: string;       必填, e.g. "2026 Q3"
 *     strategy: string;        必填, 公司一句话战略
 *     departments: { id, name }[];  必填 (≥1, ≤8 由 service 限制)
 *     maxDepartments?: number; 可选 (1-8)
 *   }
 *
 * Returns 200:
 *   { cycleName, strategy, options: [4 个选项 A/B/C/D], generatedAt, modelUsed?, source, fallbackReason? }
 *
 * 选项语义 (3+1):
 *   A SOP        模板库匹配 (启发式关键词, 0 LLM 调用)
 *   B REASONING  LLM 推演 (失败降级到模板)
 *   C HISTORICAL v0 占位 (v2 接 Memory retriever)
 *   D ORIGINAL   humanOnly=true, 留空让主管自己写
 *
 * v1 计划: 改 SSE 流式, 返回每个选项就绪时立即推送.
 *
 * audit: 自动写 `persona_brief.options_generated` (复用 3+1 通用 audit action).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getRouter } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  generateBulkCreateOptions,
  type BulkCreateInput,
} from '@/lib/services/okr-bulk-create';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  cycleName?: string;
  strategy?: string;
  departments?: Array<{ id?: string; name?: string }>;
  maxDepartments?: number;
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // 校验
  if (!body.cycleName || typeof body.cycleName !== 'string' || body.cycleName.trim().length === 0) {
    return NextResponse.json({ error: 'cycleName required' }, { status: 400 });
  }
  if (!body.strategy || typeof body.strategy !== 'string' || body.strategy.trim().length < 5) {
    return NextResponse.json({ error: 'strategy required (≥ 5 chars)' }, { status: 400 });
  }
  if (!Array.isArray(body.departments) || body.departments.length === 0) {
    return NextResponse.json({ error: 'departments required (≥ 1)' }, { status: 400 });
  }

  // 净化部门列表
  const departments = body.departments
    .filter((d): d is { id: string; name: string } =>
      typeof d?.id === 'string' && typeof d?.name === 'string' && d.id.length > 0 && d.name.length > 0,
    )
    .slice(0, body.maxDepartments ?? 8);

  if (departments.length === 0) {
    return NextResponse.json({ error: 'no valid departments after filter' }, { status: 400 });
  }

  const input: BulkCreateInput = {
    cycleName: body.cycleName.trim(),
    strategy: body.strategy.trim(),
    departments,
    triggeredBy: auth.userId,
    maxDepartments: body.maxDepartments,
  };

  try {
    await boot();
    const router = getRouter();
    const result = await generateBulkCreateOptions(input, router);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
