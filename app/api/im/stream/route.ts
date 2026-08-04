import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getChannelIfMember, subscribeIm } from '@/lib/im/service';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    unsubscribe?.();
  };

  const stream = new ReadableStream({
    start(controller) {
      const sendComment = (note: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ${note}\n\n`));
      };
      const sendEvent = (eventName: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      sendComment(`im user stream open · user=${auth.userId}`);

      heartbeat = setInterval(() => {
        try {
          sendComment(`heartbeat ${Date.now()}`);
        } catch {
          cleanup();
        }
      }, 25_000);

      unsubscribe = subscribeIm((evt) => {
        try {
          if (evt.type === 'message' && evt.message.senderId !== auth.userId) {
            void getChannelIfMember(evt.channelId, auth.userId, auth.tenantId)
              .then((channel) => {
                if (channel) sendEvent('message', { channelId: evt.channelId, message: evt.message });
              })
              .catch(() => undefined);
          } else if (evt.type === 'unread_changed' && evt.userId === auth.userId) {
            sendEvent('unread', { channelId: evt.channelId, unread: evt.unread });
          } else if (
            evt.type === 'channel_updated' &&
            evt.channel.memberIds.includes(auth.userId) &&
            (evt.channel.tenantId ?? 'default') === auth.tenantId
          ) {
            sendEvent('channel', { channelId: evt.channelId });
          }
        } catch {
          cleanup();
        }
      });

      req.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* noop */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/im/stream' });
