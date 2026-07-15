import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import { queryBusinessLogs } from '@/lib/business-log/service';
import type { BusinessLogOutcome, BusinessLogQuery } from '@/lib/business-log/types';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const dynamic = 'force-dynamic';
const OUTCOMES = new Set<BusinessLogOutcome>(['success', 'failure', 'denied', 'error']);

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
  const query: BusinessLogQuery = {
    tenantId: auth.tenantId,
    actorId: params.get('actorId') || undefined,
    requestId: params.get('requestId') || undefined,
    source: params.get('source') || undefined,
    category: params.get('category') || undefined,
    operation: params.get('operation') || undefined,
    action: params.get('action') || undefined,
    outcome: outcome && OUTCOMES.has(outcome as BusinessLogOutcome) ? outcome as BusinessLogOutcome : undefined,
    targetType: params.get('targetType') || undefined,
    targetId: params.get('targetId') || undefined,
    from: optionalDate(params.get('from')),
    to: optionalDate(params.get('to')),
    q: params.get('q')?.trim() || undefined,
    limit: Number(params.get('limit') ?? 50),
    offset: Number(params.get('offset') ?? 0),
  };
  const result = await queryBusinessLogs(query);

  if (params.get('format') === 'ai') {
    return NextResponse.json({
      schemaVersion: 'business-log.v2',
      generatedAt: new Date().toISOString(),
      filters: { ...query, tenantId: undefined },
      count: result.entries.length,
      hasMore: result.hasMore,
      records: result.entries.map((entry) => ({
        at: entry.createdAt,
        actor: { id: entry.actorId, type: entry.actorType },
        event: {
          module: entry.category,
          operation: entry.operation,
          action: entry.action,
          source: entry.source,
        },
        object: entry.targetId ? { type: entry.targetType, id: entry.targetId } : null,
        result: { outcome: entry.outcome, level: entry.level },
        trace: { requestId: entry.requestId },
        facts: entry.details,
        summary: entry.summary,
      })),
    });
  }

  return NextResponse.json({
    count: result.entries.length,
    hasMore: result.hasMore,
    limit: result.limit,
    offset: result.offset,
    entries: result.entries,
  });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/business-logs' });
