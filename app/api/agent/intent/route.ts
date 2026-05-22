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

  return NextResponse.json({
    matches: matches.slice(0, 5),
    query,
  });
}
