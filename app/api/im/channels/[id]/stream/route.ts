/**
 * GET /api/im/channels/[id]/stream
 *
 * SSE 实时推送 — 客户端订阅频道事件 (新消息 / 未读变化).
 * 浏览器用法:
 *   const es = new EventSource(`/api/im/channels/${id}/stream?userId=${me}`);
 *   es.addEventListener('message', e => append(JSON.parse(e.data)));
 */

import { type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { subscribeIm } from '@/lib/im/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Params {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: Params) {
  await boot();
  const userId = new URL(req.url).searchParams.get('userId') ?? '';
  const channelId = params.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sendComment = (note: string) => {
        controller.enqueue(encoder.encode(`: ${note}\n\n`));
      };
      const sendEvent = (eventName: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // 立即发一行注释以打开连接
      sendComment(`im stream open · channel=${channelId} user=${userId}`);

      // 心跳, 防代理超时
      const heartbeat = setInterval(() => {
        try {
          sendComment(`heartbeat ${Date.now()}`);
        } catch {
          /* closed */
        }
      }, 25_000);

      const unsubscribe = subscribeIm((evt) => {
        if (evt.type === 'message' && evt.channelId === channelId) {
          sendEvent('message', evt.message);
        } else if (
          evt.type === 'unread_changed' &&
          evt.channelId === channelId &&
          evt.userId === userId
        ) {
          sendEvent('unread', { unread: evt.unread });
        } else if (
          evt.type === 'channel_updated' &&
          evt.channelId === channelId
        ) {
          sendEvent('channel', evt.channel);
        }
      });

      // 客户端断开时清理
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* noop */
        }
      });
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
