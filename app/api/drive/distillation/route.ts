/**
 * /api/drive/distillation
 *
 * GET  : 列出蒸馏候选 (可 ?status=pending|dismissed|promoted)。
 * POST : 触发一次云盘蒸馏扫描 (仅 admin/owner/steward)。AI 只产候选草稿, 不提案。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { scanDistillableFiles } from '@/lib/drive/distillation';
import type { DriveDistillationCandidate } from '@/lib/types/drive-distillation';
import { withApiLog } from '@/lib/api-log/with-api-log';

const SCAN_ROLES = ['admin', 'owner', 'steward'];

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const status = new URL(req.url).searchParams.get('status');
  const store = getStore();
  let candidates = await store.driveDistillationCandidates.list({ tenantId: auth.tenantId } as Partial<DriveDistillationCandidate>);
  if (status) candidates = candidates.filter((c) => c.status === status);
  candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ candidates });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/drive/distillation' });

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!(auth.roles ?? []).some((r) => SCAN_ROLES.includes(r))) {
    return NextResponse.json({ error: '仅管理员/管家可触发蒸馏扫描' }, { status: 403 });
  }
  const store = getStore();
  const ctx = createAppContext();
  const result = await scanDistillableFiles({
    tenantId: auth.tenantId,
    listFiles: () => ctx.driveRepo.list({ tenantId: auth.tenantId }),
    listCandidates: () =>
      store.driveDistillationCandidates.list({ tenantId: auth.tenantId } as Partial<DriveDistillationCandidate>),
    createCandidate: (c) => store.driveDistillationCandidates.create(c),
  });
  return NextResponse.json({
    created: result.created.length,
    scanned: result.scanned,
    skipped: result.skipped,
  });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/drive/distillation' });
