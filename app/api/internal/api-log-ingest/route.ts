// api-log-exempt: signed sink used by middleware and Edge route handlers.
import { createHmac, timingSafeEqual } from 'crypto';
import { appendApiLog } from '@/lib/api-log/service';
import type { ApiLogInput } from '@/lib/api-log/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 16_384;
const MAX_CLOCK_SKEW_MS = 60_000;

function secret(): string {
  return process.env.API_LOG_INGEST_SECRET || process.env.BUSINESS_LOG_INGEST_SECRET
    || process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET || 'dev-only-api-log-ingest-secret';
}

function validSignature(timestamp: string, body: string, provided: string): boolean {
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) return false;
  const expected = createHmac('sha256', secret()).update(`${timestamp}.${body}`).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) return Response.json({ error: 'payload_too_large' }, { status: 413 });
  const body = await req.text();
  const timestamp = req.headers.get('x-api-log-timestamp') ?? '';
  const signature = req.headers.get('x-api-log-signature') ?? '';
  if (!validSignature(timestamp, body, signature)) return Response.json({ error: 'invalid_signature' }, { status: 401 });
  try {
    const input = JSON.parse(body) as ApiLogInput;
    const validOutcome = ['success', 'failure', 'denied', 'error'].includes(input.outcome);
    if (!validOutcome || !input.operation || !input.action || !input.method || !input.path || !input.summary) {
      return Response.json({ error: 'invalid_payload' }, { status: 400 });
    }
    await appendApiLog({ ...input, source: input.source === 'edge' ? 'edge' : 'middleware' });
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }
}
