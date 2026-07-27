export type BrandSiteSummary = {
  id: string;
  code: string;
  nameCn: string;
  nameEn: string;
  appKey: string | null;
  deliveryType?: 'self_hosted' | 'external';
  developmentUrl?: string | null;
  productionUrl?: string | null;
  resolvedUrl?: string | null;
  resolvedEnvironment?: string;
  logoArtifactId?: string | null;
  status: 'active' | 'inactive';
  sortOrder: number;
  childBrandCodes?: string[];
  deletedAt: string | null;
  publishCapability?: BrandPublishCapability;
};

export type BrandSiteEnvironmentLink = {
  key: 'testing' | 'production';
  label: '测试环境' | '生产环境';
  url: string;
};

export type BrandPublishCapability = {
  supported: boolean;
  mode: 'static-backup' | 'unsupported';
  label: string;
  reason: string;
};

export type BrandProductRow = {
  id: string;
  sku: string;
  materialCode: string;
  publicSlug: string;
  name: string;
  model: string;
  category: string;
  materialCategory: string;
  productLine: string;
  categoryLevel1Id: string | null;
  categoryLevel2Id: string | null;
  categoryLevel3Id: string | null;
  categoryPath: string;
  applicationScenarios: string[];
  system: string;
  websiteMenuCategory: string;
  status: string;
  sortOrder: number;
  imageState: {
    hasMainImage: boolean;
    mainImageUrl: string;
    mainArtifactId: string;
    mainRef: AssetRef | null;
    detailRefs: AssetRef[];
    galleryCount: number;
    label: string;
  };
  metadataReadiness: {
    ready: boolean;
    score: number;
    missing: string[];
  };
  raw: Record<string, unknown>;
};

export type AssetRef = {
  role: string;
  artifactId: string;
  objectKey?: string;
  filename?: string;
  mimeType?: string;
  sortOrder?: number;
  url?: string;
};

export type BrandProductEditDraft = {
  publicSlug: string;
  name: string;
  model: string;
  category: string;
  system: string;
  websiteMenuCategory: string;
  sortOrder: string;
  series: string;
  tagline: string;
  officialEnglishName: string;
  badges: string;
};

export type BrandContentKeyValueDraft = {
  key: string;
  value: string;
};

export type BrandContentFeatureDraft = {
  title: string;
  description: string;
};

export type BrandContentFaqDraft = {
  question: string;
  answer: string;
};

export type BrandContentGalleryDraft = {
  url: string;
  alt: string;
};

export type BrandStructuredContentDraft = {
  tagline: string;
  series: string;
  officialEnglishName: string;
  officialCopy: string;
  websiteTitle: string;
  websiteDescription: string;
  icon: string;
  image: string;
  specImage: string;
  badges: string[];
  specs: BrandContentKeyValueDraft[];
  features: BrandContentFeatureDraft[];
  highlights: BrandContentKeyValueDraft[];
  certs: string[];
  faqs: BrandContentFaqDraft[];
  gallery: BrandContentGalleryDraft[];
  positioning: Record<string, string[]>;
};

export type BrandProductEmptyState = {
  kind: 'unknown-brand' | 'no-products';
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

export type BrandProductConsoleData = {
  brandCode: string;
  site: BrandSiteSummary | null;
  products: BrandProductRow[];
  taxonomy: Record<string, unknown>;
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  facets: BrandProductFacets;
  emptyState: BrandProductEmptyState | null;
  apiCalls: string[];
};

export type BrandProductQuery = {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  category?: string;
  categoryLevel1Id?: string;
  categoryLevel2Id?: string;
  categoryLevel3Id?: string;
  deferGroupProducts?: boolean;
};

export type BrandProductFacets = {
  categories: Array<{ value: string; count: number }>;
  statuses: Array<{ value: string; count: number }>;
};

export type BrandMenuGroupOption = {
  value: string;
  label: string;
};

type BrandProductConsoleApiDeps = {
  products?: {
    list: (query?: Record<string, string>) => Promise<unknown>;
    taxonomy: () => Promise<Record<string, unknown>>;
  };
  brandSites?: {
    list: () => Promise<unknown>;
  };
};

const DEFAULT_PRODUCT_PAGE_SIZE = 20;
const GROUP_SITE_CODE = 'rhautt-group';

const BRAND_PRODUCT_TENANTS: Record<string, string | undefined> = {
  everhot: process.env.NEXT_PUBLIC_EVERHOT_TENANT_ID || 'e5e40000-0000-4000-8000-000000000001',
  rheem: process.env.NEXT_PUBLIC_RHEEM_TENANT_ID || '4aee0000-0000-4000-8000-000000000001',
  ruud: process.env.NEXT_PUBLIC_RUUD_TENANT_ID || '7aad0000-0000-4000-8000-000000000001',
};

const BRAND_SITE_ENVIRONMENT_FALLBACKS: Record<string, { testing: string; production: string }> = {
  rheem: { testing: 'http://localhost:5014/', production: 'https://www.rheem.com.cn/' },
  ruud: { testing: 'http://localhost:5015/', production: 'https://www.ruud.com.cn/' },
  everhot: { testing: 'http://localhost:5011/', production: 'https://www.everhot.com.cn/' },
};

const BRAND_MENU_GROUP_OPTIONS: Record<string, string[]> = {
  everhot: [
    '家用中央空调',
    '地暖系统',
    '全热新风',
    '热水系统',
    '燃气冷凝壁挂炉',
    '零冷水燃气热水器',
    '空气能热水器',
    '容积式燃气热水器',
    '电热水器',
    '采暖热水两联供',
  ],
  rheem: ['中央热水系统', '采暖系统', '全空气系统', '智能控制系统'],
  ruud: ['中央空调', '空气源热泵', '全热新风', '采暖系统'],
};

const MENU_GROUP_LABELS: Record<string, string> = {
  residential: '家用',
  commercial: '商用',
  residential_comfort: '家用舒适系统',
  'residential-comfort': '家用舒适系统',
};

const WRITE_ROLES = new Set(['platform_admin', 'hq_admin', 'brand_admin']);

async function apiProducts() {
  return import('./api').then((api) => api.products);
}

async function apiBrandSites() {
  return import('./api').then((api) => api.brandSites);
}

async function apiFileArtifacts() {
  return import('./api').then((api) => api.fileArtifacts);
}

export function normalizeBrandCode(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveBrandSiteEnvironmentLinks(
  site: Pick<BrandSiteSummary, 'code' | 'developmentUrl' | 'productionUrl'> | null,
  brandCodeInput: string
): BrandSiteEnvironmentLink[] {
  const brandCode = normalizeBrandCode(site?.code || brandCodeInput);
  const fallback = BRAND_SITE_ENVIRONMENT_FALLBACKS[brandCode];
  return [
    {
      key: 'testing',
      label: '测试环境',
      url: normalizeRuntimeUrl(site?.developmentUrl || fallback?.testing || ''),
    },
    {
      key: 'production',
      label: '生产环境',
      url: normalizeRuntimeUrl(site?.productionUrl || fallback?.production || ''),
    },
  ];
}

export async function loadBrandProductConsoleData(
  brandCodeInput: string,
  options: BrandProductQuery = {},
  deps: BrandProductConsoleApiDeps = {}
): Promise<BrandProductConsoleData> {
  const brandCode = normalizeBrandCode(brandCodeInput);
  const query = buildBrandProductListQuery(brandCode, options);
  const apiCalls = [
    '/api/v2/brand-sites',
    '/api/v2/product-catalog/taxonomy',
  ];

  const [products, brandSites] = await Promise.all([
    deps.products ? Promise.resolve(deps.products) : apiProducts(),
    deps.brandSites ? Promise.resolve(deps.brandSites) : apiBrandSites(),
  ]);
  const [siteResult, taxonomy] = await Promise.all([
    brandSites.list().catch(() => ({ items: [] })),
    products.taxonomy().catch(() => ({})),
  ]);

  const sites = getItems(siteResult) as BrandSiteSummary[];
  const site =
    sites
      .filter((item) => !item.deletedAt)
      .find((item) => normalizeBrandCode(item.code) === brandCode) || null;

  if (!site) {
    return {
      brandCode,
      site: null,
      products: [],
      taxonomy,
      total: 0,
      page: Number(query.page),
      pageSize: Number(query.pageSize),
      pages: 0,
      facets: { categories: [], statuses: [] },
      emptyState: {
        kind: 'unknown-brand',
        title: '品牌站点尚未绑定',
        description: '先在品牌官网管理中创建或启用该品牌站点，再维护官网产品内容。',
        actionLabel: '返回品牌官网管理',
        actionHref: '/comfort/sites',
      },
      apiCalls,
    };
  }

  if (brandCode === GROUP_SITE_CODE) {
    const childBrandCodes = childBrandCodesForSite(site);
    const page = Math.max(Number(options.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(options.pageSize) || DEFAULT_PRODUCT_PAGE_SIZE, 1), 100);

    if (!childBrandCodes.length) {
      return {
        brandCode,
        site,
        products: [],
        taxonomy,
        total: 0,
        page,
        pageSize,
        pages: 0,
        facets: { categories: [], statuses: [] },
        emptyState: {
          kind: 'no-products',
          title: '集团站点尚未绑定子品牌',
          description: '请先在子品牌绑定区域选择可加入集团下面的子品牌，再维护集团官网货架产品。',
          actionLabel: '选择子品牌',
          actionHref: '/comfort/sites/rhautt-group',
        },
        apiCalls,
      };
    }

    if (options.deferGroupProducts) {
      return {
        brandCode,
        site,
        products: [],
        taxonomy,
        total: 0,
        page,
        pageSize,
        pages: 0,
        facets: { categories: [], statuses: [] },
        emptyState: null,
        apiCalls,
      };
    }

    const childQueries = childBrandCodes.map((childBrandCode) =>
      buildBrandProductListQuery(childBrandCode, { ...options, page: 1, pageSize: 100 })
    );
    apiCalls.push(...childQueries.map((childQuery) => `/api/v2/product-catalog/devices?${new URLSearchParams(childQuery).toString()}`));
    const productResults = await Promise.all(childQueries.map((childQuery) => products.list(childQuery)));
    const productItems = productResults
      .flatMap((productResult) => getItems(productResult))
      .filter((item) => childBrandCodes.includes(productBrandCode(item)))
      .map((item) => toBrandProductRow(item as Record<string, unknown>, productBrandCode(item)))
      .sort(compareProductRows);
    const pagedProducts = productItems.slice((page - 1) * pageSize, page * pageSize);

    return {
      brandCode,
      site,
      products: pagedProducts,
      taxonomy,
      total: productItems.length,
      page,
      pageSize,
      pages: Math.ceil(productItems.length / pageSize),
      facets: facetsFromProductRows(productItems),
      emptyState: productItems.length
        ? null
        : {
            kind: 'no-products',
            title: '已绑定子品牌暂无产品目录记录',
            description: '当前勾选的子品牌在产品目录中没有匹配产品。请先在产品目录创建或导入对应子品牌产品。',
            actionLabel: '打开产品目录',
            actionHref: '/products?module=catalog',
          },
      apiCalls,
    };
  }

  apiCalls.push(`/api/v2/product-catalog/devices?${new URLSearchParams(query).toString()}`);
  const productResult = await products.list(query);
  const productData = productResultData(productResult);
  const productItems = getItems(productResult)
    .filter((item) => normalizeBrandCode(String((item as any).brand || '')) === brandCode)
    .map((item) => toBrandProductRow(item as Record<string, unknown>, brandCode))
    .sort(compareProductRows);

  return {
    brandCode,
    site,
    products: productItems,
    taxonomy,
    total: Number(productData.total ?? productItems.length),
    page: Number(productData.page ?? query.page),
    pageSize: Number(productData.pageSize ?? query.pageSize),
    pages: Number(productData.pages ?? Math.ceil(Number(productData.total ?? productItems.length) / Number(query.pageSize))),
    facets: normalizeProductFacets(productData.facets),
    emptyState: productItems.length
      ? null
      : {
          kind: 'no-products',
          title: '该品牌还没有产品目录记录',
          description:
            '当前品牌站点已存在，但产品目录没有该品牌的产品。请先在产品目录创建或导入产品，再回到这里维护官网字段。',
          actionLabel: '打开产品目录',
          actionHref: '/products?module=catalog',
        },
    apiCalls,
  };
}

export function buildBrandProductListQuery(
  brandCodeInput: string,
  options: BrandProductQuery = {}
): Record<string, string> {
  const brandCode = normalizeBrandCode(brandCodeInput);
  const page = Math.max(Number(options.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(options.pageSize) || DEFAULT_PRODUCT_PAGE_SIZE, 1), 100);
  const query: Record<string, string> = {
    brand: brandCode,
    page: String(page),
    pageSize: String(pageSize),
  };
  const tenantId = BRAND_PRODUCT_TENANTS[brandCode] || '';
  if (tenantId) query.tenantId = tenantId;
  const keyword = text(options.keyword);
  const status = text(options.status);
  const category = text(options.category);
  const categoryLevel1Id = text(options.categoryLevel1Id);
  const categoryLevel2Id = text(options.categoryLevel2Id);
  const categoryLevel3Id = text(options.categoryLevel3Id);
  if (keyword) query.keyword = keyword;
  if (status) query.status = status;
  if (category) query.category = category;
  if (categoryLevel1Id) query.categoryLevel1Id = categoryLevel1Id;
  if (categoryLevel2Id) query.categoryLevel2Id = categoryLevel2Id;
  if (categoryLevel3Id) query.categoryLevel3Id = categoryLevel3Id;
  return query;
}

export function getBrandMenuGroupOptions(
  brandCodeInput: string,
  currentValue = ''
): BrandMenuGroupOption[] {
  const brandCode = normalizeBrandCode(brandCodeInput);
  const values = [...(BRAND_MENU_GROUP_OPTIONS[brandCode] || BRAND_MENU_GROUP_OPTIONS.rheem)];
  const current = text(currentValue);
  if (current && !values.includes(current)) values.unshift(current);
  return values.map((value) => ({
    value,
    label: value === current && !BRAND_MENU_GROUP_OPTIONS[brandCode]?.includes(value)
      ? `${MENU_GROUP_LABELS[value] || value}（当前值）`
      : MENU_GROUP_LABELS[value] || value,
  }));
}

export function canWriteBrandProducts(session: { role?: string | null; permissions?: string[] | null } | null): boolean {
  if (!session?.role) return false;
  if (session.permissions?.includes('*')) return true;
  return WRITE_ROLES.has(session.role) || Boolean(session.permissions?.includes('product-catalog:write'));
}

export function draftFromProductRow(row: BrandProductRow): BrandProductEditDraft {
  const brandCode = normalizeBrandCode(String(row.raw.brand || ''));
  const brandMeta = objectOrEmpty(objectOrEmpty(row.raw.meta)[brandCode]);
  return {
    publicSlug: row.publicSlug,
    name: row.name,
    model: row.model,
    category: row.category,
    system: row.system,
    websiteMenuCategory: row.websiteMenuCategory,
    sortOrder: String(row.sortOrder || 0),
    series: text(brandMeta.series),
    tagline: text(brandMeta.tagline),
    officialEnglishName: text(brandMeta.en),
    badges: Array.isArray(brandMeta.badges) ? brandMeta.badges.map(text).filter(Boolean).join(', ') : '',
  };
}

export function blankNewProductDraft(brandCodeInput: string): BrandProductEditDraft {
  const brandCode = normalizeBrandCode(brandCodeInput);
  return {
    publicSlug: '',
    name: '',
    model: '',
    category: '',
    system: '',
    websiteMenuCategory: '',
    sortOrder: '0',
    series: '',
    tagline: '',
    officialEnglishName: brandCode.toUpperCase(),
    badges: '',
  };
}

export function isDirtyProductDraft(row: BrandProductRow, draft: BrandProductEditDraft): boolean {
  return JSON.stringify(normalizeDraft(draft)) !== JSON.stringify(normalizeDraft(draftFromProductRow(row)));
}

export function structuredDraftFromProductRow(
  row: BrandProductRow,
  brandCodeInput?: string,
): BrandStructuredContentDraft {
  const brandCode = normalizeBrandCode(brandCodeInput || String(row.raw.brand || ''));
  const brandMeta = objectOrEmpty(objectOrEmpty(row.raw.meta)[brandCode]);
  const positioning = objectOrEmpty(row.raw.positioning);
  return {
    tagline: text(brandMeta.tagline),
    series: text(brandMeta.series),
    officialEnglishName: text(brandMeta.en),
    officialCopy: text(brandMeta.officialCopy || brandMeta.copy),
    websiteTitle: text(brandMeta.websiteTitle || brandMeta.title),
    websiteDescription: text(brandMeta.websiteDescription || brandMeta.description),
    icon: text(brandMeta.icon),
    image: text(brandMeta.image),
    specImage: text(brandMeta.specImage),
    badges: stringArray(brandMeta.badges),
    specs: keyValueRows(brandMeta.specs, 'key', 'value'),
    features: featureRows(brandMeta.features),
    highlights: keyValueRows(brandMeta.highlights, 'label', 'value'),
    certs: stringArray(brandMeta.certs || brandMeta.certificates),
    faqs: faqRows(brandMeta.faqs || brandMeta.faq),
    gallery: galleryRows(brandMeta.gallery),
    positioning: {
      targetSegments: stringArray(positioning.targetSegments),
      channels: stringArray(positioning.channels),
      userPersonas: stringArray(positioning.userPersonas),
      markets: stringArray(positioning.markets),
      applicationScenarios: stringArray(positioning.applicationScenarios),
    },
  };
}

export function isDirtyStructuredContentDraft(
  row: BrandProductRow,
  brandCode: string,
  draft: BrandStructuredContentDraft,
): boolean {
  return (
    JSON.stringify(normalizeStructuredDraft(draft)) !==
    JSON.stringify(normalizeStructuredDraft(structuredDraftFromProductRow(row, brandCode)))
  );
}

export function buildBrandStructuredContentUpdatePayload(
  brandCodeInput: string,
  row: BrandProductRow,
  draft: BrandStructuredContentDraft,
): Record<string, unknown> {
  const brandCode = normalizeBrandCode(brandCodeInput);
  const rawMeta = objectOrEmpty(row.raw.meta);
  const previousBrandMeta = objectOrEmpty(rawMeta[brandCode]);
  const previousPositioning = objectOrEmpty(row.raw.positioning);
  const normalized = normalizeStructuredDraft(draft);

  return {
    ...tenantPatch(row),
    meta: {
      ...rawMeta,
      [brandCode]: {
        ...previousBrandMeta,
        tagline: normalized.tagline,
        series: normalized.series,
        en: normalized.officialEnglishName,
        officialCopy: normalized.officialCopy,
        websiteTitle: normalized.websiteTitle,
        websiteDescription: normalized.websiteDescription,
        icon: normalized.icon,
        image: normalized.image,
        specImage: normalized.specImage,
        badges: normalized.badges,
        specs: mergeKeyValueShape(previousBrandMeta.specs, normalized.specs, 'k', 'v'),
        features: normalized.features,
        highlights: mergeKeyValueShape(previousBrandMeta.highlights, normalized.highlights, 'label', 'value'),
        certs: normalized.certs,
        faqs: normalized.faqs,
        gallery: normalized.gallery,
      },
    },
    positioning: {
      ...previousPositioning,
      targetSegments: normalized.positioning.targetSegments,
      channels: normalized.positioning.channels,
      userPersonas: normalized.positioning.userPersonas,
      markets: normalized.positioning.markets,
      applicationScenarios: normalized.positioning.applicationScenarios,
    },
  };
}

export function buildBrandProductUpdatePayload(
  brandCodeInput: string,
  row: BrandProductRow,
  draft: BrandProductEditDraft,
): Record<string, unknown> {
  const brandCode = normalizeBrandCode(brandCodeInput);
  const rawMeta = objectOrEmpty(row.raw.meta);
  const rawSpec = objectOrEmpty(row.raw.spec);
  const previousBrandMeta = objectOrEmpty(rawMeta[brandCode]);
  const normalized = normalizeDraft(draft);

  return {
    tenantId: text(row.raw.tenantId),
    name: normalized.name,
    category: normalized.category,
    spec: {
      ...rawSpec,
      officialModel: normalized.model,
      model: normalized.model,
      system: normalized.system,
    },
    meta: {
      ...rawMeta,
      [brandCode]: {
        ...previousBrandMeta,
        slug: normalized.publicSlug,
        name: normalized.name,
        model: normalized.model,
        cat: normalized.websiteMenuCategory || normalized.category,
        websiteMenuCategory: normalized.websiteMenuCategory,
        sys: normalized.system,
        displayOrder: normalized.sortOrder,
        sortOrder: normalized.sortOrder,
        series: normalized.series,
        tagline: normalized.tagline,
        en: normalized.officialEnglishName,
        badges: normalized.badges,
      },
    },
  };
}

export function buildNewBrandProductPayload(
  brandCodeInput: string,
  draft: BrandProductEditDraft,
): Record<string, unknown> {
  const brandCode = normalizeBrandCode(brandCodeInput);
  const normalized = normalizeDraft(draft);
  const sku = skeletonSku(brandCode, normalized.model || normalized.publicSlug || normalized.name);
  const tenantId = BRAND_PRODUCT_TENANTS[brandCode] || '';
  return {
    ...(tenantId ? { tenantId } : {}),
    sku,
    name: normalized.name || normalized.model || sku,
    brand: brandCode,
    category: normalized.category,
    status: 'inactive',
    spec: {
      officialModel: normalized.model || sku,
      model: normalized.model || sku,
      system: normalized.system,
    },
    meta: {
      [brandCode]: {
        slug: normalized.publicSlug || slug(sku),
        name: normalized.name || normalized.model || sku,
        model: normalized.model || sku,
        cat: normalized.websiteMenuCategory || normalized.category,
        websiteMenuCategory: normalized.websiteMenuCategory,
        sys: normalized.system,
        displayOrder: normalized.sortOrder,
        sortOrder: normalized.sortOrder,
        series: normalized.series,
        tagline: normalized.tagline,
        en: normalized.officialEnglishName,
        badges: normalized.badges,
        specs: [],
        features: [],
        highlights: [],
      },
    },
  };
}

export async function saveBrandProductRow(
  brandCode: string,
  row: BrandProductRow,
  draft: BrandProductEditDraft,
) {
  const products = await apiProducts();
  return products.update(row.id, buildBrandProductUpdatePayload(brandCode, row, draft));
}

export async function saveBrandStructuredContent(
  brandCode: string,
  row: BrandProductRow,
  draft: BrandStructuredContentDraft,
) {
  const products = await apiProducts();
  return products.update(row.id, buildBrandStructuredContentUpdatePayload(brandCode, row, draft));
}

export async function createBrandProduct(
  brandCode: string,
  draft: BrandProductEditDraft,
) {
  const products = await apiProducts();
  return products.create(buildNewBrandProductPayload(brandCode, draft));
}

export async function uploadBrandProductMainImage(
  brandCodeInput: string,
  row: BrandProductRow,
  file: File,
) {
  assertBrandProductScope(brandCodeInput, row);
  if (!file.type.startsWith('image/')) throw new Error('只能上传图片文件。');

  const [products, fileArtifacts] = await Promise.all([apiProducts(), apiFileArtifacts()]);
  const artifact = await fileArtifacts.uploadBase64({
    entityType: 'product-image',
    entityId: row.sku || row.id,
    filename: file.name || `${row.sku || row.id}.jpg`,
    mimeType: file.type || 'application/octet-stream',
    dataBase64: await readFileBase64(file),
  });
  const artifactId = text((artifact as any)?.id || (artifact as any)?.artifactId);
  if (!artifactId) throw new Error('文件上传未返回素材 ID。');

  const brandCode = normalizeBrandCode(brandCodeInput);
  const rawMeta = objectOrEmpty(row.raw.meta);
  const previousBrandMeta = objectOrEmpty(rawMeta[brandCode]);
  const nextRef: AssetRef = {
    role: 'main',
    artifactId,
    objectKey: text((artifact as any)?.fileKey || (artifact as any)?.objectKey),
    filename: text((artifact as any)?.originalName) || file.name || `${row.sku || row.id}.jpg`,
    mimeType: text((artifact as any)?.mimeType) || file.type || 'application/octet-stream',
    sortOrder: 0,
    url: text((artifact as any)?.contentUrl) || artifactContentUrl(artifactId),
  };

  return products.update(row.id, {
    ...tenantPatch(row),
    assetRefs: [
      ...assetRefsFromRaw(row.raw).filter((ref) => ref.role !== 'main' && ref.role !== 'card'),
      nextRef,
    ],
    meta: {
      ...rawMeta,
      imageArtifactId: nextRef.artifactId,
      imageObjectKey: nextRef.objectKey,
      imageMimeType: nextRef.mimeType,
      imageFilename: nextRef.filename,
      imageRole: 'main',
      imageOwned: true,
      [brandCode]: {
        ...previousBrandMeta,
        imageArtifactId: nextRef.artifactId,
        imageObjectKey: nextRef.objectKey,
        imageMimeType: nextRef.mimeType,
        imageFilename: nextRef.filename,
      },
    },
  });
}

export async function deleteBrandProductMainImage(
  brandCodeInput: string,
  row: BrandProductRow,
) {
  assertBrandProductScope(brandCodeInput, row);
  const artifactId = row.imageState.mainArtifactId;
  if (!artifactId) throw new Error('当前产品没有可删除的主图素材。');
  const [products, fileArtifacts] = await Promise.all([apiProducts(), apiFileArtifacts()]);

  const brandCode = normalizeBrandCode(brandCodeInput);
  const rawMeta = objectOrEmpty(row.raw.meta);
  const previousBrandMeta = objectOrEmpty(rawMeta[brandCode]);
  const nextBrandMeta = { ...previousBrandMeta };
  delete nextBrandMeta.imageArtifactId;
  delete nextBrandMeta.imageObjectKey;
  delete nextBrandMeta.imageMimeType;
  delete nextBrandMeta.imageFilename;

  const nextMeta = {
    ...rawMeta,
    [brandCode]: nextBrandMeta,
  };
  if (text(nextMeta.imageArtifactId) === artifactId) {
    delete nextMeta.imageArtifactId;
    delete nextMeta.imageObjectKey;
    delete nextMeta.imageMimeType;
    delete nextMeta.imageFilename;
    delete nextMeta.imageRole;
    delete nextMeta.imageOwned;
  }

  await products.update(row.id, {
    ...tenantPatch(row),
    assetRefs: assetRefsFromRaw(row.raw).filter(
      (ref) => !(ref.artifactId === artifactId && (ref.role === 'main' || ref.role === 'card'))
    ),
    meta: nextMeta,
  });
  return fileArtifacts.remove(artifactId);
}

export async function uploadBrandProductDetailImage(
  brandCodeInput: string,
  row: BrandProductRow,
  file: File,
) {
  assertBrandProductScope(brandCodeInput, row);
  if (!file.type.startsWith('image/')) throw new Error('只能上传图片文件。');

  const [products, fileArtifacts] = await Promise.all([apiProducts(), apiFileArtifacts()]);
  const artifact = await fileArtifacts.uploadBase64({
    entityType: 'product-detail-image',
    entityId: row.sku || row.id,
    filename: file.name || `${row.sku || row.id}-detail.jpg`,
    mimeType: file.type || 'application/octet-stream',
    dataBase64: await readFileBase64(file),
  });
  const artifactId = text((artifact as any)?.id || (artifact as any)?.artifactId);
  if (!artifactId) throw new Error('文件上传未返回素材 ID。');

  const refs = assetRefsFromRaw(row.raw);
  const detailRefs = refs.filter((ref) => ref.role === 'detail');
  const nextRef: AssetRef = {
    role: 'detail',
    artifactId,
    objectKey: text((artifact as any)?.fileKey || (artifact as any)?.objectKey),
    filename: text((artifact as any)?.originalName) || file.name || `${row.sku || row.id}-detail.jpg`,
    mimeType: text((artifact as any)?.mimeType) || file.type || 'application/octet-stream',
    sortOrder: detailRefs.length,
    url: text((artifact as any)?.contentUrl) || artifactContentUrl(artifactId),
  };

  return products.update(row.id, {
    ...tenantPatch(row),
    assetRefs: [...refs, nextRef],
  });
}

export async function deleteBrandProductDetailImage(
  brandCodeInput: string,
  row: BrandProductRow,
  artifactId: string,
) {
  assertBrandProductScope(brandCodeInput, row);
  const targetId = text(artifactId);
  if (!targetId) throw new Error('缺少详情图素材 ID。');
  const [products, fileArtifacts] = await Promise.all([apiProducts(), apiFileArtifacts()]);
  const nextRefs = assetRefsFromRaw(row.raw)
    .filter((ref) => !(ref.role === 'detail' && ref.artifactId === targetId))
    .map((ref, index) => ref.role === 'detail' ? { ...ref, sortOrder: index } : ref);
  await products.update(row.id, {
    ...tenantPatch(row),
    assetRefs: nextRefs,
  });
  return fileArtifacts.remove(targetId);
}

export async function reorderBrandProductDetailImages(
  brandCodeInput: string,
  row: BrandProductRow,
  orderedArtifactIds: string[],
) {
  assertBrandProductScope(brandCodeInput, row);
  const order = new Map(orderedArtifactIds.map((id, index) => [id, index]));
  const nextAssetRefs = assetRefsFromRaw(row.raw).map((ref) =>
    ref.role === 'detail' && order.has(ref.artifactId)
      ? { ...ref, sortOrder: order.get(ref.artifactId) }
      : ref
  );
  const products = await apiProducts();
  return products.update(row.id, {
    ...tenantPatch(row),
    assetRefs: nextAssetRefs,
  });
}

export async function updateBrandProductStatus(
  row: BrandProductRow,
  status: 'active' | 'inactive',
) {
  const tenantId = text(row.raw.tenantId);
  const products = await apiProducts();
  return products.update(row.id, { status, ...(tenantId ? { tenantId } : {}) });
}

export async function archiveBrandProduct(row: BrandProductRow) {
  const products = await apiProducts();
  return products.archive(row.id, text(row.raw.tenantId) || undefined);
}

function getItems(payload: unknown): unknown[] {
  const data = (payload as any)?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.devices)) return data.devices;
  return [];
}

function productResultData(payload: unknown): Record<string, any> {
  const data = (payload as any)?.data ?? payload;
  return data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, any> : {};
}

function normalizeProductFacets(value: unknown): BrandProductFacets {
  const facets = objectOrEmpty(value);
  return {
    categories: facetItems(facets.categories),
    statuses: facetItems(facets.statuses),
  };
}

function childBrandCodesForSite(site: BrandSiteSummary): string[] {
  if (!Array.isArray(site.childBrandCodes)) return [];
  return [...new Set(site.childBrandCodes.map((code) => normalizeBrandCode(code)).filter((code) => code && code !== GROUP_SITE_CODE))];
}

function productBrandCode(product: unknown): string {
  return normalizeBrandCode(String((product as any)?.brand || ''));
}

function compareProductRows(left: BrandProductRow, right: BrandProductRow): number {
  const byBrand = String(left.raw.brand || '').localeCompare(String(right.raw.brand || ''));
  if (byBrand) return byBrand;
  const bySort = left.sortOrder - right.sortOrder;
  if (bySort) return bySort;
  return left.name.localeCompare(right.name) || left.sku.localeCompare(right.sku);
}

function facetsFromProductRows(rows: BrandProductRow[]): BrandProductFacets {
  return {
    categories: countedFacet(rows.map((row) => row.category)),
    statuses: countedFacet(rows.map((row) => row.status)),
  };
}

function countedFacet(values: string[]): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values.map(text).filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => left.value.localeCompare(right.value));
}

function facetItems(value: unknown): Array<{ value: string; count: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = objectOrEmpty(item);
      return { value: text(record.value), count: Number(record.count) || 0 };
    })
    .filter((item) => item.value);
}

function toBrandProductRow(product: Record<string, unknown>, brandCode: string): BrandProductRow {
  const spec = objectOrEmpty(product.spec);
  const meta = objectOrEmpty(product.meta);
  const brandMeta = objectOrEmpty(meta[brandCode]);
  const assetRefs = assetRefsFromRaw(product);
  const mainAsset =
    assetRefs.find((item) => item?.role === 'main') ||
    assetRefs.find((item) => item?.role === 'card');
  const detailRefs = assetRefs
    .filter((item) => item?.role === 'detail')
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  const galleryCount =
    detailRefs.length + arrayLength(brandMeta.gallery);
  const mainArtifactId =
    text(mainAsset?.artifactId) || text(meta.imageArtifactId) || text(brandMeta.imageArtifactId);
  const mainImageUrl =
    text(mainAsset?.url) || text(brandMeta.image) || text(meta.imageUrl) || artifactContentUrl(mainArtifactId);
  const publicSlug = slug(text(brandMeta.slug) || text(meta.publicSlug) || text(product.sku));
  const websiteMenuCategory =
    text(brandMeta.cat) ||
    text(brandMeta.websiteMenuCategory) ||
    text(brandMeta.menuCategory) ||
    text(product.category);
  const model =
    text(brandMeta.model) ||
    text(spec.officialModel) ||
    text(spec.model) ||
    text(product.model) ||
    text(product.sku);
  const name = text(brandMeta.name) || text(product.name) || model || text(product.sku);
  const category = text(product.category) || text(brandMeta.cat);
  const rootCategoryLevel1Id = text(product.categoryLevel1Id);
  const rootCategoryLevel2Id = text(product.categoryLevel2Id);
  const rootCategoryLevel3Id = text(product.categoryLevel3Id);
  const categoryLevel1Id = text(brandMeta.categoryLevel1Id) || rootCategoryLevel1Id || null;
  const categoryLevel2Id = text(brandMeta.categoryLevel2Id) || rootCategoryLevel2Id || null;
  const categoryLevel3Id = text(brandMeta.categoryLevel3Id) || rootCategoryLevel3Id || null;
  const categoryPath = text(product.categoryPath) || text(brandMeta.categoryPath);
  const materialCode = text(spec.materialCode) || text(product.sku);
  const materialCategory = text(spec.materialCategory) || text(brandMeta.materialCategory);
  const productLine = text(spec.productLine) || text(brandMeta.productLine);
  const positioning = objectOrEmpty(product.positioning);
  const applicationScenarios = stringArray(positioning.applicationScenarios);
  const system = text(brandMeta.sys) || text(spec.system) || text(product.systemFamily);
  const sortOrder = nonNegativeInt(
    brandMeta.displayOrder ?? brandMeta.sortOrder ?? product.sortOrder
  );
  const status = text(product.status) || 'draft';
  const imageState = {
    hasMainImage: Boolean(mainImageUrl || mainArtifactId),
    mainImageUrl,
    mainArtifactId,
    mainRef: mainAsset || null,
    detailRefs,
    galleryCount,
    label: mainImageUrl || mainArtifactId ? `主图已绑定 · 详情图 ${galleryCount}` : '缺少主图',
  };
  const metadataReadiness = readiness({
    publicSlug,
    websiteMenuCategory,
    system,
    imageState,
    specs: brandMeta.specs,
    features: brandMeta.features,
    highlights: brandMeta.highlights,
    positioning: product.positioning,
  });

  return {
    id: text(product.id) || text(product._id) || text(product.sku),
    sku: text(product.sku),
    materialCode,
    publicSlug,
    name,
    model,
    category,
    materialCategory,
    productLine,
    categoryLevel1Id,
    categoryLevel2Id,
    categoryLevel3Id,
    categoryPath,
    applicationScenarios,
    system,
    websiteMenuCategory,
    status,
    sortOrder,
    imageState,
    metadataReadiness,
    raw: product,
  };
}

function readiness(input: {
  publicSlug: string;
  websiteMenuCategory: string;
  system: string;
  imageState: BrandProductRow['imageState'];
  specs: unknown;
  features: unknown;
  highlights: unknown;
  positioning: unknown;
}): BrandProductRow['metadataReadiness'] {
  const checks = [
    ['公开 Slug', Boolean(input.publicSlug)],
    ['官网菜单分类', Boolean(input.websiteMenuCategory)],
    ['系统', Boolean(input.system)],
    ['主图', input.imageState.hasMainImage],
    ['规格', arrayLength(input.specs) > 0],
    ['功能卖点', arrayLength(input.features) > 0],
    ['亮点', arrayLength(input.highlights) > 0],
    ['定位词表', hasPositioning(input.positioning)],
  ] as const;
  const missing = checks.filter(([, ok]) => !ok).map(([label]) => label);
  const score = Math.round(((checks.length - missing.length) / checks.length) * 100);
  return { ready: missing.length === 0, score, missing };
}

function hasPositioning(value: unknown): boolean {
  const positioning = objectOrEmpty(value);
  return ['targetSegments', 'channels', 'userPersonas', 'markets', 'applicationScenarios'].some(
    (key) => arrayLength(positioning[key]) > 0
  );
}

function objectOrEmpty(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function assetRefsFromRaw(product: Record<string, unknown>): AssetRef[] {
  if (!Array.isArray(product.assetRefs)) return [];
  return product.assetRefs
    .filter((ref): ref is AssetRef => Boolean(ref && typeof ref === 'object' && text((ref as any).artifactId)))
    .map((ref: any) => ({
      role: text(ref.role),
      artifactId: text(ref.artifactId),
      objectKey: text(ref.objectKey),
      filename: text(ref.filename),
      mimeType: text(ref.mimeType),
      sortOrder: Number.isFinite(Number(ref.sortOrder)) ? Number(ref.sortOrder) : undefined,
      url: text(ref.url) || artifactContentUrl(text(ref.artifactId)),
    }));
}

function artifactContentUrl(artifactId: string) {
  const id = text(artifactId);
  return id ? `/api/v2/file-artifact/${encodeURIComponent(id)}/content` : '';
}

function tenantPatch(row: BrandProductRow): Record<string, string> {
  const tenantId = text(row.raw.tenantId);
  return tenantId ? { tenantId } : {};
}

function assertBrandProductScope(brandCodeInput: string, row: BrandProductRow) {
  const selectedBrand = normalizeBrandCode(brandCodeInput);
  const rowBrand = normalizeBrandCode(String(row.raw.brand || ''));
  if (!selectedBrand || !rowBrand || selectedBrand !== rowBrand) {
    throw new Error('Product image operation is outside the selected brand scope.');
  }
}

function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',').pop() || '' : value);
    };
    reader.onerror = () => reject(reader.error || new Error('Image file could not be read.'));
    reader.readAsDataURL(file);
  });
}

function normalizeDraft(draft: BrandProductEditDraft) {
  return {
    publicSlug: slug(draft.publicSlug),
    name: text(draft.name),
    model: text(draft.model),
    category: text(draft.category),
    system: text(draft.system),
    websiteMenuCategory: text(draft.websiteMenuCategory),
    sortOrder: nonNegativeInt(draft.sortOrder),
    series: text(draft.series),
    tagline: text(draft.tagline),
    officialEnglishName: text(draft.officialEnglishName),
    badges: splitBadges(draft.badges),
  };
}

function normalizeStructuredDraft(draft: BrandStructuredContentDraft): BrandStructuredContentDraft {
  return {
    tagline: text(draft.tagline),
    series: text(draft.series),
    officialEnglishName: text(draft.officialEnglishName),
    officialCopy: text(draft.officialCopy),
    websiteTitle: text(draft.websiteTitle),
    websiteDescription: text(draft.websiteDescription),
    icon: text(draft.icon),
    image: text(draft.image),
    specImage: text(draft.specImage),
    badges: normalizeStringList(draft.badges),
    specs: normalizeKeyValueList(draft.specs),
    features: (draft.features || [])
      .map((item) => ({
        title: text(item.title),
        description: text(item.description),
      }))
      .filter((item) => item.title || item.description),
    highlights: normalizeKeyValueList(draft.highlights),
    certs: normalizeStringList(draft.certs),
    faqs: (draft.faqs || [])
      .map((item) => ({
        question: text(item.question),
        answer: text(item.answer),
      }))
      .filter((item) => item.question || item.answer),
    gallery: (draft.gallery || [])
      .map((item) => ({
        url: text(item.url),
        alt: text(item.alt),
      }))
      .filter((item) => item.url || item.alt),
    positioning: {
      targetSegments: normalizeStringList(draft.positioning?.targetSegments),
      channels: normalizeStringList(draft.positioning?.channels),
      userPersonas: normalizeStringList(draft.positioning?.userPersonas),
      markets: normalizeStringList(draft.positioning?.markets),
      applicationScenarios: normalizeStringList(draft.positioning?.applicationScenarios),
    },
  };
}

function normalizeStringList(values: unknown): string[] {
  return stringArray(values).map(text).filter(Boolean);
}

function normalizeKeyValueList(values: BrandContentKeyValueDraft[]): BrandContentKeyValueDraft[] {
  return (values || [])
    .map((item) => ({ key: text(item.key), value: text(item.value) }))
    .filter((item) => item.key || item.value);
}

function mergeKeyValueShape(
  previous: unknown,
  rows: BrandContentKeyValueDraft[],
  keyName: string,
  valueName: string,
): unknown {
  if (previous && typeof previous === 'object' && !Array.isArray(previous)) {
    return rows.reduce<Record<string, string>>((next, row) => {
      if (row.key) next[row.key] = row.value;
      return next;
    }, {});
  }
  return rows.map((row) => ({ [keyName]: row.key, [valueName]: row.value }));
}

function splitBadges(value: string): string[] {
  return value
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function normalizeRuntimeUrl(value: unknown): string {
  const url = text(value);
  if (!url) return '';
  return /\/$/.test(url) ? url : `${url}/`;
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function nonNegativeInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function skeletonSku(brandCode: string, seed: string): string {
  const suffix = slug(seed) || String(Date.now());
  return `${brandCode.toUpperCase()}-${suffix.toUpperCase()}`;
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (typeof value === 'string') return splitBadges(value);
  return [];
}

function keyValueRows(value: unknown, keyName: string, valueName: string): BrandContentKeyValueDraft[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const entry = objectOrEmpty(item);
        return {
          key: text(entry.k || entry.key || entry.label || entry.name || entry.title || entry[keyName]),
          value: text(entry.v || entry.value || entry.desc || entry.description || entry[valueName]),
        };
      })
      .filter((item) => item.key || item.value);
  }
  const objectValue = objectOrEmpty(value);
  return Object.entries(objectValue)
    .map(([key, itemValue]) => ({ key: text(key), value: text(itemValue) }))
    .filter((item) => item.key || item.value);
}

function featureRows(value: unknown): BrandContentFeatureDraft[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const entry = objectOrEmpty(item);
      return {
        title: text(entry.title || entry.name),
        description: text(entry.description || entry.desc || entry.text),
      };
    })
    .filter((item) => item.title || item.description);
}

function faqRows(value: unknown): BrandContentFaqDraft[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const entry = objectOrEmpty(item);
      return {
        question: text(entry.question || entry.q),
        answer: text(entry.answer || entry.a),
      };
    })
    .filter((item) => item.question || item.answer);
}

function galleryRows(value: unknown): BrandContentGalleryDraft[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return { url: item.trim(), alt: '' };
      const entry = objectOrEmpty(item);
      return {
        url: text(entry.url || entry.src || entry.href),
        alt: text(entry.alt || entry.title || entry.caption),
      };
    })
    .filter((item) => item.url || item.alt);
}
