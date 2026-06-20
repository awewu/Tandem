/**
 * 搭字手抄 · 文章/公众号一键导入提炼 (对标 Get笔记 的"链接转笔记")
 *
 *   POST /api/shouchao/import  { url, rawText?, mode?: 'distill' | 'full' }
 *
 * 抓取网页正文 (复用 clip 的 htmlToText), 用 LLM 提炼成结构化中文笔记后落库为本人笔记.
 * - mode='distill' (默认): AI 提炼要点 + 生成标题/标签, 适合长文/公众号
 * - mode='full'           : 保留正文全文 (仅清洗), 适合想自己读原文的场景
 * - 严格 ownerId 隔离, 落到本人搭字手抄, 不进公司知识库
 * - 抓取失败 / AI 失败诚实返回错误, 不伪造内容
 *
 * 公众号 (mp.weixin.qq.com) 等需 UA 伪装的站点已带浏览器 UA; 反爬严重的站点会失败,
 * 此时前端可提示用户改用"粘贴正文" (rawText)。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { createNote } from '@/lib/shouchao/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Body {
  url?: string;
  rawText?: string;
  mode?: 'distill' | 'full';
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function htmlToText(html: string): string {
  const body = html.replace(/<head[\s\S]*?<\/head>/gi, ' ');
  const stripped = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/(p|div|section|article|h[1-6]|li|br|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(stripped)
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();
}

async function fetchArticle(url: string): Promise<{ title: string; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html') && !ct.includes('text')) throw new Error(`不支持的内容类型：${ct || '未知'}`);
    const html = await res.text();
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : new URL(url).hostname;
    return { title, text: htmlToText(html).slice(0, 20_000) };
  } finally {
    clearTimeout(timer);
  }
}

const DISTILL_SYSTEM = [
  '你是一个文章提炼助手。把用户给的文章正文提炼成一篇结构清晰的中文笔记，便于日后检索回顾。',
  '',
  '要求：',
  '- 用 Markdown 输出，第一行是 # 一级标题（精炼概括文章主旨，<=30字）。',
  '- 正文用要点/小标题组织，保留关键数据、观点、结论、可执行建议。',
  '- 去掉广告、导航、版权声明、互动引导等噪音。',
  '- 末尾用一行「标签：tag1 tag2 tag3」给出 3-5 个中文标签（便于检索）。',
  '- 忠于原文，不编造原文没有的事实。',
].join('\n');

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  const body = (await req.json().catch(() => ({}))) as Body;
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const rawText = typeof body.rawText === 'string' ? body.rawText.trim() : '';
  const mode = body.mode === 'full' ? 'full' : 'distill';

  if (!url && !rawText) {
    return NextResponse.json({ ok: false, error: 'url 或 rawText 至少提供一个' }, { status: 400 });
  }

  let sourceTitle = '';
  let sourceText = rawText;
  let sourceUrl: string | undefined;
  if (!sourceText && url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol');
    } catch {
      return NextResponse.json({ ok: false, error: '请输入合法的 http(s) 链接' }, { status: 400 });
    }
    try {
      const art = await fetchArticle(parsed.toString());
      sourceTitle = art.title;
      sourceText = art.text;
      sourceUrl = parsed.toString();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      const friendly = /abort/i.test(msg) ? '抓取超时' : `抓取失败：${msg}（可改用粘贴正文）`;
      return NextResponse.json({ ok: false, error: friendly }, { status: 502 });
    }
  }

  if (!sourceText || sourceText.length < 20) {
    return NextResponse.json({ ok: false, error: '正文为空或过短，无法提炼' }, { status: 422 });
  }

  if (mode === 'full') {
    const title = sourceTitle || sourceText.split('\n')[0].slice(0, 30) || '导入的文章';
    const note = await createNote({
      ownerId: auth.userId,
      tenantId: auth.tenantId,
      title,
      content: sourceText,
      sourceUrl,
      tags: ['导入'],
    });
    return NextResponse.json({ ok: true, note, mode });
  }

  const { createDefaultRouter } = await import('@/lib/taf');
  const router = createDefaultRouter();
  try {
    const resp = await router.chat({
      messages: [
        { role: 'system', content: DISTILL_SYSTEM },
        {
          role: 'user',
          content: `${sourceUrl ? `来源：${sourceUrl}\n` : ''}${sourceTitle ? `原标题：${sourceTitle}\n` : ''}\n正文：\n${sourceText}`,
        },
      ],
      scenario: 'long_context',
      temperature: 0.3,
      maxTokens: 1500,
      metadata: { userId: auth.userId, requestId: 'shouchao:import' },
    });
    const md = typeof resp.message.content === 'string' ? resp.message.content.trim() : '';
    if (!md) throw new Error('AI 返回空内容');

    const lines = md.split('\n');
    const titleLine = lines.find((l) => /^#\s+/.test(l));
    const title = (titleLine ? titleLine.replace(/^#\s+/, '') : sourceTitle || '导入的文章').slice(0, 60);
    const tagLine = [...lines].reverse().find((l) => /^标签[:：]/.test(l.trim()));
    const tags = tagLine
      ? tagLine
          .replace(/^标签[:：]/, '')
          .split(/[\s,，、]+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 5)
      : ['导入'];

    const note = await createNote({
      ownerId: auth.userId,
      tenantId: auth.tenantId,
      title,
      content: md,
      sourceUrl,
      tags,
    });
    return NextResponse.json({ ok: true, note, mode });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI 服务不可用';
    return NextResponse.json({ ok: false, error: `提炼失败：${msg}` }, { status: 503 });
  }
});
