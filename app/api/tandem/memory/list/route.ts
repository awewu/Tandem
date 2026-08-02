/**
 * GET /api/tandem/memory/list
 *
 * 列出 Memory 层条目 (SOP / Case / Redline / Value).
 *
 * 查询:
 *   - ?status=active|revising|inactive|deprecated  (可选, 默认全部)
 *   - ?type=sop|case|redline|value                  (可选)
 *   - ?limit=N                                      (默认 100)
 *
 * 用途:
 *   - Steward 工作台浏览
 *   - 个人记事本 (detail=1, ownerUserId=self)
 *
 * 安全 (P0 修复):
 *   - requireAuth: 必须登录.
 *   - 租户隔离: 仅返回本租户 (orgId===tenant, 历史空 orgId 视同 default 租户 = 前向安全).
 *   - 逐条可见性: admin/owner 全看; steward 看全部非 personal (治理浏览);
 *     其余用户走 canViewMemory (个人记事本仅本人/主管可见, 杜绝跨用户读他人笔记全文).
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { requireAuth } from '@/lib/auth/require-auth';
import { canViewMemory } from '@/lib/types/memory';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');
  const ownershipLevel = url.searchParams.get('ownershipLevel');
  const ownerUserId = url.searchParams.get('ownerUserId');
  const ownerDepartmentId = url.searchParams.get('ownerDepartmentId');
  /** detail=1 时返回 body+tags+priority+parentId+uiCategory 等完整字段 (个人记事本用) */
  const detail = url.searchParams.get('detail') === '1';
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') ?? '100')));

  const isAdmin = auth.roles.includes('admin') || auth.roles.includes('owner');
  const isSteward = isAdmin || auth.roles.includes('steward');
  const viewer = { userId: auth.userId };

  const store = getStore();
  let memories = await store.memories.list();

  // 租户隔离 + 逐条可见性 (P0). demo 模式 (dev/e2e) 放行全部.
  if (!auth.demo) {
    memories = memories.filter((m) => {
      if ((m.orgId ?? auth.tenantId) !== auth.tenantId) return false;
      if (isAdmin) return true;
      if (isSteward && m.ownershipLevel !== 'personal') return true;
      return canViewMemory(m, viewer);
    });
  }

  if (status) memories = memories.filter((m) => m.status === status);
  if (type) memories = memories.filter((m) => m.type === type);
  if (ownershipLevel) memories = memories.filter((m) => m.ownershipLevel === ownershipLevel);
  if (ownerUserId) memories = memories.filter((m) => m.ownerUserId === ownerUserId);
  if (ownerDepartmentId) memories = memories.filter((m) => m.ownerDepartmentId === ownerDepartmentId);

  memories = memories.slice(0, limit);
  return NextResponse.json({
    memories: memories.map((m) => detail
      ? {
          id: m.id,
          type: m.type,
          title: m.title,
          body: m.body,
          status: m.status,
          ownershipLevel: m.ownershipLevel,
          ownerUserId: m.ownerUserId,
          uiCategory: m.uiCategory,
          priority: m.priority,
          tags: m.tags ?? [],
          parentId: m.parentId ?? null,
          isActive: m.isActive ?? (m.status === 'active'),
          version: m.version ?? 1,
          referenceCount: m.referenceCount ?? 0,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        }
      : {
          id: m.id,
          type: m.type,
          title: m.title,
          status: m.status,
          ownershipLevel: m.ownershipLevel,
          ownerDepartmentId: m.ownerDepartmentId ?? null,
          tags: m.tags ?? [],
          referenceCount: m.referenceCount ?? 0,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        }
    ),
    count: memories.length,
  });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/tandem/memory/list' });
