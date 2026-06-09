/**
 * 搭子手抄 · AI 加工
 *
 *   POST /api/shouchao/ai  { action: 'summarize'|'polish'|'tags', content }
 *
 * 复用 Tandem LLM router (createDefaultRouter). AI 失败时诚实返回 503,
 * 不伪造结果 (避免假闭环). 高频场景走低成本模型.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import type { ShouchaoAiAction } from '@/lib/types/shouchao';

export const runtime = 'nodejs';

interface Body {
  action?: ShouchaoAiAction;
  content?: string;
}

const PROMPTS: Record<ShouchaoAiAction, string> = {
  summarize:
    '你是笔记助手。请把用户的笔记内容提炼为简洁的中文摘要：先一句话总览，再用 3-5 个要点列出核心信息。只输出摘要正文，不要寒暄。',
  polish:
    '你是中文写作助手。请把用户口述/草稿式的笔记整理成逻辑清晰、通顺的书面表达，保留全部信息与原意，不要新增事实。只输出整理后的正文。',
  tags:
    '你是标签助手。根据笔记内容生成 3-6 个精准的中文标签，用于检索归类。严格只输出 JSON 数组，如 ["产品","会议纪要","Q3规划"]，不要任何额外文字。',
};

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Body;
  const action = body.action;
  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (!action || !(action in PROMPTS)) {
    return NextResponse.json({ ok: false, error: 'action 必须是 summarize|polish|tags' }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ ok: false, error: 'content 必填' }, { status: 400 });
  }

  const { createDefaultRouter } = await import('@/lib/taf');
  const router = createDefaultRouter();

  try {
    const response = await router.chat({
      messages: [
        { role: 'system', content: PROMPTS[action] },
        { role: 'user', content: content.slice(0, 8000) },
      ],
      scenario: action === 'summarize' ? 'long_context' : 'high_frequency',
      temperature: action === 'polish' ? 0.4 : 0.3,
      maxTokens: 800,
      metadata: { userId: auth.userId, requestId: `shouchao:${action}` },
    });

    const raw = typeof response.message.content === 'string' ? response.message.content.trim() : '';

    if (action === 'tags') {
      let tags: string[] = [];
      try {
        const m = raw.match(/\[[\s\S]*\]/);
        tags = JSON.parse(m ? m[0] : raw);
      } catch {
        tags = raw
          .split(/[,，、\n]/)
          .map((s) => s.replace(/["'\[\]]/g, '').trim())
          .filter(Boolean);
      }
      return NextResponse.json({ ok: true, tags: tags.slice(0, 8) });
    }

    return NextResponse.json({ ok: true, result: raw });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI 服务不可用';
    return NextResponse.json({ ok: false, error: `AI 服务暂时不可用：${msg}` }, { status: 503 });
  }
});
