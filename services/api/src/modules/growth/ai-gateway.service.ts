import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

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
  provider?: 'hermes-center-ai' | 'default';
  requireRealProvider?: boolean;
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
  provider?: string;
}

/** 治理网关 SSE 读取结果：正文 + 末帧 token 用量（供成本计量）。 */
interface HermesSseResult {
  text: string;
  tokensCost: number;
}

// 《广告法》第九条等：绝对化用语与虚假承诺（最小基线词库；生产由 compliance 域集中维护）。
const FORBIDDEN_TERMS = [
  '国家级', '最高级', '最佳', '第一', '独家', '唯一', '全网最低',
  '100%', '绝对', '永久', '万能', '包治', '根治', '最便宜', '顶级', '史无前例',
];

const CHANNEL_COPY_GUIDANCE: Record<string, { label: string; guidance: string; length: string }> = {
  xiaohongshu: { label: '小红书', guidance: '输出种草笔记，包含标题、正文、卖点展开、行动引导。', length: '400-700 字' },
  douyin: { label: '抖音', guidance: '输出 45-75 秒镜头脚本，按镜头分段，包含画面、文字或旁白。', length: '45-75 秒脚本' },
  wechat: { label: '微信公众号', guidance: '输出公众号推文，包含标题、导语、正文段落、卖点展开、行动引导。', length: '600-900 字' },
  zhihu: { label: '知乎', guidance: '输出知乎问答，包含标题、问题描述、回答、论证和总结。', length: '600-900 字' },
  seo: { label: 'SEO', guidance: '输出搜索友好的官网/落地页文案，包含标题、摘要、正文和 FAQ。', length: '300-600 字' },
  ad: { label: '广告投放', guidance: '输出广告投放文案，包含主标题、副标题、短正文和 CTA。', length: '300-600 字' },
};

function channelCopyGuidance(channel?: string) {
  return CHANNEL_COPY_GUIDANCE[String(channel || '').trim()] || {
    label: channel || '通用渠道',
    guidance: '输出当前渠道可直接审核的单份文案，包含标题、正文、卖点展开、行动引导。',
    length: '300-600 字',
  };
}

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
    if (req.provider === 'hermes-center-ai') {
      return this.generateHermesDraft(req);
    }

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
        if (req.requireRealProvider) {
          throw new ServiceUnavailableException(`AI provider call failed: ${this.errorMessage(err)}`);
        }
        this.logger.warn(`AI provider call failed, falling back to deterministic draft: ${String(err)}`);
        draft = this.deterministicDraft(req);
        model = 'stub:deterministic(ai-fallback)';
      }
    } else {
      if (req.requireRealProvider) {
        throw new ServiceUnavailableException('AI provider is not configured');
      }
      draft = this.deterministicDraft(req);
    }

    const complianceFlags = this.scanCompliance(draft, req.bannedTerms ?? []);
    return { draft, model, tokensCost, complianceFlags, provider: model.startsWith('stub:') ? 'stub' : 'anthropic' };
  }

  private async generateHermesDraft(req: AiDraftRequest): Promise<AiDraftResult> {
    try {
      const { text: draft, tokensCost } = await this.callHermesCenterAi(req);
      const complianceFlags = this.scanCompliance(draft, req.bannedTerms ?? []);
      return {
        draft,
        model: process.env.HERMES_CENTER_AI_PROVIDER || 'qwen-max',
        tokensCost,
        complianceFlags,
        provider: 'hermes-center-ai',
      };
    } catch (err: unknown) {
      if (req.requireRealProvider !== false) {
        throw new ServiceUnavailableException(`Hermes center AI copy generation failed: ${this.errorMessage(err)}`);
      }
      this.logger.warn(`Hermes center AI failed, falling back to deterministic draft: ${String(err)}`);
      const draft = this.deterministicDraft(req);
      return {
        draft,
        model: 'stub:deterministic(hermes-fallback)',
        tokensCost: 0,
        complianceFlags: this.scanCompliance(draft, req.bannedTerms ?? []),
        provider: 'stub',
      };
    }
  }

  private async callHermesCenterAi(req: AiDraftRequest): Promise<HermesSseResult> {
    const baseUrl = String(process.env.HERMES_CENTER_AI_BASE_URL || '').trim().replace(/\/+$/, '');
    if (!baseUrl) throw new Error('HERMES_CENTER_AI_BASE_URL is not configured');

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'text/event-stream',
    };
    const authHeader = String(process.env.HERMES_CENTER_AI_AUTH_HEADER || '').trim();
    const authToken = String(process.env.HERMES_CENTER_AI_AUTH_TOKEN || '').trim();
    if (authHeader && authToken) headers[authHeader] = authToken;

    const provider = String(process.env.HERMES_CENTER_AI_PROVIDER || 'qwen-max').trim() || 'qwen-max';
    const firstByteTimeoutMs = Math.max(Number(process.env.HERMES_CENTER_AI_FIRST_BYTE_TIMEOUT_MS) || 30000, 5000);
    const timeoutMs = Math.max(Number(process.env.HERMES_CENTER_AI_TIMEOUT_MS) || 120000, firstByteTimeoutMs);
    const response = await this.withTimeout(
      fetch(`${baseUrl}/api/llm-stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          teamProvider: provider,
          temperature: 0.72,
          messages: [
            { role: 'system', content: this.hermesCopySystemPrompt(req) },
            { role: 'user', content: this.hermesCopyUserPrompt(req) },
          ],
        }),
      }),
      firstByteTimeoutMs,
      'Hermes center AI request timed out',
    );

    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => '');
      throw new Error(`Hermes returned HTTP ${response.status}: ${body.slice(0, 500) || response.statusText}`);
    }

    const answer = await this.withTimeout(
      this.readHermesSse(response),
      timeoutMs,
      'Hermes center AI stream timed out',
    );
    const draft = answer.text.trim();
    if (!draft) throw new Error('Hermes returned empty answer');
    return { text: draft, tokensCost: answer.tokensCost };
  }

  private hermesCopySystemPrompt(req: AiDraftRequest): string {
    const brand = req.brand;
    const channel = channelCopyGuidance(req.channel);
    const facts = (brand?.facts || []).slice(0, 8).map((fact) => `- ${fact}`).join('\n');
    const banned = (req.bannedTerms || []).filter(Boolean).join('、') || '广告法绝对化用语、无法核实的承诺、贬低竞品';
    return [
      '你是 Rhautt Nexus 的营销文案撰写助手，当前通过 Hermes 中心 AI 调用。',
      '任务是生成可供人工审核的完整营销文案草稿，不是摘要，不是占位模板。',
      '只允许输出当前指定渠道的一份文案，严禁附带其他渠道版本、渠道合集或“另附抖音/公众号/知乎”等内容。',
      '必须使用中文，语气专业、克制、具体，避免空泛套话。',
      `当前渠道：${channel.label}`,
      `当前渠道格式：${channel.guidance}`,
      `品牌：${brand?.name || req.brandSlug || 'Rhautt Comfort / 瑞合瑞德暖通科技集团'}`,
      brand?.positioning ? `品牌定位：${brand.positioning}` : '',
      brand?.tone ? `语气：${brand.tone}` : '',
      facts ? `可用事实：\n${facts}` : '',
      `禁止内容：${banned}`,
      '不要编造产品参数、价格、补贴、疗效、保修承诺或官方背书。',
      `输出结构必须符合当前渠道，不要输出“渠道：小红书/抖音/公众号/知乎”的多渠道清单。`,
    ].filter(Boolean).join('\n');
  }

  private hermesCopyUserPrompt(req: AiDraftRequest): string {
    const channel = channelCopyGuidance(req.channel);
    return [
      `用户原始需求：${req.prompt}`,
      '',
      `请只生成「${channel.label}」这一版可直接进入文案库审核的完整草稿。`,
      `长度控制：${channel.length}。`,
      '结尾必须提醒“具体参数以产品事实库和官方资料为准”。',
    ].join('\n');
  }

  private async readHermesSse(response: Response): Promise<HermesSseResult> {
    const reader = response.body?.getReader();
    if (!reader) return { text: '', tokensCost: 0 };
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';
    let tokensCost = 0;
    const absorb = (rawEvent: string) => {
      const part = this.extractHermesEvent(rawEvent);
      answer += part.text;
      if (part.tokensCost > 0) tokensCost = part.tokensCost;
    };
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        absorb(rawEvent);
      }
    }
    if (buffer.trim()) absorb(buffer);
    return { text: answer, tokensCost };
  }

  /**
   * 解析单个 SSE 事件：文本增量 + 末帧 token 用量。
   * 用量来自治理网关（Tandem）透传的 `{ usage: { totalTokens } }` 末帧——
   * 这是护栏 §2「每次调用记 tokensCost 供 governance 计量」在流式路径上的落点，
   * 此前该路径硬编码 0，导致 AI 成本无法计量。
   */
  private extractHermesEvent(rawEvent: string): HermesSseResult {
    let text = '';
    let tokensCost = 0;
    for (const line of rawEvent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        text += this.extractTextFromHermesPayload(parsed);
        const usage = parsed?.usage;
        if (usage) {
          const total = Number(usage.totalTokens ?? usage.total_tokens ?? 0);
          const split = Number(usage.promptTokens ?? usage.prompt_tokens ?? 0)
            + Number(usage.completionTokens ?? usage.completion_tokens ?? 0);
          const resolved = total > 0 ? total : split;
          if (resolved > 0) tokensCost = resolved;
        }
      } catch {
        text += payload;
      }
    }
    return { text, tokensCost };
  }

  private extractTextFromHermesPayload(payload: any): string {
    if (!payload) return '';
    if (typeof payload === 'string') return payload;
    if (typeof payload.content === 'string') return payload.content;
    if (typeof payload.text === 'string') return payload.text;
    if (typeof payload.answer === 'string') return payload.answer;
    if (typeof payload.delta === 'string') return payload.delta;
    if (typeof payload.response === 'string') return payload.response;
    const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
    if (typeof choice?.delta?.content === 'string') return choice.delta.content;
    if (typeof choice?.message?.content === 'string') return choice.message.content;
    return '';
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
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
