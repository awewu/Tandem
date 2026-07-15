import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import { queryApiLogs } from '@/lib/api-log/service';
import type { ApiLogOutcome, ApiLogQuery } from '@/lib/api-log/types';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const dynamic = 'force-dynamic';
const OUTCOMES = new Set<ApiLogOutcome>(['success', 'failure', 'denied', 'error']);

function optionalDate(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? undefined : value;
}

async function GETApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const params = req.nextUrl.searchParams;
  const outcome = params.get('outcome');
  const statusCode = Number(params.get('statusCode'));
  const query: ApiLogQuery = {
    tenantId: auth.tenantId,
    actorId: params.get('actorId') || undefined,
    requestId: params.get('requestId') || undefined,
    source: params.get('source') || undefined,
    category: params.get('category') || undefined,
    method: params.get('method') || undefined,
    route: params.get('route') || undefined,
    outcome: outcome && OUTCOMES.has(outcome as ApiLogOutcome) ? outcome as ApiLogOutcome : undefined,
    statusCode: Number.isInteger(statusCode) && statusCode > 0 ? statusCode : undefined,
    from: optionalDate(params.get('from')),
    to: optionalDate(params.get('to')),
    q: params.get('q')?.trim() || undefined,
    limit: Number(params.get('limit') ?? 50),
    offset: Number(params.get('offset') ?? 0),
  };
  const result = await queryApiLogs(query);
  return NextResponse.json({
    count: result.entries.length,
    hasMore: result.hasMore,
    limit: result.limit,
    offset: result.offset,
    entries: result.entries,
  });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/api-logs' });
