/**
 * /api/agent/intent · 自然语言意图 → 路由 (U1 Agent-first command palette)
 *
 * POST { query: string }
 *   返回: { matches: [{ intent, route, label, confidence, params }], reasoning?: string }
 *
 * V1 实现: 中英文关键词 heuristic + 基于 SkillManifest description 软匹配.
 * V2: 接入 LLM (走 TAF Layer 2 router) 做真正的意图理解.
 *
 * 触发: command palette 输入 ≥ 6 字符 + 含动词性关键词时调用.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { loadSkills, getLoadedSkills } from '@/lib/skills/registry';
import { boot, getRouter } from '@/lib/boot';

interface Match {
  intent: string;
  route: string;
  label: string;
  confidence: number;
  /** 可选 URL params 提示给前端 */
  params?: Record<string, string>;
  /** 可触发的 skill (供前端展示) */
  skill?: string;
}

/**
 * 关键词 → 路由意图. 顺序敏感: 越具体的越靠前.
 */
const RULES: Array<{
  keywords: string[];
  match: (q: string, allKeywords: string[]) => boolean;
  produce: (q: string) => Match | null;
}> = [
  // 5min 智能日报
  {
    keywords: ['日报', '5min', '5 min', '日志', '今天'],
    match: (q, kw) => kw.some((k) => ['日报', '5min', '日志'].includes(k)) || /今天.*做了|今天.*推进/.test(q),
    produce: () => ({
      intent: 'report.daily',
      route: '/report',
      label: '写 5min 智能日报',
      confidence: 0.85,
    }),
  },
  // 本周回顾 / 周报
  {
    keywords: ['周报', '本周', '回顾', '周回顾', '一周'],
    match: (q, kw) => kw.some((k) => ['周报', '本周', '回顾', '一周'].includes(k)) || /这.*周|本周.*怎么/.test(q),
    produce: () => ({
      intent: 'report.weekly',
      route: '/report/weekly',
      label: '看本周回顾（AI 周报）',
      confidence: 0.85,
    }),
  },
  // 平衡记分卡 / 个人绩效
  {
    keywords: ['平衡记分卡', 'bsc', '绩效达成', '我的绩效', '绩效目标'],
    match: (q, kw) =>
      kw.some((k) => ['bsc', '平衡记分卡', '绩效达成'].includes(k)) || /我.*绩效|绩效.*目标/.test(q),
    produce: () => ({
      intent: 'kpi.personal',
      route: '/kpi',
      label: '看我的绩效目标（平衡记分卡）',
      confidence: 0.8,
    }),
  },
  // 部门绩效对比
  {
    keywords: ['部门绩效', '团队绩效', '部门对比'],
    match: (q) => /部门绩效|团队绩效|部门对比|部门.*完成/.test(q),
    produce: () => ({
      intent: 'kpi.department',
      route: '/kpi?view=dept',
      label: '看部门绩效对比',
      confidence: 0.85,
    }),
  },
  // 奖金类
  {
    keywords: ['奖金', '年终', '下发', 'baseBonus', 'bonus'],
    match: (_q, kw) => kw.some((k) => ['奖金', '年终', 'bonus'].includes(k)),
    produce: () => ({
      intent: 'kpi.bonus_calculate',
      route: '/admin/kpi/bonus-payout',
      label: '去 KPI 奖金下发工作台',
      confidence: 0.85,
      skill: 'kpi-bonus',
    }),
  },
  // 年终关闭
  {
    keywords: ['关闭', '封档', '年终关闭'],
    match: (q) => /关闭周期|年终关闭|封档/.test(q),
    produce: () => ({
      intent: 'kpi.year_end_close',
      route: '/admin/kpi/bonus-payout',
      label: '去年终关闭流程',
      confidence: 0.9,
      skill: 'kpi-bonus',
    }),
  },
  // 9-box / 干预 / 调岗 / 升职
  {
    keywords: ['9宫格', '九宫格', '干预', '调岗', '升职', '人才', 'calibration', 'box'],
    match: (_q, kw) =>
      kw.some((k) => ['9宫格', '九宫格', 'box', '干预', '调岗', '升职', 'calibration'].includes(k)),
    produce: () => ({
      intent: 'nine-box.suggestion',
      route: '/nine-box/suggestions',
      label: '看 9-box 联动管理建议',
      confidence: 0.8,
      skill: 'nine-box-action',
    }),
  },
  // TTI 填报 / OKR check-in
  {
    keywords: ['TTI', 'OKR', '四要素', 'check-in', '我的目标'],
    match: (_q, kw) => kw.some((k) => ['TTI', 'OKR', '四要素', '我的目标'].includes(k)),
    produce: () => ({
      intent: 'tti.fill',
      route: '/tti',
      label: '去填我的 TTI 四要素',
      confidence: 0.8,
      skill: 'tti-coaching',
    }),
  },
  // KPI 健康度
  {
    keywords: ['KPI', '健康度', '看板', 'health'],
    match: (q, kw) => kw.includes('KPI') || /健康度|看板/.test(q),
    produce: () => ({
      intent: 'kpi.health',
      route: '/admin/kpi/health-dashboard',
      label: '看 KPI 健康度看板',
      confidence: 0.7,
    }),
  },
  // KPI 分析
  {
    keywords: ['分析', '简报', '红色清单', '部门排序'],
    match: (q) => /分析|简报|红色清单|部门排序/.test(q),
    produce: () => ({
      intent: 'kpi.analytics',
      route: '/admin/kpi/analytics',
      label: '看 KPI 分析中枢',
      confidence: 0.75,
    }),
  },
  // 议事室 / 决策卡
  {
    keywords: ['决策', '议事', 'convergence', '决议', 'decision'],
    match: (_q, kw) => kw.some((k) => ['决策', '议事', '决议'].includes(k)),
    produce: () => ({
      intent: 'convergence.start',
      route: '/convergence',
      label: '进议事室',
      confidence: 0.7,
      skill: 'decision-card-template',
    }),
  },
  // 审计
  {
    keywords: ['审计', '哈希链', '篡改', 'verify'],
    match: (q, kw) => kw.includes('审计') || /哈希链|篡改/.test(q),
    produce: () => ({
      intent: 'audit.verify',
      route: '/api/audit/verify',
      label: '验证审计链完整性',
      confidence: 0.85,
      skill: 'audit-verify',
    }),
  },
  // Persona
  {
    keywords: ['persona', '分身', '画像', '升级'],
    match: (_q, kw) => kw.some((k) => ['persona', '分身', '画像'].includes(k)),
    produce: () => ({
      intent: 'persona.view',
      route: '/persona',
      label: '看我的 Persona 画像',
      confidence: 0.7,
    }),
  },
];

function tokenize(q: string): string[] {
  // simple: split on space + punctuation; keep CJK chars as 2-3 grams handled by includes
  return q
    .toLowerCase()
    .split(/[\s,，。!！?？\.\-_\/]+/)
    .filter(Boolean);
}

let _booted = false;
async function ensureSkills() {
  if (_booted) return;
  await loadSkills();
  _booted = true;
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: { query?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const query = (body.query ?? '').trim();
  if (!query) return NextResponse.json({ matches: [] });

  await ensureSkills();
  const tokens = tokenize(query);

  // Run rules
  const matches: Match[] = [];
  for (const rule of RULES) {
    if (rule.match(query, tokens)) {
      const m = rule.produce(query);
      if (m) matches.push(m);
    }
  }

  // Skills-based 软匹配 (description 包含 query 关键词)
  if (matches.length === 0) {
    const skills = getLoadedSkills();
    for (const s of skills) {
      const desc = s.description.toLowerCase();
      const hits = tokens.filter((t) => desc.includes(t)).length;
      if (hits > 0) {
        matches.push({
          intent: `skill.${s.name}`,
          route: '#',
          label: `召唤 Skill · ${s.name}`,
          confidence: Math.min(0.6, hits * 0.15),
          skill: s.name,
        });
      }
    }
  }

  // Sort by confidence desc
  matches.sort((a, b) => b.confidence - a.confidence);

  // ── LLM 兜底：query 较长且关键词命中弱时调 LLM 做真正的意图理解 ──
  const needLlmFallback =
    query.length >= 4 && (matches.length === 0 || matches[0].confidence < 0.7);
  if (needLlmFallback) {
    const llmMatch = await tryLlmIntent(query, auth.userId);
    if (llmMatch) {
      // LLM 结果置顶
      matches.unshift(llmMatch);
    }
  }

  return NextResponse.json({
    matches: matches.slice(0, 5),
    query,
  });
}

// ---------------------------------------------------------------------------
// LLM 兜底意图理解
// ---------------------------------------------------------------------------

/** 可路由的页面清单（同步给 LLM 作为 schema） */
const ROUTE_CATALOG: Array<{ route: string; description: string }> = [
  { route: '/report', description: '写 5min 智能日报（员工每日填报，AI 自动提炼并推流 OKR）' },
  { route: '/report/weekly', description: '本周回顾 / AI 周报（基于过去 7 天 check-in）' },
  { route: '/kpi', description: '我的绩效目标 · 平衡记分卡（BSC 四维度）' },
  { route: '/kpi?view=dept', description: '部门绩效对比（manager 及以上可见）' },
  { route: '/okr', description: '我的 OKR / 关键结果与对齐' },
  { route: '/okr/cascade', description: 'OKR 5 层 Cascade 对齐树' },
  { route: '/okr/dashboard', description: '团队效能 Dashboard' },
  { route: '/tti', description: 'TTI 四要素填报' },
  { route: '/convergence', description: '议事室（17 分钟决策协议）' },
  { route: '/decision-card', description: '决议卡 / Decision Card 列表' },
  { route: '/memories', description: 'Memory 知识库（SOP / 案例 / 红线 / 价值观）' },
  { route: '/intranet', description: '企业内网 / 公告 / 政策' },
  { route: '/im', description: 'IM 群聊 / 团队沟通' },
  { route: '/mail', description: '邮箱（对外正式沟通）' },
  { route: '/persona', description: '我的 AI 分身 / Persona' },
  { route: '/360', description: '360 评估' },
  { route: '/1on1', description: '1on1 对话' },
  { route: '/nine-box', description: '9 宫格人才矩阵' },
  { route: '/nine-box/suggestions', description: '9-box 联动管理建议' },
  { route: '/admin/kpi/health-dashboard', description: 'KPI 健康度看板（admin）' },
  { route: '/admin/kpi/analytics', description: 'KPI 分析中枢（admin）' },
  { route: '/admin/kpi/bonus-payout', description: 'KPI 奖金下发（admin）' },
  { route: '/admin/intranet', description: 'Intranet 编辑（admin）' },
  { route: '/admin/launchpad', description: 'Launchpad 管理（admin）' },
];

async function tryLlmIntent(query: string, userId: string): Promise<Match | null> {
  try {
    await boot();
    const router = getRouter();
    if (router.listProviders().length === 0) return null;

    const catalogText = ROUTE_CATALOG.map((r) => `${r.route} — ${r.description}`).join('\n');
    const system = `你是一个企业内部产品的导航助手。根据用户的自然语言需求，从下方"可路由清单"里选出最匹配的一个 route，并返回严格 JSON：

{ "route": "/xxx", "label": "去做某件事", "confidence": 0.8 }

可路由清单：
${catalogText}

要求：
1. route 必须严格在清单里出现；如果没有任何项合理，返回 { "route": "", "label": "", "confidence": 0 }。
2. label 用中文动词短语描述用户的动作意图，≤ 16 字。
3. confidence 0-1 之间。
4. 只输出 JSON，不要解释。`;

    const resp = await router.chat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: query },
      ],
      scenario: 'high_frequency',
      temperature: 0.2,
      // §B-004 · 严格 schema · 消灭 ```json``` 包裹 / 多余文本 / 字段缺失
      responseFormat: {
        type: 'json_schema',
        name: 'agent_intent',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['route', 'label', 'confidence'],
          properties: {
            route: { type: 'string' },
            label: { type: 'string', maxLength: 16 },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
      maxTokens: 200,
      metadata: { userId },
    });

    const text = typeof resp.message.content === 'string' ? resp.message.content : '';
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end < 0) return null;
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as {
      route?: string;
      label?: string;
      confidence?: number;
    };

    if (!obj.route || !obj.label || typeof obj.confidence !== 'number') return null;
    // 验证 route 必须在清单里（防 LLM 编造）
    if (!ROUTE_CATALOG.some((r) => r.route === obj.route)) return null;

    return {
      intent: 'llm.routed',
      route: obj.route,
      label: `🤖 ${obj.label}`,
      confidence: Math.max(0.6, Math.min(0.95, obj.confidence)),
    };
  } catch {
    return null;
  }
}
