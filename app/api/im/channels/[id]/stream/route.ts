/**
 * GET /api/im/channels/[id]/stream
 *
 * SSE 实时推送 — 客户端订阅频道事件 (新消息 / 未读变化).
 * 浏览器用法:
 *   const es = new EventSource(`/api/im/channels/${id}/stream?userId=${me}`);
 *   es.addEventListener('message', e => append(JSON.parse(e.data)));
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { subscribeIm, getChannelIfMember } from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Params {
  params: { id: string };
}

async function GETApiHandler(req: NextRequest, { params }: Params) {
  await boot();
  // 访问控制: 必须登录且为频道成员才能订阅实时消息流 (防未鉴权/跨频道/跨租户 IDOR).
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const channelId = params.id;
  const channel = await getChannelIfMember(channelId, auth.userId, auth.tenantId);
  if (!channel) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const userId = auth.userId;

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
          encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // 立即发一行注释以打开连接
      sendComment(`im stream open · channel=${channelId} user=${userId}`);

      // 心跳, 防代理超时
      heartbeat = setInterval(() => {
        try {
          sendComment(`heartbeat ${Date.now()}`);
        } catch {
          cleanup();
        }
      }, 25_000);

      unsubscribe = subscribeIm((evt) => {
        try {
          if (evt.type === 'message' && evt.channelId === channelId) {
            sendEvent('message', evt.message);
          } else if (evt.type === 'message_updated' && evt.channelId === channelId) {
            // Day 4: 撤回 / 编辑 推送
            sendEvent('message_updated', evt.message);
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
          } else if (
            evt.type === 'read_receipt_changed' &&
            evt.channelId === channelId
          ) {
            sendEvent('read_receipt', { userId: evt.userId, lastReadAt: evt.lastReadAt });
          } else if (
            evt.type === 'typing' &&
            evt.channelId === channelId &&
            evt.userId !== userId
          ) {
            // §Sprint2 typing: 排除自己, 前端收到后短超时自动清
            sendEvent('typing', { userId: evt.userId, at: evt.at });
          }
        } catch {
          cleanup();
        }
      });

      // 客户端断开时清理
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
      // Next/代理在某些断连路径只触发 stream cancel, 不一定触发 request abort。
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

export const GET = withApiLog(GETApiHandler, { route: '/api/im/channels/[id]/stream' });
