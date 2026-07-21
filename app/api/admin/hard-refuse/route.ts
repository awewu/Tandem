/**
 * GET  /api/admin/hard-refuse  — 读取当前业务红线清单 (enabled + topics + 来源)
 * PUT  /api/admin/hard-refuse  — 更新红线清单 (owner/admin only, 存 DB 热更新)
 *
 * 红线硬拒: 中央 AI / 搭子 回答入口的确定性快检 (薪资/裁员/法律/对外承诺/资金/考评…),
 * 命中即转人工。清单存 KvStore, 无需重新部署。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { getHardRefuseConfig, saveHardRefuseConfig } from '@/lib/governance/hard-refuse-service';
import { DEFAULT_HARD_REFUSE_TOPICS } from '@/lib/governance/hard-refuse-redlines';

export const runtime = 'nodejs';

async function GETApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles.some((r) => ['owner', 'admin'].includes(r))) {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
  }

  const cfg = await getHardRefuseConfig(auth.tenantId);
  return NextResponse.json({
    enabled: cfg.enabled,
    topics: cfg.topics,
    source: cfg.source, // 'db' = 已自定义, 'default' = 仍用出厂兜底
    defaults: DEFAULT_HARD_REFUSE_TOPICS, // 供前端"恢复默认"用
  });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/admin/hard-refuse' });

async function PUTApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles.some((r) => ['owner', 'admin'].includes(r))) {
    return NextResponse.json({ error: '仅管理员可修改' }, { status: 403 });
  }

  let body: { enabled?: boolean; topics?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  try {
    const saved = await saveHardRefuseConfig(
      { enabled: body.enabled, topics: body.topics },
      auth.userId,
      auth.tenantId,
    );
    const { audit } = await import('@/lib/audit/log');
    await audit('hard_refuse.config_updated', auth.userId, {
      targetType: 'hard_refuse_config',
      targetId: saved.id,
      metadata: { enabled: saved.enabled, topicCount: saved.topics.length },
    }).catch(() => { /* noop */ });
    return NextResponse.json({ enabled: saved.enabled, topics: saved.topics, source: 'db' });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export const PUT = withApiLog(PUTApiHandler, { route: '/api/admin/hard-refuse' });
