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
 *   - e2e 获取真实 memoryId 以测试降级流程
 *
 * 注意: 这是管控类 API (公司知识资产), 生产环境需加 cookie 鉴权. V1 PoC 暂开放读.
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';

export async function GET(req: NextRequest) {
  await boot();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');
  const ownershipLevel = url.searchParams.get('ownershipLevel');
  const ownerUserId = url.searchParams.get('ownerUserId');
  /** detail=1 时返回 body+tags+priority+parentId+uiCategory 等完整字段 (个人记事本用) */
  const detail = url.searchParams.get('detail') === '1';
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') ?? '100')));

  const store = getStore();
  let memories = await store.memories.list();
  if (status) memories = memories.filter((m) => m.status === status);
  if (type) memories = memories.filter((m) => m.type === type);
  if (ownershipLevel) memories = memories.filter((m) => m.ownershipLevel === ownershipLevel);
  if (ownerUserId) memories = memories.filter((m) => m.ownerUserId === ownerUserId);

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
          referenceCount: m.referenceCount ?? 0,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        }
    ),
    count: memories.length,
  });
}
