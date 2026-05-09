import type { NextRequest } from 'next/server';
import { boot, getRouter } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/convergence/[id]/stream
 *
 * SSE 端点 · 流式生成 3+1 选项 (用户能看到 LLM 边写边出)
 *
 * 浏览器端用法:
 *   const es = new EventSource(`/api/convergence/${id}/stream`);
 *   es.addEventListener('token', e => append(e.data));
 *   es.addEventListener('done', () => es.close());
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const store = getStore();
  const card = await store.decisionCards.get(params.id);
  if (!card) {
    return new Response('decision card not found', { status: 404 });
  }

  const router = getRouter();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };

      try {
        send('start', JSON.stringify({ cardId: card.id, title: card.title }));

        // 流式让 LLM 边写边出 3+1 选项的"思考过程" (供 UI 显示)
        const iter = router.chatStream({
          scenario: 'reasoning_complex',
          temperature: 0.6,
          messages: [
            {
              role: 'system',
              content: `你是 Tandem 议事室助手. 任务: 针对议题, 一边推理一边输出 3+1 选项.
输出顺序: 先 A (SOP), 然后 B (AI 推演), 然后 C (历史案例), 最后留空 D (员工原创).
每个选项前用 "## A:" / "## B:" / "## C:" 标记.`,
            },
            {
              role: 'user',
              content: `议题: ${card.title}\n\n背景: ${(card.origins as { description?: string } | null)?.description ?? '(无)'}`,
            },
          ],
        });

        for await (const chunk of iter) {
          const delta = typeof chunk.delta?.content === 'string' ? chunk.delta.content : '';
          if (delta) {
            send('token', JSON.stringify({ delta }));
          }
          if (chunk.finishReason) {
            send('done', JSON.stringify({ finishReason: chunk.finishReason }));
            break;
          }
        }
        controller.close();
      } catch (err) {
        send('error', JSON.stringify({ error: (err as Error).message }));
        controller.close();
      }
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
