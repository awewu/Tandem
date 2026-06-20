/**
 * 搭子手抄 · 跨笔记 AI 问答 (Ask) · SSE 流式
 *
 *   POST /api/shouchao/ask  { question }
 *
 * 对标 NotebookLM / open-notebook 的"问你的第二大脑":
 * 在【本人全部笔记】里检索相关内容, 让 LLM 基于这些笔记带引用作答.
 * - 严格 ownerId 隔离, 只读本人笔记 (不读公司/他人 Memory)
 * - 答案只能基于检索到的笔记, 无依据则诚实说"笔记里没有", 不编造 (避免假闭环)
 * - 流式: 先发 citations 事件 (命中的笔记 id/标题, 供前端立刻渲染来源),
 *   再边生成边推 content 事件; 答案里的 [n] 对应 citations 的 index, 供溯源高亮.
 *
 * Response: SSE
 *   data: {"citations": [{index,id,title}]}
 *   data: {"content": "..."}
 *   data: {"error": "..."}
 *   data: {"done": true}
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getRouter } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { searchNotesForAsk } from '@/lib/shouchao/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  question?: string;
}

const SYSTEM_PROMPT = `你是用户的私人笔记助手 (第二大脑)。请【只依据】下面提供的"笔记片段"回答用户的问题。

规则：
- 只能基于给出的笔记内容作答，不得编造笔记里没有的事实。
- 若笔记片段不足以回答，请直接说明"你的笔记里没有相关记录"，并可建议用户补充记录。
- 回答用简洁清晰的中文。引用某条笔记时，在句末用 [n] 标注片段编号（n 为片段前的编号），便于用户溯源。
- 不要寒暄，直接给答案。`;

export async function POST(req: NextRequest): Promise<Response> {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth; // 401

  const body = (await req.json().catch(() => ({}))) as Body;
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return NextResponse.json({ ok: false, error: 'question 必填' }, { status: 400 });
  }

  await boot();

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* ignore */ }
      };
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch { /* ignore */ }
      };

      const onAbort = () => { send({ done: true, aborted: true }); safeClose(); };
      req.signal.addEventListener('abort', onAbort);

      try {
        const hits = await searchNotesForAsk(auth.userId, question, { topK: 6 });
        if (hits.length === 0) {
          send({ citations: [] });
          send({ content: '你还没有任何笔记。先记几条，我就能帮你回顾和检索了。' });
          send({ done: true });
          return;
        }

        const citations = hits.map((h, i) => ({
          index: i + 1,
          id: h.note.id,
          title: h.note.title,
        }));
        // 先把来源推给前端, 让"引用溯源"在答案生成前就可见
        send({ citations });

        // 拼接带编号的笔记片段 (每条限长, 控制 token)
        const context = hits
          .map((h, i) => {
            const tags = (h.note.tags ?? []).length ? ` [标签: ${h.note.tags.join(', ')}]` : '';
            return `片段 [${i + 1}] 《${h.note.title}》${tags}\n${(h.note.content ?? '').slice(0, 1500)}`;
          })
          .join('\n\n---\n\n');

        const router = getRouter();
        const stream = router.chatStream({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `我的笔记片段如下：\n\n${context}\n\n========\n我的问题：${question}` },
          ],
          scenario: 'long_context',
          temperature: 0.3,
          maxTokens: 1000,
          metadata: { userId: auth.userId, requestId: 'shouchao:ask' },
        });

        for await (const chunk of stream) {
          if (req.signal.aborted) break;
          const text = typeof chunk.delta?.content === 'string' ? chunk.delta.content : '';
          if (text) send({ content: text });
        }
        send({ done: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI 服务不可用';
        send({ error: `AI 服务暂时不可用：${msg}` });
        send({ done: true });
      } finally {
        req.signal.removeEventListener('abort', onAbort);
        safeClose();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
