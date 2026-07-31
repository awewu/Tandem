import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 增长中枢 · 品牌大脑（Brand Brain）· E2 文案接地层（G2）。
 *
 * 单一事实源：governance/growth-brand-brain.json。为 AI 文案生成提供：
 *  - 品牌定位/受众/**可核实事实**（防幻觉，只准基于事实展开）；
 *  - 语气（全局 + 品牌）；
 *  - 禁用主张（全局《广告法》绝对化词 + 品牌特定禁语，合并进合规扫描）。
 * 缺配置时优雅降级为全局语气 + 全局禁语，保证 source-contract 可运行。
 */

export interface BrandContext {
  slug: string;
  name: string;
  positioning: string;
  facts: string[];
  tone: string;
  bannedClaims: string[];
  audiences: string[];
}

const BRAND_BRAIN_ALIASES: Record<string, string> = {
  rheem: 'rheem-cn',
  ruud: 'ruud-cn',
  everhot: 'everhot-cn',
};

@Injectable()
export class BrandBrainService {
  private readonly logger = new Logger('GrowthBrandBrain');
  private cache: Record<string, unknown> | null = null;

  private load(): Record<string, any> {
    if (this.cache) return this.cache as Record<string, any>;
    try {
      this.cache = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'governance/growth-brand-brain.json'), 'utf8'),
      );
    } catch (err: unknown) {
      this.logger.warn(`growth-brand-brain.json unavailable, degrading to global defaults: ${String(err)}`);
      this.cache = { globalTone: '专业、克制、合规。', globalBannedClaims: [], brands: {} };
    }
    return this.cache as Record<string, any>;
  }

  /** 全局禁用主张（无品牌上下文也生效）。 */
  globalBannedClaims(): string[] {
    return (this.load().globalBannedClaims as string[]) || [];
  }

  /** 解析品牌上下文（未知 slug 返回 null，由调用方回落到全局语气）。 */
  context(brandSlug?: string | null): BrandContext | null {
    if (!brandSlug) return null;
    const data = this.load();
    const resolvedSlug = BRAND_BRAIN_ALIASES[brandSlug] || brandSlug;
    const b = (data.brands || {})[resolvedSlug];
    if (!b) return null;
    return {
      slug: resolvedSlug,
      name: b.name || brandSlug,
      positioning: b.positioning || '',
      facts: b.facts || [],
      tone: b.tone || '',
      bannedClaims: [...(data.globalBannedClaims || []), ...(b.bannedClaims || [])],
      audiences: b.audiences || [],
    };
  }

  /** 构造接地 system prompt：品牌事实 + 语气 + 禁语，明令「只基于事实、禁虚构」。 */
  buildSystemPrompt(brandSlug?: string | null): string {
    const data = this.load();
    const globalTone = data.globalTone || '专业、克制、合规。';
    const ctx = this.context(brandSlug);
    const lines = [
      '你是瑞合瑞德暖通集团的品牌文案助手。严格遵守《中华人民共和国广告法》：禁止绝对化用语、虚假承诺、贬低竞品。',
      `整体语气：${globalTone}`,
    ];
    if (ctx) {
      lines.push(`品牌：${ctx.name}。定位：${ctx.positioning}`);
      if (ctx.audiences.length) lines.push(`目标受众：${ctx.audiences.join('、')}`);
      if (ctx.facts.length) lines.push(`只可基于以下可核实事实展开，禁止编造未列出的参数、荣誉、数据：\n- ${ctx.facts.join('\n- ')}`);
      if (ctx.tone) lines.push(`品牌语气：${ctx.tone}`);
      if (ctx.bannedClaims.length) lines.push(`禁用词/主张：${ctx.bannedClaims.join('、')}`);
    } else {
      const banned = (data.globalBannedClaims || []) as string[];
      if (banned.length) lines.push(`禁用词/主张：${banned.join('、')}`);
      lines.push('若未提供具体产品事实，避免给出具体参数或荣誉性表述。');
    }
    return lines.join('\n');
  }
}
