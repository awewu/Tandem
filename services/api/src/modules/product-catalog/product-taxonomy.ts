/**
 * D2 产品事实基座 · 定位受控词表（P1）
 * 事实源：docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md §2。
 *
 * 「把产品说清楚」的五组结构化定位维度的受控词汇。集中管理，供各消费方
 * （问诊/报价/品牌站/增长中枢）一致筛选。词表为「软约束」：录入时未知 code
 * 会被 sanitize 过滤，而非硬失败——保证 seed / 无损往返不被卡死。
 */

export interface TaxonomyTerm {
  code: string;
  label: string;
}

/** 卖给谁 · 目标客户 */
export const TARGET_SEGMENTS: readonly TaxonomyTerm[] = [
  { code: 'home', label: '家庭' },
  { code: 'villa', label: '别墅' },
  { code: 'commercial', label: '商用' },
  { code: 'project', label: '工程' },
] as const;

/** 哪个渠道 */
export const CHANNELS: readonly TaxonomyTerm[] = [
  { code: 'dealer', label: '经销商' },
  { code: 'project', label: '工程项目' },
  { code: 'ecommerce', label: '电商' },
  { code: 'direct', label: '直营' },
] as const;

/** 哪类用户 · 画像 */
export const USER_PERSONAS: readonly TaxonomyTerm[] = [
  { code: 'premium_upgrade', label: '高端改善' },
  { code: 'essential', label: '刚需' },
  { code: 'retrofit', label: '存量改造' },
  { code: 'new_build', label: '新装' },
] as const;

/** 哪个市场 · 区域/场景 */
export const MARKETS: readonly TaxonomyTerm[] = [
  { code: 'east_villa', label: '华东别墅' },
  { code: 'south_humid', label: '南方潮湿区' },
  { code: 'north_heating', label: '北方采暖区' },
  { code: 'tier1_city', label: '一线城市' },
] as const;

/**
 * 应用场景大类（P5）· 家用 / 商用 双轨。
 * targetSegments 回答「卖给谁」，此处回答「用在什么场景」——两者正交：
 * 同一产品可跨家用/商用场景，但推广/赋能/交付/技术支持模式随场景族不同（见 SEGMENT_OPERATING_MODELS）。
 */
export interface ApplicationScenarioTerm extends TaxonomyTerm {
  /** 所属场景族：residential=家用，commercial=商用/轻商 */
  family: 'residential' | 'commercial';
}

export const APPLICATION_SCENARIOS: readonly ApplicationScenarioTerm[] = [
  // 家用（residential）
  { code: 'res_new_decoration', label: '新房精装', family: 'residential' },
  { code: 'res_villa', label: '别墅大宅', family: 'residential' },
  { code: 'res_retrofit', label: '存量旧房改造', family: 'residential' },
  { code: 'res_apartment', label: '公寓刚需', family: 'residential' },
  // 商用 / 轻商（commercial）
  { code: 'com_office', label: '办公写字楼', family: 'commercial' },
  { code: 'com_hospitality', label: '酒店/民宿', family: 'commercial' },
  { code: 'com_public', label: '学校/医院/公建', family: 'commercial' },
  { code: 'com_retail', label: '商业综合体/门店', family: 'commercial' },
  { code: 'com_industrial', label: '工业厂房/园区', family: 'commercial' },
] as const;

export type ScenarioFamily = 'residential' | 'commercial';

/**
 * 段位运营模型（P5）· 家用 vs 商用在四个经营维度上的差异化模式。
 * 事实源：PRD docs/PRODUCT-APPLICATION-SCENARIO-AND-SEGMENT-MODEL.md。
 * 供增长中枢/经销商工作台/交付域按场景族选择对应的推广-赋能-交付-支持打法。
 */
export interface SegmentOperatingModel {
  family: ScenarioFamily;
  label: string;
  /** 推广模式 */
  promotion: string[];
  /** 赋能模式（对经销商/设计师/销售） */
  enablement: string[];
  /** 交付模式 */
  delivery: string[];
  /** 技术支持模式 */
  techSupport: string[];
}

export const SEGMENT_OPERATING_MODELS: Readonly<Record<ScenarioFamily, SegmentOperatingModel>> = {
  residential: {
    family: 'residential',
    label: '家用（C端消费驱动）',
    promotion: ['C端内容种草(AI问诊/GEO/口碑)', '门店/样板间体验', '经销商分销获客', '品牌矩阵曝光'],
    enablement: ['标准化系统套餐', '一键精算+AI方案', '经销商工作台自助', '话术/物料一键取用'],
    delivery: ['标准化快速交付', '生命周期14态', '验收打勾', 'IoT仅移交'],
    techSupport: ['远程指导+经销商自服务', '保修台账', '标准SLA'],
  },
  commercial: {
    family: 'commercial',
    label: '商用/轻商（B端项目驱动）',
    promotion: ['B端项目获客(工程渠道/招投标)', '行业展会/标杆案例', 'GEO专业词+技术白皮书', '客情与关系营销'],
    enablement: ['定制化选型+负荷精算', '多专业BIM深化协同', '投标报价/技术标书', '厂商专家支持'],
    delivery: ['项目制里程碑交付', '深化图纸/工程量/标准符合性', '多方分阶段验收', '调试与移交'],
    techSupport: ['驻场/专业工程师', 'SLA+运维合同', '能效优化/长期服务'],
  },
} as const;

/** targetSegment（home/villa/commercial/project）→ 场景族。 */
export function segmentFamily(targetSegment: string): ScenarioFamily {
  return targetSegment === 'commercial' || targetSegment === 'project' ? 'commercial' : 'residential';
}

/** 素材角色 · 产品挂载的 DAM 引用类别（P2） */
export const ASSET_ROLES: readonly TaxonomyTerm[] = [
  { code: 'main', label: '主图' },
  { code: 'icon', label: '图标' },
  { code: 'detail', label: '详情图' },
  { code: 'card', label: '卡片图' },
  { code: 'spec', label: '参数表' },
  { code: 'cert', label: '认证文件' },
  { code: 'bim', label: 'BIM 族' },
  { code: 'doc', label: '说明文档' },
] as const;

/** 单条素材引用（只存引用，不复制文件；文件在 file-artifact/DAM） */
export interface AssetRef {
  /** 素材角色（见 ASSET_ROLES） */
  role: string;
  /** DAM 制品 id */
  artifactId: string;
  /** 对象存储 key（可选） */
  objectKey?: string;
  filename?: string;
  mimeType?: string;
  sortOrder?: number;
}

/** 定位结构（存于 products.positioning jsonb） */
export interface ProductPositioning {
  /** 卖给谁 */
  targetSegments: string[];
  /** 哪个渠道 */
  channels: string[];
  /** 哪类用户 */
  userPersonas: string[];
  /** 哪个市场/区域 */
  markets: string[];
  /** 为何设计 · 一句话价值主张 */
  valueProposition: string;
  /** 解决的痛点 */
  painPoints: string[];
  /** 适用场景（自由文本） */
  scenarios: string[];
  /** 应用场景大类（受控：家用/商用双轨，见 APPLICATION_SCENARIOS） */
  applicationScenarios: string[];
}

export const EMPTY_POSITIONING: ProductPositioning = {
  targetSegments: [],
  channels: [],
  userPersonas: [],
  markets: [],
  valueProposition: '',
  painPoints: [],
  scenarios: [],
  applicationScenarios: [],
};

/** 完整词表（供 GET /taxonomy 与后台下拉）。relationTypes/locales 在下方定义后并入。 */
export const PRODUCT_TAXONOMY = {
  targetSegments: TARGET_SEGMENTS,
  channels: CHANNELS,
  userPersonas: USER_PERSONAS,
  markets: MARKETS,
  applicationScenarios: APPLICATION_SCENARIOS,
  segmentModels: SEGMENT_OPERATING_MODELS,
  assetRoles: ASSET_ROLES,
  get relationTypes() { return RELATION_TYPES; },
  get locales() { return LOCALES; },
} as const;

function codeSet(terms: readonly TaxonomyTerm[]): Set<string> {
  return new Set(terms.map((t) => t.code));
}

function sanitizeCodes(input: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const v of input) {
    if (typeof v === 'string' && allowed.has(v)) seen.add(v);
  }
  return [...seen];
}

function sanitizeStrings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

/**
 * 归一化定位输入：受控维度过滤未知 code，自由文本裁剪。
 * 软约束：非法值静默剔除，不抛错（保证 seed / 无损往返稳健）。
 */
export function sanitizePositioning(input: unknown): ProductPositioning {
  const p = (input && typeof input === 'object' ? input : {}) as Partial<ProductPositioning>;
  return {
    targetSegments: sanitizeCodes(p.targetSegments, codeSet(TARGET_SEGMENTS)),
    channels: sanitizeCodes(p.channels, codeSet(CHANNELS)),
    userPersonas: sanitizeCodes(p.userPersonas, codeSet(USER_PERSONAS)),
    markets: sanitizeCodes(p.markets, codeSet(MARKETS)),
    valueProposition: typeof p.valueProposition === 'string' ? p.valueProposition.trim() : '',
    painPoints: sanitizeStrings(p.painPoints),
    scenarios: sanitizeStrings(p.scenarios),
    applicationScenarios: sanitizeCodes(p.applicationScenarios, codeSet(APPLICATION_SCENARIOS)),
  };
}

/**
 * MDM-lite 稳定产品标识（P4）：跨品牌/多源识别「同一产品」。
 * 品牌无关——仅由归一化名称（+品类前缀）派生，使多站/多源同款可去重。
 * 归一：NFKC → 小写 → 去分隔符/标点 → 保留字母数字与 CJK。
 */
export function computeProductKey(name?: string | null, category?: string | null): string {
  const norm = String(name ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_/]+/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  const cat = String(category ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return cat && norm ? `${cat}:${norm}` : norm;
}

/**
 * 归一化素材引用数组：要求 role 属 ASSET_ROLES 且 artifactId 非空；main/card/spec 等单例角色取最后一条，detail 允许多张并按 sortOrder 排序。
 * 软约束：非法条目静默剔除，不抛错（保证 seed / partial 写入稳健）。
 */
export function sanitizeAssetRefs(input: unknown): AssetRef[] {
  if (!Array.isArray(input)) return [];
  const allowed = codeSet(ASSET_ROLES);
  const singletonByRole = new Map<string, AssetRef>();
  const multiRefs: AssetRef[] = [];
  const seenMultiRefs = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Partial<AssetRef>;
    if (typeof r.role !== 'string' || !allowed.has(r.role)) continue;
    if (typeof r.artifactId !== 'string' || !r.artifactId.trim()) continue;
    const ref: AssetRef = { role: r.role, artifactId: r.artifactId };
    if (typeof r.objectKey === 'string') ref.objectKey = r.objectKey;
    if (typeof r.filename === 'string') ref.filename = r.filename;
    if (typeof r.mimeType === 'string') ref.mimeType = r.mimeType;
    if (Number.isFinite(Number(r.sortOrder))) ref.sortOrder = Math.max(0, Number(r.sortOrder));
    if (ref.role === 'detail' || ref.role === 'doc') {
      const key = `${ref.role}:${ref.artifactId}`;
      if (seenMultiRefs.has(key)) continue;
      seenMultiRefs.add(key);
      multiRefs.push(ref);
    } else {
      singletonByRole.set(ref.role, ref);
    }
  }
  const sortedMultiRefs = multiRefs
    .map((ref, index) => ({ ...ref, sortOrder: Number.isFinite(ref.sortOrder) ? ref.sortOrder : index }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return [...singletonByRole.values(), ...sortedMultiRefs];
}

// ════════════════════════════════════════════════════════════════════════
// L7 营销供给层 · 类型 + 归一（i18n + SEO/GEO + 富营销内容）
// 事实源：docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md §10。
// ════════════════════════════════════════════════════════════════════════

/** 支持的 locale 受控词表（BCP-47）。默认 zh-CN；软约束下未知 locale 仍可存但不入表建议集。 */
export const LOCALES: readonly TaxonomyTerm[] = [
  { code: 'zh-CN', label: '简体中文（中国）' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'zh-TW', label: '繁體中文（台灣）' },
  { code: 'ja-JP', label: '日本語（日本）' },
] as const;

export const DEFAULT_LOCALE = 'zh-CN';

/** L7b SEO/GEO 结构（存于 product_content.seo jsonb）。JSON-LD 由服务读时计算，不存此处。 */
export interface ProductSeo {
  metaTitle: string;
  metaDescription: string;
  canonical: string;
  ogImage: string;
  keywords: string[];
}

export const EMPTY_SEO: ProductSeo = {
  metaTitle: '',
  metaDescription: '',
  canonical: '',
  ogImage: '',
  keywords: [],
};

/** L7c 卖点-利益对。 */
export interface FeatureBenefit {
  feature: string;
  benefit: string;
}

/** L7c FAQ 条目。 */
export interface FaqItem {
  q: string;
  a: string;
}

/** L7c 富营销内容结构（存于 product_content.marketing jsonb）。 */
export interface ProductMarketing {
  headline: string;
  subhead: string;
  featureBenefits: FeatureBenefit[];
  highlights: string[];
  faq: FaqItem[];
}

export const EMPTY_MARKETING: ProductMarketing = {
  headline: '',
  subhead: '',
  featureBenefits: [],
  highlights: [],
  faq: [],
};

/** 归一化 locale：白名单命中返回该 code，否则回退默认（软约束，不抛错）。 */
export function sanitizeLocale(input: unknown): string {
  const v = typeof input === 'string' ? input.trim() : '';
  return codeSet(LOCALES).has(v) ? v : DEFAULT_LOCALE;
}

/** 归一化 SEO 输入：字符串裁剪、keywords 过滤非空字符串。软约束，非法值剔除。 */
export function sanitizeSeo(input: unknown): ProductSeo {
  const s = (input && typeof input === 'object' ? input : {}) as Partial<ProductSeo>;
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  return {
    metaTitle: str(s.metaTitle),
    metaDescription: str(s.metaDescription),
    canonical: str(s.canonical),
    ogImage: str(s.ogImage),
    keywords: sanitizeStrings(s.keywords),
  };
}

/** 产品关系类型受控词表（P1）。 */
export const RELATION_TYPES: readonly TaxonomyTerm[] = [
  { code: 'accessory', label: '配件' },
  { code: 'compatible', label: '兼容' },
  { code: 'replaces', label: '替代（新替旧）' },
  { code: 'replaced_by', label: '被替代' },
  { code: 'cross_sell', label: '交叉销售' },
  { code: 'up_sell', label: '向上销售' },
  { code: 'compare', label: '对比' },
] as const;

/** 校验关系类型合法（白名单）。 */
export function isValidRelationType(t: unknown): boolean {
  return typeof t === 'string' && codeSet(RELATION_TYPES).has(t);
}

/**
 * 关系类型的反向映射（P1 双向图）：写「A →type→ B」时自动补「B →inverse→ A」，
 * 避免后台只能看到单向关系、公开对比/关联缺半边。
 *  - 对称关系（compatible/compare/cross_sell）反向即自身；
 *  - 方向关系 replaces ↔ replaced_by 互为反向；
 *  - accessory / up_sell 无干净语义反向（配件的「主机」、向上销售的「向下销售」不在受控集），
 *    故不自动补边——保持单向、不臆造反向语义。
 */
export const INVERSE_RELATION: Readonly<Record<string, string>> = {
  compatible: 'compatible',
  compare: 'compare',
  cross_sell: 'cross_sell',
  replaces: 'replaced_by',
  replaced_by: 'replaces',
};

/** 取某关系类型的反向类型；无干净反向语义时返回 null（不自动补边）。 */
export function inverseRelationType(t: string): string | null {
  return INVERSE_RELATION[t] ?? null;
}

// ── L7 发布工作流（P1）· 状态机 ────────────────────────────────────────────
/** 内容发布态受控集。只有 published 且 publishedAt<=now 进公开供给。 */
export const CONTENT_STATUSES = ['draft', 'review', 'scheduled', 'published'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** 工作流动作 → 合法起始态集合 + 目标态。schedule 需 scheduledAt（未来）。 */
export const WORKFLOW_TRANSITIONS: Record<string, { from: ContentStatus[]; to: ContentStatus }> = {
  submit: { from: ['draft'], to: 'review' },
  approve: { from: ['review'], to: 'published' },
  schedule: { from: ['review', 'draft'], to: 'scheduled' },
  reject: { from: ['review'], to: 'draft' },
  unpublish: { from: ['published', 'scheduled'], to: 'draft' },
};

export const CONTENT_ACTIONS = Object.keys(WORKFLOW_TRANSITIONS);

/** 校验一个工作流动作是否可从当前态执行；返回目标态或 null（非法）。 */
export function resolveTransition(action: string, current: string): ContentStatus | null {
  const t = WORKFLOW_TRANSITIONS[action];
  if (!t) return null;
  if (!t.from.includes(current as ContentStatus)) return null;
  return t.to;
}

/** 归一化富营销内容：字符串裁剪；featureBenefits/faq 要求成对非空；highlights 过滤非空。 */
export function sanitizeMarketing(input: unknown): ProductMarketing {
  const m = (input && typeof input === 'object' ? input : {}) as Partial<ProductMarketing>;
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const fbs = Array.isArray(m.featureBenefits) ? m.featureBenefits : [];
  const faqs = Array.isArray(m.faq) ? m.faq : [];
  return {
    headline: str(m.headline),
    subhead: str(m.subhead),
    featureBenefits: fbs
      .map((x) => ({ feature: str((x as FeatureBenefit)?.feature), benefit: str((x as FeatureBenefit)?.benefit) }))
      .filter((x) => x.feature || x.benefit),
    highlights: sanitizeStrings(m.highlights),
    faq: faqs
      .map((x) => ({ q: str((x as FaqItem)?.q), a: str((x as FaqItem)?.a) }))
      .filter((x) => x.q && x.a),
  };
}

const OFFICIAL_DETAIL_ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a', 'img',
  'h2', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);
const OFFICIAL_DETAIL_VOID_TAGS = new Set(['br', 'img']);

function escapeOfficialDetailHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readHtmlAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  raw.replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g, (_match, name, dquoted, squoted, bare) => {
    attrs[String(name).toLowerCase()] = String(dquoted ?? squoted ?? bare ?? '');
    return '';
  });
  return attrs;
}

function safeOfficialDetailUrl(value: string, kind: 'href' | 'src'): string {
  const url = String(value || '').trim();
  if (!url) return '';
  if (kind === 'href' && /^(https?:\/\/|mailto:|tel:|\/)/i.test(url)) return url;
  if (kind === 'src' && /^(https?:\/\/|\/api\/|\/assets\/|\/uploads\/)/i.test(url)) return url;
  return '';
}

function officialDetailTagHtml(tag: string, attrsRaw: string, closing: boolean, selfClosing: boolean): string {
  if (!OFFICIAL_DETAIL_ALLOWED_TAGS.has(tag)) return '';
  if (closing) return OFFICIAL_DETAIL_VOID_TAGS.has(tag) ? '' : `</${tag}>`;

  const attrs = readHtmlAttrs(attrsRaw);
  if (tag === 'a') {
    const href = safeOfficialDetailUrl(attrs.href, 'href');
    return href
      ? `<a href="${escapeOfficialDetailHtml(href)}" rel="noopener noreferrer"${/^https?:\/\//i.test(href) ? ' target="_blank"' : ''}>`
      : '<a>';
  }
  if (tag === 'img') {
    const src = safeOfficialDetailUrl(attrs.src, 'src');
    if (!src) return '';
    return `<img src="${escapeOfficialDetailHtml(src)}" alt="${escapeOfficialDetailHtml(attrs.alt || '')}" loading="lazy">`;
  }
  if (OFFICIAL_DETAIL_VOID_TAGS.has(tag) || selfClosing) return `<${tag}>`;
  return `<${tag}>`;
}

export function sanitizeOfficialDetailHtml(input: unknown): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return '';
  const withoutBlockedContent = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button)\b[^>]*\/?>/gi, '');
  let output = '';
  let cursor = 0;
  const tagRe = /<\/?\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(withoutBlockedContent))) {
    output += escapeOfficialDetailHtml(withoutBlockedContent.slice(cursor, match.index));
    const full = match[0] || '';
    output += officialDetailTagHtml(
      String(match[1] || '').toLowerCase(),
      match[2] || '',
      /^<\//.test(full),
      /\/\s*>$/.test(full),
    );
    cursor = match.index + full.length;
  }
  output += escapeOfficialDetailHtml(withoutBlockedContent.slice(cursor));
  return output.trim();
}
