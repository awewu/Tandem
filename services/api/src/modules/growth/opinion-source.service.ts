import { Injectable, Logger } from '@nestjs/common';

/**
 * 增长中枢 · E1 舆情源连接器注册表（G3）。
 *
 * 可插拔架构：每个公开源一个连接器。外部源（微博/小红书/知乎/抖音/大众点评/新闻/AI答案）
 * 需凭证（环境变量），未配置则 status=not-configured，不臆造抓取；manual 源永远可用（人工/表单录入）。
 * 真实抓取实现落在各连接器 fetch()，此处提供统一契约 + 就绪度，保证 source-contract 可运行。
 */

export interface RawMention {
  source: string;
  content: string;
  url?: string;
  authorHash?: string;
}

export interface OpinionConnector {
  source: string;
  label: string;
  requiresCredential: boolean;
  credentialEnv?: string;
  fetch(query: string, limit: number): Promise<RawMention[]>;
}

export interface ConnectorStatus {
  source: string;
  label: string;
  status: 'ready' | 'not-configured';
  requiresCredential: boolean;
}

const EXTERNAL_SOURCES: { source: string; label: string; env: string }[] = [
  { source: 'weibo', label: '微博', env: 'GROWTH_WEIBO_TOKEN' },
  { source: 'xiaohongshu', label: '小红书', env: 'GROWTH_XHS_TOKEN' },
  { source: 'zhihu', label: '知乎', env: 'GROWTH_ZHIHU_TOKEN' },
  { source: 'douyin', label: '抖音', env: 'GROWTH_DOUYIN_TOKEN' },
  { source: 'dianping', label: '大众点评', env: 'GROWTH_DIANPING_TOKEN' },
];

// Bing 新闻 RSS：公开、无需凭证。可用 GROWTH_NEWS_RSS 覆盖为其它 RSS 端点（%q 占位查询词）。
const NEWS_RSS_TEMPLATE =
  process.env.GROWTH_NEWS_RSS || 'https://www.bing.com/news/search?q=%q&format=rss&setmkt=zh-CN';
const NEWS_FETCH_TIMEOUT_MS = 8000;

@Injectable()
export class OpinionSourceService {
  private readonly logger = new Logger('GrowthOpinionSource');
  private readonly connectors = new Map<string, OpinionConnector>();

  constructor() {
    // manual：始终可用（人工/表单/客服工单录入）。
    this.register({
      source: 'manual', label: '人工录入', requiresCredential: false,
      fetch: async () => [],
    });
    // news：真实 RSS 实拉（Bing 新闻，公开无凭证）。
    this.register({
      source: 'news', label: '新闻(RSS)', requiresCredential: false,
      fetch: (query, limit) => this.fetchNewsRss(query, limit),
    });
    // 外部源：凭证门控，未配置时 fetch 抛出显式错误（不静默臆造）。
    for (const e of EXTERNAL_SOURCES) {
      this.register({
        source: e.source, label: e.label, requiresCredential: true, credentialEnv: e.env,
        fetch: async () => {
          if (!process.env[e.env]) throw new Error(`connector ${e.source} not configured (missing ${e.env})`);
          // 真实抓取适配待接入；配置凭证后在此实现 HTTP 拉取 + 归一化。
          this.logger.warn(`connector ${e.source} configured but live fetch adapter not yet implemented`);
          return [];
        },
      });
    }
  }

  private register(c: OpinionConnector): void {
    this.connectors.set(c.source, c);
  }

  /** 连接器就绪度清单（供 UI 展示哪些源已接通）。 */
  statuses(): ConnectorStatus[] {
    return [...this.connectors.values()].map((c) => ({
      source: c.source,
      label: c.label,
      requiresCredential: c.requiresCredential,
      status: !c.requiresCredential || (c.credentialEnv && process.env[c.credentialEnv]) ? 'ready' : 'not-configured',
    }));
  }

  /** 从指定源拉取原始舆情（未配置源抛错，交调用方处理）。 */
  async pull(source: string, query: string, limit = 20): Promise<RawMention[]> {
    const c = this.connectors.get(source);
    if (!c) throw new Error(`unknown opinion source: ${source}`);
    return c.fetch(query, limit);
  }

  /** Bing 新闻 RSS 实拉 → 归一化为 RawMention（无凭证；含超时与安全解析）。 */
  private async fetchNewsRss(query: string, limit: number): Promise<RawMention[]> {
    if (!query) throw new Error('news source requires a query');
    const url = NEWS_RSS_TEMPLATE.replace('%q', encodeURIComponent(query));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS);
    let xml: string;
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'RhauttNexusGrowth/1.0 (+opinion-radar)' },
      });
      if (!res.ok) throw new Error(`news RSS HTTP ${res.status}`);
      xml = await res.text();
    } catch (err: unknown) {
      this.logger.warn(`news RSS fetch failed: ${String(err)}`);
      throw new Error(`news source fetch failed: ${String((err as Error)?.message || err)}`);
    } finally {
      clearTimeout(timer);
    }
    return this.parseRssItems(xml, limit);
  }

  /** 极简 RSS 解析（正则，无新增依赖）：抽取 item 的 title/link/description。 */
  private parseRssItems(xml: string, limit: number): RawMention[] {
    const items: RawMention[] = [];
    const itemRe = /<item[\s\S]*?<\/item>/gi;
    const pick = (block: string, tag: string): string => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? this.stripXml(m[1]) : '';
    };
    let match: RegExpExecArray | null;
    while ((match = itemRe.exec(xml)) && items.length < limit) {
      const block = match[0];
      const title = pick(block, 'title');
      const desc = pick(block, 'description');
      const link = pick(block, 'link');
      const content = [title, desc].filter(Boolean).join(' — ').trim();
      if (content) items.push({ source: 'news', content, url: link || undefined });
    }
    return items;
  }

  /** 去 CDATA / 标签 / 解码基础实体。 */
  private stripXml(raw: string): string {
    return raw
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
