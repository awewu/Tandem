/**
 * GEO 策略库（AgenticGEO 式 · 研究支撑）
 *
 * 背景：GEO 内容生成过去是「固定一招 prompt」。学术前沿（普林斯顿 GEO KDD'24 /
 * AutoGEO ICLR'26 / AgenticGEO 2026）证明：不同问题类型该用不同策略组合，
 * 且固定 prompt 会过拟合、跨引擎不稳。
 *
 * 本模块把「被实证有效」的 GEO 策略固化为可组合的枚举，每条带：
 *   - 论文实测增益（用于排序与解释，不是我们自造的数字）
 *   - 注入 LLM 的具体指令
 *   - 适用的问题类型
 *
 * 关键设计：`selectStrategies()` 按问题类型选组合 → 生成内容时记录用了哪些策略 →
 * 第 7 层闭环实验的 lift 就能归因到「哪些策略真的提升了出现率」，
 * 形成 AgenticGEO 的自进化数据基础（哪个策略 lift 高，下次优先选）。
 *
 * ⚠️ 被实证「无效/有害」的做法（不做，且主动规避）：
 *   - 关键词堆砌（普林斯顿：比基线 -10%）
 *   - 依赖 Schema/JSON-LD 提升引用（Ahrefs 10 亿数据点：无显著提升，仅作实体清晰度卫生）
 */

export type GeoContentKind = 'faq' | 'comparison' | 'topic';

export interface GeoStrategy {
  key: string;
  label: string;
  /** 论文实测增益说明（来源标注，非自造） */
  evidence: string;
  /** 注入 LLM 的具体改写指令 */
  instruction: string;
  /** 适用的内容类型 */
  kinds: GeoContentKind[];
  /** 默认权重（越高越优先入选；后续可由实验 lift 动态调整） */
  weight: number;
}

/**
 * 研究支撑的 GEO 策略库。
 * 增益数字来源：普林斯顿《GEO》KDD 2024 对照实验 + RAG 引用率研究。
 */
export const GEO_STRATEGIES: GeoStrategy[] = [
  {
    key: 'statistics',
    label: '统计数据添加',
    evidence: '普林斯顿 GEO: 位置调整词数 +41%（加具体定量数据，而非定性描述）',
    instruction: '优先加入具体、可核实的定量数据（数值、比例、区间），而非"更节能""更舒适"这类定性描述。无来源支撑的数值一律写"待补充"，绝不编造。',
    kinds: ['faq', 'comparison', 'topic'],
    weight: 10,
  },
  {
    key: 'cite-sources',
    label: '引用可信来源',
    evidence: '普林斯顿 GEO: 两项可见度指标均 +30%（明确引用可靠来源）',
    instruction: '为关键论断标注可信来源（国标编号、官方规范、权威机构）。有参考资料时明确引用其出处；无来源的论断标注"依据待补充"。',
    kinds: ['faq', 'comparison', 'topic'],
    weight: 9,
  },
  {
    key: 'quotation',
    label: '引文添加',
    evidence: '普林斯顿 GEO: 主观展示 +28%（加入来自权威来源的直接引文）',
    instruction: '在合适处引入来自权威来源的简短直接引文（如国标条款原文、行业规范表述），增强被 AI 引用的可信度。',
    kinds: ['comparison', 'topic'],
    weight: 7,
  },
  {
    key: 'fluency',
    label: '流畅性优化',
    evidence: '普林斯顿 GEO: 与统计组合达 +35.8%（提升表达流畅度与可读性）',
    instruction: '语言简洁流畅、逻辑清晰，避免冗长堆砌。表述专业但易读，便于 AI 摘取。',
    kinds: ['faq', 'comparison', 'topic'],
    weight: 6,
  },
  {
    key: 'definition-opening',
    label: '定义式开头',
    evidence: 'RAG 引用研究: "X 是…"式开头（前 150 字符）显著提升被检索为答案的概率',
    instruction: '每个要点/段落用"X 是…"的定义式陈述开头，前 150 字符内给出自包含的核心事实，便于 RAG 分块检索。',
    kinds: ['faq', 'topic'],
    weight: 8,
  },
  {
    key: 'anchor-chunks',
    label: '锚句分块（100–150词/段）',
    evidence: 'RAG 引用研究: 100–150 词/段的自包含事实句 → 4.7× 引用率',
    instruction: '把内容切分为 100–150 字的自包含段落，每段一个可独立引用的事实要点（锚句），不依赖上下文即可被单独摘取。',
    kinds: ['faq', 'topic'],
    weight: 8,
  },
  {
    key: 'authority-tone',
    label: '权威语气 + E-E-A-T',
    evidence: 'AI 引擎系统性偏好第三方权威内容（Earned media bias, arXiv 2509.08919）',
    instruction: '体现经验、专业、权威、可信（E-E-A-T）：给出方法依据、适用条件与边界，避免营销口吻和绝对化用语（合规）。',
    kinds: ['comparison', 'topic'],
    weight: 7,
  },
];

// 保底必选策略：实证最高增益（statistics +41% / cite-sources +30% / anchor-chunks 4.7×引用），
// 无论权重如何排序，只要适用于该内容类型就强制注入，确保"默认就带高增益手法"。
export const ALWAYS_ON = new Set(['statistics', 'cite-sources', 'anchor-chunks']);

/**
 * 按内容类型选择策略组合（AgenticGEO 式的策略选择）。
 * - 保底：ALWAYS_ON 中适用于该类型的策略强制入选（默认注入高增益手法）。
 * - 其余按权重补足到 max；weightOverrides 由实验 lift 结果动态提权，实现自进化。
 */
export function selectStrategies(
  kind: GeoContentKind,
  opts: { max?: number; weightOverrides?: Record<string, number> } = {},
): GeoStrategy[] {
  const max = opts.max ?? 4;
  const overrides = opts.weightOverrides || {};
  const applicable = GEO_STRATEGIES
    .filter((s) => s.kinds.includes(kind))
    .map((s) => ({ ...s, weight: s.weight + (overrides[s.key] ?? 0) }));

  const mustHave = applicable.filter((s) => ALWAYS_ON.has(s.key));
  const rest = applicable
    .filter((s) => !ALWAYS_ON.has(s.key))
    .sort((a, b) => b.weight - a.weight);

  // 保底优先，再按权重补足；总数仍受 max 约束（但不挤掉保底）。
  const selected = [...mustHave.sort((a, b) => b.weight - a.weight)];
  for (const s of rest) {
    if (selected.length >= Math.max(max, mustHave.length)) break;
    selected.push(s);
  }
  return selected;
}

/**
 * 自进化权重的三层收缩估计（经验贝叶斯）——纯函数，便于测试与复用。
 *   L0 研究基线（本函数中增量基准 = 0，即 GEO_STRATEGIES 内置权重）
 *   L1 品类层：同品类跨品牌平均 lift，先向 L0 收缩
 *   L2 品牌层：该品牌自身实验，再向品类先验收缩
 * 效果：n_brand=0 → 完全继承品类先验（新品牌开局不从零）；
 *       n_brand 小 → 先验主导（避免 n=1 的噪声冒充经验）；
 *       n_brand 大 → 收敛到品牌自身经验。
 */
export interface HierarchicalDeltaOptions {
  kBrand?: number;      // 品牌层平滑常数
  kCategory?: number;   // 品类层向 L0 收缩的平滑常数
  scale?: number;       // lift(百分点) → 权重量级
  cap?: number;         // 增量上下限
}

export interface HierarchicalDeltaResult {
  delta: number;
  prior: number;
  brandAvg: number;
  categoryAvg: number;
  source: 'brand' | 'category' | 'none';
}

export function blendHierarchicalDelta(
  input: { brandN: number; brandSum: number; categoryN: number; categorySum: number },
  opts: HierarchicalDeltaOptions = {},
): HierarchicalDeltaResult {
  const kBrand = opts.kBrand ?? 5;
  const kCategory = opts.kCategory ?? 3;
  const scale = opts.scale ?? 0.2;
  const cap = opts.cap ?? 5;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const brandN = Math.max(0, Number(input.brandN) || 0);
  const categoryN = Math.max(0, Number(input.categoryN) || 0);
  const brandAvg = brandN ? input.brandSum / brandN : 0;
  const categoryAvg = categoryN ? input.categorySum / categoryN : 0;

  const prior = categoryN ? (categoryN * categoryAvg) / (categoryN + kCategory) : 0;
  const blended = (brandN * brandAvg + kBrand * prior) / (brandN + kBrand);
  const delta = Math.max(-cap, Math.min(cap, round1(blended * scale)));

  return {
    delta,
    prior: round1(prior),
    brandAvg: round1(brandAvg),
    categoryAvg: round1(categoryAvg),
    source: brandN ? 'brand' : (categoryN ? 'category' : 'none'),
  };
}

/** 把选中的策略渲染成 prompt 指令块（含策略名，便于产出可追溯）。 */
export function renderStrategyBlock(strategies: GeoStrategy[]): string {
  if (!strategies.length) return '';
  const lines = strategies.map((s, i) => `${i + 1}. 【${s.label}】${s.instruction}`);
  return ['GEO 优化策略（按研究实证有效性排序，逐条落实）：', ...lines].join('\n');
}
