/**
 * 搭子手抄 · 网页/链接剪藏
 *
 *   POST /api/shouchao/clip  { url }
 *
 * 服务端抓取 URL → 抽取标题 + 正文纯文本 (粗剥 HTML). 失败诚实返回错误,
 * 不伪造内容. 仅作 MVP 抽取, 复杂正文抽取留二阶段.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { safeFetch, SsrfBlockedError } from '@/lib/infra/ssrf-guard';

export const runtime = 'nodejs';

interface Body {
  url?: string;
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

/** 粗剥 HTML → 纯文本: 去 script/style/head, 标签转换行, 折叠空白. */
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

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Body;
  const url = typeof body.url === 'string' ? body.url.trim() : '';

  try {
    // SSRF 防护: 逐跳校验 (含重定向) 后再抓取, 拒绝内网/元数据地址
    const res = await safeFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TandemShouchaoClip/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `抓取失败：HTTP ${res.status}` }, { status: 502 });
    }
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html') && !ct.includes('text')) {
      return NextResponse.json({ ok: false, error: `不支持的内容类型：${ct || '未知'}` }, { status: 415 });
    }

    const finalUrl = res.url || url;
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    let hostname = '';
    try { hostname = new URL(finalUrl).hostname; } catch { /* ignore */ }
    const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : hostname;
    const text = htmlToText(html).slice(0, 20_000);

    return NextResponse.json({
      ok: true,
      title,
      url: finalUrl,
      content: text,
    });
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : 'unknown';
    const friendly = /abort/i.test(msg) ? '抓取超时' : `抓取失败：${msg}`;
    return NextResponse.json({ ok: false, error: friendly }, { status: 502 });
  }
});
