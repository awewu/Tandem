import { type NextRequest } from 'next/server';
import { makeSSEStream } from '@/lib/realtime/event-bus';

export const runtime = 'edge';

/**
 * GET /api/realtime/[channel]
 * SSE 端点 - 客户端通过 EventSource 订阅
 */
export async function GET(_req: NextRequest, { params }: { params: { channel: string } }) {
  const stream = makeSSEStream(params.channel);
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
