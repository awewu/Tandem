import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { waitAgent } from '@/lib/taf/agent/spawn';
import { withApiLog } from '@/lib/api-log/with-api-log';

/**
 * POST /api/agent/wait
 * Body: { agentId: string, timeoutMs?: number }
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const body = (await req.json().catch(() => ({}))) as {
    agentId?: string;
    timeoutMs?: number;
  };
  if (!body.agentId) {
    return NextResponse.json({ ok: false, error: 'agentId required' }, { status: 400 });
  }
  const result = await waitAgent(body.agentId, body.timeoutMs ?? 60_000);
  if (!result) {
    return NextResponse.json({ ok: false, status: 'pending', error: 'timeout or unknown agent' });
  }
  return NextResponse.json({ ok: true, ...result });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/agent/wait' });
