/**
 * POST /api/knowledge/web-ingest
 *
 * 用大模型抓取外部网页/搜索结果，提炼后存入公司知识库。
 * 需要 webLearnEnabled=true (admin 开关) 且配置了 web search provider。
 *
 * Body:
 *   { urls?: string[],        // 直接指定 URL 列表
 *     query?: string,         // 搜索关键词 (走 web.search skill)
 *     folder?: string,        // 存入知识库的文件夹名，默认 "外网学习"
 *     ownership?: string }    // 知识所有权级别，默认 "company"
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot, getRouter } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getAiSettings } from '@/lib/settings/ai-settings';
import { createNode, listNodes } from '@/lib/knowledge/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function fetchPageText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'TandemAI-Learner/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // 粗剥 HTML 标签
    return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s{3,}/g, '\n').slice(0, 8000);
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles?.includes('admin') && !auth.roles?.includes('champion'))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const cfg = await getAiSettings(auth.tenantId);
  if (cfg.webLearnEnabled === false)
    return NextResponse.json({ error: 'webLearnEnabled 开关已关闭，请在 AI 设置中开启' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { urls = [], query = '', folder = '外网学习', ownership = 'company' } = body as {
    urls?: string[]; query?: string; folder?: string; ownership?: string;
  };

  const urlList: string[] = [...(urls ?? [])];

  // 如果传了 query，先走 web.search skill 获取 URL 列表
  if (query.trim()) {
    try {
      const { skillRegistry } = await import('@/lib/taf/skills');
      const r = await skillRegistry.execute('web.search', { query: query.trim(), count: 5 }, { userId: auth.userId, tenantId: auth.tenantId, isProxy: false });
      if (r.ok && r.data) {
        const data = r.data as { results: Array<{ url: string; title: string; snippet: string }> };
        for (const item of data.results ?? []) {
          if (item.url) urlList.push(item.url);
        }
      }
    } catch { /* 搜索失败不阻塞 */ }
  }

  if (urlList.length === 0)
    return NextResponse.json({ error: 'urls 或 query 至少提供一个' }, { status: 400 });

  // 确保文件夹存在
  const nodes = await listNodes(auth.userId);
  let folderId = nodes.find((n) => n.type === 'folder' && n.name === folder)?.id;
  if (!folderId) {
    const f = await createNode({ ownerId: auth.userId, tenantId: auth.tenantId, name: folder, type: 'folder', parentId: 'root', ownership: ownership as never });
    folderId = f.id;
  }

  const router = getRouter();
  const results: Array<{ url: string; ok: boolean; title?: string; error?: string }> = [];

  for (const url of urlList.slice(0, 10)) {
    try {
      const raw = await fetchPageText(url);
      const completion = await router.chat({
        model: undefined,
        messages: [
          { role: 'system', content: '你是一个知识提炼助手。将以下网页内容提炼为结构化的中文知识摘要，保留关键数据、观点和结论，去除广告和导航内容。用 Markdown 格式输出，包含标题和要点。' },
          { role: 'user', content: `来源: ${url}\n\n${raw}` },
        ],
      });
      const summary = completion.choices?.[0]?.message?.content ?? raw.slice(0, 2000);
      const title = summary.split('\n')[0].replace(/^#+\s*/, '').slice(0, 80) || new URL(url).hostname;
      await createNode({
        ownerId: auth.userId,
        tenantId: auth.tenantId,
        name: `${title} (${new Date().toLocaleDateString('zh-CN')})`,
        type: 'file',
        parentId: folderId,
        content: `来源: ${url}\n更新: ${new Date().toISOString()}\n\n${summary}`,
        ownership: ownership as never,
      });
      results.push({ url, ok: true, title });
    } catch (e) {
      results.push({ url, ok: false, error: (e as Error).message });
    }
  }

  const ok = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, processed: results.length, saved: ok, results });
}
