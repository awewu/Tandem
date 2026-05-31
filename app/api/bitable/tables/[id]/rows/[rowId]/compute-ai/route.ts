/**
 * D-02: 多维表格 · 单行 AI 列计算 endpoint
 *
 *   POST /api/bitable/tables/[id]/rows/[rowId]/compute-ai
 *   body (可选): { colIds?: string[] }   // 仅计算这些列, 不传 = 全部 ai_compute 列
 *
 * 返回: { computed, ok, failed, cells: [{colId, status, value?, error?}] }
 *
 * 鉴权: table.ownerId 必须 === auth.userId (与 rows route 一致).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { computeAiCellsForRow } from '@/lib/services/bitable-ai-compute';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; rowId: string } },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const table = await store.bitableTables.get(params.id);
  if (!table) return NextResponse.json({ error: 'table not found' }, { status: 404 });
  if ((table.tenantId ?? 'default') !== auth.tenantId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (table.ownerId !== auth.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { colIds?: string[] };

  try {
    const result = await computeAiCellsForRow(
      params.id,
      params.rowId,
      body.colIds,
      auth.userId,
    );
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'compute failed';
    const status = msg === 'row not found' ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
