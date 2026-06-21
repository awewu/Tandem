/**
 * 搭字手抄 · 文章/公众号/文件一键导入提炼 (对标 Get笔记 的"链接转笔记/文件转笔记")
 *
 *   POST /api/shouchao/import
 *     - JSON      { url, rawText?, mode?: 'distill' | 'full' }
 *     - multipart  file=<PDF/.docx/.txt/.md>, mode=<distill|full>
 *
 * 抓取网页正文 (复用 clip 的 htmlToText) 或抽取上传文件正文, 用 LLM 提炼成结构化中文笔记后落库.
 * - mode='distill' (默认): AI 提炼要点 + 生成标题/标签, 适合长文/公众号
 * - mode='full'           : 保留正文全文 (仅清洗), 适合想自己读原文的场景
 * - 严格 ownerId 隔离, 落到本人搭字手抄, 不进公司知识库
 * - 抓取失败 / AI 失败诚实返回错误, 不伪造内容
 *
 * 公众号 (mp.weixin.qq.com) 等需 UA 伪装的站点已带浏览器 UA; 反爬严重的站点会失败,
 * 此时前端可提示用户改用"粘贴正文" (rawText)。
 * 文件支持: PDF (pdfjs-dist) / .docx (mammoth) / 纯文本/Markdown; 旧版 .doc 与扫描件 PDF 不支持。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { createNote } from '@/lib/shouchao/service';
import { extractDocument, MAX_FILE_BYTES } from '@/lib/infra/document-extract';
import { safeFetch, SsrfBlockedError } from '@/lib/infra/ssrf-guard';

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
  // SSRF 防护: safeFetch 逐跳校验 (含重定向), 拒绝内网/元数据地址
  const res = await safeFetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('html') && !ct.includes('text')) throw new Error(`不支持的内容类型：${ct || '未知'}`);
  const html = await res.text();
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let hostname = '';
  try { hostname = new URL(res.url || url).hostname; } catch { /* ignore */ }
  const title = m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : hostname;
  return { title, text: htmlToText(html).slice(0, 20_000) };
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

  let sourceTitle = '';
  let sourceText = '';
  let sourceUrl: string | undefined;
  let mode: 'distill' | 'full' = 'distill';

  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    // ---- 文件上传分支 ----
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ ok: false, error: '表单解析失败' }, { status: 400 });
    }
    const file = form.get('file');
    const modeField = form.get('mode');
    mode = modeField === 'full' ? 'full' : 'distill';
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: '缺少上传文件 file' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { ok: false, error: `文件过大（上限 ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB）` },
        { status: 413 },
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extracted = await extractDocument(bytes, file.name, file.type);
    if (!extracted.ok || !extracted.text) {
      return NextResponse.json({ ok: false, error: extracted.error ?? '文件解析失败' }, { status: 422 });
    }
    sourceTitle = extracted.title ?? '';
    sourceText = extracted.text;
  } else {
    // ---- 链接 / 粘贴正文分支 ----
    const body = (await req.json().catch(() => ({}))) as Body;
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const rawText = typeof body.rawText === 'string' ? body.rawText.trim() : '';
    mode = body.mode === 'full' ? 'full' : 'distill';

    if (!url && !rawText) {
      return NextResponse.json({ ok: false, error: 'url 或 rawText 至少提供一个' }, { status: 400 });
    }
    sourceText = rawText;
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
        if (err instanceof SsrfBlockedError) {
          return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
        }
        const msg = err instanceof Error ? err.message : 'unknown';
        const friendly = /abort/i.test(msg) ? '抓取超时' : `抓取失败：${msg}（可改用粘贴正文）`;
        return NextResponse.json({ ok: false, error: friendly }, { status: 502 });
      }
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
