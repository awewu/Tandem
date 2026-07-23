import { NextRequest, NextResponse } from 'next/server';

// GEO Analysis API — MVP Mock Implementation
// TODO: Replace with real AI search engine API calls (豆包/Kimi/DeepSeek/文心/通义/智谱/星火/元宝)

interface EngineResult {
  engine: string;
  score: number;
  mentioned: boolean;
  recommended: boolean;
  snippet: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'not_found';
}

const AI_ENGINES = [
  '豆包（字节）',
  'Kimi（月之暗面）',
  'DeepSeek',
  '文心一言（百度）',
  '通义千问（阿里）',
  '智谱清言',
  '讯飞星火',
  '腾讯元宝',
];

// Brand keywords that indicate our brands are mentioned
const BRAND_KEYWORDS = ['rheem', '瑞美', 'ruud', '瑞德', 'everhot', '恒热', 'rhautt', '瑞合'];

// Simulate AI engine responses based on query relevance
function simulateEngineResult(engine: string, query: string): EngineResult {
  const queryLower = query.toLowerCase();
  const isDirectBrand = BRAND_KEYWORDS.some((k) => queryLower.includes(k));

  // Simulate varying visibility based on engine + query type
  let baseScore = Math.floor(Math.random() * 40) + 10; // 10-50 base

  // Boost score if query directly mentions our brand
  if (isDirectBrand) baseScore += 30;

  // Certain engines are "better" for certain queries (simulated)
  if (engine.includes('百度') && queryLower.includes('热水器')) baseScore += 20;
  if (engine.includes('字节') && queryLower.includes('空调')) baseScore += 15;
  if (engine.includes('DeepSeek') && queryLower.includes('设计')) baseScore += 25;

  const score = Math.min(100, Math.max(0, baseScore + Math.floor(Math.random() * 15)));
  const mentioned = score > 30;
  const recommended = score > 60;

  let sentiment: EngineResult['sentiment'] = 'not_found';
  if (recommended) sentiment = 'positive';
  else if (mentioned) sentiment = 'neutral';
  else if (score > 15 && Math.random() > 0.7) sentiment = 'negative';

  const snippets: Record<string, string[]> = {
    positive: [
      `在回答中明确推荐了 Rheem/恒热 品牌，列为"值得考虑的品牌"之一`,
      `将 Everhot 列入"性价比高"的推荐清单中，并给出正面评价`,
      `详细介绍了 Rheem 的产品优势和适用场景`,
    ],
    neutral: [
      `在品牌列表中提及了 Rheem，但未给出特别推荐`,
      `作为对比品牌之一被提到，无明显倾向`,
      `在"其他可选品牌"中一带而过`,
    ],
    negative: [
      `提到了竞品的售后问题可能涉及我方品牌认知混淆`,
      `在对比中将价格定位偏高作为劣势提及`,
    ],
    not_found: [
      `回答中未出现任何关联品牌信息`,
      `推荐了其他竞品品牌，完全未提及我方`,
      `该引擎对此类问题的回答未涉及品牌推荐`,
    ],
  };

  const pool = snippets[sentiment] ?? snippets.not_found;
  const snippet = pool[Math.floor(Math.random() * pool.length)];

  return { engine, score, mentioned, recommended, snippet, sentiment };
}

function generateGaps(results: EngineResult[], query: string): string[] {
  const gaps: string[] = [];
  const notFoundEngines = results.filter((r) => r.sentiment === 'not_found');
  const lowScoreEngines = results.filter((r) => r.score < 30);

  if (notFoundEngines.length >= 4) {
    gaps.push(`超过半数 AI 引擎（${notFoundEngines.length}/8）未提及品牌，需加强内容建设`);
  }

  if (lowScoreEngines.length > 0) {
    gaps.push(
      `在 ${lowScoreEngines.map((e) => e.engine).join('、')} 中可见度低于 30%，建议针对性优化`,
    );
  }

  const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
  if (avgScore < 40) {
    gaps.push(`综合可见度仅 ${avgScore}%，建议围绕「${query}」创作专业内容并发布到主流平台`);
  }

  if (!results.some((r) => r.recommended)) {
    gaps.push(`没有任何引擎将品牌列为首选推荐，需建立"被推荐"的内容策略`);
  }

  return gaps;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const query = body.query?.trim();

  if (!query) {
    return NextResponse.json({ error: '请输入探测关键词' }, { status: 400 });
  }

  // Simulate network delay (real API calls would take 2-5s per engine)
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));

  const results = AI_ENGINES.map((engine) => simulateEngineResult(engine, query));
  const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
  const gaps = generateGaps(results, query);

  return NextResponse.json({
    query,
    timestamp: new Date().toISOString(),
    results,
    avgScore,
    gaps,
  });
}
