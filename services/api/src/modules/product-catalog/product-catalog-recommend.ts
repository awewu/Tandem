import { EMPTY_POSITIONING, sanitizePositioning, type ProductPositioning } from './product-taxonomy';

export interface ProductRecommendationCandidate {
  sku?: string | null;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  spec?: Record<string, unknown> | null;
  positioning?: unknown;
}

export interface ProductRecommendationCriteria {
  segments?: unknown;
  channels?: unknown;
  personas?: unknown;
  markets?: unknown;
  scenarios?: unknown;
  systems?: unknown;
  painPoints?: unknown;
}

export interface ProductRecommendationScore {
  score: number;
  signals: string[];
  positioning: ProductPositioning;
}

const SYSTEM_KEYWORDS: Record<string, string[]> = {
  hot_water: ['water-heating', 'hot water', 'water heater', '热水', '热水器', '恒温', '大水量'],
  heating: ['heating-boiler', 'boiler', '采暖', '壁挂炉', '冷凝炉', '锅炉'],
  air: ['heat-pump', 'fan-coil', 'ventilation', 'dehumidification', 'air', '风盘', '空气', '新风', '除湿', '热泵'],
  fresh_air: ['ventilation', 'dehumidification', 'fresh air', '新风', '除湿', '空气'],
  water_treatment: ['water-treatment', 'filter', '净水', '软水', '过滤', '前置'],
  smart_control: ['control', 'hydronic-control', 'smart', '控制', '联动', '水控'],
};

const PAIN_PREFIX_SYSTEMS: Record<string, string[]> = {
  h: ['hot_water'],
  t: ['heating', 'air'],
  a: ['fresh_air', 'air'],
  w: ['water_treatment'],
  s: ['smart_control'],
};

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function lowerList(value: unknown): string[] {
  return asList(value).map((item) => item.toLowerCase());
}

function inferSystemsFromPainPoints(painPoints: string[]): string[] {
  const out = new Set<string>();
  for (const raw of painPoints) {
    const prefix = raw.trim().toLowerCase().split('_')[0];
    for (const system of PAIN_PREFIX_SYSTEMS[prefix] || []) out.add(system);
  }
  return [...out];
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

export function resolveRecommendationSystems(criteria: ProductRecommendationCriteria): string[] {
  const explicit = lowerList(criteria.systems);
  const inferred = inferSystemsFromPainPoints(lowerList(criteria.painPoints));
  return [...new Set([...explicit, ...inferred])];
}

export function scoreProductRecommendation(
  product: ProductRecommendationCandidate,
  criteria: ProductRecommendationCriteria,
): ProductRecommendationScore {
  const positioning = sanitizePositioning(product.positioning ?? EMPTY_POSITIONING);
  const wanted: Array<[keyof ProductPositioning, string[], number]> = [
    ['targetSegments', lowerList(criteria.segments), 2],
    ['channels', lowerList(criteria.channels), 2],
    ['userPersonas', lowerList(criteria.personas), 2],
    ['markets', lowerList(criteria.markets), 2],
    ['applicationScenarios', lowerList(criteria.scenarios), 2],
  ];
  const signals: string[] = [];
  let score = 0;

  for (const [dimension, values, weight] of wanted) {
    if (!values.length) continue;
    const available = lowerList(positioning[dimension]);
    const hits = values.filter((value) => available.includes(value));
    if (hits.length) {
      score += hits.length * weight;
      signals.push(`${dimension}:${hits.join(',')}`);
    }
  }

  const painPoints = lowerList(criteria.painPoints);
  if (painPoints.length) {
    const hay = [positioning.valueProposition, ...positioning.painPoints, ...positioning.scenarios]
      .join(' ')
      .toLowerCase();
    const hits = painPoints.filter((pain) => hay.includes(pain));
    if (hits.length) {
      score += hits.length;
      signals.push(`pain:${hits.join(',')}`);
    }
  }

  const systems = resolveRecommendationSystems(criteria);
  if (systems.length) {
    const productText = [
      product.name,
      product.sku,
      product.brand,
      product.category,
      product.spec?.officialModel,
      product.spec?.text,
      positioning.valueProposition,
      ...positioning.painPoints,
      ...positioning.scenarios,
    ].filter(Boolean).join(' ').toLowerCase();

    for (const system of systems) {
      const keywords = SYSTEM_KEYWORDS[system] || [system];
      if (containsAny(productText, keywords)) {
        score += 4;
        signals.push(`system:${system}`);
      }
    }
  }

  return { score, signals, positioning };
}
