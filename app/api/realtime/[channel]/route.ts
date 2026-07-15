import { type NextRequest } from 'next/server';
import { makeSSEStream } from '@/lib/realtime/event-bus';
import { withApiLog } from '@/lib/api-log/with-api-log-edge';

export const runtime = 'edge';

/**
 * GET /api/realtime/[channel]
 * SSE 端点 - 客户端通过 EventSource 订阅
 */
async function GETApiHandler(_req: NextRequest, { params }: { params: { channel: string } }) {
  const stream = makeSSEStream(params.channel);
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/realtime/[channel]' });
