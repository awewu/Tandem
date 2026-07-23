import { Injectable, Logger } from '@nestjs/common';

/**
 * 增长中枢 · 统一 AI 网关（底座 B1/B2 支撑）。
 *
 * 护栏（不可绕过，见 BOARD-3 §4 / §10）：
 *  1. 合规词过滤：《广告法》绝对化用语等命中即在产出打标（compliance_flags），供审校拦截。
 *  2. 成本与审计：每次调用返回 model + tokensCost，供 governance 计量。
 *  3. draft 默认：本网关只产「草稿」；approved 状态只能由人工核准流赋予（在各引擎 service）。
 *
 * 模型可插拔：优先用 @anthropic-ai/sdk（已在依赖），未配置 API Key 时回落到确定性桩，
 * 保证 source-contract 可运行、可测试，不硬绑外部网络。
 */

export interface AiDraftRequest {
  system?: string;
  prompt: string;
  channel?: string;
  brandSlug?: string | null;
  bannedTerms?: string[];
  brand?: {
    name?: string;
    positioning?: string;
    facts?: string[];
    audiences?: string[];
    tone?: string;
  } | null;
}

export interface AiDraftResult {
  draft: string;
  model: string;
  tokensCost: number;
  complianceFlags: string[];
}

// 《广告法》第九条等：绝对化用语与虚假承诺（最小基线词库；生产由 compliance 域集中维护）。
const FORBIDDEN_TERMS = [
  '国家级', '最高级', '最佳', '第一', '独家', '唯一', '全网最低',
  '100%', '绝对', '永久', '万能', '包治', '根治', '最便宜', '顶级', '史无前例',
];

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger('GrowthAiGateway');
  private readonly model = process.env.GROWTH_AI_MODEL || 'claude-3-5-sonnet-latest';

  /** 命中的合规违禁词（用于 draft 打标 + 审校拦截）。extra 为品牌大脑注入的品牌特定禁语。 */
  scanCompliance(text: string, extra: string[] = []): string[] {
    if (!text) return [];
    const terms = [...new Set([...FORBIDDEN_TERMS, ...extra])];
    return terms.filter((term) => term && text.includes(term));
  }

  /**
   * 生成营销文案草稿。永远返回 draft（未核准），并附合规打标与成本。
   */
  async generateDraft(req: AiDraftRequest): Promise<AiDraftResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.GROWTH_AI_API_KEY;
    let draft: string;
    let tokensCost = 0;
    // 如实标注实际产出路径：真实模型成功 → 模型名；有 Key 但调用失败回落 → stub:deterministic(ai-fallback)；无 Key → stub:deterministic。
    let model = 'stub:deterministic';

    if (apiKey) {
      try {
        // 延迟加载，避免无 Key 环境下的初始化开销与耦合。
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey });
        const system =
          req.system ||
          '你是瑞合瑞德暖通集团的品牌文案助手。严格遵守《广告法》，禁止绝对化用语、虚假承诺、贬低竞品。输出真实、克制、专业。';
        const resp = await client.messages.create({
          model: this.model,
          max_tokens: 1024,
          system,
          messages: [{ role: 'user', content: req.prompt }],
        });
        draft = (resp?.content || [])
          .map((block: { type: string; text?: string }) => (block.type === 'text' ? block.text || '' : ''))
          .join('\n')
          .trim();
        const usage = resp?.usage || {};
        tokensCost = Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0);
        // 空回复也视为失败，回落确定性生成，避免产出空草稿。
        if (!draft) throw new Error('empty model response');
        model = this.model;
      } catch (err: unknown) {
        this.logger.warn(`AI provider call failed, falling back to deterministic draft: ${String(err)}`);
        draft = this.deterministicDraft(req);
        model = 'stub:deterministic(ai-fallback)';
      }
    } else {
      draft = this.deterministicDraft(req);
    }

    const complianceFlags = this.scanCompliance(draft, req.bannedTerms ?? []);
    return { draft, model, tokensCost, complianceFlags };
  }

  /**
   * 确定性文案生成器（无模型 Key 时的兜底，非占位）：
   * 基于品牌大脑「可核实事实」+ 渠道语式，产出「钩子 / 正文卖点 / CTA」结构化草稿，
   * 只用已知事实展开（防幻觉），并规避禁语。配置 ANTHROPIC_API_KEY 后自动改走大模型。
   */
  private deterministicDraft(req: AiDraftRequest): string {
    const channel = (req.channel || 'generic').toLowerCase();
    const brand = req.brand || {};
    const name = brand.name || '瑞合瑞德';
    const theme = (req.prompt || '').trim();
    const banned = new Set([...(req.bannedTerms || [])]);
    const facts = (brand.facts || []).filter(Boolean).filter((f) => !this.violates(f, banned)).slice(0, 4);
    const audience = (brand.audiences || [])[0] || '';
    const positioning = brand.positioning || '';
    const style = CHANNEL_STYLES[channel] || CHANNEL_STYLES.generic;

    const hook = style.hook(name, theme, positioning, audience);
    const bullets = facts.length
      ? facts.map((f) => `${style.bullet} ${f}`)
      : [`${style.bullet} 围绕「${theme || positioning || name}」展开，具体参数以产品事实库为准。`];
    const body = style.body(theme, positioning);
    const cta = style.cta(name);

    const parts = [
      `【${style.label} · 草稿 · 待人工核准】`,
      hook,
      '',
      body,
      ...bullets,
      '',
      cta,
    ].filter((l) => l !== undefined);

    let draft = parts.join('\n').trim();
    // 兜底自净：若拼装结果意外命中禁语，逐词剔除（生产仍以 scanCompliance 打标拦截为准）。
    for (const term of banned) {
      if (term && draft.includes(term)) draft = draft.split(term).join('');
    }
    return draft;
  }

  private violates(text: string, banned: Set<string>): boolean {
    for (const t of banned) if (t && text.includes(t)) return true;
    return false;
  }
}

// 渠道语式：不同平台的钩子/正文/CTA 语气差异（离线可用，配 Key 后由模型接管）。
interface ChannelStyle {
  label: string;
  bullet: string;
  hook: (name: string, theme: string, positioning: string, audience: string) => string;
  body: (theme: string, positioning: string) => string;
  cta: (name: string) => string;
}

const CHANNEL_STYLES: Record<string, ChannelStyle> = {
  xiaohongshu: {
    label: '小红书 种草',
    bullet: '·',
    hook: (name, theme, _p, audience) =>
      `📌 ${audience ? audience + '必看｜' : ''}关于「${theme || name}」，我把功课做齐了`,
    body: () => '真实体验分享，帮你避坑、选对：',
    cta: (name) => `想了解更多可以看 ${name} 官方信息，按自家户型和需求选～`,
  },
  douyin: {
    label: '抖音 脚本',
    bullet: '▶',
    hook: (name, theme) => `〔0-3秒钩子〕${theme || name}，很多人第一步就选错了`,
    body: () => '〔核心卖点·配画面〕逐条讲清，边看边记：',
    cta: (name) => `〔结尾引导〕点主页看 ${name} 更多对比，评论区聊聊你的需求。`,
  },
  zhihu: {
    label: '知乎 专业问答',
    bullet: '—',
    hook: (name, theme, positioning) =>
      `先给结论：选购「${theme || name}」，关键看这几点。${positioning ? '（' + positioning + '）' : ''}`,
    body: () => '下面从技术与使用场景逐条拆解，力求客观：',
    cta: () => '以上供参考，具体以官方参数与实测为准，欢迎理性讨论。',
  },
  wechat: {
    label: '公众号 推文',
    bullet: '◆',
    hook: (name, theme) => `${theme || name}｜一篇讲清楚，收藏不迷路`,
    body: () => '正文围绕以下要点展开：',
    cta: (name) => `了解 ${name} 更多内容，请见文末菜单或官方渠道。`,
  },
  generic: {
    label: '通用文案',
    bullet: '·',
    hook: (name, theme, positioning) => `${theme || name}${positioning ? '：' + positioning : ''}`,
    body: () => '核心信息如下：',
    cta: (name) => `更多信息请以 ${name} 官方发布为准。`,
  },
};
