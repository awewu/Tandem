/**
 * 搭子手抄 · 跨笔记 AI 问答 (Ask)
 *
 *   POST /api/shouchao/ask  { question }
 *
 * 对标 NotebookLM / open-notebook 的"问你的第二大脑":
 * 在【本人全部笔记】里检索相关内容, 让 LLM 基于这些笔记带引用作答.
 * - 严格 ownerId 隔离, 只读本人笔记 (不读公司/他人 Memory)
 * - 答案只能基于检索到的笔记, 无依据则诚实说"笔记里没有", 不编造 (避免假闭环)
 * - 返回 citations (命中的笔记 id/标题), 供前端做来源跳转
 * AI 失败诚实返回 503.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { searchNotesForAsk } from '@/lib/shouchao/service';

export const runtime = 'nodejs';

interface Body {
  question?: string;
}

const SYSTEM_PROMPT = `你是用户的私人笔记助手 (第二大脑)。请【只依据】下面提供的"笔记片段"回答用户的问题。

规则：
- 只能基于给出的笔记内容作答，不得编造笔记里没有的事实。
- 若笔记片段不足以回答，请直接说明"你的笔记里没有相关记录"，并可建议用户补充记录。
- 回答用简洁清晰的中文。引用某条笔记时，在句末用 [n] 标注片段编号（n 为片段前的编号），便于用户溯源。
- 不要寒暄，直接给答案。`;

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  const body = (await req.json().catch(() => ({}))) as Body;
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return NextResponse.json({ ok: false, error: 'question 必填' }, { status: 400 });
  }

  const hits = await searchNotesForAsk(auth.userId, question, { topK: 6 });
  if (hits.length === 0) {
    return NextResponse.json({
      ok: true,
      answer: '你还没有任何笔记。先记几条，我就能帮你回顾和检索了。',
      citations: [],
    });
  }

  // 拼接带编号的笔记片段 (每条限长, 控制 token)
  const context = hits
    .map((h, i) => {
      const tags = (h.note.tags ?? []).length ? ` [标签: ${h.note.tags.join(', ')}]` : '';
      return `片段 [${i + 1}] 《${h.note.title}》${tags}\n${(h.note.content ?? '').slice(0, 1500)}`;
    })
    .join('\n\n---\n\n');

  const citations = hits.map((h, i) => ({
    index: i + 1,
    id: h.note.id,
    title: h.note.title,
  }));

  const { createDefaultRouter } = await import('@/lib/taf');
  const router = createDefaultRouter();

  try {
    const response = await router.chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `我的笔记片段如下：\n\n${context}\n\n========\n我的问题：${question}` },
      ],
      scenario: 'long_context',
      temperature: 0.3,
      maxTokens: 1000,
      metadata: { userId: auth.userId, requestId: 'shouchao:ask' },
    });
    const answer = typeof response.message.content === 'string' ? response.message.content.trim() : '';
    return NextResponse.json({ ok: true, answer, citations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI 服务不可用';
    return NextResponse.json({ ok: false, error: `AI 服务暂时不可用：${msg}` }, { status: 503 });
  }
});
