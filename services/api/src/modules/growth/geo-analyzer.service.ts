import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BrandBrainService } from './brand-brain.service';
import { geoEngineStatuses, GeoEngineStatus } from './geo-engines';

const GEO_BRAND_DISPLAY_NAMES: Record<string, string> = {
  rheem: '瑞美 Rheem',
  ruud: '瑞德 Ruud',
  everhot: '恒热 Everhot',
  'rheem-cn': '瑞美 Rheem',
  'ruud-cn': '瑞德 Ruud',
  'everhot-cn': '恒热 Everhot',
};

/**
 * 增长中枢 · E3 GEO Analyzer 核心分析器（G1）。
 *
 * 两个战场：
 *  - 站内可引用度（on-site）：消费 guard:geo 产物 evidence/geo/geo-readiness-report.json
 *    （schema/alt/sitemap 就绪度）——真实数据。
 *  - 站外可见度（off-site）：给定 AI 引擎答案快照，计算我方是否被引用、引用位次、
 *    竞品占位，以及 AIVS 可见度分（对标 GEOlytic：位置35% + 推荐强度30% + 证据20% + 品牌显著度15%）。
 *
 * 真实引擎探测（HTTP 调各 AI 搜索）为可插拔外部适配（无 Key/网络时由调用方传入答案快照离线分析），
 * 与 AiGateway 同策略，保证 source-contract 可运行、可测试。
 */

export interface TrustSource {
  url: string;
  domain: string;
  ours: boolean;
}

export interface HallucinationRisk {
  segment: string;
  reason: string;
}

// GEO 可见度三层（arXiv 2509.08919 / super-geo：fetched≠cited≠mentioned，三者独立可赢可输）。
// - none      未出现
// - mentioned 只出现品牌名，无我方出处链接 → 被"提到"，不代表 AI 读了我们的内容
// - cited     出现品牌名 + 我方域名/URL 出处 → 真正被引用（AI 引了我们的页面）
// 说明：纯客户端无法直接观测"fetched（被爬取但未引用）"，故落地为 none/mentioned/cited 三态，
// 其中 cited 是唯一"真引用"，避免把"被提及"高估成"被引用"。
export type GeoVisibilityTier = 'none' | 'mentioned' | 'cited';

export interface GeoAnswerAnalysis {
  weCited: boolean;                 // 向后兼容：等价于 tier !== 'none'（品牌名出现即真）
  visibilityTier: GeoVisibilityTier;
  hasOurSource: boolean;            // 答案是否含我方域名/URL 出处（cited 的判据）
  citationRank: number | null;      // 我方首次出现在答案第几个句段（1-based），未引用为 null
  competitorsCited: string[];
  aivs: number;                     // 0-100
  aivsBreakdown: { position: number; recommendation: number; evidence: number; prominence: number };
  sentiment: 'positive' | 'negative' | 'neutral';   // AI 答案对我方品牌的情感倾向
  ourMentions: number;
  competitorMentions: number;
  trustSources: TrustSource[];      // 答案引用的出处 URL（我方/第三方）
  hallucinationRisks: HallucinationRisk[]; // 疑似 AI 编造的我方参数/事实（对照品牌大脑事实库）
}

export interface QuestionSet {
  brandSlug: string | null;
  category: string;
  questions: { stage: 'pre' | 'mid' | 'post' | 'followup'; question: string }[];
}

export interface GeoTask {
  priority: 'P0' | 'P1' | 'P2';
  engine?: string;
  kind: 'not-cited' | 'low-rank' | 'hallucination' | 'onsite-schema' | 'content-gap';
  action: string;
}

const RECOMMEND_CUES = ['推荐', '首选', '值得', '不错', '优选', '建议选', '口碑好', '靠谱', '领先', '知名'];
const NEGATIVE_CUES = ['差', '坑', '不推荐', '避雷', '故障', '漏水', '投诉', '贵', '不值', '难用', '踩雷', '虚标'];
const SPEC_PATTERN = /(\d+(?:\.\d+)?\s*(?:年|L|升|kW|W|℃|度|%|级|米|m|mm|万|元|dB|分贝|Hz|匹|P))/;

@Injectable()
export class GeoAnalyzerService {
  private readonly logger = new Logger('GrowthGeoAnalyzer');
  private brandProfileCache: { names: string[]; domains: string[] } | null = null;

  constructor(private readonly brandBrain: BrandBrainService) {}

  /** 多引擎覆盖就绪度（哪些 AI 引擎已配凭证可在线探测）。 */
  engines(): GeoEngineStatus[] {
    return geoEngineStatuses();
  }

  /** 我方品牌名（中英）+ 对外域名，取自 brand-registry.json 对外类型。 */
  brandProfile(): { names: string[]; domains: string[] } {
    if (this.brandProfileCache) return this.brandProfileCache;
    const names: string[] = [];
    const domains: string[] = [];
    try {
      const reg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'brand-registry.json'), 'utf8'));
      const outward = new Set(['group', 'brand-site', 'consumer-app']);
      for (const b of reg.brands || []) {
        if (!outward.has(b.type)) continue;
        if (b.name_cn) names.push(String(b.name_cn));
        if (b.name_en) names.push(String(b.name_en));
        if (b.domain) domains.push(String(b.domain));
      }
    } catch (err: unknown) {
      this.logger.warn(`brand-registry.json unavailable, using minimal brand profile: ${String(err)}`);
    }
    // 品牌关键词兜底（含设备品牌短名，用于答案文本匹配）。
    for (const kw of ['瑞合瑞德', 'Rhautt', 'Rheem', '瑞美', 'Ruud', '瑞德', 'Everhot', '恒热', '瑞诺瓦', 'Rysnova']) {
      if (!names.includes(kw)) names.push(kw);
    }
    this.brandProfileCache = { names, domains };
    return this.brandProfileCache;
  }

  /**
   * 分析一段 AI 答案快照：我方是否被引用、位次、竞品、AIVS。
   * competitors: 调用方给定的竞品候选名单（在答案中命中即计入 competitorsCited）。
   */
  analyzeAnswer(answerSnapshot: string, competitors: string[] = [], brandSlug?: string | null): GeoAnswerAnalysis {
    const text = String(answerSnapshot || '');
    const { names, domains } = this.brandProfile();
    const segments = text.split(/[。！？\n]+/).map((s) => s.trim()).filter(Boolean);
    const total = Math.max(segments.length, 1);

    // 位次：我方品牌/域名首次出现在第几个句段。
    let citationRank: number | null = null;
    for (let i = 0; i < segments.length; i++) {
      if (this.hits(segments[i], names) || this.hits(segments[i], domains)) { citationRank = i + 1; break; }
    }
    // 三层可见度：品牌名出现=至少 mentioned；再有我方域名/URL 出处=cited（真引用）。
    // 这修正了此前把"被提及"当"被引用"的高估——mentioned 不代表 AI 读了我们的内容。
    const hasOurSource = domains.some((d) => d && text.includes(d));
    const nameAppears = citationRank !== null;
    const visibilityTier: GeoVisibilityTier = hasOurSource ? 'cited' : nameAppears ? 'mentioned' : 'none';
    const weCited = nameAppears;

    // 竞品候选只使用本次探测显式给定的名单，避免未配置时冒出默认竞品。
    const candidateCompetitors = [...new Set(competitors)]
      .filter((c) => c && !names.includes(c));
    const competitorsCited = [...new Set(candidateCompetitors.filter((c) => text.includes(c)))];

    // ── AIVS（0-100，对标 GEOlytic 权重）──
    // position 35%：越靠前越高
    const position = weCited ? (1 - (citationRank! - 1) / total) : 0;
    // recommendation 30%：我方句段附近是否含推荐性措辞
    const recommendation = weCited && this.nearRecommendation(segments, names, domains) ? 1 : 0;
    // evidence 20%：答案是否引用了我方域名（链接/出处）—— 即三层里的 cited 判据
    const evidence = hasOurSource ? 1 : 0;
    // prominence 15%：我方提及次数占（我方+竞品）总提及比
    const ourMentions = this.count(text, names) + this.count(text, domains);
    const competitorMentions = competitorsCited.reduce((s, c) => s + this.count(text, [c]), 0);
    const prominence = ourMentions + competitorMentions > 0 ? ourMentions / (ourMentions + competitorMentions) : 0;

    const breakdown = {
      position: Math.round(position * 35),
      recommendation: Math.round(recommendation * 30),
      evidence: Math.round(evidence * 20),
      prominence: Math.round(prominence * 15),
    };
    const aivs = breakdown.position + breakdown.recommendation + breakdown.evidence + breakdown.prominence;
    return {
      weCited, visibilityTier, hasOurSource, citationRank, competitorsCited, aivs, aivsBreakdown: breakdown,
      sentiment: this.sentimentToward(segments, names, domains),
      ourMentions, competitorMentions,
      trustSources: this.extractTrustSources(text),
      hallucinationRisks: this.detectHallucinations(segments, names, domains, brandSlug),
    };
  }

  /**
   * 品牌幻觉/事实错误检测（我方独有优势：对照治理级品牌大脑事实库）。
   * 规则：提及我方品牌且含具体参数/规格（数字+单位）的句段，若与 brand-brain facts 无一致依据，
   * 标为疑似 AI 编造——喂回品牌大脑做正本清源。
   */
  detectHallucinations(segments: string[], names: string[], domains: string[], brandSlug?: string | null): HallucinationRisk[] {
    const ctx = this.brandBrain.context(brandSlug ?? null);
    const factsBlob = ctx ? ctx.facts.join(' ') : '';
    const risks: HallucinationRisk[] = [];
    for (const seg of segments) {
      if (!(this.hits(seg, names) || this.hits(seg, domains))) continue;
      const m = seg.match(SPEC_PATTERN);
      if (!m) continue;
      // 若该具体数值未在品牌事实库出现 → 疑似编造。
      if (!factsBlob.includes(m[1].replace(/\s+/g, ''))) {
        risks.push({ segment: seg.slice(0, 80), reason: `含未经品牌事实库核实的具体参数「${m[1].trim()}」` });
      }
    }
    return risks.slice(0, 10);
  }

  /** 引用源反查：解析答案里的出处 URL，标注是否我方域名（Trust Sources）。 */
  extractTrustSources(text: string): TrustSource[] {
    const { domains } = this.brandProfile();
    const urls = text.match(/https?:\/\/[^\s，。）)】\]"'<>]+/gi) || [];
    const seen = new Set<string>();
    const out: TrustSource[] = [];
    for (const url of urls) {
      const domain = (url.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] || '').toLowerCase();
      if (!domain || seen.has(domain)) continue;
      seen.add(domain);
      out.push({ url, domain, ours: domains.some((d) => domain.includes(String(d).toLowerCase())) });
    }
    return out.slice(0, 20);
  }

  /**
   * 全周期探测问题集生成（购前/购中/购后 + 追问），对标好现「模拟用户全周期高频问题」。
   * 纯模板 + 品牌/品类填充，可离线；后续可由 AI 网关扩充长尾。
   */
  generateQuestionSet(brandSlug?: string | null, category = '家用热水与舒适系统'): QuestionSet {
    const ctx = this.brandBrain.context(brandSlug ?? null);
    const brand = brandSlug ? (GEO_BRAND_DISPLAY_NAMES[brandSlug] || ctx?.name || brandSlug) : '瑞美 Rheem';
    const questions: QuestionSet['questions'] = [
      { stage: 'pre', question: `${category}怎么选？有哪些值得推荐的品牌？` },
      { stage: 'pre', question: `${category}主流品牌对比，哪个口碑好？` },
      { stage: 'pre', question: `预算有限，${category}选什么性价比高？` },
      { stage: 'mid', question: `${brand}怎么样？值得买吗？` },
      { stage: 'mid', question: `${brand}和同价位竞品比有什么优势？` },
      { stage: 'post', question: `${brand}售后服务/保修/客服电话是多少？` },
      { stage: 'post', question: `${brand}安装和使用有哪些注意事项？` },
      { stage: 'followup', question: `${brand}有哪些常见故障和解决办法？` },
      { stage: 'followup', question: `${category}安装完成后如何验收和保养？` },
    ];
    return { brandSlug: brandSlug ?? null, category, questions };
  }

  /**
   * 探测工单：问题集 × 目标引擎 的笛卡尔积，生成「待探测」清单（含各引擎在线状态）。
   * 用于批量运营：运营按此清单逐条到各引擎取答案快照，再回填 geo/probe 分析。
   * 不臆造答案——仅编排工单（真实引擎在线探测为可插拔外部适配）。
   */
  buildProbeWorklist(
    brandSlug?: string | null,
    category?: string,
    engineFilter?: string[],
  ): { brandSlug: string | null; category: string; total: number; items: { question: string; stage: string; engine: string; engineReady: boolean }[] } {
    const qs = this.generateQuestionSet(brandSlug ?? null, category);
    const engines = this.engines().filter((e) => !engineFilter || !engineFilter.length || engineFilter.includes(e.engine));
    const items: { question: string; stage: string; engine: string; engineReady: boolean }[] = [];
    for (const q of qs.questions) {
      for (const e of engines) {
        items.push({ question: q.question, stage: q.stage, engine: e.engine, engineReady: e.status === 'ready' });
      }
    }
    return { brandSlug: qs.brandSlug, category: qs.category, total: items.length, items };
  }

  /**
   * 优化任务清单 / Per-engine Playbook（诊断→执行闭环）。
   * 由「引擎可见度 + 幻觉 + 站内就绪」推导可执行任务，content-gap 回流 E2 文案。
   */
  buildPlaybook(
    engineVisibility: { engine: string; probes: number; citedRate: number; avgAivs: number }[],
    hallucinationCount: number,
  ): GeoTask[] {
    const tasks: GeoTask[] = [];
    for (const v of engineVisibility) {
      if (v.citedRate === 0) {
        tasks.push({ priority: 'P0', engine: v.engine, kind: 'not-cited', action: `${v.engine}：完全未被引用，优先在该引擎索引友好渠道补权威内容 + 结构化数据` });
      } else if (v.avgAivs < 40) {
        tasks.push({ priority: 'P1', engine: v.engine, kind: 'low-rank', action: `${v.engine}：AIVS 偏低(${v.avgAivs})，强化推荐性证据与我方域名出处，回流 E2 补对比型内容` });
      }
    }
    if (hallucinationCount > 0) {
      tasks.push({ priority: 'P0', kind: 'hallucination', action: `检出 ${hallucinationCount} 处疑似品牌幻觉，向品牌大脑提交事实修正并生成正本清源内容` });
    }
    const onSite = this.onSiteReadiness();
    if (onSite.total > 0 && onSite.ready < onSite.total) {
      tasks.push({ priority: 'P1', kind: 'onsite-schema', action: `站内 ${onSite.total - onSite.ready}/${onSite.total} 个对外站未就绪，补齐 Product/ItemList schema 与 sitemap（见 guard:geo）` });
    }
    if (tasks.length === 0) {
      tasks.push({ priority: 'P2', kind: 'content-gap', action: '各引擎可见度良好，持续监测并扩充长尾问答内容' });
    }
    return tasks;
  }

  /** 结构化数据自动生成：品牌 Organization JSON-LD（供各品牌站 <head> 注入，喂 RAG 抓取）。 */
  brandJsonLd(brandSlug?: string | null): Record<string, unknown> {
    const ctx = this.brandBrain.context(brandSlug ?? null);
    const { domains } = this.brandProfile();
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: ctx ? ctx.name : '瑞合瑞德暖通科技集团',
      description: ctx ? ctx.positioning : '',
      url: domains.length ? `https://${domains[0]}` : undefined,
      knowsAbout: ctx ? ctx.facts : [],
    };
  }

  /** llms.txt 生成：把品牌事实/语气以 AI 友好格式输出，供 llms.txt 部署到各站根。 */
  llmsTxt(brandSlug?: string | null): string {
    const ctx = this.brandBrain.context(brandSlug ?? null);
    const name = ctx ? ctx.name : '瑞合瑞德暖通科技集团';
    const lines = [`# ${name}`, ''];
    if (ctx) {
      lines.push(`> ${ctx.positioning}`, '', '## Facts');
      for (const f of ctx.facts) lines.push(`- ${f}`);
    }
    return lines.join('\n');
  }

  /** 站内可引用度：消费 guard:geo 产物。 */
  onSiteReadiness(): { generatedAt: string | null; sites: unknown[]; ready: number; total: number } {
    try {
      const report = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'evidence/geo/geo-readiness-report.json'), 'utf8'),
      );
      const sites = report.summary || [];
      const ready = sites.filter((s: { status?: string }) => s.status === 'ready').length;
      return { generatedAt: report.generatedAt || null, sites, ready, total: sites.length };
    } catch (err: unknown) {
      this.logger.warn(`geo-readiness-report.json unavailable: ${String(err)}`);
      return { generatedAt: null, sites: [], ready: 0, total: 0 };
    }
  }

  private hits(segment: string, needles: string[]): boolean {
    return needles.some((n) => n && segment.includes(n));
  }
  private count(text: string, needles: string[]): number {
    let c = 0;
    for (const n of needles) {
      if (!n) continue;
      c += text.split(n).length - 1;
    }
    return c;
  }
  private nearRecommendation(segments: string[], names: string[], domains: string[]): boolean {
    return segments.some(
      (seg) => (this.hits(seg, names) || this.hits(seg, domains)) && RECOMMEND_CUES.some((cue) => seg.includes(cue)),
    );
  }
  /** 答案对我方品牌的情感倾向：仅看提及我方的句段的正负面措辞。 */
  private sentimentToward(segments: string[], names: string[], domains: string[]): 'positive' | 'negative' | 'neutral' {
    let pos = 0;
    let neg = 0;
    for (const seg of segments) {
      if (!(this.hits(seg, names) || this.hits(seg, domains))) continue;
      if (RECOMMEND_CUES.some((c) => seg.includes(c))) pos++;
      if (NEGATIVE_CUES.some((c) => seg.includes(c))) neg++;
    }
    if (pos > neg) return 'positive';
    if (neg > pos) return 'negative';
    return 'neutral';
  }
}
