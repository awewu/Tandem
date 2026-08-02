/**
 * POST /api/im/channels/:id/summary   { scope?: 'recent' | 'unread' | 'today' }
 *
 * §Sprint3 群总结 (对标企业微信「群总结」并超越):
 *   - 结构化输出 (概览/话题/结论/待办含负责人/未决问题)
 *   - 范围: recent 最近 · unread 我上次已读之后 · today 最近 24h
 *   - 真实姓名 + fail-soft (LLM 不可用降级为确定性轻量总结, 不 500)
 *   - 权限: 仅频道成员 (summarizeChannel 内部校验, 非成员抛 'not found' → 404)
 *   - 兼容旧客户端: 额外返回 markdown `summary` 字符串
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { summarizeChannel, summaryToMarkdown, type ImSummaryScope } from '@/lib/im/summary';
import { withApiLog } from '@/lib/api-log/with-api-log';

const VALID_SCOPES: ImSummaryScope[] = ['recent', 'unread', 'today'];

async function POSTApiHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { scope?: unknown };
  const scope: ImSummaryScope = VALID_SCOPES.includes(body.scope as ImSummaryScope)
    ? (body.scope as ImSummaryScope)
    : 'recent';

  try {
    const result = await summarizeChannel({
      channelId: id,
      userId: auth.userId,
      tenantId: auth.tenantId,
      scope,
    });
    return NextResponse.json({ result, summary: summaryToMarkdown(result) });
  } catch (err) {
    // summarizeChannel 只在无权限时抛 'not found' → 404 (不泄露存在性)
    if ((err as Error).message === 'not found') {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/im/channels/[id]/summary' });
