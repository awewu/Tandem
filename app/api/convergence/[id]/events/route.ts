/**
 * GET /api/convergence/[id]/events
 *
 * SSE 端点 · 议事室状态实时推送
 *
 * 浏览器端用法:
 *   const es = new EventSource(`/api/convergence/${id}/events`);
 *   es.addEventListener('snapshot', e => setData(JSON.parse(e.data)));
 *   es.addEventListener('ping', () => {});
 */

import { NextRequest } from 'next/server';
import { getStore } from '@/lib/storage/repository';
import { convergenceBus } from '@/lib/convergence/events';
import type { DecisionCard } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const cardId = params.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch { /* stream closed */ }
      };

      // 1. 立即推送当前快照
      const store = getStore();
      const card = await store.decisionCards.get(cardId);
      if (card) {
        send('snapshot', card);
      } else {
        send('error', { message: 'Decision card not found' });
        controller.close();
        return;
      }

      // 2. 订阅状态变更
      const onUpdate = (id: string, updatedCard: DecisionCard) => {
        if (id === cardId) {
          send('snapshot', updatedCard);
        }
      };
      convergenceBus.on('card-updated', onUpdate);

      // 3. 心跳 (防止 Nginx/CDN 断开空闲连接)
      const heartbeat = setInterval(() => {
        send('ping', { ts: Date.now() });
      }, 15000);

      // 4. 定时兜底刷新 (每 3s 查一次 DB，推送 elapsedSeconds 等时间相关变化)
      let lastElapsed = card.elapsedSeconds ?? 0;
      const ticker = setInterval(async () => {
        try {
          const fresh = await store.decisionCards.get(cardId);
          if (!fresh) return;
          if (fresh.elapsedSeconds !== lastElapsed || fresh.convergenceState !== card.convergenceState) {
            lastElapsed = fresh.elapsedSeconds ?? 0;
            send('snapshot', fresh);
          }
        } catch { /* noop */ }
      }, 3000);

      // 清理
      const cleanup = () => {
        clearInterval(heartbeat);
        clearInterval(ticker);
        convergenceBus.off('card-updated', onUpdate);
        try { controller.close(); } catch { /* noop */ }
      };

      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
