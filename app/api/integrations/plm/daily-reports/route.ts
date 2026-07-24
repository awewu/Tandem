import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import {
  DailyReportSyncError,
  listOwnDailyReports,
  syncPlmDailyReport,
} from '@/lib/integrations/plm-daily-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const reports = await listOwnDailyReports(auth);
  return NextResponse.json({ dailyReports: reports });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/integrations/plm/daily-reports' });

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.authType !== 'oidc_bearer') {
    return NextResponse.json(
      { error: 'bearer_access_token_required' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
    );
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new DailyReportSyncError('invalid JSON body', 400, 'invalid_json');
    }
    const result = await syncPlmDailyReport(auth, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DailyReportSyncError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/integrations/plm/daily-reports' });
