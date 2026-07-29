'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  Archive,
  ArrowDownCircle,
  ArrowUpCircle,
  Bold,
  ChevronDown,
  Check,
  ExternalLink,
  EyeOff,
  Heading2,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Loader2,
  Pencil,
  Plus,
  PackagePlus,
  RefreshCw,
  Rocket,
  Rows3,
  Save,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { PageHeader } from '@rhautt/ui';
import { auth, brandProductCategories, brandSites, fileArtifacts, products, siteMaterials, siteNews, siteProductAssignments } from '../../../lib/api';
import {
  archiveBrandProduct,
  blankNewProductDraft,
  createBrandProduct,
  deleteBrandProductDetailImage,
  deleteBrandProductMainImage,
  draftFromProductRow,
  getBrandProductPermissions,
  getBrandMenuGroupOptions,
  isDirtyStructuredContentDraft,
  isDirtyProductDraft,
  loadBrandProductConsoleData,
  normalizeBrandCode,
  reorderBrandProductDetailImages,
  resolveBrandSiteEnvironmentLinks,
  saveBrandProductRow,
  saveBrandStructuredContent,
  structuredDraftFromProductRow,
  uploadBrandProductMainImage,
  uploadBrandProductDetailImage,
  updateBrandProductStatus,
  type BrandStructuredContentDraft,
  type BrandProductEditDraft,
  type BrandProductConsoleData,
  type BrandProductQuery,
  type BrandProductRow,
  type BrandPublishCapability,
  type BrandMenuGroupOption,
  type BrandProductPermissions,
} from '../../../lib/brand-product-adapter';
import {
  StatusPill,
  WorkbenchFilterToolbar,
  WorkbenchPaginationFooter,
  WorkbenchTableShell,
  WorkbenchTableState,
} from '../../../components/WorkbenchCore';

type SiteStatus = 'active' | 'inactive';
type DeliveryType = 'self_hosted' | 'external';
type ContentTab = 'products' | 'materials' | 'news';
type TaxonomyOption = { code: string; label: string };
type AssignmentStatus = 'draft' | 'published' | 'hidden';
type WebsiteShelfTransition = 'publishing' | 'hiding';
type WebsiteShelfFilter = 'all' | 'published' | 'unpublished';
type ImageActionFeedback = { tone: 'pending' | 'success' | 'error'; text: string };
type CategoryFilterLevel = 1 | 2 | 3;
type ProductManualPdfDraft = {
  id: string;
  file?: File;
  artifactId?: string;
  objectKey?: string;
  name: string;
  mimeType?: string;
  previewUrl: string;
  saved?: boolean;
  sortOrder?: number;
};
const EMPTY_BRAND_PRODUCT_PERMISSIONS: BrandProductPermissions = {
  canCreateProduct: false,
  canUpdateProduct: false,
  canDeleteProduct: false,
  canPublishProduct: false,
  canCreateBrandLibrary: false,
  canUpdateBrandLibrary: false,
  canDeleteBrandLibrary: false,
  canPublishBrandLibrary: false,
  canAnyProductWrite: false,
  canAnyBrandWrite: false,
  canAnyWrite: false,
};
type ProductCategoryFilterNode = {
  id: string;
  parentId: string | null;
  level: CategoryFilterLevel;
  code: string;
  name: string;
  sortOrder: number;
  status: string;
  children: ProductCategoryFilterNode[];
};
type ProductCategoryFilterOption = {
  value: string;
  label: string;
  level: CategoryFilterLevel;
  pathCodes?: string[];
};

type BrandSite = {
  id: string;
  code: string;
  nameCn: string;
  nameEn: string;
  appKey: string | null;
  deliveryType: DeliveryType;
  developmentUrl: string | null;
  productionUrl: string | null;
  resolvedUrl: string | null;
  resolvedEnvironment: string;
  logoArtifactId?: string | null;
  sortOrder: number;
  status: SiteStatus;
  siteNote: string | null;
  childBrandCodes?: string[];
  deletedAt: string | null;
  updatedAt: string | null;
  publishCapability?: BrandPublishCapability;
};

type WebsiteShelfAssignment = {
  id: string;
  productTenantId: string;
  productId: string;
  publicSlug: string;
  websiteCategory: string | null;
  menuGroup: string | null;
  displayOrder: number;
  isFeatured: boolean;
  status: AssignmentStatus;
  siteTitle: string | null;
  siteSummary: string | null;
  deletedAt?: string | null;
};

const KNOWN_BRANDS: Record<string, Pick<BrandSite, 'code' | 'nameCn' | 'nameEn' | 'appKey' | 'sortOrder'>> = {
  rheem: { code: 'rheem', nameCn: '瑞美', nameEn: 'Rheem', appKey: 'rheem-cn', sortOrder: 10 },
  ruud: { code: 'ruud', nameCn: '瑞德', nameEn: 'Ruud', appKey: 'ruud-cn', sortOrder: 20 },
  everhot: { code: 'everhot', nameCn: '恒热', nameEn: 'Everhot', appKey: 'everhot-cn', sortOrder: 30 },
};

const GROUP_SITE_CODE = 'rhautt-group';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PRODUCT_COLUMNS = [
  '产品',
  '产品型号',
  '分类',
  '图片',
  '排序',
  '操作',
];

const PRODUCT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const CATEGORY_FILTER_LOAD_PAGE_SIZE = 100;
const PRODUCT_TABLE_COLUMNS = [
  '',
  '\u4ea7\u54c1\u5206\u7c7b',
  '\u4ea7\u54c1',
  '\u4ea7\u54c1\u578b\u53f7',
  '\u56fe\u7247',
  '\u6392\u5e8f',
  '\u5b98\u7f51\u72b6\u6001',
  '\u64cd\u4f5c',
];

const PRODUCT_CATEGORY_SELECT_OPTIONS: BrandMenuGroupOption[] = [
  { value: 'residential', label: '\u5bb6\u7528' },
  { value: 'commercial', label: '\u5546\u7528' },
  { value: 'heat_pump', label: '\u70ed\u6cf5' },
  { value: 'water_heater', label: '\u70ed\u6c34\u5668' },
  { value: 'heating_boiler', label: '\u91c7\u6696\u9505\u7089' },
  { value: 'residential_comfort', label: '\u5bb6\u7528\u8212\u9002\u7cfb\u7edf' },
];

const PRODUCT_SYSTEM_SELECT_OPTIONS: BrandMenuGroupOption[] = [
  { value: 'water-heating', label: '\u70ed\u6c34\u7cfb\u7edf' },
  { value: 'heating-cooling', label: '\u91c7\u6696\u4e0e\u5236\u51b7' },
  { value: 'heat-pump', label: '\u70ed\u6cf5\u7cfb\u7edf' },
  { value: 'fresh-air', label: '\u65b0\u98ce\u7cfb\u7edf' },
  { value: 'central-air', label: '\u4e2d\u592e\u7a7a\u8c03' },
  { value: 'smart-control', label: '\u667a\u63a7\u7cfb\u7edf' },
];

const UNSUPPORTED_PUBLISH: BrandPublishCapability = {
  supported: false,
  mode: 'unsupported',
  label: '暂不支持发布',
  reason: '该品牌尚未配置服务端静态备份流程',
};

const TAXONOMY_LABELS: Record<string, string> = {
  home: '家庭',
  villa: '别墅',
  commercial: '商用',
  project: '工程项目',
  dealer: '经销商',
  ecommerce: '电商',
  direct: '直营',
  premium_upgrade: '高端改善',
  essential: '刚需',
  retrofit: '存量改造',
  new_build: '新装',
  east_villa: '华东别墅',
  south_humid: '南方潮湿区',
  north_heating: '北方采暖区',
  tier1_city: '一线城市',
  res_new_decoration: '新房精装',
  res_villa: '别墅大宅',
  res_retrofit: '旧房改造',
  res_apartment: '公寓刚需',
  com_office: '办公写字楼',
  com_hospitality: '酒店/民宿',
  com_public: '学校/医院/公建',
  com_retail: '商业综合体/门店',
  com_industrial: '工业厂房/园区',
};

const MOCK_SITE_MATERIALS = [
  {
    key: 'home-hero',
    recommendedSize: '1660 x 550 px',
    name: '首页 Hero 主视觉',
    type: '图片 / 标题文案',
    location: '首页首屏',
    status: '模拟数据',
    note: '展示官网首页主图、标题和行动入口的占位流程。',
  },
  {
    key: 'brand-story',
    recommendedSize: '940 x 900 px',
    name: '品牌故事图文',
    type: '图文模块',
    location: '品牌介绍',
    status: '模拟数据',
    note: '用于模拟品牌故事图片、段落摘要和官网落点。',
  },
  {
    key: 'service-banner',
    recommendedSize: '940 x 900 px',
    name: '服务入口 Banner',
    type: '图片 / 链接',
    location: '服务与支持',
    status: '模拟数据',
    note: '用于模拟售后服务、保修注册和支持入口素材。',
  },
  {
    key: 'footer-cert',
    recommendedSize: '940 x 900 px',
    name: '页脚资质素材',
    type: '证书 / Logo',
    location: '全站页脚',
    status: '模拟数据',
    note: '用于模拟备案、授权、认证和 Powered by Rysnova 信息。',
  },
];

function statusMeta(site: BrandSite) {
  if (site.deletedAt) return { label: '已归档', className: 'badge-grey' };
  if (site.status === 'active') return { label: '启用中', className: 'badge-success' };
  return { label: '已停用', className: 'badge-warning' };
}

function fallbackSite(code: string): BrandSite {
  const preset = KNOWN_BRANDS[code];
  return {
    id: `synthetic-${code}`,
    code,
    nameCn: preset?.nameCn || code.toUpperCase(),
    nameEn: preset?.nameEn || code,
    appKey: preset?.appKey || null,
    deliveryType: 'self_hosted',
    developmentUrl: null,
    productionUrl: null,
    resolvedUrl: null,
    resolvedEnvironment: 'unbound',
    sortOrder: preset?.sortOrder || 0,
    status: 'inactive',
    siteNote: '当前代码尚未绑定启用中的品牌官网主数据。',
    deletedAt: null,
    updatedAt: null,
  };
}

function assignmentItems(payload: unknown): WebsiteShelfAssignment[] {
  const data = (payload as any)?.data ?? payload;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function slugValue(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizedChildBrandCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => normalizeBrandCode(String(item || ''))).filter((code) => code && code !== GROUP_SITE_CODE))];
}

function childBrandLabel(site: BrandSite) {
  return `${site.nameCn || site.nameEn || site.code} ${site.nameEn || ''}`.trim();
}

function fallbackBrandLogoSrc(codeInput: string) {
  const code = normalizeBrandCode(codeInput);
  if (code === 'everhot') {
    return '/images/brand/everhot-logo.png';
  }
  return '';
}

async function loadBrandSiteLogo(siteId: string, signal: AbortSignal) {
  return brandSites.logo(siteId, { signal }) as Promise<{ mimeType?: string; dataBase64?: string }>;
}

async function loadShelfFilterProductRows(
  brandCode: string,
  query: BrandProductQuery,
  currentData: BrandProductConsoleData,
  deferGroupProducts: boolean
) {
  if (deferGroupProducts) return currentData.products;
  const firstPageQuery = { ...query, page: 1, pageSize: CATEGORY_FILTER_LOAD_PAGE_SIZE };
  const firstPageData =
    currentData.page === 1 && currentData.pageSize === CATEGORY_FILTER_LOAD_PAGE_SIZE
      ? currentData
      : await loadBrandProductConsoleData(brandCode, firstPageQuery);
  const rowsById = new Map<string, BrandProductRow>();
  for (const product of firstPageData.products) rowsById.set(product.id || product.sku, product);
  const pages = Math.max(firstPageData.pages || 1, 1);
  if (pages > 1) {
    const pageResults = await Promise.all(
      Array.from({ length: pages - 1 }, (_, index) => index + 2).map((nextPage) =>
        loadBrandProductConsoleData(brandCode, {
          ...firstPageQuery,
          page: nextPage,
        })
      )
    );
    for (const result of pageResults) {
      for (const product of result.products) rowsById.set(product.id || product.sku, product);
    }
  }
  return [...rowsById.values()];
}

function productCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    heat_pump: '热泵',
    'heat-pump': '热泵',
    heating_boiler: '采暖锅炉',
    'heating-boiler': '采暖锅炉',
    residential_comfort: '家用舒适系统',
    'residential-comfort': '家用舒适系统',
    smoke_test: '测试分类',
    'smoke-test': '测试分类',
    water_heater: '热水器',
    'water-heater': '热水器',
    water_heating: '热水系统',
    'water-heating': '热水系统',
    water_treatment: '水处理',
    'water-treatment': '水处理',
    residential: '家用',
    commercial: '商用',
    heating_cooling: '采暖与制冷',
    'heating-cooling': '采暖与制冷',
    cooling: '制冷',
    heating: '采暖',
    fresh_air: '新风',
    'fresh-air': '新风',
    central_air: '中央空调',
    'central-air': '中央空调',
    smart_control: '智控系统',
    'smart-control': '智控系统',
  };
  return labels[String(category || '').trim().toLowerCase()] || category || '未设置';
}

function productCategoryPathLabel(categoryPath: string) {
  const parts = categoryPath.split('/').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return '未设置';
  return parts.map((part) => productCategoryLabel(part)).join(' / ');
}

function productDisplayCategoryPath(product: BrandProductRow) {
  const path = String(product.categoryPath || '').trim();
  return path ? productCategoryPathLabel(path) : '-';
}

function productDisplaySystem(value: string) {
  return productCategoryLabel(value);
}

function productRowFromCreateDraft(draft: BrandProductEditDraft, brandCode: string): BrandProductRow {
  return {
    id: '__new-product__',
    sku: '',
    materialCode: '',
    publicSlug: draft.publicSlug,
    name: draft.name,
    model: draft.model,
    category: draft.category,
    materialCategory: '',
    productLine: '',
    categoryLevel1Id: null,
    categoryLevel2Id: null,
    categoryLevel3Id: null,
    categoryPath: '',
    applicationScenarios: [],
    system: draft.system,
    websiteMenuCategory: draft.websiteMenuCategory,
    status: 'inactive',
    sortOrder: Number(draft.sortOrder) || 0,
    imageState: {
      hasMainImage: false,
      mainImageUrl: '',
      mainArtifactId: '',
      mainRef: null,
      detailRefs: [],
      galleryCount: 0,
      label: '未上传图片',
    },
    metadataReadiness: {
      ready: false,
      score: 0,
      missing: [],
    },
    raw: {
      brand: brandCode,
      meta: {
        [brandCode]: {
          en: draft.officialEnglishName,
          series: draft.series,
          tagline: draft.tagline,
          badges: draft.badges,
        },
      },
    },
  };
}

function blankCreateStructuredDraft(brandCode: string): BrandStructuredContentDraft {
  return structuredDraftFromProductRow(
    productRowFromCreateDraft(blankNewProductDraft(brandCode), brandCode),
    brandCode,
  );
}

function productContentItems(result: unknown): Array<Record<string, any>> {
  const payload = (result as any)?.data ?? result;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function officialDetailFromContent(result: unknown): string {
  const items = productContentItems(result);
  return String((items.find((item) => item?.locale === 'zh-CN') || items[0])?.officialDetailHtml || '');
}

function rowAssetRefs(row: BrandProductRow) {
  return Array.isArray(row.raw?.assetRefs) ? (row.raw.assetRefs as Array<Record<string, unknown>>) : [];
}

function savedProductManualPdfs(row: BrandProductRow): ProductManualPdfDraft[] {
  return rowAssetRefs(row)
    .filter((ref) => ref?.role === 'doc' && ref?.artifactId)
    .sort((left, right) => (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0))
    .map((ref, index) => {
      const artifactId = String(ref.artifactId || '');
      const url = String(ref.url || `/api/v2/file-artifact/${encodeURIComponent(artifactId)}/content`);
      return {
        id: artifactId,
        artifactId,
        objectKey: String(ref.objectKey || ''),
        name: String(ref.filename || `产品说明-${index + 1}.pdf`),
        mimeType: String(ref.mimeType || 'application/pdf'),
        previewUrl: url,
        saved: true,
        sortOrder: Number(ref.sortOrder) || index,
      };
    });
}

function productManualPdfsChanged(row: BrandProductRow, manualPdfs: ProductManualPdfDraft[]): boolean {
  const currentIds = savedProductManualPdfs(row).map((item) => item.artifactId || item.id).join('|');
  const nextIds = manualPdfs.map((item) => item.artifactId || item.id).join('|');
  return currentIds !== nextIds || manualPdfs.some((item) => item.file);
}

function manualPdfAssetRefs(manualPdfs: ProductManualPdfDraft[]) {
  return manualPdfs
    .filter((manual) => manual.saved && manual.artifactId)
    .map((manual, index) => ({
      role: 'doc',
      artifactId: manual.artifactId,
      objectKey: manual.objectKey || '',
      filename: manual.name,
      mimeType: manual.mimeType || 'application/pdf',
      sortOrder: index,
      url: manual.previewUrl || `/api/v2/file-artifact/${encodeURIComponent(String(manual.artifactId))}/content`,
    }));
}

function optionsWithCurrent(
  options: BrandMenuGroupOption[],
  value: string,
  labeler: (value: string) => string,
): BrandMenuGroupOption[] {
  const current = String(value || '').trim();
  if (!current || options.some((option) => option.value === current)) return options;
  return [{ value: current, label: labeler(current) }, ...options];
}

function isAllowedJpgOrPng(file: File): boolean {
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  return type === 'image/jpeg' || type === 'image/png' || /\.(jpe?g|png)$/.test(name);
}

function imageTypeErrorText() {
  return '\u53ea\u652f\u6301\u4e0a\u4f20 JPG \u6216 PNG \u683c\u5f0f\u7684\u56fe\u7247\u3002';
}

function productAudienceCategoryLabel(product: BrandProductRow) {
  const categoryPath = String(product.categoryPath || '').trim();
  if (categoryPath) return productCategoryPathLabel(categoryPath);
  const rawCategory = String(product.category || '').trim();
  const rawMenu = String(product.websiteMenuCategory || '').trim();
  const category = rawCategory.toLowerCase();
  const menu = rawMenu.toLowerCase();
  const residentialMenus = new Set([
    '家用',
    'residential',
    'residential_comfort',
    'residential-comfort',
    '家用中央空调',
    '地暖系统',
    '全热新风',
    '地源热泵',
  ]);
  const commercialMenus = new Set([
    '商用',
    'commercial',
    '燃气冷凝壁挂炉',
    '零冷水燃气热水器',
    '空气能热水器',
    '容积式燃气热水器',
    '电热水器',
    '采暖热水两联供',
  ]);
  if (residentialMenus.has(rawCategory) || residentialMenus.has(rawMenu) || category === 'residential' || menu === 'residential') {
    return '家用';
  }
  if (commercialMenus.has(rawCategory) || commercialMenus.has(rawMenu) || category === 'commercial' || menu === 'commercial') {
    return '商用';
  }
  return productCategoryLabel(rawCategory || rawMenu);
}

function productAudienceRootCategoryLabel(product: BrandProductRow) {
  const categoryPath = String(product.categoryPath || '').trim();
  const firstPathPart = categoryPath.split('/').map((part) => part.trim()).filter(Boolean)[0];
  if (firstPathPart) return productCategoryLabel(firstPathPart);
  const label = productAudienceCategoryLabel(product);
  return label.split('/').map((part) => part.trim()).filter(Boolean)[0] || label;
}

function productCategoryMatchLabels(product: BrandProductRow) {
  const labels = new Set<string>();
  const root = productAudienceRootCategoryLabel(product);
  const full = productAudienceCategoryLabel(product);
  const fields = [product.categoryPath, product.category, product.system, product.websiteMenuCategory]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  labels.add(root);
  labels.add(full);
  fields.forEach((field) => {
    labels.add(productCategoryLabel(field));
    field.split('/').map((part) => part.trim()).filter(Boolean).forEach((part) => labels.add(productCategoryLabel(part)));
    if (root && field && productCategoryLabel(field) !== root) labels.add(`${root} / ${productCategoryLabel(field)}`);
  });
  return [...labels].filter(Boolean);
}

function categoryMatchParts(value: unknown) {
  return String(value || '')
    .split(/[\/／]/)
    .map((part) => productCategoryLabel(part.trim()))
    .filter(Boolean);
}

function categoryMatchKey(value: unknown) {
  return categoryMatchParts(value)
    .join('/')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function categoryOptionMatchKeys(option?: ProductCategoryFilterOption) {
  if (!option) return [];
  return [
    option.label,
    option.pathCodes?.join('/') || '',
    option.pathCodes?.map(productCategoryLabel).join('/') || '',
  ].map(categoryMatchKey).filter(Boolean);
}

function productCategoryMatchKeys(product: BrandProductRow) {
  const values = new Set<string>([
    ...productCategoryMatchLabels(product),
    product.categoryPath,
    [product.category, product.system].filter(Boolean).join('/'),
    [product.category, product.system].filter(Boolean).map(productCategoryLabel).join('/'),
    product.websiteMenuCategory,
  ]);
  return [...values].map(categoryMatchKey).filter(Boolean);
}

function cleanCategoryText(value: unknown): string {
  return String(value || '').trim();
}

function categoryFilterValue(level: CategoryFilterLevel, id: string) {
  return `${level}:${id}`;
}

function categoryFilterQuery(value: string): Pick<BrandProductQuery, 'category' | 'categoryLevel1Id' | 'categoryLevel2Id' | 'categoryLevel3Id'> {
  const [level, id] = value.split(':');
  const categoryId = cleanCategoryText(id);
  if (!categoryId) {
    const legacyCategory = cleanCategoryText(value);
    return legacyCategory ? { category: legacyCategory } : {};
  }
  if (level === '1') return { categoryLevel1Id: categoryId };
  if (level === '2') return { categoryLevel2Id: categoryId };
  if (level === '3') return { categoryLevel3Id: categoryId };
  return {};
}

function normalizeProductCategoryFilterTree(value: unknown): ProductCategoryFilterNode[] {
  const source: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray((value as any)?.items)
      ? (value as any).items
      : Array.isArray((value as any)?.tree)
        ? (value as any).tree
        : [];
  const rows = source
    .map((item) => {
      const record = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const id = cleanCategoryText(record.id || record._id || record.code);
      const parentId = cleanCategoryText(record.parentId || record.parent_id) || null;
      const level = Number(record.level || 1);
      if (!id || ![1, 2, 3].includes(level)) return null;
      return {
        id,
        parentId,
        level: level as CategoryFilterLevel,
        code: cleanCategoryText(record.code || id),
        name: cleanCategoryText(record.nameCn || record.name || record.label || record.nameEn || record.code),
        sortOrder: Number(record.sortOrder ?? record.sort_order ?? 0),
        status: cleanCategoryText(record.status || 'active'),
        children: [],
      } satisfies ProductCategoryFilterNode;
    })
    .filter(Boolean) as ProductCategoryFilterNode[];
  const byId = new Map(rows.map((item) => [item.id, item]));
  const roots: ProductCategoryFilterNode[] = [];
  rows.forEach((item) => {
    const parent = item.parentId ? byId.get(item.parentId) : null;
    if (parent && item.level > parent.level && parent.level < 3) parent.children.push(item);
    else roots.push(item);
  });
  const sortTree = (items: ProductCategoryFilterNode[]) => {
    items.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
    items.forEach((item) => sortTree(item.children));
    return items;
  };
  return sortTree(roots.filter((item) => item.level === 1 || !item.parentId));
}

function categoryFilterOptionsFromTree(tree: ProductCategoryFilterNode[]): ProductCategoryFilterOption[] {
  const options: ProductCategoryFilterOption[] = [];
  const walk = (items: ProductCategoryFilterNode[], ancestors: string[], ancestorCodes: string[]) => {
    for (const item of items) {
      if (item.status === 'inactive') continue;
      const path = [...ancestors, item.name].filter(Boolean);
      const pathCodes = [...ancestorCodes, item.code].filter(Boolean);
      options.push({
        value: categoryFilterValue(item.level, item.id),
        label: path.join(' / '),
        level: item.level,
        pathCodes,
      });
      walk(item.children, path, pathCodes);
    }
  };
  walk(tree, [], []);
  return options;
}

function rootCategoryFilterOptionsFromProducts(products: BrandProductRow[]): ProductCategoryFilterOption[] {
  const labels = [...new Set(products.map((product) => productAudienceRootCategoryLabel(product)).filter(Boolean))];
  return labels.map((label) => ({ value: `root:${label}`, label, level: 1 as CategoryFilterLevel }));
}

function productCategoryPathFilterOptions(products: BrandProductRow[]): ProductCategoryFilterOption[] {
  const options = new Map<string, ProductCategoryFilterOption>();
  for (const product of products) {
    const path = String(product.categoryPath || '').trim();
    if (!path) continue;
    const parts = path.split('/').map((part) => part.trim()).filter(Boolean);
    const labels = parts.map((part) => productCategoryLabel(part));
    parts.forEach((part, index) => {
      const label = labels.slice(0, index + 1).join(' / ');
      const level = Math.min(index + 1, 3) as CategoryFilterLevel;
      const key = `path:${parts.slice(0, index + 1).join('/')}`;
      if (!options.has(key)) {
        options.set(key, {
          value: key,
          label,
          level,
          pathCodes: parts.slice(0, index + 1),
        });
      }
    });
  }
  return [...options.values()];
}

function productMatchesCategoryFilters(product: BrandProductRow, selectedValues: string[], optionMap: Map<string, ProductCategoryFilterOption>) {
  if (!selectedValues.length) return true;
  const matchLabels = productCategoryMatchLabels(product);
  const productKeys = productCategoryMatchKeys(product);
  return selectedValues.some((value) => {
    if (value.startsWith('path:')) {
      const path = value.slice('path:'.length);
      const productPath = String(product.categoryPath || '').trim();
      const pathKey = categoryMatchKey(path);
      return Boolean(
        path && (
          productPath === path ||
          productPath.startsWith(`${path}/`) ||
          productKeys.some((candidate) => candidate === pathKey || candidate.startsWith(`${pathKey}/`))
        )
      );
    }
    const [level, categoryId] = value.split(':');
    if (categoryId) {
      if (level === '1' && product.categoryLevel1Id === categoryId) return true;
      if (level === '2' && product.categoryLevel2Id === categoryId) return true;
      if (level === '3' && product.categoryLevel3Id === categoryId) return true;
    }
    const option = optionMap.get(value);
    const optionKeys = categoryOptionMatchKeys(option);
    if (!optionKeys.length) optionKeys.push(categoryMatchKey(value.replace(/^\w+:/, '')));
    if (optionKeys.some((key) => productKeys.some((candidate) => candidate === key || candidate.startsWith(`${key}/`)))) {
      return true;
    }
    const label = option?.label || value.replace(/^\w+:/, '');
    return matchLabels.some((candidate) => candidate === label || candidate.startsWith(`${label} / `));
  });
}

function rowTenantId(row: BrandProductRow) {
  return String((row.raw as any)?.tenantId || (row.raw as any)?.tenant_id || '').trim();
}

function shelfBatchLabel(row: BrandProductRow) {
  return row.sku || row.model || row.name || row.id;
}

function shelfBatchValidationError(row: BrandProductRow) {
  if (!UUID_RE.test(row.id)) return '产品 ID 不是 UUID，不能写入官网货架。';
  if (!UUID_RE.test(rowTenantId(row))) return '产品租户 ID 缺失或不是 UUID，不能写入官网货架。';
  if (!slugValue(row.publicSlug || row.sku || row.id)) return '公开 slug 为空，不能写入官网货架。';
  return '';
}

function shelfAssignmentMatchesProduct(assignment: WebsiteShelfAssignment | undefined, row: BrandProductRow) {
  return Boolean(
    assignment &&
    !assignment.deletedAt &&
    assignment.productId === row.id &&
    assignment.productTenantId === rowTenantId(row)
  );
}

export default function BrandSiteConsoleShell({ brandCode }: { brandCode: string }) {
  const normalizedBrandCode = normalizeBrandCode(decodeMaybe(brandCode));
  const [data, setData] = useState<BrandProductConsoleData | null>(null);
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [categoryTree, setCategoryTree] = useState<ProductCategoryFilterNode[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [productPermissions, setProductPermissions] = useState<BrandProductPermissions>(EMPTY_BRAND_PRODUCT_PERMISSIONS);
  const [drafts, setDrafts] = useState<Record<string, BrandProductEditDraft>>({});
  const [structuredDrafts, setStructuredDrafts] = useState<Record<string, BrandStructuredContentDraft>>({});
  const [officialDetailDrafts, setOfficialDetailDrafts] = useState<Record<string, string>>({});
  const [officialDetailInitials, setOfficialDetailInitials] = useState<Record<string, string>>({});
  const [manualPdfDrafts, setManualPdfDrafts] = useState<Record<string, ProductManualPdfDraft[]>>({});
  const [editingProductId, setEditingProductId] = useState('');
  const [savingId, setSavingId] = useState('');
  const [savingStructuredId, setSavingStructuredId] = useState('');
  const [actionProductId, setActionProductId] = useState('');
  const [imageActionId, setImageActionId] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [rowFeedback, setRowFeedback] = useState<Record<string, { tone: 'success' | 'error'; text: string }>>({});
  const [imageFeedback, setImageFeedback] = useState<Record<string, ImageActionFeedback>>({});
  const [shelfAssignments, setShelfAssignments] = useState<WebsiteShelfAssignment[]>([]);
  const [shelfProductRows, setShelfProductRows] = useState<BrandProductRow[]>([]);
  const [shelfFilter, setShelfFilter] = useState<WebsiteShelfFilter>('all');
  const [shelfLoading, setShelfLoading] = useState(false);
  const [shelfError, setShelfError] = useState('');
  const [shelfBusyProductId, setShelfBusyProductId] = useState('');
  const [shelfTransitions, setShelfTransitions] = useState<Record<string, WebsiteShelfTransition>>({});
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkShelfAction, setBulkShelfAction] = useState<WebsiteShelfTransition | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [activeContentTab, setActiveContentTab] = useState<ContentTab>('products');
  const [createDraft, setCreateDraft] = useState<BrandProductEditDraft>(() => blankNewProductDraft(normalizedBrandCode));
  const [createStructuredDraft, setCreateStructuredDraft] = useState<BrandStructuredContentDraft>(() => blankCreateStructuredDraft(normalizedBrandCode));
  const [createManualPdfs, setCreateManualPdfs] = useState<ProductManualPdfDraft[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    ok: boolean;
    log: string;
    error?: string;
  } | null>(null);
  const [childBrandSites, setChildBrandSites] = useState<BrandSite[]>([]);
  const [childBrandDraft, setChildBrandDraft] = useState<string[]>([]);
  const [savingChildBrands, setSavingChildBrands] = useState(false);
  const [childBrandFeedback, setChildBrandFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [brandLogo, setBrandLogo] = useState('');
  const [brandLogoFailed, setBrandLogoFailed] = useState(false);
  const loadRequestRef = useRef(0);
  const imageFeedbackTimersRef = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    const isCurrentRequest = () => loadRequestRef.current === requestId;
    setIsLoading(true);
    setShelfLoading(true);
    setError('');
    setShelfError('');
    try {
      const hasCategoryFilter = categoryFilter.length > 0;
      const query: BrandProductQuery = {
        page: hasCategoryFilter ? 1 : page,
        pageSize: hasCategoryFilter ? CATEGORY_FILTER_LOAD_PAGE_SIZE : pageSize,
        keyword,
        status: 'active',
        ...(categoryFilter.length === 1 ? categoryFilterQuery(categoryFilter[0]) : {}),
      };
      const shouldDeferGroupProducts = normalizedBrandCode === GROUP_SITE_CODE;
      let nextData = await loadBrandProductConsoleData(normalizedBrandCode, {
        ...query,
        deferGroupProducts: shouldDeferGroupProducts,
      });
      if (hasCategoryFilter && nextData.pages > 1) {
        const pages = Array.from({ length: nextData.pages - 1 }, (_, index) => index + 2);
        const pageResults = await Promise.all(
          pages.map((nextPage) =>
            loadBrandProductConsoleData(normalizedBrandCode, {
              ...query,
              page: nextPage,
              deferGroupProducts: shouldDeferGroupProducts,
            })
          )
        );
        const productsById = new Map<string, BrandProductRow>();
        for (const product of nextData.products) productsById.set(product.id || product.sku, product);
        for (const result of pageResults) {
          for (const product of result.products) productsById.set(product.id || product.sku, product);
        }
        nextData = {
          ...nextData,
          products: [...productsById.values()],
          total: productsById.size,
          page: 1,
          pageSize: productsById.size || CATEGORY_FILTER_LOAD_PAGE_SIZE,
          pages: 1,
        };
      }
      if (!isCurrentRequest()) return;
      setData(nextData);
      setShelfProductRows(nextData.products);
      setIsLoading(false);
      loadShelfFilterProductRows(normalizedBrandCode, query, nextData, shouldDeferGroupProducts)
        .then((nextShelfProductRows) => {
          if (isCurrentRequest()) setShelfProductRows(nextShelfProductRows);
        })
        .catch((e) => {
          if (isCurrentRequest()) setShelfError((e as Error).message || '官网货架筛选数据加载失败。');
        });
      if (shouldDeferGroupProducts && normalizedChildBrandCodes(nextData.site?.childBrandCodes).length) {
        loadBrandProductConsoleData(normalizedBrandCode, query)
          .then(async (fullData) => {
            const fullShelfProductRows = await loadShelfFilterProductRows(normalizedBrandCode, query, fullData, false);
            if (isCurrentRequest()) {
              setData(fullData);
              setShelfProductRows(fullShelfProductRows);
            }
          })
          .catch((e) => {
            if (isCurrentRequest()) setShelfError((e as Error).message || '集团产品加载失败。');
          });
      }
      if (normalizedBrandCode === GROUP_SITE_CODE) {
        const siteResult = await brandSites.list().catch(() => ({ items: [] }));
        if (!isCurrentRequest()) return;
        const rows = Array.isArray(siteResult?.items) ? siteResult.items as BrandSite[] : [];
        setChildBrandSites(rows.filter((item) => item.status === 'active' && !item.deletedAt && item.code !== GROUP_SITE_CODE));
        const groupSite = rows.find((item) => item.code === GROUP_SITE_CODE) || nextData.site;
        setChildBrandDraft(normalizedChildBrandCodes(groupSite?.childBrandCodes));
      } else {
        setChildBrandSites([]);
        setChildBrandDraft([]);
      }
      if (!nextData.site) {
        setShelfAssignments([]);
        setShelfProductRows([]);
        setShelfLoading(false);
        return;
      }
      try {
        const result = await siteProductAssignments.list(nextData.site.code || normalizedBrandCode, {
          includeArchived: 'true',
        });
        if (!isCurrentRequest()) return;
        setShelfAssignments(assignmentItems(result));
      } catch (e) {
        if (!isCurrentRequest()) return;
        setShelfAssignments([]);
        setShelfError((e as Error).message || '官网货架状态加载失败。');
      } finally {
        if (isCurrentRequest()) setShelfLoading(false);
      }
    } catch (e) {
      if (!isCurrentRequest()) return;
      setError((e as Error).message || '品牌官网产品数据加载失败。');
      setShelfProductRows([]);
      setIsLoading(false);
      setShelfLoading(false);
    }
  }, [categoryFilter, keyword, normalizedBrandCode, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (actionFeedback?.tone !== 'success') return undefined;
    const timer = window.setTimeout(() => setActionFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [actionFeedback]);

  useEffect(() => () => {
    Object.values(imageFeedbackTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    imageFeedbackTimersRef.current = {};
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCategoryFilter([]);
    setCategoryTree([]);
    setCategoryError('');
    setCategoryLoading(false);
    if (normalizedBrandCode === GROUP_SITE_CODE) return () => { cancelled = true; };
    setCategoryLoading(true);
    brandProductCategories.list({ brandCode: normalizedBrandCode })
      .then((result) => {
        if (cancelled) return;
        setCategoryTree(normalizeProductCategoryFilterTree(result));
      })
      .catch((e) => {
        if (cancelled) return;
        setCategoryTree([]);
        setCategoryError((e as Error).message || 'Category filters failed to load.');
      })
      .finally(() => {
        if (!cancelled) setCategoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [normalizedBrandCode]);

  useEffect(() => {
    let cancelled = false;
    auth.me()
      .then((me) => {
        if (!cancelled) setProductPermissions(getBrandProductPermissions(me));
      })
      .catch(() => {
        if (!cancelled) setProductPermissions(EMPTY_BRAND_PRODUCT_PERMISSIONS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCreateDraft(blankNewProductDraft(normalizedBrandCode));
    setShowCreate(false);
    setPublishResult(null);
    setStructuredDrafts({});
    setEditingProductId('');
    setKeyword('');
    setShelfProductRows([]);
    setShelfFilter('all');
    setCategoryFilter([]);
    setPage(1);
  }, [normalizedBrandCode]);

  const site = useMemo(() => {
    return (data?.site as BrandSite | null) || fallbackSite(normalizedBrandCode);
  }, [data, normalizedBrandCode]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    setBrandLogo('');
    setBrandLogoFailed(false);
    if (!site.logoArtifactId) {
      window.clearTimeout(timeout);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }
    loadBrandSiteLogo(site.id, controller.signal)
      .then((logo) => {
        if (cancelled || !logo.dataBase64) return;
        setBrandLogo(`data:${logo.mimeType || 'image/png'};base64,${logo.dataBase64}`);
      })
      .catch(() => {
        if (!cancelled) setBrandLogo('');
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [site.id, site.logoArtifactId]);

  const meta = statusMeta(site);
  const fallbackLogo = fallbackBrandLogoSrc(site.code);
  const currentBrandLogoSrc = brandLogoFailed ? '' : brandLogo || fallbackLogo;
  const publishCapability = site.publishCapability || UNSUPPORTED_PUBLISH;
  const canCreateProduct = productPermissions.canCreateProduct;
  const canUpdateProduct = productPermissions.canUpdateProduct;
  const canDeleteProduct = productPermissions.canDeleteProduct;
  const canPublishProduct = productPermissions.canPublishProduct;
  const canUpdateBrandLibrary = productPermissions.canUpdateBrandLibrary;
  const canPublishBrandLibrary = productPermissions.canPublishBrandLibrary;
  const canPublishWebsiteShelf = productPermissions.canCreateBrandLibrary && productPermissions.canPublishBrandLibrary;
  const canWrite = canUpdateProduct;
  const environmentLinks = useMemo(
    () => resolveBrandSiteEnvironmentLinks(data?.site || site, normalizedBrandCode),
    [data?.site, normalizedBrandCode, site]
  );
  const productRows = data?.products || [];
  const shelfSourceProductRows = shelfProductRows.length || !productRows.length ? shelfProductRows : productRows;
  const totalProducts = data?.total || 0;
  const currentPage = data?.page || page;
  const currentPageSize = data?.pageSize || pageSize;
  const totalPages = Math.max(data?.pages || Math.ceil(totalProducts / currentPageSize) || 1, 1);
  const categoryOptions = useMemo(() => {
    return categoryFilterOptionsFromTree(categoryTree);
  }, [categoryTree]);
  const categoryOptionMap = useMemo(() => {
    return new Map(categoryOptions.map((option) => [option.value, option]));
  }, [categoryOptions]);
  const assignmentByProductId = useMemo(() => {
    const map = new Map<string, WebsiteShelfAssignment>();
    for (const assignment of shelfAssignments) {
      if (!assignment.productId) continue;
      const current = map.get(assignment.productId);
      if (!current || shelfAssignmentPriority(assignment) > shelfAssignmentPriority(current)) {
        map.set(assignment.productId, assignment);
      }
    }
    return map;
  }, [shelfAssignments]);
  const shelfFilterCounts = useMemo(() => {
    let published = 0;
    let unpublished = 0;
    for (const product of shelfSourceProductRows.filter((item) => productMatchesCategoryFilters(item, categoryFilter, categoryOptionMap))) {
      if (isWebsiteShelfPublished(assignmentByProductId.get(product.id))) published += 1;
      else unpublished += 1;
    }
    return { all: published + unpublished, published, unpublished };
  }, [assignmentByProductId, categoryFilter, categoryOptionMap, shelfSourceProductRows]);
  const visibleProducts = useMemo(() => {
    const sourceRows = shelfFilter === 'all' ? productRows : shelfSourceProductRows;
    return sourceRows
      .filter((product) => productMatchesCategoryFilters(product, categoryFilter, categoryOptionMap))
      .filter((product) => productMatchesShelfFilter(assignmentByProductId.get(product.id), shelfFilter))
      .map((product, index) => ({ product, index }))
      .sort((left, right) => {
        const byShelf =
          shelfSortRank(assignmentByProductId.get(right.product.id)) -
          shelfSortRank(assignmentByProductId.get(left.product.id));
        if (byShelf) return byShelf;
        return left.index - right.index;
      })
      .map((entry) => entry.product);
  }, [assignmentByProductId, categoryFilter, categoryOptionMap, productRows, shelfFilter, shelfSourceProductRows]);
  const visibleProductIds = useMemo(() => visibleProducts.map((product) => product.id).filter(Boolean), [visibleProducts]);
  const visibleProductIdKey = visibleProductIds.join('|');
  const selectedVisibleProducts = useMemo(() => {
    const selected = new Set(selectedProductIds);
    return visibleProducts.filter((product) => selected.has(product.id));
  }, [selectedProductIds, visibleProducts]);
  const allVisibleSelected = visibleProductIds.length > 0 && visibleProductIds.every((id) => selectedProductIds.includes(id));
  const someVisibleSelected = visibleProductIds.some((id) => selectedProductIds.includes(id));
  const isInitialLoading = isLoading && !data;
  const usesLocalProductFilter = categoryFilter.length > 0 || shelfFilter !== 'all';
  const footerTotalProducts = usesLocalProductFilter ? visibleProducts.length : totalProducts;
  const footerCurrentPage = usesLocalProductFilter ? 1 : currentPage;
  const footerTotalPages = usesLocalProductFilter ? 1 : totalPages;
  const editingProduct = useMemo(() => {
    if (!editingProductId) return null;
    return visibleProducts.find((product) => product.id === editingProductId) || null;
  }, [editingProductId, visibleProducts]);
  const createProductPreview = useMemo(
    () => productRowFromCreateDraft(createDraft, normalizedBrandCode),
    [createDraft, normalizedBrandCode]
  );

  const taxonomyCount = useMemo(() => {
    if (!data?.taxonomy) return 0;
    return Object.values(data.taxonomy).filter((value) => Array.isArray(value)).length;
  }, [data]);

  useEffect(() => {
    const visible = new Set(visibleProductIds);
    setSelectedProductIds((current) => {
      const next = current.filter((id) => visible.has(id));
      return next.length === current.length ? current : next;
    });
  }, [visibleProductIdKey]);

  function updateDraft(id: string, patch: Partial<BrandProductEditDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } as BrandProductEditDraft }));
  }

  function structuredDraft(row: BrandProductRow) {
    return structuredDrafts[row.id] || structuredDraftFromProductRow(row, normalizedBrandCode);
  }

  function updateStructuredDraft(id: string, patch: Partial<BrandStructuredContentDraft>) {
    setStructuredDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } as BrandStructuredContentDraft }));
  }

  function toggleProductSelection(productId: string, checked: boolean) {
    setSelectedProductIds((current) => {
      if (checked) return current.includes(productId) ? current : [...current, productId];
      return current.filter((id) => id !== productId);
    });
  }

  function toggleVisibleProductSelection(checked: boolean) {
    setSelectedProductIds(checked ? visibleProductIds : []);
  }

  function beginProductEdit(row: BrandProductRow) {
    setDrafts((current) => ({ ...current, [row.id]: current[row.id] || draftFromProductRow(row) }));
    setStructuredDrafts((current) => ({
      ...current,
      [row.id]: current[row.id] || structuredDraftFromProductRow(row, normalizedBrandCode),
    }));
    products
      .listContent(row.id, { tenantId: rowTenantId(row), locale: 'zh-CN' })
      .then((result) => {
        const officialDetailHtml = officialDetailFromContent(result);
        setOfficialDetailDrafts((current) => ({ ...current, [row.id]: officialDetailHtml }));
        setOfficialDetailInitials((current) => ({ ...current, [row.id]: officialDetailHtml }));
      })
      .catch(() => {
        setOfficialDetailDrafts((current) => ({ ...current, [row.id]: '' }));
        setOfficialDetailInitials((current) => ({ ...current, [row.id]: '' }));
      });
    setShowCreate(false);
    setEditingProductId(row.id);
  }

  function closeProductEdit(row: BrandProductRow | null) {
    if (row) {
      resetDraft(row);
      resetStructuredDraft(row);
    }
    if (row) {
      (manualPdfDrafts[row.id] || []).forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
      setManualPdfDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    }
    setEditingProductId('');
  }

  function beginProductCreate() {
    setEditingProductId('');
    const nextDraft = blankNewProductDraft(normalizedBrandCode);
    createManualPdfs.forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
    setCreateDraft(nextDraft);
    setCreateStructuredDraft(blankCreateStructuredDraft(normalizedBrandCode));
    setCreateManualPdfs([]);
    setCreateError('');
    setShowCreate(true);
  }

  function closeProductCreate() {
    setShowCreate(false);
    setCreateError('');
    createManualPdfs.forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
    setCreateDraft(blankNewProductDraft(normalizedBrandCode));
    setCreateStructuredDraft(blankCreateStructuredDraft(normalizedBrandCode));
    setCreateManualPdfs([]);
  }

  function resetDraft(row: BrandProductRow) {
    setDrafts((current) => ({ ...current, [row.id]: draftFromProductRow(row) }));
    setOfficialDetailDrafts((current) => ({ ...current, [row.id]: officialDetailInitials[row.id] || '' }));
    (manualPdfDrafts[row.id] || []).forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
    setManualPdfDrafts((current) => {
      const next = { ...current };
      delete next[row.id];
      return next;
    });
    setRowFeedback((current) => {
      const next = { ...current };
      delete next[row.id];
      return next;
    });
  }

  function resetStructuredDraft(row: BrandProductRow) {
    setStructuredDrafts((current) => ({ ...current, [row.id]: structuredDraftFromProductRow(row, normalizedBrandCode) }));
    setRowFeedback((current) => {
      const next = { ...current };
      delete next[`${row.id}:structured`];
      return next;
    });
  }

  async function saveRow(row: BrandProductRow, overrides?: { officialDetailHtml?: string }) {
    if (!canWrite) return;
    const draft = drafts[row.id] || draftFromProductRow(row);
    const officialDetailHtml = overrides?.officialDetailHtml ?? officialDetailDrafts[row.id] ?? '';
    const officialDetailInitial = officialDetailInitials[row.id] || '';
    const manualPdfs = manualPdfDrafts[row.id] || savedProductManualPdfs(row);
    const baseDirty = isDirtyProductDraft(row, draft);
    const detailDirty = officialDetailHtml !== officialDetailInitial;
    const manualDirty = productManualPdfsChanged(row, manualPdfs);
    if (!draft.name.trim()) {
      setRowFeedback((current) => ({
        ...current,
        [row.id]: { tone: 'error', text: '产品名称不能为空' },
      }));
      return;
    }
    if (!baseDirty && !detailDirty && !manualDirty) return;
    setSavingId(row.id);
    setRowFeedback((current) => ({ ...current, [row.id]: { tone: 'success', text: '保存中...' } }));
    try {
      if (baseDirty) await saveBrandProductRow(normalizedBrandCode, row, draft);
      if (detailDirty) {
        await products.upsertContent(row.id, {
          tenantId: rowTenantId(row),
          locale: 'zh-CN',
          status: 'published',
          officialDetailHtml,
        });
      }
      if (manualDirty) {
        const manualRefs = await uploadProductManualPdfRefs(manualPdfs.filter((manual) => manual.file), row.sku || row.id);
        const existingManualRefs = manualPdfAssetRefs(manualPdfs);
        await products.update(row.id, {
          tenantId: rowTenantId(row),
          assetRefs: [
            ...rowAssetRefs(row).filter((ref) => ref?.role !== 'doc'),
            ...existingManualRefs,
            ...manualRefs.map((ref, index) => ({ ...ref, sortOrder: existingManualRefs.length + index })),
          ],
        });
      }
      await load();
      manualPdfs.filter((manual) => manual.file).forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setOfficialDetailDrafts((current) => ({ ...current, [row.id]: officialDetailHtml }));
      setOfficialDetailInitials((current) => ({ ...current, [row.id]: officialDetailHtml }));
      setManualPdfDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setRowFeedback((current) => ({ ...current, [row.id]: { tone: 'success', text: '已保存' } }));
      window.setTimeout(() => {
        setRowFeedback((current) => {
          const next = { ...current };
          delete next[row.id];
          return next;
        });
      }, 2400);
    } catch (e) {
      setRowFeedback((current) => ({
        ...current,
        [row.id]: { tone: 'error', text: (e as Error).message || '保存失败' },
      }));
    } finally {
      setSavingId('');
    }
  }

  async function saveStructured(row: BrandProductRow) {
    if (!canWrite) return;
    const draft = structuredDraft(row);
    if (!isDirtyStructuredContentDraft(row, normalizedBrandCode, draft)) return;
    setSavingStructuredId(row.id);
    setRowFeedback((current) => ({ ...current, [`${row.id}:structured`]: { tone: 'success', text: '官网内容保存中...' } }));
    try {
      await saveBrandStructuredContent(normalizedBrandCode, row, draft);
      await load();
      setStructuredDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setRowFeedback((current) => ({ ...current, [`${row.id}:structured`]: { tone: 'success', text: '官网内容已保存' } }));
      window.setTimeout(() => {
        setRowFeedback((current) => {
          const next = { ...current };
          delete next[`${row.id}:structured`];
          return next;
        });
      }, 2400);
    } catch (e) {
      setRowFeedback((current) => ({
        ...current,
        [`${row.id}:structured`]: { tone: 'error', text: (e as Error).message || '官网内容保存失败' },
      }));
    } finally {
      setSavingStructuredId('');
    }
  }

  async function createProduct() {
    if (!canCreateProduct || !data?.site) return;
    setCreating(true);
    setCreateError('');
    try {
      const manualPdfRefs = await uploadProductManualPdfRefs(
        createManualPdfs,
        createDraft.model || createDraft.publicSlug || createDraft.name || normalizedBrandCode,
      );
      await createBrandProduct(normalizedBrandCode, createDraft, createStructuredDraft, manualPdfRefs);
      await load();
      setShowCreate(false);
      createManualPdfs.forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
      setCreateDraft(blankNewProductDraft(normalizedBrandCode));
      setCreateStructuredDraft(blankCreateStructuredDraft(normalizedBrandCode));
      setCreateManualPdfs([]);
    } catch (e) {
      setCreateError((e as Error).message || '上新失败');
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(row: BrandProductRow) {
    if (!canUpdateProduct) return;
    const nextStatus = row.status === 'active' ? 'inactive' : 'active';
    setActionProductId(row.id);
    setActionFeedback(null);
    try {
      await updateBrandProductStatus(row, nextStatus);
      setActionFeedback({ tone: 'success', text: `${row.sku} 已${nextStatus === 'active' ? '上架' : '下架'}。` });
      await load();
    } catch (e) {
      setActionFeedback({ tone: 'error', text: (e as Error).message || '产品状态更新失败。' });
    } finally {
      setActionProductId('');
    }
  }

  async function publishWebsiteShelfAssignment(row: BrandProductRow, existing?: WebsiteShelfAssignment) {
    const siteCode = site.code || normalizedBrandCode;
    if (existing && !existing.deletedAt && !shelfAssignmentMatchesProduct(existing, row)) {
      await siteProductAssignments.archive(siteCode, existing.id);
    }
    let assignmentId = shelfAssignmentMatchesProduct(existing, row) ? existing?.id || '' : '';
    if (!assignmentId) {
      const created = await siteProductAssignments.create(siteCode, {
        productId: row.id,
        productTenantId: rowTenantId(row),
        publicSlug: slugValue(row.publicSlug || row.sku || row.id),
        websiteCategory: row.websiteMenuCategory || row.category || null,
        menuGroup: row.system || null,
        displayOrder: row.sortOrder || 0,
        isFeatured: false,
        siteTitle: row.name || null,
        siteSummary: row.category || null,
      });
      assignmentId = String(created?.id || '').trim();
    }
    if (!assignmentId) throw new Error('官网货架分配未返回 ID，无法发布。');
    await siteProductAssignments.publish(siteCode, assignmentId);
  }

  async function hideWebsiteShelfAssignment(row: BrandProductRow, existing?: WebsiteShelfAssignment) {
    if (!existing) return;
    await siteProductAssignments.hide(site.code || normalizedBrandCode, existing.id);
  }

  async function runBatchShelfAction(action: WebsiteShelfTransition) {
    if (bulkShelfAction) {
      setActionFeedback({ tone: 'error', text: '官网货架批量操作正在处理中，请稍后再试。' });
      return;
    }
    if ((action === 'publishing' && !canPublishBrandLibrary) || (action === 'hiding' && !canUpdateBrandLibrary)) {
      setActionFeedback({ tone: 'error', text: '当前账号没有官网货架写入权限，不能批量上架或下架。' });
      return;
    }
    if (!selectedVisibleProducts.length) {
      setActionFeedback({ tone: 'error', text: '请先勾选需要批量操作的产品。' });
      return;
    }
    if (shelfLoading) {
      setActionFeedback({ tone: 'error', text: '官网货架状态还在加载，请加载完成后再批量操作。' });
      return;
    }
    const rows = selectedVisibleProducts;
    const invalidRows = action === 'publishing'
      ? rows
          .map((row) => ({ row, error: shelfBatchValidationError(row) }))
          .filter((item) => item.error)
      : [];
    if (invalidRows.length) {
      setRowFeedback((current) => {
        const next = { ...current };
        invalidRows.forEach(({ row, error }) => {
          next[`${row.id}:shelf`] = { tone: 'error', text: error };
        });
        return next;
      });
      setActionFeedback({
        tone: 'error',
        text: `官网批量上架未提交：${invalidRows.slice(0, 3).map(({ row }) => shelfBatchLabel(row)).join('、')} 等 ${invalidRows.length} 个产品缺少可写入官网货架的数据库 ID。`,
      });
      return;
    }

    const nextFeedback = action === 'publishing' ? '官网货架批量上架中...' : '官网货架批量下架中...';
    setBulkShelfAction(action);
    setShelfTransitions((current) => {
      const next = { ...current };
      rows.forEach((row) => {
        next[row.id] = action;
      });
      return next;
    });
    setRowFeedback((current) => {
      const next = { ...current };
      rows.forEach((row) => {
        next[`${row.id}:shelf`] = { tone: 'success', text: nextFeedback };
      });
      return next;
    });

    try {
      const items = rows.map((row) => {
        const existing = assignmentByProductId.get(row.id);
        return action === 'publishing'
          ? {
              assignmentId: shelfAssignmentMatchesProduct(existing, row) ? existing?.id || '' : '',
              productId: row.id,
              productTenantId: rowTenantId(row),
              publicSlug: slugValue(row.publicSlug || row.sku || row.id),
              websiteCategory: row.websiteMenuCategory || row.category || null,
              menuGroup: row.system || null,
              displayOrder: row.sortOrder || 0,
              isFeatured: false,
              siteTitle: row.name || null,
              siteSummary: row.category || null,
              sku: row.sku,
            }
          : {
              assignmentId: existing?.id || '',
              productId: row.id,
              sku: row.sku,
            };
      });
      const siteCode = site.code || normalizedBrandCode;
      const result = action === 'publishing'
        ? await siteProductAssignments.batchPublish(siteCode, items) as any
        : await siteProductAssignments.batchHide(siteCode, items) as any;
      const failed = Array.isArray(result?.failed) ? result.failed : [];
      const successCount = Number(result?.successCount ?? 0);
      const failureCount = Number(result?.failureCount ?? failed.length);
      const byProductId = new Map(rows.map((row) => [row.id, row]));
      setRowFeedback((current) => {
        const next = { ...current };
        rows.forEach((row) => {
          next[`${row.id}:shelf`] = { tone: 'success', text: action === 'publishing' ? '已上架到当前官网。' : '已从当前官网下架。' };
        });
        failed.forEach((item: any) => {
          const row = byProductId.get(String(item.productId || ''));
          if (row) next[`${row.id}:shelf`] = { tone: 'error', text: String(item.error || '官网货架批量操作失败。') };
        });
        return next;
      });
      await load();
      setSelectedProductIds((current) => current.filter((id) => !rows.some((row) => row.id === id)));
      setActionFeedback({
        tone: failureCount ? 'error' : 'success',
        text: failureCount
          ? `官网批量操作完成：成功 ${successCount} 个，失败 ${failureCount} 个。${failed.slice(0, 3).map((item: any) => `${item.sku || item.productId}: ${item.error}`).join('；')}`
          : action === 'publishing'
            ? `已批量官网上架 ${successCount} 个产品。`
            : `已批量官网下架 ${successCount} 个产品。`,
      });
    } catch (e) {
      setActionFeedback({ tone: 'error', text: (e as Error).message || '官网货架批量操作失败。' });
    } finally {
      setBulkShelfAction('');
      setShelfTransitions((current) => {
        const next = { ...current };
        rows.forEach((row) => {
          delete next[row.id];
        });
        return next;
      });
    }
  }

  async function runBulkShelfAction(action: WebsiteShelfTransition) {
    if ((action === 'publishing' && !canPublishWebsiteShelf) || (action === 'hiding' && !canUpdateBrandLibrary) || !selectedVisibleProducts.length || bulkShelfAction) return;
    const rows = selectedVisibleProducts;
    const nextFeedback = action === 'publishing' ? '官网货架批量上架中...' : '官网货架批量下架中...';
    setBulkShelfAction(action);
    setShelfTransitions((current) => {
      const next = { ...current };
      rows.forEach((row) => {
        next[row.id] = action;
      });
      return next;
    });
    setRowFeedback((current) => {
      const next = { ...current };
      rows.forEach((row) => {
        next[`${row.id}:shelf`] = { tone: 'success', text: nextFeedback };
      });
      return next;
    });
    let successCount = 0;
    let failureCount = 0;
    for (const row of rows) {
      try {
        const existing = assignmentByProductId.get(row.id);
        if (action === 'publishing') await publishWebsiteShelfAssignment(row, existing);
        else await hideWebsiteShelfAssignment(row, existing);
        successCount += 1;
      } catch (e) {
        failureCount += 1;
        setRowFeedback((current) => ({
          ...current,
          [`${row.id}:shelf`]: { tone: 'error', text: (e as Error).message || '官网货架批量操作失败。' },
        }));
      } finally {
        setShelfTransitions((current) => {
          const next = { ...current };
          delete next[row.id];
          return next;
        });
      }
    }
    await load();
    setBulkShelfAction('');
    setSelectedProductIds((current) => current.filter((id) => !rows.some((row) => row.id === id)));
    setActionFeedback({
      tone: failureCount ? 'error' : 'success',
      text: failureCount
        ? `官网批量操作完成：成功 ${successCount} 个，失败 ${failureCount} 个。`
        : action === 'publishing'
          ? `已批量官网上架 ${successCount} 个产品。`
          : `已批量官网下架 ${successCount} 个产品。`,
    });
  }

  async function publishWebsiteShelf(row: BrandProductRow) {
    if (!canPublishWebsiteShelf) return;
    const existing = assignmentByProductId.get(row.id);
    setShelfBusyProductId(row.id);
    setShelfTransitions((current) => ({ ...current, [row.id]: 'publishing' }));
    setRowFeedback((current) => ({ ...current, [`${row.id}:shelf`]: { tone: 'success', text: '官网货架发布中...' } }));
    try {
      await publishWebsiteShelfAssignment(row, existing);
      await load();
      setRowFeedback((current) => ({ ...current, [`${row.id}:shelf`]: { tone: 'success', text: '已上架到当前官网。' } }));
      window.setTimeout(() => {
        setRowFeedback((current) => {
          const next = { ...current };
          delete next[`${row.id}:shelf`];
          return next;
        });
      }, 2400);
    } catch (e) {
      setRowFeedback((current) => ({
        ...current,
        [`${row.id}:shelf`]: { tone: 'error', text: (e as Error).message || '官网货架发布失败。' },
      }));
    } finally {
      setShelfBusyProductId('');
      setShelfTransitions((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    }
  }

  async function hideWebsiteShelf(row: BrandProductRow) {
    if (!canUpdateBrandLibrary) return;
    const assignment = assignmentByProductId.get(row.id);
    if (!assignment) return;
    setShelfBusyProductId(row.id);
    setShelfTransitions((current) => ({ ...current, [row.id]: 'hiding' }));
    setRowFeedback((current) => ({ ...current, [`${row.id}:shelf`]: { tone: 'success', text: '官网货架隐藏中...' } }));
    try {
      await hideWebsiteShelfAssignment(row, assignment);
      await load();
      setRowFeedback((current) => ({ ...current, [`${row.id}:shelf`]: { tone: 'success', text: '已从当前官网下架。' } }));
      window.setTimeout(() => {
        setRowFeedback((current) => {
          const next = { ...current };
          delete next[`${row.id}:shelf`];
          return next;
        });
      }, 2400);
    } catch (e) {
      setRowFeedback((current) => ({
        ...current,
        [`${row.id}:shelf`]: { tone: 'error', text: (e as Error).message || '官网货架隐藏失败。' },
      }));
    } finally {
      setShelfBusyProductId('');
      setShelfTransitions((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    }
  }

  async function archiveProduct(row: BrandProductRow) {
    if (!canDeleteProduct) return;
    const confirmed = window.confirm(
      `确认归档 ${row.name || row.sku}？归档后官网不再展示该产品，后台记录会保留。`
    );
    if (!confirmed) return;
    setActionProductId(row.id);
    setActionFeedback(null);
    try {
      await archiveBrandProduct(row);
      setActionFeedback({ tone: 'success', text: `${row.sku} 已归档。` });
      await load();
    } catch (e) {
      setActionFeedback({ tone: 'error', text: (e as Error).message || '产品归档失败。' });
    } finally {
      setActionProductId('');
    }
  }

  function showImageFeedback(row: BrandProductRow, feedback: ImageActionFeedback) {
    const key = `${row.id}:image`;
    const existingTimer = imageFeedbackTimersRef.current[key];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      delete imageFeedbackTimersRef.current[key];
    }
    setImageFeedback((current) => ({ ...current, [key]: feedback }));
    if (feedback.tone !== 'success') return;
    imageFeedbackTimersRef.current[key] = window.setTimeout(() => {
      setImageFeedback((current) => {
        if (current[key]?.text !== feedback.text) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
      delete imageFeedbackTimersRef.current[key];
    }, 3000);
  }

  async function uploadMainImage(row: BrandProductRow, file: File | null) {
    if (!canUpdateProduct || !file) return;
    if (!isAllowedJpgOrPng(file)) {
      showImageFeedback(row, { tone: 'error', text: imageTypeErrorText() });
      setActionFeedback({ tone: 'error', text: imageTypeErrorText() });
      return;
    }
    setImageActionId(`${row.id}:main`);
    setActionFeedback(null);
    showImageFeedback(row, { tone: 'pending', text: '主图正在上传...' });
    try {
      await uploadBrandProductMainImage(normalizedBrandCode, row, file);
      showImageFeedback(row, { tone: 'success', text: '主图上传成功，已保存到当前产品。' });
      setActionFeedback({ tone: 'success', text: `${row.sku} main image saved.` });
      await load();
    } catch (e) {
      const message = (e as Error).message || '主图上传失败。';
      showImageFeedback(row, { tone: 'error', text: message });
      setActionFeedback({ tone: 'error', text: message });
    } finally {
      setImageActionId('');
    }
  }

  async function deleteMainImage(row: BrandProductRow) {
    if (!canUpdateProduct) return;
    setImageActionId(`${row.id}:main`);
    setActionFeedback(null);
    showImageFeedback(row, { tone: 'pending', text: '主图正在删除...' });
    try {
      await deleteBrandProductMainImage(normalizedBrandCode, row);
      showImageFeedback(row, { tone: 'success', text: '主图已删除。' });
      setActionFeedback({ tone: 'success', text: `${row.sku} main image deleted.` });
      await load();
    } catch (e) {
      const message = (e as Error).message || '主图删除失败。';
      showImageFeedback(row, { tone: 'error', text: message });
      setActionFeedback({ tone: 'error', text: message });
    } finally {
      setImageActionId('');
    }
  }

  async function uploadDetailImage(row: BrandProductRow, file: File | null) {
    if (!canUpdateProduct || !file) return;
    if (!isAllowedJpgOrPng(file)) {
      showImageFeedback(row, { tone: 'error', text: imageTypeErrorText() });
      setActionFeedback({ tone: 'error', text: imageTypeErrorText() });
      return;
    }
    setImageActionId(`${row.id}:detail`);
    setActionFeedback(null);
    showImageFeedback(row, { tone: 'pending', text: '详情图正在上传...' });
    try {
      await uploadBrandProductDetailImage(normalizedBrandCode, row, file);
      showImageFeedback(row, { tone: 'success', text: '详情图上传成功，已加入图片列表。' });
      setActionFeedback({ tone: 'success', text: `${row.sku} detail image uploaded.` });
      await load();
    } catch (e) {
      const message = (e as Error).message || '详情图上传失败。';
      showImageFeedback(row, { tone: 'error', text: message });
      setActionFeedback({ tone: 'error', text: message });
    } finally {
      setImageActionId('');
    }
  }

  async function deleteDetailImage(row: BrandProductRow, artifactId: string) {
    if (!canUpdateProduct) return;
    setImageActionId(`${row.id}:detail`);
    setActionFeedback(null);
    showImageFeedback(row, { tone: 'pending', text: '详情图正在删除...' });
    try {
      await deleteBrandProductDetailImage(normalizedBrandCode, row, artifactId);
      showImageFeedback(row, { tone: 'success', text: '详情图已删除。' });
      setActionFeedback({ tone: 'success', text: `${row.sku} detail image deleted.` });
      await load();
    } catch (e) {
      const message = (e as Error).message || '详情图删除失败。';
      showImageFeedback(row, { tone: 'error', text: message });
      setActionFeedback({ tone: 'error', text: message });
    } finally {
      setImageActionId('');
    }
  }

  async function moveDetailImage(row: BrandProductRow, artifactId: string, direction: -1 | 1) {
    if (!canUpdateProduct) return;
    const ids = row.imageState.detailRefs.map((ref) => ref.artifactId);
    const index = ids.indexOf(artifactId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    setImageActionId(`${row.id}:detail`);
    setActionFeedback(null);
    showImageFeedback(row, { tone: 'pending', text: '详情图顺序正在保存...' });
    try {
      await reorderBrandProductDetailImages(normalizedBrandCode, row, ids);
      showImageFeedback(row, { tone: 'success', text: '详情图顺序已保存。' });
      setActionFeedback({ tone: 'success', text: `${row.sku} detail image order saved.` });
      await load();
    } catch (e) {
      const message = (e as Error).message || '详情图排序失败。';
      showImageFeedback(row, { tone: 'error', text: message });
      setActionFeedback({ tone: 'error', text: message });
    } finally {
      setImageActionId('');
    }
  }
  async function publishBrandSite() {
    if (!canPublishBrandLibrary || !data?.site || !publishCapability.supported) return;
    setPublishing(true);
    setPublishResult(null);
    try {
      const result = await brandSites.publish(site.id) as { ok?: boolean; log?: string };
      setPublishResult({
        ok: result.ok !== false,
        log: result.log || '发布完成，但服务端没有返回日志。',
      });
    } catch (error) {
      const requestError = error as Error & { details?: Record<string, unknown> };
      const log = typeof requestError.details?.log === 'string'
        ? requestError.details.log
        : requestError.message;
      setPublishResult({ ok: false, error: requestError.message, log });
    } finally {
      setPublishing(false);
    }
  }

  async function saveChildBrandBindings() {
    if (!canUpdateBrandLibrary || !data?.site || normalizedBrandCode !== GROUP_SITE_CODE) return;
    setSavingChildBrands(true);
    setChildBrandFeedback(null);
    try {
      await brandSites.update(data.site.id, { childBrandCodes: childBrandDraft });
      setChildBrandFeedback({ tone: 'success', text: '子品牌绑定已保存。' });
      await load();
    } catch (e) {
      setChildBrandFeedback({ tone: 'error', text: (e as Error).message || '子品牌绑定保存失败。' });
    } finally {
      setSavingChildBrands(false);
    }
  }

  return (
    <div className="brand-console-shell">
      <div className="page-container brand-console-page">
        <PageHeader
          title={`${site.nameCn || site.nameEn} 官网内容控制台`}
          subtitle="集中维护官网内容、产品货架与发布状态"
          actions={
            <>
              <button type="button" className="btn btn-outline" onClick={load} disabled={isLoading}>
                <RefreshCw size={15} />
                刷新
              </button>
              {canCreateProduct && data?.site && (
                <button type="button" className="btn btn-outline" onClick={beginProductCreate}>
                  <PackagePlus size={15} />
                  上新产品
                </button>
              )}
              {canPublishBrandLibrary && data?.site && (
                <button
                  type="button"
                  className="btn btn-brand"
                  onClick={publishBrandSite}
                  disabled={publishing || !publishCapability.supported}
                  title={publishCapability.reason}
                >
                  <Rocket size={15} />
                  {publishing ? '发布中...' : publishCapability.label}
                </button>
              )}
            </>
          }
        />

        {error && (
          <div className="brand-console-notice error" role="alert">
            {error}
          </div>
        )}
        {actionFeedback && (
          <div className={`brand-console-notice ${actionFeedback.tone}${actionFeedback.tone === 'success' ? ' is-floating' : ''}`} role="status">
            {actionFeedback.text}
          </div>
        )}

        <section className="brand-console-hero" aria-label="品牌官网摘要">
          <div className="brand-console-identity">
            <div className="brand-console-mark">
              {currentBrandLogoSrc ? (
                <img
                  src={currentBrandLogoSrc}
                  alt={`${site.nameCn || site.nameEn || site.code} Logo`}
                  onError={() => {
                    if (currentBrandLogoSrc !== fallbackLogo && fallbackLogo) {
                      setBrandLogo('');
                      setBrandLogoFailed(false);
                      return;
                    }
                    setBrandLogoFailed(true);
                  }}
                />
              ) : null}
              <span>{(site.nameEn || site.code).slice(0, 1).toUpperCase()}</span>
            </div>
            <div>
              <p className="t-label">当前品牌</p>
              <h2>{site.nameEn || site.nameCn || site.code}</h2>
              <span>{site.nameCn || site.code} / {site.code}</span>
            </div>
          </div>
          <div className="brand-console-summary">
            <SummaryItem label="站点状态">
              <span className={`badge ${meta.className}`}>{meta.label}</span>
            </SummaryItem>
            <SummaryItem label="交付方式">
              <span className="pill-neutral">
                {site.deliveryType === 'self_hosted' ? '自建站' : '外部站'}
              </span>
            </SummaryItem>
            {environmentLinks.map((environment) => (
              <SummaryItem key={environment.key} label={environment.label}>
                {environment.url ? (
                  <a
                    className="environment-link"
                    href={environment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`打开${environment.label}`}
                  >
                    <span>{environment.url}</span>
                    <ExternalLink size={13} />
                  </a>
                ) : (
                  <span className="muted-value">未配置</span>
                )}
              </SummaryItem>
            ))}
            <SummaryItem label="应用标识">
              <span>{site.appKey || '未绑定'}</span>
            </SummaryItem>
          </div>
        </section>

        <section className="brand-console-modules" aria-label="产品管理能力">
          <ConsoleModule icon={<Rows3 size={18} />} title="产品行" value={`${data?.products.length || 0} 条产品`} />
          <ConsoleModule icon={<Image size={18} />} title="图片素材" value="主图与详情图素材" />
          <ConsoleModule icon={<Settings2 size={18} />} title="分类词表" value={`${taxonomyCount} 组词表`} />
          <ConsoleModule
            icon={<Rocket size={18} />}
            title="发布备份"
            value={publishCapability.reason}
          />
        </section>

        {normalizedBrandCode === GROUP_SITE_CODE && (
          <section className="card-elevated child-brand-panel" aria-label="子品牌绑定">
            <div>
              <p className="t-label">子品牌绑定</p>
              <h2>选择可加入集团下面的子品牌</h2>
              <span>这里控制集团官网货架可选择哪些子品牌产品；集团官网前台展示暂不在本步实现。</span>
            </div>
            <div className="child-brand-options">
              {childBrandSites.length ? childBrandSites.map((childSite) => {
                const checked = childBrandDraft.includes(childSite.code);
                return (
                  <label className={checked ? 'child-brand-option selected' : 'child-brand-option'} key={childSite.code}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canUpdateBrandLibrary || savingChildBrands}
                      onChange={(event) => {
                        if (event.target.checked) setChildBrandDraft((current) => [...new Set([...current, childSite.code])]);
                        else setChildBrandDraft((current) => current.filter((code) => code !== childSite.code));
                      }}
                    />
                    <span>{childBrandLabel(childSite)}</span>
                    <small>{childSite.code}</small>
                  </label>
                );
              }) : <span className="muted-value">暂无可绑定的启用子品牌站点</span>}
            </div>
            <div className="child-brand-actions">
              {childBrandFeedback && <span className={`row-feedback ${childBrandFeedback.tone}`}>{childBrandFeedback.text}</span>}
              {canUpdateBrandLibrary ? (
                <button type="button" className="btn btn-brand btn-sm" onClick={saveChildBrandBindings} disabled={savingChildBrands || !data?.site}>
                  <Save size={13} />
                  {savingChildBrands ? '保存中...' : '保存子品牌'}
                </button>
              ) : (
                <span className="badge badge-grey">只读查看</span>
              )}
            </div>
          </section>
        )}

        {publishResult && (
          <section
            className={`brand-publish-result ${publishResult.ok ? 'success' : 'error'}`}
            aria-label="品牌发布日志"
            role={publishResult.ok ? 'status' : 'alert'}
          >
            <div className="brand-publish-result-head">
              <div>
                <p className="t-label">发布日志</p>
                <h2>{publishResult.ok ? '静态备份完成' : '静态备份失败'}</h2>
              </div>
              <span className={`badge ${publishResult.ok ? 'badge-success' : 'badge-danger'}`}>
                {publishResult.ok ? '成功' : '失败'}
              </span>
            </div>
            {publishResult.error && <p className="brand-publish-error">{publishResult.error}</p>}
            <pre>{publishResult.log}</pre>
          </section>
        )}

        <section className="card-elevated brand-product-panel" aria-label="品牌产品行">
          <div className="brand-product-head">
            <div>
              <p className="t-label">产品库</p>
              <div className="brand-product-title-row">
                <h2>{site.nameCn || site.nameEn || site.code} 官网产品</h2>
                <div className="brand-content-switch" aria-label="官网内容类型切换">
                  <button
                    type="button"
                    className={activeContentTab === 'products' ? 'is-active' : undefined}
                    aria-pressed={activeContentTab === 'products'}
                    onClick={() => setActiveContentTab('products')}
                  >
                    产品
                  </button>
                  <button
                    type="button"
                    className={activeContentTab === 'materials' ? 'is-active' : undefined}
                    aria-pressed={activeContentTab === 'materials'}
                    onClick={() => setActiveContentTab('materials')}
                  >
                    其他素材
                  </button>
                  <button
                    type="button"
                    className={activeContentTab === 'news' ? 'is-active' : undefined}
                    aria-pressed={activeContentTab === 'news'}
                    onClick={() => setActiveContentTab('news')}
                  >
                    资讯
                  </button>
                </div>
              </div>
            </div>
            <div className="brand-product-head-actions" />
          </div>
          {activeContentTab === 'products' ? (
            <>
          <WorkbenchFilterToolbar>
            <div className="brand-product-search">
              <Search size={15} />
              <input
                className="input"
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(1);
                }}
                placeholder="搜索 SKU、slug、名称、型号、分类或系统"
              />
              <select
                className="input brand-product-filter"
                value={shelfFilter}
                onChange={(event) => {
                  setShelfFilter(event.target.value as WebsiteShelfFilter);
                  setPage(1);
                }}
                aria-label="Website shelf status filter"
              >
                <option value="all">全部官网状态 ({shelfFilterCounts.all})</option>
                <option value="published">官网已上架 ({shelfFilterCounts.published})</option>
                <option value="unpublished">官网未上架 ({shelfFilterCounts.unpublished})</option>
              </select>
              <CategoryMultiSelect
                options={categoryOptions}
                value={categoryFilter}
                open={categoryFilterOpen}
                loading={categoryLoading}
                onOpenChange={setCategoryFilterOpen}
                onChange={(nextValue) => {
                  setCategoryFilter(nextValue);
                  setPage(1);
                }}
              />
              <select
                className="input brand-product-filter legacy-category-select"
                value=""
                disabled={categoryLoading && !categoryOptions.length}
                onChange={(event) => {
                  setCategoryFilter(event.target.value ? [event.target.value] : []);
                  setPage(1);
                }}
                aria-label="Product category filter"
              >
                <option value="">全部分类</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {isLoading && data ? (
              <span className="badge badge-info brand-product-sync-badge" role="status">
                同步中
              </span>
            ) : null}
            {categoryError && <span className="row-feedback error">{categoryError}</span>}
            {shelfError && <span className="row-feedback error">{shelfError}</span>}
          </WorkbenchFilterToolbar>
          <WorkbenchTableShell>
          {selectedVisibleProducts.length ? (
            <div className="brand-product-bulk-bar" role="status">
              <span>已选 {selectedVisibleProducts.length} 个产品</span>
              <div className="brand-product-bulk-actions">
                {canPublishBrandLibrary && (
                <button
                  type="button"
                  className="btn btn-brand btn-sm"
                  onClick={() => runBatchShelfAction('publishing')}
                  disabled={Boolean(bulkShelfAction)}
                >
                  <Rocket size={13} />
                  {bulkShelfAction === 'publishing' ? '批量官网上架中' : '批量官网上架'}
                </button>
                )}
                {canUpdateBrandLibrary && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => runBatchShelfAction('hiding')}
                  disabled={Boolean(bulkShelfAction)}
                >
                  <EyeOff size={13} />
                  {bulkShelfAction === 'hiding' ? '批量官网下架中' : '批量官网下架'}
                </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => toggleVisibleProductSelection(false)}
                  disabled={Boolean(bulkShelfAction)}
                >
                  取消选择
                </button>
              </div>
            </div>
          ) : null}
          {actionFeedback && (
            <div className={`brand-product-inline-feedback ${actionFeedback.tone}`} role={actionFeedback.tone === 'error' ? 'alert' : 'status'}>
              {actionFeedback.text}
            </div>
          )}
          <div className="brand-product-table-wrap">
            <table className="table brand-product-table">
              <thead>
                <tr>
                  {PRODUCT_TABLE_COLUMNS.map((column, index) => (
                    <th key={`${column || 'select'}-${index}`}>
                      {index === 0 ? (
                        <input
                          type="checkbox"
                          className="brand-product-select-checkbox"
                          checked={allVisibleSelected}
                          disabled={!visibleProductIds.length || (!canPublishBrandLibrary && !canUpdateBrandLibrary) || Boolean(bulkShelfAction)}
                          ref={(node) => {
                            if (node) node.indeterminate = someVisibleSelected && !allVisibleSelected;
                          }}
                          onChange={(event) => toggleVisibleProductSelection(event.target.checked)}
                          aria-label="选择当前页全部产品"
                        />
                      ) : column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={isLoading && data ? 'is-refreshing' : undefined}>
                {isInitialLoading ? (
                  <tr>
                    <td colSpan={PRODUCT_TABLE_COLUMNS.length} className="brand-product-empty">
                      <WorkbenchTableState
                        type="loading"
                        title="正在加载品牌产品行"
                        description="正在读取品牌官网主数据、产品目录和分类词表。"
                      />
                    </td>
                  </tr>
                ) : data?.emptyState ? (
                  <tr>
                    <td colSpan={PRODUCT_TABLE_COLUMNS.length} className="brand-product-empty">
                      <WorkbenchTableState
                        type="empty"
                        title={data.emptyState.kind === 'no-products' ? '该品牌还没有官网产品' : data.emptyState.title}
                        description={data.emptyState.description}
                        action={
                          <a className="btn btn-brand btn-sm" href={data.emptyState.actionHref}>
                            {data.emptyState.actionLabel}
                            <ExternalLink size={13} />
                          </a>
                        }
                      />
                    </td>
                  </tr>
                ) : visibleProducts.length ? (
                  visibleProducts.map((product) => (
                    <ProductSummaryRow
                      key={product.id || product.sku}
                      product={product}
                      canWrite={canWrite}
                      canPublishShelf={canPublishWebsiteShelf}
                      canHideShelf={canUpdateBrandLibrary}
                      feedback={rowFeedback[product.id]}
                      shelfAssignment={assignmentByProductId.get(product.id)}
                      shelfLoading={shelfLoading}
                      shelfBusy={shelfBusyProductId === product.id || Boolean(shelfTransitions[product.id])}
                      shelfTransition={shelfTransitions[product.id]}
                      shelfFeedback={rowFeedback[`${product.id}:shelf`]}
                      selected={selectedProductIds.includes(product.id)}
                      selectionDisabled={(!canPublishBrandLibrary && !canUpdateBrandLibrary) || Boolean(bulkShelfAction)}
                      onSelectionChange={(checked) => toggleProductSelection(product.id, checked)}
                      onEdit={() => beginProductEdit(product)}
                      onPublishShelf={() => publishWebsiteShelf(product)}
                      onHideShelf={() => hideWebsiteShelf(product)}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={PRODUCT_TABLE_COLUMNS.length} className="brand-product-empty">
                      <WorkbenchTableState
                        type="empty"
                        title="没有匹配当前搜索的产品"
                        description="清空搜索关键词后返回品牌产品列表。"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <WorkbenchPaginationFooter
            currentPage={footerCurrentPage}
            totalPages={footerTotalPages}
            totalItems={footerTotalProducts}
            pageSize={pageSize}
            pageSizeOptions={PRODUCT_PAGE_SIZE_OPTIONS}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
            onPageChange={isLoading ? undefined : (nextPage) => setPage(nextPage)}
            onPrevious={isLoading || footerCurrentPage <= 1 ? undefined : () => setPage((current) => Math.max(current - 1, 1))}
            onNext={isLoading || footerCurrentPage >= footerTotalPages ? undefined : () => setPage((current) => current + 1)}
          />
          </WorkbenchTableShell>
          {showCreate && canCreateProduct && (
            <ProductEditModal
              mode="create"
              product={createProductPreview}
              brandCode={normalizedBrandCode}
              canWrite={canCreateProduct}
              canUpdateStatus={false}
              canArchiveProduct={false}
              canPublishShelf={false}
              canHideShelf={false}
              categoryOptions={categoryOptions}
              draft={createDraft}
              structuredDraft={createStructuredDraft}
              manualPdfs={createManualPdfs}
              officialDetailDirty={false}
              taxonomy={data?.taxonomy || {}}
              saving={creating}
              savingStructured={false}
              feedback={createError ? { tone: 'error', text: createError } : undefined}
              shelfLoading={false}
              shelfBusy={false}
              actionBusy={false}
              imageBusy={false}
              onChange={(patch) => setCreateDraft((current) => ({ ...current, ...patch }))}
              onStructuredChange={(patch) => setCreateStructuredDraft((current) => ({ ...current, ...patch }))}
              onManualPdfsChange={setCreateManualPdfs}
              onSave={createProduct}
              onReset={() => {
                createManualPdfs.forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
                setCreateDraft(blankNewProductDraft(normalizedBrandCode));
                setCreateStructuredDraft(blankCreateStructuredDraft(normalizedBrandCode));
                setCreateManualPdfs([]);
              }}
              onStructuredSave={() => {}}
              onStructuredReset={() => {}}
              onClose={closeProductCreate}
              onToggleStatus={() => {}}
              onArchive={() => {}}
              onPublishShelf={() => {}}
              onHideShelf={() => {}}
              onUploadMainImage={() => {}}
              onDeleteMainImage={() => {}}
              onUploadDetailImage={() => {}}
              onDeleteDetailImage={() => {}}
              onMoveDetailImage={() => {}}
            />
          )}
          {editingProduct && (
            <ProductEditModal
              mode="edit"
              product={editingProduct}
              brandCode={normalizedBrandCode}
              canWrite={canWrite}
              canUpdateStatus={canPublishProduct}
              canArchiveProduct={canDeleteProduct}
              canPublishShelf={canPublishWebsiteShelf}
              canHideShelf={canUpdateBrandLibrary}
              categoryOptions={categoryOptions}
              draft={drafts[editingProduct.id] || draftFromProductRow(editingProduct)}
              structuredDraft={structuredDraft(editingProduct)}
              officialDetailHtml={officialDetailDrafts[editingProduct.id] || ''}
              officialDetailDirty={(officialDetailDrafts[editingProduct.id] || '') !== (officialDetailInitials[editingProduct.id] || '')}
              manualPdfs={manualPdfDrafts[editingProduct.id] || savedProductManualPdfs(editingProduct)}
              manualPdfsDirty={productManualPdfsChanged(editingProduct, manualPdfDrafts[editingProduct.id] || savedProductManualPdfs(editingProduct))}
              taxonomy={data?.taxonomy || {}}
              saving={savingId === editingProduct.id}
              savingStructured={savingStructuredId === editingProduct.id}
              feedback={rowFeedback[editingProduct.id]}
              structuredFeedback={rowFeedback[`${editingProduct.id}:structured`]}
              officialDetailFeedback={rowFeedback[`${editingProduct.id}:official-detail`]}
              shelfAssignment={assignmentByProductId.get(editingProduct.id)}
              shelfLoading={shelfLoading}
              shelfBusy={shelfBusyProductId === editingProduct.id}
              shelfTransition={shelfTransitions[editingProduct.id]}
              shelfFeedback={rowFeedback[`${editingProduct.id}:shelf`]}
              actionBusy={actionProductId === editingProduct.id}
              imageBusy={imageActionId.startsWith(`${editingProduct.id}:`)}
              imageFeedback={imageFeedback[`${editingProduct.id}:image`]}
              onChange={(patch) => updateDraft(editingProduct.id, patch)}
              onStructuredChange={(patch) => updateStructuredDraft(editingProduct.id, patch)}
              onOfficialDetailChange={(officialDetailHtml) => setOfficialDetailDrafts((current) => ({ ...current, [editingProduct.id]: officialDetailHtml }))}
              onOfficialDetailFeedback={(detailFeedback) => setRowFeedback((current) => ({ ...current, [`${editingProduct.id}:official-detail`]: detailFeedback }))}
              onManualPdfsChange={(manualPdfs) => setManualPdfDrafts((current) => ({ ...current, [editingProduct.id]: manualPdfs }))}
              onSave={(overrides) => saveRow(editingProduct, overrides)}
              onReset={() => resetDraft(editingProduct)}
              onStructuredSave={() => saveStructured(editingProduct)}
              onStructuredReset={() => resetStructuredDraft(editingProduct)}
              onClose={() => closeProductEdit(editingProduct)}
              onToggleStatus={() => toggleStatus(editingProduct)}
              onArchive={() => archiveProduct(editingProduct)}
              onPublishShelf={() => publishWebsiteShelf(editingProduct)}
              onHideShelf={() => hideWebsiteShelf(editingProduct)}
              onUploadMainImage={(file) => uploadMainImage(editingProduct, file)}
              onDeleteMainImage={() => deleteMainImage(editingProduct)}
              onUploadDetailImage={(file) => uploadDetailImage(editingProduct, file)}
              onDeleteDetailImage={(artifactId) => deleteDetailImage(editingProduct, artifactId)}
              onMoveDetailImage={(artifactId, direction) => moveDetailImage(editingProduct, artifactId, direction)}
            />
          )}
            </>
          ) : activeContentTab === 'materials' ? (
            <SiteMaterialMockPanel brandCode={normalizedBrandCode} />
          ) : (
            <SiteNewsPanel
              siteCode={site.code || normalizedBrandCode}
              siteAssetBaseUrl={site.developmentUrl || site.productionUrl || site.resolvedUrl || ''}
              canWrite={canUpdateBrandLibrary}
            />
          )}
        </section>
      </div>

      <style>{`
        .brand-console-shell {
          min-height: 100%;
          background: linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%);
        }
        .brand-console-page {
          display: grid;
          gap: 12px;
          width: 100%;
          max-width: none;
        }
        .brand-console-notice {
          padding: 10px 12px;
          border: 1px solid;
          border-radius: var(--r-sm);
          font-size: 13px;
          font-weight: 600;
        }
        .brand-console-notice.success {
          color: var(--success);
          background: var(--success-bg);
          border-color: rgba(120, 157, 74, 0.28);
        }
        .brand-console-notice.is-floating {
          position: fixed;
          top: 76px;
          right: 24px;
          z-index: 40;
          max-width: min(420px, calc(100vw - 48px));
          box-shadow: var(--sh-card);
        }
        .brand-console-notice.error {
          color: var(--danger);
          background: var(--danger-bg);
          border-color: rgba(220, 38, 38, 0.22);
        }
        .brand-publish-result {
          display: grid;
          gap: 12px;
          padding: 16px 18px;
          background: var(--surface-1);
          border: 1px solid var(--border);
          border-left: 3px solid var(--success);
          border-radius: var(--r-lg);
          box-shadow: var(--sh-card);
        }
        .brand-publish-result.error {
          border-left-color: var(--danger);
        }
        .brand-publish-result-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .brand-publish-result h2 {
          margin: 2px 0 0;
          color: var(--t-strong);
          font-size: 16px;
        }
        .brand-publish-error {
          margin: 0;
          color: var(--danger);
          font-size: 13px;
          font-weight: 600;
        }
        .brand-publish-result pre {
          max-height: 260px;
          margin: 0;
          overflow: auto;
          padding: 12px;
          color: var(--t-primary);
          background: var(--surface-3);
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .brand-console-hero {
          display: grid;
          grid-template-columns: minmax(260px, 360px) 1fr;
          gap: 14px;
          align-items: stretch;
        }
        .brand-console-identity,
        .brand-console-summary,
        .brand-console-modules,
        .brand-product-panel {
          background: var(--surface-1);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          box-shadow: var(--sh-card);
        }
        .brand-console-identity {
          display: flex;
          align-items: center;
          gap: 16px;
          min-height: 132px;
          padding: 18px;
          border-top: 3px solid var(--brand);
        }
        .brand-console-mark {
          width: 56px;
          height: 56px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: var(--r-lg);
          color: #fff;
          background: #fff;
          border: 1px solid var(--border);
          font-size: 24px;
          font-weight: 800;
          box-shadow: var(--sh-xs);
          overflow: hidden;
          position: relative;
        }
        .brand-console-mark img {
          width: 48px;
          max-height: 48px;
          object-fit: contain;
          background: #fff;
          position: relative;
          z-index: 1;
        }
        .brand-console-mark img:not([style*="display: none"]) + span {
          display: none;
        }
        .brand-console-mark span {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: var(--brand);
        }
        .brand-console-identity h2 {
          margin: 4px 0 2px;
          color: var(--t-strong);
          font-size: 24px;
          line-height: 1.2;
        }
        .brand-console-identity span,
        .muted-value {
          color: var(--t-tertiary);
          font-size: 13px;
        }
        .brand-console-summary {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          overflow: hidden;
        }
        .summary-item {
          min-width: 0;
          min-height: 132px;
          display: grid;
          align-content: center;
          gap: 8px;
          padding: 16px;
          border-left: 1px solid var(--border);
        }
        .summary-item > div {
          min-width: 0;
        }
        .summary-item:first-child {
          border-left: 0;
        }
        .summary-item label {
          color: var(--t-tertiary);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .summary-item a {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
          max-width: 100%;
          color: var(--brand);
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
        }
        .summary-item a span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .brand-console-modules {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          overflow: hidden;
        }
        .console-module {
          min-height: 104px;
          display: grid;
          align-content: center;
          gap: 8px;
          padding: 16px;
          border-left: 1px solid var(--border);
        }
        .console-module:first-child {
          border-left: 0;
        }
        .console-module svg {
          color: var(--brand);
        }
        .console-module strong {
          color: var(--t-primary);
          font-size: 14px;
        }
        .console-module span {
          color: var(--t-secondary);
          font-size: 12px;
        }
        .brand-product-panel {
          min-height: 481px;
          overflow: visible;
        }
        .brand-product-panel .workbench-table-shell {
          overflow: visible;
          border: 0;
          border-top: 1px solid var(--border);
          border-radius: 0;
          box-shadow: none;
        }
        .child-brand-panel {
          display: grid;
          gap: 14px;
          padding: 16px 18px;
        }
        .child-brand-panel h2 {
          margin: 2px 0 4px;
          color: var(--t-strong);
          font-size: 18px;
        }
        .child-brand-panel span {
          color: var(--t-secondary);
          font-size: 13px;
        }
        .child-brand-options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .child-brand-option {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 36px;
          padding: 7px 10px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-1);
          cursor: pointer;
        }
        .child-brand-option.selected {
          border-color: var(--brand);
          background: var(--brand-soft);
        }
        .child-brand-option input {
          width: 15px;
          height: 15px;
          accent-color: var(--brand);
        }
        .child-brand-option small {
          color: var(--t-tertiary);
          font-size: 11px;
          font-weight: 800;
        }
        .child-brand-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }
        .brand-product-head {
          min-height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }
        .brand-product-head h2 {
          margin: 2px 0 0;
          color: var(--t-strong);
          font-size: 18px;
          line-height: 1.25;
        }
        .brand-product-title-row,
        .brand-product-head-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .brand-product-legacy-title {
          color: var(--t-tertiary);
          font-size: 12px;
          font-weight: 700;
        }
        .brand-content-switch {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 2px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-2);
        }
        .brand-content-switch button {
          width: max-content;
          min-height: 28px;
          padding: 0 10px;
          border: 0;
          border-radius: calc(var(--r-sm) - 2px);
          color: var(--t-secondary);
          background: transparent;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: none;
        }
        .brand-content-switch button:hover {
          color: var(--t-strong);
          background: var(--surface-1);
        }
        .brand-content-switch button.is-active {
          color: #fff;
          background: var(--brand);
          box-shadow: var(--sh-xs);
        }
        .brand-product-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }
        .brand-product-search {
          flex: 1 1 360px;
          max-width: 820px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--t-tertiary);
        }
        .brand-product-search > .input:first-of-type {
          min-width: 220px;
          flex: 1 1 280px;
        }
        .brand-product-filter {
          width: 150px;
          flex: 0 0 150px;
        }
        .legacy-category-select {
          display: none;
        }
        .category-filter-select {
          position: relative;
          flex: 0 0 240px;
          width: 240px;
          color: var(--t-primary);
        }
        .category-filter-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          text-align: left;
          cursor: pointer;
        }
        .category-filter-trigger span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .category-filter-trigger.is-open {
          border-color: var(--brand);
          box-shadow: 0 0 0 2px rgba(228, 0, 43, 0.08);
        }
        .category-filter-menu {
          position: absolute;
          z-index: 40;
          top: calc(100% + 6px);
          left: 0;
          width: 320px;
          max-width: min(360px, calc(100vw - 48px));
          max-height: min(384px, calc(100vh - 160px));
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-1);
          box-shadow: var(--sh-lg);
          animation: categoryDropdownIn 140ms ease-out both;
        }
        .category-filter-all,
        .category-filter-option {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 34px;
          padding: 7px 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .category-filter-all {
          border-bottom: 1px solid var(--border);
          background: color-mix(in srgb, var(--surface-2) 72%, var(--surface-1) 28%);
        }
        .category-filter-options {
          flex: 1 1 auto;
          max-height: none;
          min-height: 88px;
          overflow-y: auto;
          padding: 4px 0;
        }
        .category-filter-actions {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding: 8px 10px;
          border-top: 1px solid var(--border);
          background: var(--surface-1);
        }
        .category-filter-option:hover {
          background: color-mix(in srgb, var(--brand-50) 30%, var(--surface-1) 70%);
        }
        .category-filter-option.child {
          padding-left: 30px;
          color: var(--t-secondary);
          font-weight: 600;
        }
        .category-filter-option input,
        .category-filter-all input {
          width: 14px;
          height: 14px;
          accent-color: var(--brand);
        }
        .category-single-field {
          position: relative;
          z-index: 6;
        }
        .category-filter-select--single {
          width: 100%;
          flex: 1 1 auto;
        }
        .category-filter-menu--single {
          width: min(360px, calc(100vw - 64px));
        }
        .brand-product-page-size {
          width: 112px;
          flex: 0 0 112px;
        }
        .brand-product-sync-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          margin-left: auto;
          min-width: 64px;
          min-height: 28px;
          padding: 0 10px;
          white-space: nowrap;
          animation: productSyncPulse 0.9s ease-in-out infinite alternate;
        }
        .brand-product-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          color: var(--t-secondary);
          border-top: 1px solid var(--border);
          font-size: 13px;
          font-weight: 700;
        }
        .brand-product-page-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brand-product-page-actions strong {
          color: var(--t-strong);
          font-size: 13px;
        }
        .brand-product-table-wrap {
          width: 100%;
          overflow-x: auto;
          background: var(--surface-1);
        }
        .brand-product-bulk-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 16px;
          border-bottom: 1px solid var(--border);
          background: color-mix(in srgb, var(--brand-50) 42%, var(--surface-1) 58%);
          color: var(--t-primary);
          font-size: 13px;
          font-weight: 800;
          animation: productRowFadeIn 0.16s ease-out both;
        }
        .brand-product-bulk-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }
        .brand-product-inline-feedback {
          margin: 0;
          padding: 10px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-1);
          color: var(--t-secondary);
          font-size: 13px;
          font-weight: 800;
        }
        .brand-product-inline-feedback.success {
          background: #f0fdf4;
          color: #166534;
        }
        .brand-product-inline-feedback.error {
          background: #fff1f2;
          color: #be123c;
        }
        .brand-product-table {
          width: 100%;
          min-width: 1160px;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: fixed;
        }
        .brand-product-table th,
        .brand-product-table td {
          min-width: 0;
          height: 52px;
          padding: 7px 12px;
          overflow: hidden;
          vertical-align: middle;
        }
        .brand-product-table th {
          height: 34px;
          padding-top: 5px;
          padding-bottom: 5px;
          color: var(--t-tertiary);
          background: color-mix(in srgb, var(--surface-2) 70%, var(--surface-1) 30%);
          border-bottom: 1px solid var(--border);
          font-size: 11px;
          font-weight: 800;
          text-align: center;
          vertical-align: middle;
        }
        .brand-product-table tbody tr {
          background: var(--surface-1);
          animation: productRowFadeIn 0.16s ease-out both;
          transition: background 0.14s ease, box-shadow 0.14s ease, opacity 0.18s ease, transform 0.18s ease;
        }
        .brand-product-table tbody.is-refreshing tr {
          opacity: 0.72;
        }
        .brand-product-table tbody tr:nth-child(even) {
          background: color-mix(in srgb, var(--surface-2) 45%, var(--surface-1) 55%);
        }
        .brand-product-table tbody tr:hover {
          background: color-mix(in srgb, var(--brand-50) 32%, var(--surface-1) 68%);
        }
        .brand-product-table tbody tr.is-selected {
          background: color-mix(in srgb, var(--brand-50) 48%, var(--surface-1) 52%);
        }
        .brand-product-table tbody td {
          border-bottom: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
        }
        @keyframes productRowFadeIn {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes categoryDropdownIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes productSyncPulse {
          from { opacity: 0.62; }
          to { opacity: 1; }
        }
        .brand-product-table th:nth-child(1),
        .brand-product-table td:nth-child(1) {
          width: 4%;
          text-align: center;
        }
        .brand-product-select-checkbox {
          width: 16px;
          height: 16px;
          accent-color: var(--brand);
          cursor: pointer;
        }
        .brand-product-select-checkbox:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }
        .brand-product-table th:nth-child(2),
        .brand-product-table td:nth-child(2) {
          width: 18%;
        }
        .brand-product-table th:nth-child(3),
        .brand-product-table td:nth-child(3) {
          width: 24%;
        }
        .brand-product-table th:nth-child(4),
        .brand-product-table td:nth-child(4) {
          width: 14%;
        }
        .brand-product-table th:nth-child(5),
        .brand-product-table td:nth-child(5) {
          width: 9%;
        }
        .brand-product-table th:nth-child(6),
        .brand-product-table td:nth-child(6) {
          width: 7%;
          text-align: center;
          white-space: nowrap;
        }
        .brand-product-table th:nth-child(7),
        .brand-product-table td:nth-child(7) {
          width: 11%;
          text-align: center;
          white-space: nowrap;
        }
        .brand-product-table th:nth-child(8),
        .brand-product-table td:nth-child(8) {
          width: 13%;
          text-align: center;
          white-space: nowrap;
        }
        .brand-product-table td:nth-child(3) {
          text-align: left;
        }
        .brand-product-table th:nth-child(2),
        .brand-product-table td:nth-child(2),
        .brand-product-table td:nth-child(3),
        .brand-product-table th:nth-child(4),
        .brand-product-table td:nth-child(4),
        .brand-product-table th:nth-child(5),
        .brand-product-table td:nth-child(5),
        .brand-product-table th:nth-child(6),
        .brand-product-table td:nth-child(6),
        .brand-product-table th:nth-child(7),
        .brand-product-table td:nth-child(7),
        .brand-product-table th:nth-child(8),
        .brand-product-table td:nth-child(8) {
          text-align: center;
        }
        .site-material-panel {
          display: grid;
          gap: 14px;
          min-height: 397px;
          padding: 16px;
          border-top: 1px solid var(--border);
          background: var(--surface-2);
        }
        .site-material-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .site-material-panel-head h3 {
          margin: 2px 0 0;
          color: var(--t-strong);
          font-size: 16px;
        }
        .site-material-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .site-material-item {
          display: grid;
          gap: 9px;
          min-height: 132px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-1);
        }
        .site-material-item strong {
          color: var(--t-strong);
          font-size: 14px;
        }
        .site-material-item span {
          color: var(--t-secondary);
          font-size: 12px;
        }
        .site-material-spec {
          display: inline-flex;
          width: fit-content;
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(228, 0, 43, 0.08);
          color: var(--brand-500);
          font-size: 12px;
          font-weight: 700;
        }
        .site-material-file {
          min-width: 0;
          overflow: hidden;
          color: var(--t-secondary);
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .site-material-item-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: auto;
        }
        .site-material-transfer-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
        }
        .site-news-panel {
          display: grid;
          gap: 14px;
          min-height: 397px;
          padding: 16px;
          border-top: 1px solid var(--border);
          background: var(--surface-2);
        }
        .site-news-panel .product-create-panel {
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--surface-1);
          box-shadow: var(--sh-xs);
        }
        .site-news-table {
          min-width: 980px;
        }
        .site-news-table th:nth-child(1),
        .site-news-table td:nth-child(1) {
          width: 116px;
          text-align: center;
        }
        .site-news-table th:nth-child(2),
        .site-news-table td:nth-child(2) {
          width: auto;
          text-align: left;
        }
        .site-news-table th:nth-child(3),
        .site-news-table td:nth-child(3),
        .site-news-table th:nth-child(4),
        .site-news-table td:nth-child(4),
        .site-news-table th:nth-child(5),
        .site-news-table td:nth-child(5) {
          width: 120px;
          text-align: center;
        }
        .site-news-table th:nth-child(6),
        .site-news-table td:nth-child(6) {
          width: 260px;
          text-align: right;
        }
        .site-news-thumb {
          width: 82px;
          height: 54px;
          margin: 0 auto;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-2) center/cover no-repeat;
          box-shadow: var(--sh-xs);
        }
        .site-news-preview-card {
          display: grid;
          grid-template-columns: 240px minmax(0, 1fr);
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--surface-1);
          box-shadow: var(--sh-xs);
        }
        .site-news-preview-img {
          min-height: 150px;
          background: var(--surface-2) center/cover no-repeat;
        }
        .site-news-preview-grid {
          display: grid;
          grid-template-columns: minmax(280px, 0.85fr) minmax(320px, 1.15fr);
          gap: 12px;
          align-items: start;
        }
        .site-news-preview-pane {
          min-width: 0;
          display: grid;
          gap: 8px;
        }
        .news-preview-body {
          display: grid;
          align-content: center;
          gap: 8px;
          padding: 18px;
        }
        .news-preview-body span {
          color: var(--t-tertiary);
          font-size: 11px;
          font-weight: 800;
        }
        .news-preview-body strong {
          color: var(--t-strong);
          font-size: 15px;
        }
        .news-preview-body p {
          margin: 0;
          color: var(--t-secondary);
          font-size: 12px;
          line-height: 1.65;
        }
        .site-news-detail-preview {
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--surface-1);
          box-shadow: var(--sh-xs);
        }
        .site-news-detail-preview-img {
          height: 180px;
          background: var(--surface-2) center/cover no-repeat;
        }
        .site-news-detail-preview-body {
          display: grid;
          gap: 8px;
          padding: 18px;
        }
        .site-news-detail-preview-body > span {
          color: var(--t-tertiary);
          font-size: 11px;
          font-weight: 800;
        }
        .site-news-detail-preview-body h4 {
          margin: 0;
          color: var(--t-strong);
          font-size: 18px;
          line-height: 1.35;
        }
        .site-news-detail-preview-body > p {
          margin: 0;
          color: var(--t-secondary);
          font-size: 13px;
          line-height: 1.7;
        }
        .site-news-detail-preview-content {
          display: grid;
          gap: 8px;
          padding-top: 6px;
          border-top: 1px solid var(--border);
          color: var(--t-primary);
          font-size: 13px;
          line-height: 1.75;
        }
        .site-news-detail-preview-content :where(p, ul, ol, blockquote, h2, h3) {
          margin: 0;
        }
        .site-news-detail-preview-content [data-align="center"],
        .site-news-richtext-editor [data-align="center"] {
          text-align: center;
        }
        .site-news-detail-preview-content [data-align="right"],
        .site-news-richtext-editor [data-align="right"] {
          text-align: right;
        }
        .site-news-detail-preview-content [data-align="justify"],
        .site-news-richtext-editor [data-align="justify"] {
          text-align: justify;
        }
        .site-news-detail-preview-content [data-indent="1"],
        .site-news-richtext-editor [data-indent="1"] {
          padding-left: 1.5em;
        }
        .site-news-detail-preview-content [data-indent="2"],
        .site-news-richtext-editor [data-indent="2"] {
          padding-left: 3em;
        }
        .site-news-detail-preview-content [data-indent="3"],
        .site-news-richtext-editor [data-indent="3"] {
          padding-left: 4.5em;
        }
        .site-news-detail-preview-content [data-size="12"],
        .site-news-richtext-editor [data-size="12"] { font-size: 12px; }
        .site-news-detail-preview-content [data-size="14"],
        .site-news-richtext-editor [data-size="14"] { font-size: 14px; }
        .site-news-detail-preview-content [data-size="16"],
        .site-news-richtext-editor [data-size="16"] { font-size: 16px; }
        .site-news-detail-preview-content [data-size="18"],
        .site-news-richtext-editor [data-size="18"] { font-size: 18px; }
        .site-news-detail-preview-content [data-size="20"],
        .site-news-richtext-editor [data-size="20"] { font-size: 20px; }
        .site-news-detail-preview-content [data-size="24"],
        .site-news-richtext-editor [data-size="24"] { font-size: 24px; }
        .site-news-detail-preview-content [data-size="28"],
        .site-news-richtext-editor [data-size="28"] { font-size: 28px; }
        .site-news-detail-preview-content [data-color="ink"],
        .site-news-richtext-editor [data-color="ink"] { color: var(--t-strong); }
        .site-news-detail-preview-content [data-color="gray"],
        .site-news-richtext-editor [data-color="gray"] { color: var(--t-secondary); }
        .site-news-detail-preview-content [data-color="muted"],
        .site-news-richtext-editor [data-color="muted"] { color: var(--t-tertiary); }
        .site-news-detail-preview-content [data-color="brand"],
        .site-news-richtext-editor [data-color="brand"] { color: var(--brand); }
        .site-news-detail-preview-content [data-bg="soft"],
        .site-news-richtext-editor [data-bg="soft"] { background: var(--surface-2); }
        .site-news-detail-preview-content [data-bg="brand-soft"],
        .site-news-richtext-editor [data-bg="brand-soft"] { background: var(--brand-50); }
        .site-news-detail-preview-content [data-bg="warning-soft"],
        .site-news-richtext-editor [data-bg="warning-soft"] { background: var(--warning-bg); }
        .site-news-detail-preview-content code,
        .site-news-richtext-editor code {
          padding: 1px 5px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-2);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 0.92em;
        }
        .site-news-detail-preview-content :where(ul, ol) {
          padding-left: 1.25em;
        }
        .site-news-detail-preview-content :where(h2, h3) {
          color: var(--t-strong);
          font-size: 15px;
          line-height: 1.4;
        }
        .site-news-detail-preview-content blockquote {
          margin: 2px 0;
          padding: 10px 12px;
          border-left: 3px solid var(--brand);
          border-radius: 0 var(--r-sm) var(--r-sm) 0;
          background: var(--surface-2);
          color: var(--t-secondary);
          font-size: 13px;
          line-height: 1.75;
        }
        .site-news-detail-preview-content blockquote p {
          margin: 0;
        }
        .site-news-detail-preview-content a {
          color: var(--brand);
          font-weight: 700;
        }
        .site-news-detail-preview-content figure,
        .site-news-richtext-editor figure {
          display: table;
          width: auto;
          max-width: 100%;
          margin: 8px 0;
        }
        .site-news-detail-preview-content figure[data-align="center"],
        .site-news-richtext-editor figure[data-align="center"] {
          margin-left: auto;
          margin-right: auto;
        }
        .site-news-detail-preview-content figure[data-align="right"],
        .site-news-richtext-editor figure[data-align="right"] {
          margin-left: auto;
          margin-right: 0;
        }
        .site-news-detail-preview-content figure[data-size="small"],
        .site-news-richtext-editor figure[data-size="small"] {
          width: 38%;
        }
        .site-news-detail-preview-content figure[data-size="medium"],
        .site-news-richtext-editor figure[data-size="medium"] {
          width: 62%;
        }
        .site-news-detail-preview-content figure[data-size="large"],
        .site-news-richtext-editor figure[data-size="large"] {
          width: 82%;
        }
        .site-news-detail-preview-content figure[data-size="full"],
        .site-news-richtext-editor figure[data-size="full"] {
          width: 100%;
        }
        .site-news-detail-preview-content figure img,
        .site-news-richtext-editor figure img,
        .site-news-detail-preview-content > img,
        .site-news-richtext-editor > img {
          display: block;
          width: 100%;
          max-width: 100%;
          height: auto;
          margin: 0;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--surface-2);
          box-shadow: var(--sh-xs);
        }
        .site-news-detail-preview-content > img[data-size="small"],
        .site-news-richtext-editor > img[data-size="small"] {
          width: 38%;
        }
        .site-news-detail-preview-content > img[data-size="medium"],
        .site-news-richtext-editor > img[data-size="medium"] {
          width: 62%;
        }
        .site-news-detail-preview-content > img[data-size="large"],
        .site-news-richtext-editor > img[data-size="large"] {
          width: 82%;
        }
        .site-news-detail-preview-content > img[data-size="full"],
        .site-news-richtext-editor > img[data-size="full"] {
          width: 100%;
        }
        .site-news-richtext-editor img.is-selected {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(228, 0, 43, 0.14);
        }
        .site-news-detail-preview-content figcaption,
        .site-news-richtext-editor figcaption {
          margin-top: 6px;
          color: var(--t-tertiary);
          font-size: 12px;
          line-height: 1.55;
          text-align: center;
        }
        .site-news-richtext {
          overflow: hidden;
          border: 1px solid var(--border-2);
          border-radius: var(--r-lg);
          background: var(--surface-1);
          box-shadow: var(--sh-xs);
        }
        .site-news-richtext:focus-within {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(228, 0, 43, 0.14);
        }
        .site-news-richtext-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 8px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
        }
        .site-news-richtext-file {
          display: none;
        }
        .site-news-image-size-tools {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding-left: 4px;
          border-left: 1px solid var(--border);
        }
        .site-news-image-size-btn {
          min-width: 26px;
          min-height: 28px;
          padding: 0 7px;
          border: 1px solid var(--border-2);
          border-radius: var(--r-sm);
          background: var(--surface-1);
          color: var(--t-secondary);
          font-size: 11px;
          font-weight: 700;
        }
        .site-news-image-size-btn.active {
          color: var(--brand);
          border-color: var(--brand-100);
          background: var(--brand-50);
        }
        .site-news-image-size-btn.danger {
          color: var(--danger);
        }
        .site-news-image-size-btn:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }
        .site-news-format-btn {
          min-width: 30px;
          min-height: 30px;
          padding: 0 8px;
          border: 1px solid var(--border-2);
          border-radius: var(--r-sm);
          background: var(--surface-1);
          color: var(--t-primary);
          font-size: 12px;
          font-weight: 700;
        }
        .site-news-format-btn.active,
        .site-news-tool-btn.active {
          color: var(--brand);
          border-color: var(--brand-100);
          background: var(--brand-50);
          box-shadow: inset 0 0 0 1px rgba(228, 0, 43, 0.14);
        }
        .site-news-richtext-select {
          min-height: 30px;
          padding: 0 8px;
          border: 1px solid var(--border-2);
          border-radius: var(--r-sm);
          background: var(--surface-1);
          color: var(--t-primary);
          font-size: 12px;
          font-weight: 700;
        }
        .site-news-richtext-editor {
          min-height: 168px;
          max-height: 320px;
          overflow: auto;
          padding: 10px 12px;
          color: var(--t-primary);
          font-size: 14px;
          line-height: 1.75;
          outline: none;
        }
        .site-news-richtext-editor:empty::before {
          content: attr(data-placeholder);
          color: var(--t-disabled);
        }
        .site-news-richtext-editor :where(p, ul, ol, blockquote, h2, h3) {
          margin: 0 0 8px;
        }
        .site-news-richtext-editor :where(ul, ol) {
          padding-left: 1.25em;
        }
        .site-news-richtext-editor :where(h2, h3) {
          color: var(--t-strong);
          line-height: 1.4;
        }
        .site-news-richtext-editor h2 {
          font-size: 18px;
        }
        .site-news-richtext-editor h3 {
          font-size: 15px;
        }
        .site-news-richtext-editor blockquote {
          margin: 0 0 8px;
          padding: 8px 10px;
          border-left: 3px solid var(--brand);
          background: var(--surface-2);
          color: var(--t-secondary);
        }
        .site-news-richtext-editor a {
          color: var(--brand);
          font-weight: 700;
        }
        .brand-product-table tr.is-dirty td {
          background: rgba(78, 154, 61, 0.05);
        }
        .product-create-panel {
          display: grid;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
        }
        .product-create-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(160px, 1fr));
          gap: 10px;
        }
        .product-create-field {
          display: grid;
          gap: 5px;
          color: var(--t-secondary);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .product-create-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          min-height: 30px;
        }
        .product-edit-backdrop {
          position: fixed;
          inset: 0;
          z-index: 90;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.48);
        }
        .product-edit-modal {
          width: min(1120px, 100%);
          max-height: calc(100vh - 40px);
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          background: var(--surface-1);
          box-shadow: var(--sh-lg);
        }
        .product-edit-modal-head,
        .product-edit-modal-actions,
        .product-edit-section-head,
        .product-edit-shelf-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .product-edit-modal-head {
          justify-content: space-between;
          padding: 16px 18px;
          border-bottom: 1px solid var(--border);
        }
        .product-edit-modal-head h2 {
          margin: 2px 0 0;
          color: var(--t-strong);
          font-size: 18px;
          line-height: 1.25;
        }
        .product-edit-modal-head span {
          color: var(--t-secondary);
          font-size: 12px;
          font-weight: 700;
        }
        .product-edit-modal-body {
          min-height: 0;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          padding: 14px;
          overflow: auto;
          background: var(--surface-2);
        }
        .product-edit-section {
          min-width: 0;
          display: grid;
          align-content: start;
          gap: 12px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--surface-1);
        }
        .product-edit-section-wide {
          grid-column: 1 / -1;
        }
        .product-edit-section-head {
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .product-edit-section-head h3 {
          margin: 0;
          color: var(--t-strong);
          font-size: 14px;
          line-height: 1.25;
        }
        .product-edit-field-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(150px, 1fr));
          gap: 10px;
        }
        .product-edit-shelf-field {
          min-width: 0;
          grid-column: 1 / -1;
          display: grid;
          align-content: start;
          gap: 10px;
          min-height: 64px;
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-2);
        }
        .product-edit-shelf-field .product-edit-section-head h3 {
          font-size: 12px;
        }
        .product-edit-shelf-actions {
          flex-wrap: nowrap;
          gap: 8px;
        }
        .product-edit-shelf-actions .btn {
          flex: 0 0 auto;
          white-space: nowrap;
        }
        .product-edit-shelf-actions .btn svg {
          flex: 0 0 auto;
        }
        .product-edit-validation {
          margin: 0;
          color: var(--danger);
          font-size: 12px;
          font-weight: 700;
        }
        .product-edit-modal-actions {
          justify-content: flex-end;
          min-height: 56px;
          padding: 12px 16px;
          border-top: 1px solid var(--border);
          background: var(--surface-1);
        }
        .product-edit-modal .structured-editor {
          border: 0;
          padding: 0;
          box-shadow: none;
        }
        .site-news-edit-modal {
          width: min(1120px, 100%);
        }
        .site-news-edit-modal-body {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .site-news-edit-section .product-create-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .site-news-edit-section .product-create-field {
          min-width: 0;
        }
        .brand-product-main-cell,
        .brand-product-identity-cell,
        .brand-product-taxonomy-cell {
          min-width: 0;
          display: grid;
          gap: 3px;
        }
        .brand-product-identity-cell {
          gap: 6px;
        }
        .brand-product-identity-head,
        .brand-product-meta-line,
        .brand-product-labeled-field {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .brand-product-identity-head {
          justify-content: space-between;
        }
        .brand-product-meta-line {
          align-items: stretch;
        }
        .brand-product-meta-line > * {
          min-width: 0;
          flex: 1 1 0;
        }
        .brand-product-labeled-field {
          align-items: baseline;
        }
        .brand-product-labeled-field > .edit-field-caption {
          flex: 0 0 28px;
        }
        .brand-product-labeled-field > *:last-child {
          min-width: 0;
          flex: 1 1 auto;
        }
        .product-title-edit {
          gap: 6px;
        }
        .product-title-edit-row {
          min-width: 0;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          align-items: center;
          gap: 6px;
        }
        .edit-field-caption {
          color: var(--t-tertiary);
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }
        .brand-product-main-cell strong {
          color: var(--t-primary);
          font-size: 13px;
        }
        .brand-product-identity-col {
          padding-left: 16px !important;
        }
        .brand-product-identity-cell {
          position: relative;
          padding-left: 10px;
        }
        .brand-product-identity-cell::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          width: 3px;
          height: 18px;
          border-radius: 999px;
          background: transparent;
          transform: translateY(-50%);
          transition: background 0.14s ease;
        }
        .brand-product-table tbody tr:hover .brand-product-identity-cell::before {
          background: var(--brand);
        }
        .brand-product-identity-cell strong {
          color: var(--t-strong);
          font-size: 13px;
          font-weight: 800;
        }
        .brand-product-main-cell strong,
        .brand-product-identity-cell strong,
        .brand-product-main-cell span,
        .brand-product-identity-cell span,
        .brand-product-model-col span,
        .brand-product-taxonomy-cell span,
        .brand-product-table .muted-value,
        .brand-product-table .inline-edit-input {
          min-width: 0;
          max-width: 100%;
        }
        .brand-product-main-cell strong,
        .brand-product-identity-cell strong,
        .brand-product-main-cell > span,
        .brand-product-identity-cell > span,
        .brand-product-model-col > span,
        .brand-product-taxonomy-cell > span,
        .brand-product-labeled-field > span:not(.edit-field-caption) {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .brand-product-main-cell span,
        .muted-value {
          color: var(--t-tertiary);
          font-size: 12px;
        }
        .core-field-cell {
          min-width: 220px;
        }
        .inline-edit-input {
          min-width: 0;
          width: 100%;
          padding: 5px 8px;
          font-size: 12px;
          border-color: color-mix(in srgb, var(--border) 75%, var(--brand) 25%);
          background: color-mix(in srgb, var(--surface-1) 92%, var(--brand-50) 8%);
        }
        .inline-edit-input.compact {
          min-width: 0;
        }
        .mono-cell {
          font-family: var(--font-mono);
          font-size: 12px;
        }
        .brand-product-model-col .mono-cell {
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          min-height: 24px;
          padding: 2px 8px;
          border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
          border-radius: var(--r-sm);
          background: color-mix(in srgb, var(--surface-2) 72%, var(--surface-1) 28%);
          color: var(--t-secondary);
        }
        .brand-product-taxonomy-cell {
          justify-items: center;
        }
        .brand-product-taxonomy-cell span {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 2px 9px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--brand-50) 42%, var(--surface-1) 58%);
          color: var(--t-primary);
          font-weight: 700;
        }
        .readiness-cell {
          min-width: 0;
          display: grid;
          gap: 5px;
        }
        .readiness-track {
          height: 5px;
          overflow: hidden;
          border-radius: 999px;
          background: var(--surface-3);
        }
        .readiness-fill {
          display: block;
          height: 100%;
          background: var(--brand);
        }
        .product-status-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .product-status-actions .btn {
          white-space: nowrap;
        }
        .product-status-actions .btn-danger {
          color: var(--danger);
        }
        .website-shelf-cell {
          position: relative;
          min-width: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 34px;
        }
        .website-shelf-cell .btn {
          white-space: nowrap;
          transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
        }
        .website-shelf-status-cell {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
        }
        .brand-product-actions-col .row-edit-actions {
          width: 100%;
          align-items: center;
          justify-content: center;
          gap: 8px;
          flex-wrap: nowrap;
        }
        .brand-product-actions-col .website-shelf-cell {
          flex: 0 0 auto;
        }
        .website-shelf-cell > .row-feedback {
          position: absolute;
          top: 39px;
          left: 50%;
          width: max-content;
          max-width: 150px;
          text-align: center;
          white-space: nowrap;
          pointer-events: none;
          transform: translateX(-50%);
          animation: shelfFeedbackFloatIn 0.18s ease-out;
        }
        .website-shelf-action.is-transitioning {
          border-color: var(--brand);
          background: var(--brand-soft);
          color: var(--brand);
          box-shadow: 0 8px 22px rgba(228, 0, 43, 0.12);
          cursor: progress;
          animation: shelfActionPulse 0.8s ease-in-out infinite alternate;
        }
        .website-shelf-action.is-transitioning svg,
        .product-status-action.is-transitioning svg {
          animation: spin 0.8s linear infinite;
        }
        .product-status-action.is-transitioning {
          border-color: var(--brand);
          background: var(--brand-soft);
          color: var(--brand);
          cursor: progress;
          box-shadow: 0 8px 22px rgba(228, 0, 43, 0.1);
          animation: shelfActionPulse 0.8s ease-in-out infinite alternate;
        }
        @keyframes shelfActionPulse {
          from { transform: translateY(0); }
          to { transform: translateY(-1px); }
        }
        @keyframes shelfFeedbackIn {
          from { opacity: 0; transform: translateY(-3px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shelfFeedbackFloatIn {
          from { opacity: 0; transform: translate(-50%, -3px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .image-asset-cell {
          min-width: 0;
          display: grid;
          gap: 8px;
        }
        .image-main-preview {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          min-height: 40px;
        }
        .image-main-preview .product-image-preview {
          margin: 0;
        }
        .product-image-preview {
          display: block;
          margin: 0 auto;
          width: 48px;
          height: 36px;
          object-fit: contain;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-2);
        }
        .product-image-preview.is-empty {
          display: grid;
          place-items: center;
          color: var(--t-tertiary);
        }
        .image-preview-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 0;
          background: transparent;
          cursor: zoom-in;
        }
        .image-lightbox {
          position: fixed;
          inset: 0;
          z-index: 260;
          display: grid;
          place-items: center;
          padding: 28px;
          background: rgba(15, 23, 42, 0.68);
          animation: imageLightboxFade 160ms ease-out;
        }
        .image-lightbox-panel {
          position: relative;
          display: grid;
          place-items: center;
          min-width: min(640px, calc(100vw - 56px));
          min-height: min(420px, calc(100vh - 56px));
          max-width: min(920px, 92vw);
          max-height: 88vh;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          background: var(--surface-1);
          box-shadow: var(--sh-modal);
          animation: imageLightboxPanelIn 180ms ease-out;
        }
        .image-lightbox-panel img {
          display: block;
          max-width: 100%;
          max-height: calc(88vh - 28px);
          object-fit: contain;
        }
        .image-lightbox-media {
          display: grid;
          place-items: center;
          width: 100%;
          min-height: min(392px, calc(100vh - 84px));
        }
        .image-lightbox-state {
          display: grid;
          place-items: center;
          gap: 10px;
          color: var(--t-secondary);
          font-size: 13px;
          text-align: center;
        }
        .image-lightbox-spinner {
          width: 26px;
          height: 26px;
          border: 2px solid rgba(148, 163, 184, 0.32);
          border-top-color: var(--brand);
          border-radius: 999px;
          animation: imageLightboxSpin 800ms linear infinite;
        }
        .image-lightbox-image.is-loading {
          opacity: 0;
        }
        .image-lightbox-close {
          position: absolute;
          top: -12px;
          right: -12px;
          z-index: 2;
          background: rgba(255,255,255,0.92);
        }
        @keyframes imageLightboxFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes imageLightboxPanelIn {
          from { opacity: 0; transform: scale(0.985) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes imageLightboxSpin {
          to { transform: rotate(360deg); }
        }
        .image-asset-status,
        .image-asset-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .image-upload-label {
          cursor: pointer;
        }
        .image-upload-label.is-disabled {
          pointer-events: none;
          opacity: 0.62;
        }
        .image-format-hint {
          color: var(--t-secondary);
          font-size: 11px;
          font-weight: 700;
          line-height: 1.2;
          white-space: nowrap;
        }
        .image-format-hint::before {
          content: '·';
          margin-right: 6px;
          color: var(--t-muted);
        }
        .image-action-feedback {
          width: fit-content;
          max-width: 100%;
          padding: 6px 8px;
          border-radius: var(--r-sm);
          font-size: 12px;
          font-weight: 600;
          line-height: 1.35;
        }
        .image-action-feedback.pending {
          color: var(--info);
          background: var(--info-bg);
        }
        .image-action-feedback.success {
          color: var(--success);
          background: var(--success-bg);
        }
        .image-action-feedback.error {
          color: var(--danger);
          background: var(--danger-bg);
        }
        .sr-only-file {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }
        .icon-only {
          min-width: 28px;
          padding-left: 6px;
          padding-right: 6px;
        }
        .row-edit-actions {
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .brand-product-actions-col .row-edit-actions {
          width: 100%;
          max-width: none;
          margin: 0 auto;
          align-items: center;
          justify-content: center;
          gap: 8px;
          flex-wrap: nowrap;
        }
        .brand-product-actions-col .btn {
          min-width: 64px;
          min-height: 30px;
          padding-left: 9px;
          padding-right: 9px;
          justify-content: center;
        }
        .brand-product-actions-col .website-shelf-action {
          min-width: 58px;
        }
        .dirty-chip {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 2px 7px;
          border-radius: 999px;
          color: var(--brand);
          background: var(--brand-50);
          border: 1px solid var(--brand-100);
          font-size: 11px;
          font-weight: 700;
        }
        .row-feedback {
          color: var(--t-secondary);
          font-size: 12px;
          font-weight: 700;
          animation: shelfFeedbackIn 0.18s ease-out;
          transition: color 0.18s ease, opacity 0.18s ease, transform 0.18s ease;
        }
        .row-feedback.success {
          color: var(--success);
        }
        .row-feedback.error {
          color: var(--danger);
        }
        .brand-product-empty {
          height: 148px;
          text-align: center;
          color: var(--t-secondary);
        }
        .brand-product-empty strong,
        .brand-product-empty span,
        .brand-product-empty a {
          display: block;
        }
        .brand-product-empty strong {
          margin-bottom: 6px;
          color: var(--t-primary);
          font-size: 15px;
        }
        .brand-product-empty span {
          font-size: 13px;
          margin-bottom: 10px;
        }
        .brand-product-empty a {
          width: fit-content;
          margin: 0 auto;
        }
        .structured-toggle {
          width: fit-content;
          white-space: nowrap;
        }
        .structured-editor-row td {
          background: var(--surface-2);
          border-top: 0;
        }
        .structured-editor {
          display: grid;
          gap: 14px;
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--surface-1);
          box-shadow: var(--sh-xs);
        }
        .structured-editor-head,
        .structured-actions,
        .structured-section-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .structured-editor-head strong {
          color: var(--t-primary);
          font-size: 14px;
        }
        .structured-actions {
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .structured-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(320px, 1fr));
          gap: 12px;
        }
        .structured-section {
          display: grid;
          gap: 10px;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--surface-1);
        }
        .structured-section-wide {
          grid-column: 1 / -1;
        }
        .structured-section h3,
        .structured-section-title h3 {
          margin: 0;
          color: var(--t-primary);
          font-size: 13px;
          line-height: 1.25;
        }
        .structured-field-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(160px, 1fr));
          gap: 10px;
        }
        .structured-field {
          display: grid;
          gap: 5px;
          color: var(--t-secondary);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .structured-field strong {
          min-height: 30px;
          color: var(--t-primary);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0;
          text-transform: none;
        }
        .structured-field textarea.input {
          min-height: 74px;
          resize: vertical;
        }
        .structured-list {
          display: grid;
          gap: 8px;
        }
        .structured-pair,
        .structured-single {
          display: grid;
          gap: 8px;
          align-items: center;
        }
        .structured-pair {
          grid-template-columns: minmax(120px, 0.8fr) minmax(160px, 1.2fr) auto;
        }
        .structured-single {
          grid-template-columns: minmax(0, 1fr) auto;
        }
        .structured-inline-input {
          min-width: 0;
          padding: 6px 8px;
          font-size: 12px;
        }
        .taxonomy-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(150px, 1fr));
          gap: 10px;
        }
        .taxonomy-picker {
          display: grid;
          align-content: start;
          gap: 8px;
        }
        .taxonomy-picker strong {
          color: var(--t-primary);
          font-size: 12px;
        }
        .taxonomy-options {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }
        .taxonomy-chip {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 28px;
          padding: 4px 9px 4px 7px;
          border: 1px solid var(--border);
          border-radius: 999px;
          color: var(--t-primary);
          background: var(--surface-1);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease, color 0.16s ease;
        }
        .taxonomy-chip:hover {
          border-color: var(--brand-100);
          background: var(--brand-50);
        }
        .taxonomy-chip.selected {
          color: var(--brand);
          background: var(--brand-50);
          border-color: color-mix(in srgb, var(--brand) 42%, var(--brand-100));
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brand) 28%, transparent);
        }
        .taxonomy-chip.is-disabled {
          cursor: default;
          opacity: 0.78;
        }
        .taxonomy-chip input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }
        .taxonomy-check {
          width: 16px;
          height: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          border-radius: 50%;
          color: transparent;
          background: var(--surface-2);
          flex: 0 0 auto;
        }
        .taxonomy-chip.selected .taxonomy-check {
          color: #fff;
          border-color: var(--brand);
          background: var(--brand);
        }
        @media (max-width: 1100px) {
          .brand-console-hero,
          .brand-console-summary,
          .brand-console-modules,
          .structured-grid,
          .taxonomy-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .summary-item,
          .console-module {
            border-top: 1px solid var(--border);
          }
          .summary-item:nth-child(odd),
          .console-module:nth-child(odd) {
            border-left: 0;
          }
        }
        @media (max-width: 720px) {
          .brand-console-hero,
          .brand-console-summary,
          .brand-console-modules,
          .structured-grid,
          .structured-field-grid,
          .taxonomy-grid,
          .site-material-grid {
            grid-template-columns: 1fr;
          }
          .summary-item,
          .console-module {
            min-height: auto;
            border-left: 0;
          }
          .brand-product-toolbar {
            align-items: stretch;
            flex-direction: column;
          }
          .brand-product-head {
            align-items: flex-start;
            flex-direction: column;
          }
          .brand-product-search {
            max-width: none;
            flex-wrap: wrap;
          }
          .brand-product-bulk-bar {
            align-items: stretch;
            flex-direction: column;
          }
          .brand-product-bulk-actions {
            justify-content: flex-start;
          }
          .brand-product-search > .input:first-of-type,
          .category-filter-select,
          .brand-product-filter,
          .brand-product-page-size {
            width: 100%;
            flex: 1 1 100%;
          }
          .category-filter-menu {
            width: 100%;
            max-width: 100%;
          }
          .brand-product-sync-badge {
            margin-left: 0;
            align-self: flex-start;
          }
          .brand-product-pagination,
          .brand-product-page-actions {
            align-items: stretch;
            flex-direction: column;
          }
          .product-edit-backdrop {
            padding: 10px;
          }
          .product-edit-modal {
            max-height: calc(100vh - 20px);
          }
          .product-edit-modal-body,
          .product-edit-field-grid {
            grid-template-columns: 1fr;
          }
          .site-news-preview-grid,
          .site-news-preview-card {
            grid-template-columns: 1fr;
          }
          .product-edit-shelf-actions {
            flex-wrap: wrap;
          }
          .product-create-grid {
            grid-template-columns: 1fr;
          }
          .site-news-edit-section .product-create-grid {
            grid-template-columns: 1fr;
          }
          .structured-pair,
          .structured-single {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function SiteMaterialMockPanel({ brandCode }: { brandCode: string }) {
  const [uploadedMaterials, setUploadedMaterials] = useState<
    Record<string, { name: string; size: number; url?: string; homepageSrc?: string; synced?: boolean }>
  >({});
  const [materialBusyKey, setMaterialBusyKey] = useState('');
  const [materialFeedback, setMaterialFeedback] = useState<Record<string, { tone: 'success' | 'error'; text: string }>>(
    {}
  );
  const materialObjectUrls = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      materialObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (brandCode !== 'everhot') return () => { cancelled = true; };
    siteMaterials
      .list(brandCode)
      .then((manifest) => {
        if (cancelled || !manifest || typeof manifest !== 'object') return;
        const next: Record<string, { name: string; size: number; homepageSrc?: string; synced?: boolean }> = {};
        for (const [key, value] of Object.entries(manifest as Record<string, any>)) {
          if (!value?.src) continue;
          next[key] = {
            name: String(value.filename || value.src),
            size: Number(value.size || 0),
            homepageSrc: String(value.src),
            synced: true,
          };
        }
        setUploadedMaterials(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brandCode]);

  async function uploadMaterial(key: string, file: File | null) {
    if (!file) return;
    if (!isAllowedJpgOrPng(file)) {
      setMaterialFeedback((current) => ({ ...current, [key]: { tone: 'error', text: imageTypeErrorText() } }));
      return;
    }
    const url = URL.createObjectURL(file);
    setUploadedMaterials((current) => {
      const previous = current[key];
      if (previous?.url) URL.revokeObjectURL(previous.url);
      materialObjectUrls.current = materialObjectUrls.current.filter((item) => item !== previous?.url);
      materialObjectUrls.current.push(url);
      return {
        ...current,
        [key]: {
          name: file.name,
          size: file.size,
          url,
          synced: false,
        },
      };
    });
    setMaterialBusyKey(key);
    setMaterialFeedback((current) => ({ ...current, [key]: { tone: 'success', text: '正在同步到官网首页...' } }));
    try {
      const saved = await siteMaterials.upload(brandCode, {
        key,
        filename: file.name,
        mimeType: file.type || 'image/png',
        dataBase64: await readBrowserFileBase64(file),
      });
      setUploadedMaterials((current) => ({
        ...current,
        [key]: {
          ...current[key],
          name: String((saved as any)?.filename || file.name),
          size: Number((saved as any)?.size || file.size),
          homepageSrc: String((saved as any)?.src || ''),
          synced: true,
        },
      }));
      setMaterialFeedback((current) => ({ ...current, [key]: { tone: 'success', text: '已同步到官网首页' } }));
    } catch (e) {
      setMaterialFeedback((current) => ({
        ...current,
        [key]: { tone: 'error', text: (e as Error).message || '官网首页同步失败' },
      }));
    } finally {
      setMaterialBusyKey('');
    }
  }

  return (
    <div className="site-material-panel" aria-label="其他官网素材">
      <div className="site-material-panel-head">
        <div>
          <p className="t-label">其他素材</p>
          <h3>官网非产品素材</h3>
          <p>上传后同步到 Everhot 官网首页素材 manifest，暂未接入真实 DAM 或生产素材库。</p>
        </div>
        <span className="pill-neutral">本地首页同步</span>
      </div>
      <div className="site-material-grid">
        {MOCK_SITE_MATERIALS.map((item) => {
          const uploaded = uploadedMaterials[item.key];
          const feedback = materialFeedback[item.key];
          const busy = materialBusyKey === item.key;
          const inputId = `site-material-upload-${item.key}`;
          return (
            <article className="site-material-item" key={item.key}>
              <strong>{item.name}</strong>
              <span>{item.type} · {item.location}</span>
              <span className="site-material-spec">建议尺寸：{item.recommendedSize}</span>
              <p>{item.note}</p>
              <div className="site-material-file" title={uploaded?.name || '尚未上传'}>
                {uploaded ? `${uploaded.name} · ${Math.ceil(uploaded.size / 1024)} KB` : '尚未上传图片'}
              </div>
              {feedback && <span className={`row-feedback ${feedback.tone}`}>{feedback.text}</span>}
              <div className="site-material-item-actions">
                <span className={uploaded?.synced ? 'badge badge-success' : uploaded ? 'badge badge-warning' : 'badge badge-grey'}>
                  {uploaded?.synced ? '已同步首页' : uploaded ? '已选择' : item.status}
                </span>
                <div className="site-material-transfer-actions" title="真实 DAM 接入不在本次范围">
                  <input
                    id={inputId}
                    className="sr-only-file"
                    type="file"
                    accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                    disabled={busy}
                    data-testid={`site-material-input-${item.key}`}
                    onChange={(event) => {
                      uploadMaterial(item.key, event.target.files?.[0] || null);
                      event.currentTarget.value = '';
                    }}
                  />
                  <label
                    className="btn btn-outline btn-sm image-upload-label"
                    htmlFor={inputId}
                    title="上传或替换图片"
                  >
                    <Upload size={13} />
                    {busy ? '同步中' : '上传'}
                  </label>
                  {uploaded?.url ? (
                    <a
                      className="btn btn-outline btn-sm"
                      href={uploaded.url}
                      download={uploaded.name}
                      title="下载当前图片"
                    >
                      <ArrowDownCircle size={13} />
                      下载
                    </a>
                  ) : (
                    <button type="button" className="btn btn-outline btn-sm" disabled title="请先上传图片">
                      <ArrowDownCircle size={13} />
                      下载
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

type SiteNewsStatus = 'draft' | 'published' | 'hidden' | 'archived';
type SiteNewsArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  coverImageArtifactId?: string | null;
  coverImageUrl?: string | null;
  publishedAt?: string | null;
  status: SiteNewsStatus;
  sortOrder: number;
  isFeatured: boolean;
  deletedAt?: string | null;
};
type SiteNewsDraft = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  coverImageUrl: string;
  coverImageArtifactId: string;
  publishedAt: string;
  status: SiteNewsStatus;
  sortOrder: string;
  isFeatured: boolean;
};

function emptyNewsDraft(): SiteNewsDraft {
  return {
    slug: '',
    title: '',
    summary: '',
    body: '',
    coverImageUrl: '',
    coverImageArtifactId: '',
    publishedAt: '',
    status: 'draft',
    sortOrder: '0',
    isFeatured: false,
  };
}

function newsDraftFromArticle(article: SiteNewsArticle): SiteNewsDraft {
  const publishedAt = article.publishedAt ? String(article.publishedAt).slice(0, 10) : '';
  return {
    slug: article.slug || '',
    title: article.title || '',
    summary: article.summary || '',
    body: article.body || '',
    coverImageUrl: article.coverImageUrl || '',
    coverImageArtifactId: article.coverImageArtifactId || '',
    publishedAt,
    status: article.status || 'draft',
    sortOrder: String(article.sortOrder || 0),
    isFeatured: Boolean(article.isFeatured),
  };
}

function newsPayload(draft: SiteNewsDraft) {
  const title = draft.title.trim();
  const summary = draft.summary.trim();
  const slug = draft.slug || `news-${Date.now()}`;
  const coverImageArtifactId = draft.coverImageArtifactId.trim();
  const coverImageUrl = draft.coverImageUrl.trim();
  const body = sanitizeSiteNewsBody(draft.body);
  if (!title) throw new Error('请填写资讯标题。');
  if (!summary) throw new Error('请填写资讯摘要。');
  if (draft.status === 'published' && !coverImageArtifactId && !coverImageUrl) throw new Error('发布资讯前请先上传封面。');
  if (draft.status === 'published' && !siteNewsPlainText(body)) throw new Error('发布资讯前请填写正文。');
  return {
    slug,
    title,
    summary,
    body,
    coverImageUrl: coverImageUrl || null,
    coverImageArtifactId: coverImageArtifactId || null,
    publishedAt: draft.publishedAt || null,
    status: draft.status,
    sortOrder: Number(draft.sortOrder) || 0,
    isFeatured: draft.isFeatured,
  };
}

const SITE_NEWS_ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'A', 'H2', 'H3', 'BLOCKQUOTE', 'CODE', 'SPAN', 'FIGURE', 'FIGCAPTION', 'IMG']);
const SITE_NEWS_TEXT_SIZES = ['12', '14', '16', '18', '20', '24', '28'];
const SITE_NEWS_TEXT_COLORS = ['default', 'ink', 'gray', 'muted', 'brand'];
const SITE_NEWS_BG_COLORS = ['none', 'soft', 'brand-soft', 'warning-soft'];

function copySiteNewsSemanticAttrs(source: HTMLElement, target: HTMLElement, tag: string) {
  const role = source.getAttribute('data-role') || '';
  if (tag === 'P' && role === 'lead') target.setAttribute('data-role', role);

  const align = source.getAttribute('data-align') || '';
  if (['left', 'center', 'right', 'justify'].includes(align)) target.setAttribute('data-align', align);

  const indent = source.getAttribute('data-indent') || '';
  if (['1', '2', '3'].includes(indent)) target.setAttribute('data-indent', indent);

  const size = source.getAttribute('data-size') || '';
  if (SITE_NEWS_TEXT_SIZES.includes(size)) target.setAttribute('data-size', size);

  const color = source.getAttribute('data-color') || '';
  if (SITE_NEWS_TEXT_COLORS.includes(color)) target.setAttribute('data-color', color);

  const bg = source.getAttribute('data-bg') || '';
  if (SITE_NEWS_BG_COLORS.includes(bg)) target.setAttribute('data-bg', bg);
}

function escapeSiteNewsHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function siteNewsPlainText(value: string) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeSiteNewsBody(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (typeof document === 'undefined') return escapeSiteNewsHtml(raw).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');

  const template = document.createElement('template');
  template.innerHTML = raw;

  function cleanNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const element = node as HTMLElement;
    const tag = element.tagName.toUpperCase();
    if (!SITE_NEWS_ALLOWED_TAGS.has(tag)) {
      const fragment = document.createDocumentFragment();
      Array.from(element.childNodes).forEach((child) => {
        const clean = cleanNode(child);
        if (clean) fragment.appendChild(clean);
      });
      return fragment;
    }

    const output = document.createElement(tag.toLowerCase());
    copySiteNewsSemanticAttrs(element, output, tag);
    if (tag === 'A') {
      const href = element.getAttribute('href') || '';
      if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(href)) {
        output.setAttribute('href', href);
        output.setAttribute('rel', 'noopener noreferrer');
        if (/^https?:\/\//i.test(href)) output.setAttribute('target', '_blank');
      }
    }
    if (tag === 'IMG') {
      const src = element.getAttribute('src') || '';
      if (/^(https?:\/\/|data:image\/|blob:|\/api\/|\/assets\/)/i.test(src)) {
        output.setAttribute('src', src);
        output.setAttribute('alt', element.getAttribute('alt') || '');
        output.setAttribute('loading', 'lazy');
        const size = element.getAttribute('data-size') || '';
        if (['small', 'medium', 'large', 'full'].includes(size)) output.setAttribute('data-size', size);
        const align = element.getAttribute('data-align') || '';
        if (['left', 'center', 'right'].includes(align)) output.setAttribute('data-align', align);
      } else {
        return null;
      }
    }
    if (tag === 'FIGURE') {
      const size = element.getAttribute('data-size') || '';
      const align = element.getAttribute('data-align') || '';
      if (['small', 'medium', 'large', 'full'].includes(size)) output.setAttribute('data-size', size);
      if (['left', 'center', 'right'].includes(align)) output.setAttribute('data-align', align);
    }
    Array.from(element.childNodes).forEach((child) => {
      const clean = cleanNode(child);
      if (clean) output.appendChild(clean);
    });
    return output;
  }

  const fragment = document.createDocumentFragment();
  Array.from(template.content.childNodes).forEach((child) => {
    const clean = cleanNode(child);
    if (clean) fragment.appendChild(clean);
  });
  const container = document.createElement('div');
  container.appendChild(fragment);
  const sanitized = container.innerHTML.trim();
  if (sanitized && !/<[a-z][\s\S]*>/i.test(sanitized)) return `<p>${escapeSiteNewsHtml(siteNewsPlainText(sanitized))}</p>`;
  return sanitized || `<p>${escapeSiteNewsHtml(siteNewsPlainText(raw))}</p>`;
}

function siteNewsPreviewHtml(value: string) {
  const clean = sanitizeSiteNewsBody(value);
  if (!clean) return '<p>正文内容将在这里预览。</p>';
  if (/<[a-z][\s\S]*>/i.test(clean)) return clean;
  return `<p>${escapeSiteNewsHtml(clean)}</p>`;
}

function siteNewsAssetUrl(url: string, siteAssetBaseUrl: string) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('/api/')) return value;
  if (value.startsWith('/assets/') && siteAssetBaseUrl) {
    try {
      return new URL(value, siteAssetBaseUrl.endsWith('/') ? siteAssetBaseUrl : `${siteAssetBaseUrl}/`).toString();
    } catch {
      return value;
    }
  }
  return value;
}

function siteNewsImage(article: SiteNewsArticle, siteAssetBaseUrl: string) {
  if (article.coverImageArtifactId) return `/api/v2/file-artifact/${encodeURIComponent(article.coverImageArtifactId)}/content`;
  if (article.coverImageUrl) return siteNewsAssetUrl(article.coverImageUrl, siteAssetBaseUrl);
  return siteNewsAssetUrl('/assets/img/home-card1.webp', siteAssetBaseUrl);
}

function siteNewsStatusMeta(status: SiteNewsStatus) {
  if (status === 'published') return { label: '已发布', tone: 'success' as const };
  if (status === 'hidden') return { label: '已隐藏', tone: 'warning' as const };
  if (status === 'archived') return { label: '已归档', tone: 'neutral' as const };
  return { label: '草稿', tone: 'info' as const };
}

function SiteNewsRichTextEditor({
  value,
  onChange,
  entityId,
  imageEntityType = 'site-news-body',
  onFeedback,
  onRegisterFlush,
}: {
  value: string;
  onChange: (value: string) => void;
  entityId: string;
  imageEntityType?: string;
  onFeedback: (feedback: { tone: 'success' | 'error'; text: string }) => void;
  onRegisterFlush?: (flush: () => string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const imageUploadModeRef = useRef<'insert' | 'replace'>('insert');
  const selectionRef = useRef<Range | null>(null);
  const selectedImageRef = useRef<HTMLImageElement | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const lastValueRef = useRef(value);
  const lastEmittedValueRef = useRef(value);
  const [uploadingBodyImage, setUploadingBodyImage] = useState(false);
  const [selectedImageSize, setSelectedImageSize] = useState('');
  const [selectedImageAlign, setSelectedImageAlign] = useState('');
  const [activeFormats, setActiveFormats] = useState({
    block: 'p',
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    unorderedList: false,
    orderedList: false,
    link: false,
    align: 'left',
  });

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (document.activeElement === editor) return;
    if (editor.innerHTML === value) {
      lastValueRef.current = value;
      lastEmittedValueRef.current = value;
      return;
    }
    editor.innerHTML = value || '';
    lastValueRef.current = value;
    lastEmittedValueRef.current = value;
  }, [value]);

  useEffect(() => () => {
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
  }, []);

  useEffect(() => {
    onRegisterFlush?.(() => flushBody());
    return () => onRegisterFlush?.(() => lastEmittedValueRef.current);
  }, [onRegisterFlush]);

  function editorHtml() {
    return editorRef.current?.innerHTML || '';
  }

  function emitChange(next: string) {
    lastValueRef.current = next;
    lastEmittedValueRef.current = next;
    onChange(next);
  }

  function commitNow({ sanitize = false }: { sanitize?: boolean } = {}) {
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    const next = sanitize ? sanitizeSiteNewsBody(editorHtml()) : editorHtml();
    if (next !== lastEmittedValueRef.current) emitChange(next);
  }

  function scheduleCommit() {
    lastValueRef.current = editorHtml();
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => commitNow(), 220);
  }

  function flushBody() {
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    const next = sanitizeSiteNewsBody(editorHtml());
    if (next !== lastEmittedValueRef.current) emitChange(next);
    return next;
  }

  function selectionInsideEditor() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    return editor.contains(range.commonAncestorContainer);
  }

  function saveSelection() {
    if (!selectionInsideEditor()) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    selectionRef.current = selection.getRangeAt(0).cloneRange();
    refreshActiveFormats();
  }

  function refreshActiveFormats() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    const baseNode = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer as Element
      : range.startContainer.parentElement;
    const blockElement = baseNode?.closest('h2,h3,blockquote,p,li');
    const block = blockElement?.tagName.toLowerCase() || 'p';
    setActiveFormats({
      block: block === 'li' ? 'p' : block,
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      unorderedList: document.queryCommandState('insertUnorderedList'),
      orderedList: document.queryCommandState('insertOrderedList'),
      link: Boolean(baseNode?.closest('a')),
      align: (blockElement?.getAttribute('data-align') || 'left'),
    });
  }

  function restoreSelection() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    if (selectionRef.current) {
      selection.addRange(selectionRef.current);
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.addRange(range);
  }

  function toolbarMouseDown(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    restoreSelection();
  }

  function run(command: string, commandValue?: string) {
    restoreSelection();
    document.execCommand(command, false, commandValue);
    scheduleCommit();
    saveSelection();
    refreshActiveFormats();
  }

  function nearestBlock() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    const baseNode = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer as Element
      : range.startContainer.parentElement;
    return baseNode?.closest('p,h2,h3,blockquote,li') as HTMLElement | null;
  }

  function formatBlock(tag: 'p' | 'h2' | 'h3' | 'blockquote') {
    run('formatBlock', tag);
  }

  function clearFormat() {
    restoreSelection();
    document.execCommand('removeFormat');
    document.execCommand('formatBlock', false, 'p');
    nearestBlock()?.removeAttribute('data-align');
    nearestBlock()?.removeAttribute('data-indent');
    scheduleCommit();
    saveSelection();
    refreshActiveFormats();
  }

  function pastedTextToNewsHtml(text: string) {
    const lines = text.replace(/\r\n/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
    const chunks: string[] = [];
    let listType: 'ul' | 'ol' | '' = '';
    let listItems: string[] = [];

    function flushList() {
      if (!listType || !listItems.length) return;
      chunks.push(`<${listType}>${listItems.map((item) => `<li>${escapeSiteNewsHtml(item)}</li>`).join('')}</${listType}>`);
      listType = '';
      listItems = [];
    }

    for (const line of lines) {
      const bullet = line.match(/^[-*•]\s+(.+)$/);
      const ordered = line.match(/^\d+[.)、]\s*(.+)$/);
      if (bullet) {
        if (listType && listType !== 'ul') flushList();
        listType = 'ul';
        listItems.push(bullet[1]);
        continue;
      }
      if (ordered) {
        if (listType && listType !== 'ol') flushList();
        listType = 'ol';
        listItems.push(ordered[1]);
        continue;
      }
      flushList();
      chunks.push(`<p>${escapeSiteNewsHtml(line)}</p>`);
    }
    flushList();
    return chunks.join('');
  }

  function selectedHtml() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return '';
    const container = document.createElement('div');
    container.appendChild(selection.getRangeAt(0).cloneContents());
    return container.innerHTML;
  }

  function applyInlineData(kind: 'size' | 'color' | 'bg', value: string) {
    if (!value || value === 'default' || value === 'none') return;
    restoreSelection();
    const attr = kind === 'size' ? 'data-size' : kind === 'color' ? 'data-color' : 'data-bg';
    const html = selectedHtml() || '&#8203;';
    document.execCommand('insertHTML', false, `<span ${attr}="${escapeSiteNewsHtml(value)}">${html}</span>`);
    scheduleCommit();
    saveSelection();
  }

  function wrapInlineTag(tag: 'code') {
    restoreSelection();
    const html = selectedHtml() || '&#8203;';
    document.execCommand('insertHTML', false, `<${tag}>${html}</${tag}>`);
    scheduleCommit();
    saveSelection();
    refreshActiveFormats();
  }

  function applyBlockAlign(align: 'left' | 'center' | 'right' | 'justify') {
    restoreSelection();
    const block = nearestBlock();
    if (block) block.setAttribute('data-align', align);
    const command = align === 'center' ? 'justifyCenter' : align === 'right' ? 'justifyRight' : align === 'justify' ? 'justifyFull' : 'justifyLeft';
    document.execCommand(command);
    scheduleCommit();
    saveSelection();
    refreshActiveFormats();
  }

  function changeIndent(delta: 1 | -1) {
    restoreSelection();
    const block = nearestBlock();
    if (!block) return;
    const current = Number(block.getAttribute('data-indent') || 0);
    const next = Math.max(0, Math.min(3, current + delta));
    if (next) block.setAttribute('data-indent', String(next));
    else block.removeAttribute('data-indent');
    scheduleCommit();
    saveSelection();
    refreshActiveFormats();
  }

  function addLink() {
    restoreSelection();
    const href = window.prompt('请输入链接地址');
    if (!href) return;
    const trimmedHref = href.trim();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      document.execCommand('insertHTML', false, `<a href="${escapeSiteNewsHtml(trimmedHref)}">${escapeSiteNewsHtml(trimmedHref)}</a>`);
      scheduleCommit();
      saveSelection();
      return;
    }
    run('createLink', trimmedHref);
  }

  function markSelectedImage(img: HTMLImageElement | null) {
    if (selectedImageRef.current && selectedImageRef.current !== img) selectedImageRef.current.classList.remove('is-selected');
    selectedImageRef.current = img;
    if (!img) {
      setSelectedImageSize('');
      setSelectedImageAlign('');
      return;
    }
    img.classList.add('is-selected');
    const figure = selectedFigure(img);
    setSelectedImageSize(figure?.getAttribute('data-size') || img.getAttribute('data-size') || 'large');
    setSelectedImageAlign(figure?.getAttribute('data-align') || img.getAttribute('data-align') || 'center');
  }

  function selectedFigure(img = selectedImageRef.current) {
    const figure = img?.closest('figure');
    return figure instanceof HTMLElement ? figure : null;
  }

  function handleEditorClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const img = target?.closest('img');
    markSelectedImage(img instanceof HTMLImageElement ? img : null);
    saveSelection();
  }

  function applyImageSize(size: 'small' | 'medium' | 'large' | 'full') {
    const img = selectedImageRef.current;
    if (!img) return;
    const figure = selectedFigure(img);
    if (figure) figure.setAttribute('data-size', size);
    img.setAttribute('data-size', size);
    setSelectedImageSize(size);
    scheduleCommit();
  }

  function applyImageAlign(align: 'left' | 'center' | 'right') {
    const img = selectedImageRef.current;
    if (!img) return;
    const figure = selectedFigure(img);
    if (figure) figure.setAttribute('data-align', align);
    img.setAttribute('data-align', align);
    setSelectedImageAlign(align);
    scheduleCommit();
  }

  function editImageCaption() {
    const img = selectedImageRef.current;
    if (!img) return;
    let figure = selectedFigure(img);
    if (!figure) {
      figure = document.createElement('figure');
      figure.setAttribute('data-size', img.getAttribute('data-size') || 'large');
      figure.setAttribute('data-align', img.getAttribute('data-align') || 'center');
      img.parentNode?.insertBefore(figure, img);
      figure.appendChild(img);
    }
    const current = figure.querySelector('figcaption')?.textContent || '';
    const caption = window.prompt('请输入图片图注', current);
    if (caption === null) return;
    figure.querySelector('figcaption')?.remove();
    const next = caption.trim();
    if (next) {
      const figcaption = document.createElement('figcaption');
      figcaption.textContent = next;
      figure.appendChild(figcaption);
    }
    scheduleCommit();
  }

  function deleteSelectedImage() {
    const img = selectedImageRef.current;
    if (!img) return;
    const figure = selectedFigure(img);
    (figure || img).remove();
    markSelectedImage(null);
    scheduleCommit();
  }

  function openImageUpload(mode: 'insert' | 'replace') {
    imageUploadModeRef.current = mode;
    imageInputRef.current?.click();
  }

  async function uploadBodyImage(file: File | null) {
    if (!file) return;
    if (!isAllowedJpgOrPng(file)) {
      onFeedback({ tone: 'error', text: imageTypeErrorText() });
      return;
    }
    setUploadingBodyImage(true);
    try {
      restoreSelection();
      const artifact = await fileArtifacts.uploadBase64({
        entityType: imageEntityType,
        entityId,
        filename: file.name,
        mimeType: file.type || 'image/png',
        dataBase64: await readBrowserFileBase64(file),
      });
      const artifactId = String((artifact as any)?.id || '');
      if (!artifactId) throw new Error('正文图片上传后未返回文件 ID。');
      const src = `/api/v2/file-artifact/${encodeURIComponent(artifactId)}/content`;
      if (imageUploadModeRef.current === 'replace' && selectedImageRef.current) {
        selectedImageRef.current.setAttribute('src', src);
        selectedImageRef.current.setAttribute('alt', file.name);
      } else {
        document.execCommand('insertHTML', false, `<figure data-size="large" data-align="center"><img src="${src}" alt="${escapeSiteNewsHtml(file.name)}" loading="lazy" data-size="large" data-align="center"></figure><p><br></p>`);
      }
      scheduleCommit();
      saveSelection();
      onFeedback({ tone: 'success', text: '正文图片已上传并插入。' });
    } catch (e) {
      onFeedback({ tone: 'error', text: (e as Error).message || '正文图片上传失败。' });
    } finally {
      setUploadingBodyImage(false);
      imageUploadModeRef.current = 'insert';
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }

  return (
    <div className="site-news-richtext">
      <div className="site-news-richtext-toolbar" aria-label="正文格式工具栏">
        <button type="button" className={`site-news-format-btn${activeFormats.block === 'p' ? ' active' : ''}`} onMouseDown={toolbarMouseDown} onClick={() => formatBlock('p')} title="段落">
          段
        </button>
        <button type="button" className={`btn btn-outline btn-sm icon-only site-news-tool-btn${activeFormats.block === 'h2' ? ' active' : ''}`} onMouseDown={toolbarMouseDown} onClick={() => formatBlock('h2')} title="二级标题" aria-label="二级标题">
          <Heading2 size={13} />
        </button>
        <button type="button" className={`site-news-format-btn${activeFormats.block === 'h3' ? ' active' : ''}`} onMouseDown={toolbarMouseDown} onClick={() => formatBlock('h3')} title="三级标题">
          H3
        </button>
        <button type="button" className={`site-news-format-btn${activeFormats.block === 'blockquote' ? ' active' : ''}`} onMouseDown={toolbarMouseDown} onClick={() => formatBlock('blockquote')} title="引用">
          引
        </button>
        <button type="button" className={`btn btn-outline btn-sm icon-only site-news-tool-btn${activeFormats.bold ? ' active' : ''}`} onMouseDown={toolbarMouseDown} onClick={() => run('bold')} title="加粗" aria-label="加粗">
          <Bold size={13} />
        </button>
        <button type="button" className={`btn btn-outline btn-sm icon-only site-news-tool-btn${activeFormats.italic ? ' active' : ''}`} onMouseDown={toolbarMouseDown} onClick={() => run('italic')} title="斜体" aria-label="斜体">
          <Italic size={13} />
        </button>
        <button type="button" className={`site-news-format-btn${activeFormats.underline ? ' active' : ''}`} onMouseDown={toolbarMouseDown} onClick={() => run('underline')} title="下划线">
          U
        </button>
        <button type="button" className={`site-news-format-btn${activeFormats.strike ? ' active' : ''}`} onMouseDown={toolbarMouseDown} onClick={() => run('strikeThrough')} title="删除线">
          S
        </button>
        <button type="button" className="site-news-format-btn" onMouseDown={toolbarMouseDown} onClick={() => wrapInlineTag('code')} title="代码样式">
          {'</>'}
        </button>
        <button type="button" className={`btn btn-outline btn-sm icon-only site-news-tool-btn${activeFormats.unorderedList ? ' active' : ''}`} onMouseDown={toolbarMouseDown} onClick={() => run('insertUnorderedList')} title="项目列表" aria-label="项目列表">
          <List size={13} />
        </button>
        <button type="button" className={`btn btn-outline btn-sm icon-only site-news-tool-btn${activeFormats.orderedList ? ' active' : ''}`} onMouseDown={toolbarMouseDown} onClick={() => run('insertOrderedList')} title="编号列表" aria-label="编号列表">
          <ListOrdered size={13} />
        </button>
        <button type="button" className="site-news-format-btn" onMouseDown={toolbarMouseDown} onClick={() => changeIndent(-1)} title="减少缩进">
          减
        </button>
        <button type="button" className="site-news-format-btn" onMouseDown={toolbarMouseDown} onClick={() => changeIndent(1)} title="增加缩进">
          增
        </button>
        <select className="site-news-richtext-select" defaultValue="" onChange={(event) => {
          applyInlineData('size', event.target.value);
          event.target.value = '';
        }} title="字号">
          <option value="">字号</option>
          {SITE_NEWS_TEXT_SIZES.map((size) => <option key={size} value={size}>{size}px</option>)}
        </select>
        <select className="site-news-richtext-select" defaultValue="" onChange={(event) => {
          applyInlineData('color', event.target.value);
          event.target.value = '';
        }} title="文字颜色">
          <option value="">文字色</option>
          <option value="ink">标题黑</option>
          <option value="gray">正文灰</option>
          <option value="muted">辅助灰</option>
          <option value="brand">品牌红</option>
        </select>
        <select className="site-news-richtext-select" defaultValue="" onChange={(event) => {
          applyInlineData('bg', event.target.value);
          event.target.value = '';
        }} title="背景色">
          <option value="">背景</option>
          <option value="soft">浅灰</option>
          <option value="brand-soft">浅红</option>
          <option value="warning-soft">浅黄</option>
        </select>
        <div className="site-news-image-size-tools" aria-label="段落对齐">
          {[
            ['left', '左'],
            ['center', '中'],
            ['right', '右'],
            ['justify', '齐'],
          ].map(([align, label]) => (
            <button
              key={align}
              type="button"
              className={`site-news-image-size-btn${activeFormats.align === align ? ' active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyBlockAlign(align as 'left' | 'center' | 'right' | 'justify')}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className={`btn btn-outline btn-sm icon-only site-news-tool-btn${activeFormats.link ? ' active' : ''}`} onMouseDown={toolbarMouseDown} onClick={addLink} title="插入链接" aria-label="插入链接">
          <Link size={13} />
        </button>
        <button type="button" className="site-news-format-btn" onMouseDown={toolbarMouseDown} onClick={clearFormat} title="清除格式">
          清
        </button>
        <button type="button" className="btn btn-outline btn-sm icon-only" onMouseDown={toolbarMouseDown} onClick={() => openImageUpload('insert')} title="上传正文图片" aria-label="上传正文图片" disabled={uploadingBodyImage}>
          <Image size={13} />
        </button>
        <div className="site-news-image-size-tools" aria-label="正文图片尺寸">
          {[
            ['small', '小'],
            ['medium', '中'],
            ['large', '大'],
            ['full', '满'],
          ].map(([size, label]) => (
            <button
              key={size}
              type="button"
              className={`site-news-image-size-btn${selectedImageSize === size ? ' active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyImageSize(size as 'small' | 'medium' | 'large' | 'full')}
              disabled={!selectedImageRef.current}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="site-news-image-size-tools" aria-label="正文图片对齐">
          {[
            ['left', '左'],
            ['center', '中'],
            ['right', '右'],
          ].map(([align, label]) => (
            <button
              key={align}
              type="button"
              className={`site-news-image-size-btn${selectedImageAlign === align ? ' active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyImageAlign(align as 'left' | 'center' | 'right')}
              disabled={!selectedImageRef.current}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="site-news-image-size-tools" aria-label="正文图片操作">
          <button type="button" className="site-news-image-size-btn" onMouseDown={(event) => event.preventDefault()} onClick={editImageCaption} disabled={!selectedImageRef.current}>注</button>
          <button type="button" className="site-news-image-size-btn" onMouseDown={(event) => event.preventDefault()} onClick={() => openImageUpload('replace')} disabled={!selectedImageRef.current || uploadingBodyImage}>替</button>
          <button type="button" className="site-news-image-size-btn danger" onMouseDown={(event) => event.preventDefault()} onClick={deleteSelectedImage} disabled={!selectedImageRef.current}>删</button>
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="site-news-richtext-file"
          onChange={(event) => uploadBodyImage(event.target.files?.[0] || null)}
        />
      </div>
      <div
        ref={editorRef}
        className="site-news-richtext-editor"
        contentEditable
        role="textbox"
        aria-label="资讯正文富文本编辑器"
        data-placeholder="输入官网新闻正文，可使用小标题、段落、列表和链接。"
        suppressContentEditableWarning
        onInput={() => {
          scheduleCommit();
          refreshActiveFormats();
        }}
        onBlur={() => commitNow({ sanitize: true })}
        onFocus={saveSelection}
        onKeyUp={() => {
          saveSelection();
          refreshActiveFormats();
        }}
        onMouseUp={saveSelection}
        onClick={handleEditorClick}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData('text/plain');
          document.execCommand('insertHTML', false, pastedTextToNewsHtml(text));
          scheduleCommit();
          saveSelection();
        }}
      />
    </div>
  );
}

function SiteNewsPanel({
  siteCode,
  siteAssetBaseUrl,
  canWrite,
}: {
  siteCode: string;
  siteAssetBaseUrl: string;
  canWrite: boolean;
}) {
  const [items, setItems] = useState<SiteNewsArticle[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'all' | SiteNewsStatus>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState<SiteNewsDraft>(() => emptyNewsDraft());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bodyFlushRef = useRef<(() => string) | null>(null);

  const loadNews = useCallback(async () => {
    setLoading(true);
    try {
      const result = await siteNews.list(siteCode, {
        includeArchived: 'true',
        page: String(page),
        pageSize: String(pageSize),
        ...(keyword.trim() ? { q: keyword.trim() } : {}),
        ...(status !== 'all' ? { status } : {}),
      });
      const rows = Array.isArray((result as any)?.items) ? (result as any).items : [];
      setItems(rows);
      setTotal(Number((result as any)?.total || rows.length));
      setTotalPages(Math.max(Number((result as any)?.pages || 1), 1));
      setFeedback(null);
    } catch (e) {
      setFeedback({ tone: 'error', text: (e as Error).message || '资讯加载失败。' });
    } finally {
      setLoading(false);
    }
  }, [keyword, page, pageSize, siteCode, status]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  function startCreate() {
    setEditingId('');
    setDraft(emptyNewsDraft());
    setShowCreate(true);
    setFeedback(null);
  }

  function startEdit(article: SiteNewsArticle) {
    setEditingId(article.id);
    setDraft(newsDraftFromArticle(article));
    setShowCreate(false);
    setFeedback(null);
  }

  function closeNewsEditor() {
    setShowCreate(false);
    setEditingId('');
    setDraft(emptyNewsDraft());
  }

  async function saveDraft() {
    setSaving(true);
    try {
      const flushedBody = bodyFlushRef.current?.() ?? draft.body;
      const payload = newsPayload({ ...draft, body: flushedBody });
      if (editingId) await siteNews.update(siteCode, editingId, payload);
      else await siteNews.create(siteCode, payload);
      setFeedback({ tone: 'success', text: editingId ? '资讯已保存。' : '资讯已创建。' });
      setEditingId('');
      setShowCreate(false);
      setDraft(emptyNewsDraft());
      await loadNews();
    } catch (e) {
      setFeedback({ tone: 'error', text: (e as Error).message || '资讯保存失败。' });
    } finally {
      setSaving(false);
    }
  }

  async function uploadCover(file: File | null) {
    if (!file) return;
    if (!isAllowedJpgOrPng(file)) {
      setFeedback({ tone: 'error', text: imageTypeErrorText() });
      return;
    }
    setUploading(true);
    try {
      const artifact = await fileArtifacts.uploadBase64({
        entityType: 'site-news',
        entityId: editingId || 'draft',
        filename: file.name,
        mimeType: file.type || 'image/png',
        dataBase64: await readBrowserFileBase64(file),
      });
      setDraft((current) => ({
        ...current,
        coverImageArtifactId: String((artifact as any)?.id || ''),
        coverImageUrl: '',
      }));
      setFeedback({ tone: 'success', text: '封面图已上传。系统会自动生成官网可访问的封面地址。' });
    } catch (e) {
      setFeedback({ tone: 'error', text: (e as Error).message || '封面图上传失败。' });
    } finally {
      setUploading(false);
    }
  }

  async function changeStatus(article: SiteNewsArticle, next: 'published' | 'hidden') {
    setSaving(true);
    try {
      if (next === 'published') await siteNews.publish(siteCode, article.id);
      else await siteNews.hide(siteCode, article.id);
      setFeedback({ tone: 'success', text: next === 'published' ? '资讯已发布。' : '资讯已隐藏。' });
      await loadNews();
    } catch (e) {
      setFeedback({ tone: 'error', text: (e as Error).message || '资讯状态更新失败。' });
    } finally {
      setSaving(false);
    }
  }

  async function archiveArticle(article: SiteNewsArticle) {
    if (!window.confirm(`确认归档「${article.title}」？归档后前台不再展示。`)) return;
    setSaving(true);
    try {
      await siteNews.archive(siteCode, article.id);
      setFeedback({ tone: 'success', text: '资讯已归档。' });
      await loadNews();
    } catch (e) {
      setFeedback({ tone: 'error', text: (e as Error).message || '资讯归档失败。' });
    } finally {
      setSaving(false);
    }
  }

  const editing = Boolean(showCreate || editingId);
  const registerBodyFlush = useCallback((flush: () => string) => {
    bodyFlushRef.current = flush;
  }, []);
  const draftPreviewImage = draft.coverImageArtifactId
    ? `/api/v2/file-artifact/${encodeURIComponent(draft.coverImageArtifactId)}/content`
    : siteNewsAssetUrl(draft.coverImageUrl || '/assets/img/home-card1.webp', siteAssetBaseUrl);

  return (
    <div className="site-news-panel" aria-label="品牌官网资讯管理">
      <div className="site-material-panel-head">
        <div>
          <p className="t-label">资讯管理</p>
          <h3>官网资讯 CRUD</h3>
          <p>维护当前品牌官网的 News & Insights；前台保持现有卡片视觉，仅替换为后台数据。</p>
        </div>
        {canWrite ? (
          <button type="button" className="btn btn-brand btn-sm" onClick={startCreate} disabled={saving}>
            <Plus size={13} />
            新增资讯
          </button>
        ) : (
          <span className="pill-neutral">只读</span>
        )}
      </div>

      <WorkbenchFilterToolbar>
        <div className="brand-product-search">
          <Search size={15} />
          <input
            className="input"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="搜索标题、摘要"
          />
          <select
            className="input brand-product-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as any);
              setPage(1);
            }}
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="hidden">已隐藏</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        {loading && <span className="badge badge-info">加载中</span>}
      </WorkbenchFilterToolbar>

      {feedback && <div className={`brand-product-inline-feedback ${feedback.tone}`}>{feedback.text}</div>}

      {editing && canWrite && (
        <div className="product-edit-backdrop" role="presentation" onMouseDown={closeNewsEditor}>
          <section
            className="product-edit-modal site-news-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="site-news-edit-title"
            data-testid="site-news-edit-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="product-edit-modal-head">
              <div>
                <p className="t-label">资讯编辑</p>
                <h2 id="site-news-edit-title">{editingId ? draft.title || '编辑资讯' : '新增资讯'}</h2>
                <span>{draft.slug || 'News & Insights'}</span>
              </div>
              <button type="button" className="btn btn-outline btn-sm icon-only" onClick={closeNewsEditor} aria-label="关闭资讯编辑">
                <X size={15} />
              </button>
            </header>

            <div className="product-edit-modal-body site-news-edit-modal-body">
              <section className="product-edit-section site-news-edit-section">
                <div className="product-edit-section-head">
                  <h3>基础信息</h3>
                </div>
                <div className="product-create-grid">
                  <FormField label="标题" value={draft.title} onChange={(title) => setDraft((current) => ({ ...current, title }))} />
                  <FormField label="发布日期" value={draft.publishedAt} type="date" onChange={(publishedAt) => setDraft((current) => ({ ...current, publishedAt }))} />
                  <FormField label="排序" value={draft.sortOrder} type="number" onChange={(sortOrder) => setDraft((current) => ({ ...current, sortOrder }))} />
                  <FormField
                    label="状态"
                    value={draft.status}
                    options={[
                      { value: 'draft', label: '草稿' },
                      { value: 'published', label: '已发布' },
                      { value: 'hidden', label: '已隐藏' },
                    ]}
                    onChange={(nextStatus) => setDraft((current) => ({ ...current, status: nextStatus as SiteNewsStatus }))}
                  />
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span className="t-label">上传封面</span>
                    <input className="input" type="file" accept="image/png,image/jpeg" onChange={(event) => uploadCover(event.target.files?.[0] || null)} disabled={uploading} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={draft.isFeatured} onChange={(event) => setDraft((current) => ({ ...current, isFeatured: event.target.checked }))} />
                    <span className="t-label">置顶/精选</span>
                  </label>
                </div>
              </section>

              <section className="product-edit-section site-news-edit-section">
                <div className="product-edit-section-head">
                  <h3>内容编辑</h3>
                </div>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">摘要</span>
                  <textarea className="input" rows={2} value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">正文</span>
                  <SiteNewsRichTextEditor
                    value={draft.body}
                    entityId={editingId || draft.slug || 'draft'}
                    onChange={(body) => setDraft((current) => ({ ...current, body }))}
                    onFeedback={setFeedback}
                    onRegisterFlush={registerBodyFlush}
                  />
                </label>
              </section>

              <section className="product-edit-section product-edit-section-wide site-news-edit-section">
                <div className="product-edit-section-head">
                  <h3>官网预览</h3>
                </div>
                <div className="site-news-preview-grid">
                  <div className="site-news-preview-pane">
                    <span className="t-label">卡片</span>
                    <div className="site-news-preview-card">
                      <div
                        className="site-news-preview-img"
                        style={{ backgroundImage: `url("${draftPreviewImage}")` }}
                      />
                      <div className="news-preview-body">
                        <span>{draft.publishedAt ? draft.publishedAt.slice(0, 7) : '发布日期'}</span>
                        <strong>{draft.title || '资讯标题'}</strong>
                        <p>{draft.summary || '资讯摘要'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="site-news-preview-pane">
                    <span className="t-label">详情</span>
                    <div className="site-news-detail-preview">
                      <div className="site-news-detail-preview-img" style={{ backgroundImage: `url("${draftPreviewImage}")` }} />
                      <div className="site-news-detail-preview-body">
                        <span>{draft.publishedAt ? draft.publishedAt.slice(0, 7) : '发布日期'}</span>
                        <h4>{draft.title || '资讯标题'}</h4>
                        <p>{draft.summary || '资讯摘要'}</p>
                        <div className="site-news-detail-preview-content" dangerouslySetInnerHTML={{ __html: siteNewsPreviewHtml(draft.body) }} />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <footer className="product-edit-modal-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={closeNewsEditor} disabled={saving}>
                <X size={13} />
                取消
              </button>
              <button type="button" className="btn btn-brand btn-sm" onClick={saveDraft} disabled={saving || uploading}>
                <Save size={13} />
                {saving ? '保存中...' : '保存资讯'}
              </button>
            </footer>
          </section>
        </div>
      )}

      <WorkbenchTableShell>
        <div className="brand-product-table-wrap">
          <table className="table brand-product-table site-news-table">
            <thead>
              <tr>
                <th>封面</th>
                <th>资讯</th>
                <th>发布日期</th>
                <th>排序</th>
                <th>状态</th>
                <th style={{ textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length ? (
                items.map((article) => {
                  const meta = siteNewsStatusMeta(article.status);
                  return (
                    <tr key={article.id}>
                      <td>
                        <div className="site-news-thumb" style={{ backgroundImage: `url("${siteNewsImage(article, siteAssetBaseUrl)}")` }} />
                      </td>
                      <td>
                        <strong>{article.title}</strong>
                        <div style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>{article.summary}</div>
                      </td>
                      <td>{article.publishedAt ? String(article.publishedAt).slice(0, 10) : '-'}</td>
                      <td><span className="mono-cell">{article.sortOrder || 0}</span></td>
                      <td><StatusPill tone={meta.tone}>{meta.label}</StatusPill></td>
                      <td style={{ textAlign: 'right' }}>
                        {canWrite ? (
                          <div className="row-edit-actions">
                            <button type="button" className="btn btn-brand btn-sm" onClick={() => startEdit(article)} disabled={saving}>
                              <Pencil size={13} />
                              编辑
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => changeStatus(article, article.status === 'published' ? 'hidden' : 'published')}
                              disabled={saving || article.status === 'archived'}
                            >
                              {article.status === 'published' ? <EyeOff size={13} /> : <Rocket size={13} />}
                              {article.status === 'published' ? '隐藏' : '发布'}
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => archiveArticle(article)} disabled={saving || article.status === 'archived'}>
                              <Archive size={13} />
                              归档
                            </button>
                          </div>
                        ) : (
                          <span className="muted-value">只读</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="brand-product-empty">
                    <WorkbenchTableState
                      type={loading ? 'loading' : 'empty'}
                      title={loading ? '正在加载资讯' : '暂无资讯'}
                      description={loading ? '正在读取当前品牌官网资讯。' : '新增资讯后会用于官网 News & Insights 模块。'}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <WorkbenchPaginationFooter
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={pageSize}
          pageSizeOptions={PRODUCT_PAGE_SIZE_OPTIONS}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
          onPageChange={loading ? undefined : (nextPage) => setPage(nextPage)}
          onPrevious={loading || page <= 1 ? undefined : () => setPage((current) => Math.max(current - 1, 1))}
          onNext={loading || page >= totalPages ? undefined : () => setPage((current) => current + 1)}
        />
      </WorkbenchTableShell>
    </div>
  );
}

function CategoryMultiSelect({
  options,
  value,
  open,
  loading,
  onOpenChange,
  onChange,
}: {
  options: ProductCategoryFilterOption[];
  value: string[];
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string[]) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [draftValue, setDraftValue] = useState<string[]>(value);
  const selected = new Set(draftValue);
  const groups = categoryFilterGroups(options);
  const allValues = options.map((option) => option.value);
  const checkedCount = draftValue.length;
  const allChecked = allValues.length > 0 && checkedCount === allValues.length;
  const indeterminate = checkedCount > 0 && !allChecked;
  const selectedLabels = value.map((item) => options.find((option) => option.value === item)?.label).filter(Boolean) as string[];
  const displayLabel = selectedLabels.length
    ? selectedLabels.length === 1
      ? selectedLabels[0]
      : `已选 ${selectedLabels.length} 个分类`
    : '\u5168\u90e8\u5206\u7c7b';

  const toggleValue = (nextValue: string) => {
    const next = new Set(selected);
    if (next.has(nextValue)) next.delete(nextValue);
    else next.add(nextValue);
    setDraftValue([...next]);
  };
  const toggleGroup = (group: { root: ProductCategoryFilterOption; children: ProductCategoryFilterOption[] }) => {
    const next = new Set(selected);
    const groupValues = [group.root.value, ...group.children.map((child) => child.value)];
    const shouldSelect = !groupValues.every((item) => next.has(item));
    groupValues.forEach((item) => {
      if (shouldSelect) next.add(item);
      else next.delete(item);
    });
    setDraftValue([...next]);
  };

  const applyDraft = () => {
    onChange(draftValue);
    onOpenChange(false);
  };

  const clearDraft = () => {
    setDraftValue([]);
  };

  useEffect(() => {
    if (open) setDraftValue(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onOpenChange, open]);

  return (
    <div className="category-filter-select" ref={rootRef}>
      <button
        type="button"
        className={`input category-filter-trigger${open ? ' is-open' : ''}`}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label="Product category filter"
      >
        <span>{loading && !options.length ? '\u52a0\u8f7d\u5206\u7c7b...' : displayLabel}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="category-filter-menu">
          <label className="category-filter-all">
            <input
              type="checkbox"
              checked={allChecked}
              ref={(node) => {
                if (node) node.indeterminate = indeterminate;
              }}
              onChange={(event) => {
                setDraftValue(event.target.checked ? allValues : []);
              }}
            />
            <span>{'\u5168\u9009'}</span>
          </label>
          <div className="category-filter-options">
            {groups.map((group) => (
              <div className="category-filter-group" key={group.root.value}>
                <label className="category-filter-option root">
                  <input
                    type="checkbox"
                    checked={[group.root.value, ...group.children.map((child) => child.value)].every((item) => selected.has(item))}
                    ref={(node) => {
                      if (node) {
                        const groupValues = [group.root.value, ...group.children.map((child) => child.value)];
                        node.indeterminate = groupValues.some((item) => selected.has(item)) && !groupValues.every((item) => selected.has(item));
                      }
                    }}
                    onChange={() => toggleGroup(group)}
                  />
                  <span>{group.root.label}</span>
                </label>
                {group.children.map((child) => (
                  <label className="category-filter-option child" key={child.value}>
                    <input
                      type="checkbox"
                      checked={selected.has(child.value)}
                      onChange={() => toggleValue(child.value)}
                    />
                    <span>{child.label.replace(`${group.root.label} / `, '')}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          <div className="category-filter-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearDraft}>
              清空
            </button>
            <button type="button" className="btn btn-brand btn-sm" onClick={applyDraft}>
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function categoryFilterGroups(options: ProductCategoryFilterOption[]) {
  const roots = options.filter((option) => option.level === 1 || !option.label.includes(' / '));
  const fallbackRoots = roots.length ? roots : options.filter((option) => !option.label.includes(' / '));
  return fallbackRoots.map((root) => ({
    root,
    children: options.filter((option) => option.value !== root.value && option.label.startsWith(`${root.label} / `)),
  }));
}

function productSingleCategoryOptions(
  options: ProductCategoryFilterOption[],
  product: BrandProductRow,
  draft: BrandProductEditDraft,
): ProductCategoryFilterOption[] {
  const currentLabel = productCategoryPathLabel([draft.category, draft.system].filter(Boolean).join(' / '))
    || productDisplayCategoryPath(product);
  const currentValue = `current:${draft.category || product.category}:${draft.system || product.system}`;
  if (!currentLabel || options.some((option) => option.label === currentLabel)) return options;
  return [
    {
      value: currentValue,
      label: currentLabel,
      level: 2,
      pathCodes: [draft.category || product.category, draft.system || product.system].filter(Boolean),
    },
    ...options,
  ];
}

function selectedProductCategoryValue(
  options: ProductCategoryFilterOption[],
  product: BrandProductRow,
  draft: BrandProductEditDraft,
) {
  const category = String(draft.category || product.category || '').trim();
  const system = String(draft.system || product.system || '').trim();
  const byCodes = options.find((option) => {
    const codes = option.pathCodes || [];
    return codes.length && (!category || codes.includes(category)) && (!system || codes.includes(system));
  });
  if (byCodes) return byCodes.value;
  const display = productCategoryPathLabel([category, system].filter(Boolean).join(' / '));
  return options.find((option) => option.label === display)?.value || '';
}

function productCategoryDraftPatch(
  value: string,
  options: ProductCategoryFilterOption[],
  draft: BrandProductEditDraft,
): Partial<BrandProductEditDraft> {
  const option = options.find((item) => item.value === value);
  if (!option) return {};
  const labels = option.label.split('/').map((part) => part.trim()).filter(Boolean);
  const codes = option.pathCodes || [];
  const category = productCategoryRootCode(labels[0] || '', codes[0] || draft.category);
  const system = productCategoryLeafCode(labels[labels.length - 1] || '', codes[codes.length - 1] || draft.system, category);
  return {
    category,
    system,
  };
}

function productCategoryRootCode(label: string, fallback: string) {
  const textValue = String(label || '').trim().toLowerCase();
  if (textValue.includes('家用') || textValue === 'home' || textValue === 'residential') return 'residential';
  if (textValue.includes('商用') || textValue === 'commercial') return 'commercial';
  return fallback || textValue;
}

function productCategoryLeafCode(label: string, fallback: string, category: string) {
  const normalized = String(label || '').trim();
  const known: Record<string, string> = {
    热水系统: 'water-heating',
    采暖与制冷: 'heating-cooling',
    采暖制冷: 'heating-cooling',
    热泵系统: 'heat-pump',
    新风系统: 'fresh-air',
    中央空调: 'central-air',
    智控系统: 'smart-control',
  };
  const next = known[normalized] || fallback || normalized;
  return next === category ? '' : next;
}

function CategorySingleSelectField({
  label,
  value,
  options,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  options: ProductCategoryFilterOption[];
  fallback: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const groups = categoryFilterGroups(options);
  const selected = options.find((option) => option.value === value);
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);
  return (
    <label className="product-create-field category-single-field">
      <span>{label}</span>
      <div className="category-filter-select category-filter-select--single" ref={rootRef}>
        <button
          type="button"
          className={`input category-filter-trigger${open ? ' is-open' : ''}`}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          <span>{selected?.label || fallback}</span>
          <ChevronDown size={14} />
        </button>
        {open && (
          <div className="category-filter-menu category-filter-menu--single">
            <label className="category-filter-all">
              <input type="radio" name="product-category-single" checked={!value} onChange={() => onChange('')} />
              <span>全部分类</span>
            </label>
            <div className="category-filter-options">
              {groups.map((group) => (
                <div className="category-filter-group" key={group.root.value}>
                  <label className="category-filter-option root">
                    <input
                      type="radio"
                      name="product-category-single"
                      checked={value === group.root.value}
                      onChange={() => {
                        onChange(group.root.value);
                        setOpen(false);
                      }}
                    />
                    <span>{group.root.label}</span>
                  </label>
                  {group.children.map((child) => (
                    <label className="category-filter-option child" key={child.value}>
                      <input
                        type="radio"
                        name="product-category-single"
                        checked={value === child.value}
                        onChange={() => {
                          onChange(child.value);
                          setOpen(false);
                        }}
                      />
                      <span>{child.label.replace(`${group.root.label} / `, '')}</span>
                    </label>
                ))}
              </div>
            ))}
            </div>
            <div className="category-filter-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onChange(''); setOpen(false); }}>
                清空
              </button>
              <button type="button" className="btn btn-brand btn-sm" onClick={() => setOpen(false)}>
                确定
              </button>
            </div>
          </div>
        )}
      </div>
    </label>
  );
}

function ProductSummaryRow({
  product,
  canWrite,
  canPublishShelf,
  canHideShelf,
  feedback,
  shelfAssignment,
  shelfLoading,
  shelfBusy,
  shelfTransition,
  shelfFeedback,
  selected,
  selectionDisabled,
  onSelectionChange,
  onEdit,
  onPublishShelf,
  onHideShelf,
}: {
  product: BrandProductRow;
  canWrite: boolean;
  canPublishShelf: boolean;
  canHideShelf: boolean;
  feedback?: { tone: 'success' | 'error'; text: string };
  shelfAssignment?: WebsiteShelfAssignment;
  shelfLoading: boolean;
  shelfBusy: boolean;
  shelfTransition?: WebsiteShelfTransition;
  shelfFeedback?: { tone: 'success' | 'error'; text: string };
  selected: boolean;
  selectionDisabled: boolean;
  onSelectionChange: (checked: boolean) => void;
  onEdit: () => void;
  onPublishShelf: () => void;
  onHideShelf: () => void;
}) {
  const shelfMeta = websiteShelfMeta(shelfAssignment, shelfTransition);
  const shelfPublished = isWebsiteShelfPublished(shelfAssignment, shelfTransition);
  const canUseShelfAction = shelfPublished ? canHideShelf : canPublishShelf;
  const shelfActionLabel = shelfPublished ? '从当前品牌官网下架' : '上架到当前品牌官网';
  return (
    <tr className={selected ? 'is-selected' : undefined}>
      <td className="brand-product-select-col">
        <input
          type="checkbox"
          className="brand-product-select-checkbox"
          checked={selected}
          disabled={selectionDisabled}
          onChange={(event) => onSelectionChange(event.target.checked)}
          aria-label={`选择 ${product.name || product.sku || '产品'}`}
        />
      </td>
      <td className="brand-product-category-path-col">
        <div className="brand-product-taxonomy-cell">
          <span>{productDisplayCategoryPath(product)}</span>
        </div>
      </td>
      <td className="brand-product-identity-col">
        <div className="brand-product-identity-cell">
          <strong>{product.name || '缺少名称'}</strong>
          <input type="hidden" value={product.publicSlug || ''} readOnly aria-hidden="true" />
        </div>
      </td>
      <td className="brand-product-model-col">
        <span className="mono-cell">{product.model || product.sku || '缺少型号'}</span>
      </td>
      <td className="brand-product-image-col">
        <ProductImagePreview product={product} />
      </td>
      <td className="brand-product-order-col">
        <span className="mono-cell">{product.sortOrder || 0}</span>
      </td>
      <td className="brand-product-shelf-status-col">
        <div className="website-shelf-status-cell">
          <span data-testid={`website-shelf-status-${product.sku}`}>
            <StatusPill tone={statusTone(shelfMeta.className)}>{shelfMeta.label}</StatusPill>
          </span>
          {shelfFeedback && (shelfBusy || shelfFeedback.tone === 'error') && <span className={`row-feedback ${shelfFeedback.tone}`}>{shelfFeedback.text}</span>}
        </div>
      </td>
      <td className="brand-product-actions-col">
        {canWrite || canUseShelfAction ? (
          <div className="row-edit-actions">
            {canWrite && (
            <button
              type="button"
              className="btn btn-brand btn-sm"
              onClick={onEdit}
              data-testid={`brand-product-edit-${product.sku}`}
            >
              <Pencil size={13} />
              编辑
            </button>
            )}
            {canUseShelfAction && (
              <button
                type="button"
                className={`btn btn-outline btn-sm website-shelf-action${shelfTransition ? ' is-transitioning' : ''}`}
                onClick={shelfPublished ? onHideShelf : onPublishShelf}
                disabled={shelfBusy || shelfLoading}
                title={shelfActionLabel}
                aria-label={shelfActionLabel}
                data-testid={`website-shelf-action-${product.sku}`}
              >
                {shelfTransition ? <Loader2 size={13} /> : shelfPublished ? <EyeOff size={13} /> : <Rocket size={13} />}
                {shelfTransition ? '处理中' : shelfPublished ? '下架' : '上架'}
              </button>
            )}
            {feedback && <span className={`row-feedback ${feedback.tone}`}>{feedback.text}</span>}
          </div>
        ) : (
          <span className="muted-value">只读</span>
        )}
      </td>
    </tr>
  );
}

function ProductEditModal({
  mode = 'edit',
  product,
  brandCode,
  canWrite,
  canUpdateStatus,
  canArchiveProduct,
  canPublishShelf,
  canHideShelf,
  categoryOptions,
  draft,
  structuredDraft,
  officialDetailHtml = '',
  officialDetailDirty = false,
  manualPdfs = [],
  manualPdfsDirty = false,
  taxonomy,
  saving,
  savingStructured,
  feedback,
  structuredFeedback,
  officialDetailFeedback,
  shelfAssignment,
  shelfLoading,
  shelfBusy,
  shelfTransition,
  shelfFeedback,
  actionBusy,
  imageBusy,
  imageFeedback,
  onChange,
  onStructuredChange,
  onOfficialDetailChange,
  onOfficialDetailFeedback,
  onManualPdfsChange,
  onSave,
  onReset,
  onStructuredSave,
  onStructuredReset,
  onClose,
  onToggleStatus,
  onArchive,
  onPublishShelf,
  onHideShelf,
  onUploadMainImage,
  onDeleteMainImage,
  onUploadDetailImage,
  onDeleteDetailImage,
  onMoveDetailImage,
}: {
  mode?: 'create' | 'edit';
  product: BrandProductRow;
  brandCode: string;
  canWrite: boolean;
  canUpdateStatus: boolean;
  canArchiveProduct: boolean;
  canPublishShelf: boolean;
  canHideShelf: boolean;
  categoryOptions: ProductCategoryFilterOption[];
  draft: BrandProductEditDraft;
  structuredDraft: BrandStructuredContentDraft;
  officialDetailHtml?: string;
  officialDetailDirty?: boolean;
  manualPdfs?: ProductManualPdfDraft[];
  manualPdfsDirty?: boolean;
  taxonomy: Record<string, unknown>;
  saving: boolean;
  savingStructured: boolean;
  feedback?: { tone: 'success' | 'error'; text: string };
  structuredFeedback?: { tone: 'success' | 'error'; text: string };
  officialDetailFeedback?: { tone: 'success' | 'error'; text: string };
  shelfAssignment?: WebsiteShelfAssignment;
  shelfLoading: boolean;
  shelfBusy: boolean;
  shelfTransition?: WebsiteShelfTransition;
  shelfFeedback?: { tone: 'success' | 'error'; text: string };
  actionBusy: boolean;
  imageBusy: boolean;
  imageFeedback?: ImageActionFeedback;
  onChange: (patch: Partial<BrandProductEditDraft>) => void;
  onStructuredChange: (patch: Partial<BrandStructuredContentDraft>) => void;
  onOfficialDetailChange?: (officialDetailHtml: string) => void;
  onOfficialDetailFeedback?: (feedback: { tone: 'success' | 'error'; text: string }) => void;
  onManualPdfsChange?: (manualPdfs: ProductManualPdfDraft[]) => void;
  onSave: (overrides?: { officialDetailHtml?: string }) => void;
  onReset: () => void;
  onStructuredSave: () => void;
  onStructuredReset: () => void;
  onClose: () => void;
  onToggleStatus: () => void;
  onArchive: () => void;
  onPublishShelf: () => void;
  onHideShelf: () => void;
  onUploadMainImage: (file: File | null) => void;
  onDeleteMainImage: () => void;
  onUploadDetailImage: (file: File | null) => void;
  onDeleteDetailImage: (artifactId: string) => void;
  onMoveDetailImage: (artifactId: string, direction: -1 | 1) => void;
}) {
  const isCreate = mode === 'create';
  const dirty = canWrite && (isCreate || isDirtyProductDraft(product, draft) || officialDetailDirty || manualPdfsDirty);
  const structuredDirty = !isCreate && canWrite && isDirtyStructuredContentDraft(product, brandCode, structuredDraft);
  const status = productStatusMeta(product.status);
  const shelfMeta = websiteShelfMeta(shelfAssignment, shelfTransition);
  const shelfPublished = isWebsiteShelfPublished(shelfAssignment, shelfTransition);
  const canUseShelfAction = shelfPublished ? canHideShelf : canPublishShelf;
  const menuGroupOptions = getBrandMenuGroupOptions(String(product.raw.brand || brandCode), draft.websiteMenuCategory);
  const productCategoryOptions = productSingleCategoryOptions(categoryOptions, product, draft);
  const selectedProductCategory = selectedProductCategoryValue(productCategoryOptions, product, draft);
  const modalShelfActionLabel = shelfTransition === 'publishing'
    ? '官网上架中'
    : shelfTransition === 'hiding'
      ? '官网下架中'
      : shelfPublished
        ? '官网下架'
        : '官网上架';
  const nameInvalid = !draft.name.trim();
  const createInvalid = isCreate && !(draft.model.trim() || draft.publicSlug.trim());
  const update = (patch: Partial<BrandProductEditDraft>) => onChange({ ...draft, ...patch });
  const officialDetailFlushRef = useRef<(() => string) | null>(null);
  const handleSave = () => {
    if (isCreate || !officialDetailFlushRef.current) {
      onSave();
      return;
    }
    const flushedOfficialDetailHtml = officialDetailFlushRef.current();
    onOfficialDetailChange?.(flushedOfficialDetailHtml);
    onSave({ officialDetailHtml: flushedOfficialDetailHtml });
  };

  return (
    <div className="product-edit-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="product-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-edit-title"
        data-testid="brand-product-edit-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="product-edit-modal-head">
          <div>
            <p className="t-label">{isCreate ? '新增产品' : '产品编辑'}</p>
            <h2 id="product-edit-title">{isCreate ? draft.name || '新增产品' : product.name || product.sku || '未命名产品'}</h2>
            <span>{isCreate ? '创建后生成 SKU 与官网货架状态' : `${product.sku || product.id} · ${product.model || '缺少型号'}`}</span>
          </div>
          <button type="button" className="btn btn-outline btn-sm icon-only" onClick={onClose} aria-label="关闭产品编辑">
            <X size={15} />
          </button>
        </header>

        <div className="product-edit-modal-body">
          <section className="product-edit-section">
            <div className="product-edit-section-head">
              <h3>{'\u5bfc\u5165\u7269\u6599\u4fe1\u606f'}</h3>
              <span className="badge badge-grey">ERP</span>
            </div>
            <div className="product-edit-field-grid">
              <LabeledValue label={'\u7269\u6599\u7f16\u7801'} value={product.materialCode || product.sku} fallback="-" />
              <LabeledValue label={'\u7269\u6599\u5206\u7c7b'} value={product.materialCategory} fallback="-" />
              <LabeledValue label={'\u4ea7\u54c1\u7ebf'} value={product.productLine} fallback="-" />
              <LabeledValue label={'\u4ea7\u54c1\u5206\u7c7b'} value={productDisplayCategoryPath(product)} fallback="-" />
              <LabeledValue
                label={'\u5e94\u7528\u573a\u666f'}
                value={product.applicationScenarios.map(taxonomyDisplayLabel).join(' / ')}
                fallback="-"
              />
            </div>
          </section>

          <section className="product-edit-section">
            <div className="product-edit-section-head">
              <h3>基础信息</h3>
              <StatusPill tone={statusTone(status.className)}>{status.label}</StatusPill>
            </div>
            <div className="product-edit-field-grid">
              <FormField label="名称" value={draft.name} onChange={(name) => update({ name })} />
              <FormField label="型号" value={draft.model} onChange={(model) => update({ model })} />
              <CategorySingleSelectField
                label="分类 / 系统"
                value={selectedProductCategory}
                options={productCategoryOptions}
                fallback="请选择分类 / 系统"
                onChange={(value) => update(productCategoryDraftPatch(value, productCategoryOptions, draft))}
              />
              <FormField label="系列" value={draft.series} onChange={(series) => update({ series })} />
              <FormField label="英文名" value={draft.officialEnglishName} onChange={(officialEnglishName) => update({ officialEnglishName })} />
              {!isCreate && <div className="product-edit-shelf-field">
                <div className="product-edit-section-head">
                  <h3>官网货架</h3>
                  <StatusPill tone={statusTone(shelfMeta.className)}>{shelfMeta.label}</StatusPill>
                </div>
                <div className="product-edit-shelf-actions">
                  {canUseShelfAction && (
                  <button
                    type="button"
                    className={`btn btn-outline btn-sm website-shelf-action${shelfTransition ? ' is-transitioning' : ''}`}
                    onClick={shelfPublished ? onHideShelf : onPublishShelf}
                    disabled={shelfBusy || shelfLoading}
                    data-testid={`modal-shelf-action-${product.sku}`}
                  >
                    {shelfPublished ? <EyeOff size={13} /> : <Rocket size={13} />}
                    {modalShelfActionLabel}
                  </button>
                  )}
                  {canUpdateStatus && (
                  <button
                    type="button"
                    className={`btn btn-outline btn-sm product-status-action${actionBusy ? ' is-transitioning' : ''}`}
                    onClick={onToggleStatus}
                    disabled={actionBusy}
                    title={product.status === 'active' ? '从产品库下架' : '上架到产品库'}
                  >
                    {product.status === 'active' ? <ArrowDownCircle size={13} /> : <ArrowUpCircle size={13} />}
                    {actionBusy ? '处理中' : product.status === 'active' ? '产品库下架' : '产品库上架'}
                  </button>
                  )}
                  {canArchiveProduct && (
                  <button type="button" className="btn btn-outline btn-sm btn-danger" onClick={onArchive} disabled={actionBusy}>
                    <Archive size={13} />
                    归档产品
                  </button>
                  )}
                  {shelfFeedback && (shelfBusy || shelfFeedback.tone === 'error') && <span className={`row-feedback ${shelfFeedback.tone}`}>{shelfFeedback.text}</span>}
                </div>
              </div>}
            </div>
          </section>

          <section className="product-edit-section">
            <div className="product-edit-section-head">
              <h3>官网展示</h3>
              {dirty && <span className="dirty-chip">有未保存修改</span>}
            </div>
            <div className="product-edit-field-grid">
              <FormField label="公开 Slug" value={draft.publicSlug} onChange={(publicSlug) => update({ publicSlug })} />
              <FormField
                label="官网菜单分类"
                value={draft.websiteMenuCategory}
                options={menuGroupOptions}
                onChange={(websiteMenuCategory) => update({ websiteMenuCategory })}
              />
              <FormField label="排序" value={draft.sortOrder} type="number" onChange={(sortOrder) => update({ sortOrder })} />
              <FormField label="标语" value={draft.tagline} onChange={(tagline) => update({ tagline })} />
              <FormField label="标签" value={draft.badges} onChange={(badges) => update({ badges })} />
            </div>
            {nameInvalid && <p className="product-edit-validation">产品名称不能为空。</p>}
          </section>

          {!isCreate && <section className="product-edit-section">
            <div className="product-edit-section-head">
              <h3>图片 / 素材</h3>
              <span className={product.imageState.hasMainImage ? 'badge badge-success' : 'badge badge-warning'}>
                {product.imageState.label}
              </span>
            </div>
            <ProductImageAssets
              product={product}
              canWrite={canWrite}
              busy={imageBusy}
              feedback={imageFeedback}
              onUploadMainImage={onUploadMainImage}
              onDeleteMainImage={onDeleteMainImage}
              onUploadDetailImage={onUploadDetailImage}
              onDeleteDetailImage={onDeleteDetailImage}
              onMoveDetailImage={onMoveDetailImage}
            />
          </section>}

          <section className="product-edit-section product-edit-section-wide">
            <div className="product-edit-section-head">
              <h3>规格、卖点 / FAQ</h3>
              {structuredDirty && <span className="dirty-chip">官网内容有未保存修改</span>}
            </div>
            <StructuredContentEditor
              canWrite={canWrite}
              draft={structuredDraft}
              taxonomy={taxonomy}
              dirty={structuredDirty}
              saving={savingStructured}
              feedback={structuredFeedback}
              onChange={onStructuredChange}
              onSave={onStructuredSave}
              onReset={onStructuredReset}
            />
          </section>

          {!isCreate && <section className="product-edit-section product-edit-section-wide">
            <div className="product-edit-section-head">
              <h3>官网产品详情</h3>
              <span className="badge badge-grey">750px 长图</span>
              {officialDetailFeedback && <span className={`row-feedback ${officialDetailFeedback.tone}`}>{officialDetailFeedback.text}</span>}
            </div>
            <SiteNewsRichTextEditor
              value={officialDetailHtml}
              entityId={product.id}
              imageEntityType="product-detail-body"
              onChange={(nextHtml) => onOfficialDetailChange?.(nextHtml)}
              onFeedback={(nextFeedback) => onOfficialDetailFeedback?.(nextFeedback)}
              onRegisterFlush={(flush) => {
                officialDetailFlushRef.current = flush;
              }}
            />
            <p style={{ margin: 0, color: 'var(--t-tertiary)', fontSize: 12 }}>
              建议上传宽度 750px 的详情图片，高度不限；官网移动端会等比例缩放。
            </p>
          </section>}

          <ProductManualPdfUploader
            manualPdfs={manualPdfs}
            disabled={saving}
            onChange={(nextManualPdfs) => onManualPdfsChange?.(nextManualPdfs)}
          />
        </div>

        <footer className="product-edit-modal-actions">
          {feedback && <span className={`row-feedback ${feedback.tone}`}>{feedback.text}</span>}
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving || savingStructured}>
            <X size={13} />
            取消
          </button>
          {!isCreate && <button type="button" className="btn btn-outline btn-sm" onClick={onReset} disabled={!dirty || saving}>
            <RefreshCw size={13} />
            重置基础信息
          </button>}
          <button
            type="button"
            className="btn btn-brand btn-sm"
            onClick={handleSave}
            disabled={!dirty || saving || nameInvalid || createInvalid}
            data-testid={isCreate ? 'brand-product-create-save' : 'brand-product-edit-save'}
          >
            {isCreate ? <Check size={13} /> : <Save size={13} />}
            {saving ? (isCreate ? '创建中...' : '保存中...') : (isCreate ? '创建产品骨架' : '保存产品')}
          </button>
        </footer>
      </section>
    </div>
  );
}

function LabeledValue({ label, value, fallback }: { label: string; value: string; fallback: string }) {
  return (
    <div className="brand-product-labeled-field">
      <span className="edit-field-caption">{label}</span>
      <span>{value || fallback}</span>
    </div>
  );
}

function ProductManualPdfUploader({
  manualPdfs,
  disabled,
  onChange,
}: {
  manualPdfs: ProductManualPdfDraft[];
  disabled: boolean;
  onChange: (manualPdfs: ProductManualPdfDraft[]) => void;
}) {
  return (
    <section className="product-edit-section product-edit-section-wide">
      <div className="product-edit-section-head">
        <h3>产品说明 PDF</h3>
        <span className="badge badge-grey">不限数量</span>
      </div>
      <label className="product-create-field">
        <span>上传 PDF</span>
        <input
          className="input"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          disabled={disabled}
          onChange={(event) => {
            const files = Array.from(event.target.files || []).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
            if (!files.length) return;
            onChange([
              ...manualPdfs,
              ...files.map((file) => ({
                id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
                file,
                name: file.name,
                previewUrl: URL.createObjectURL(file),
              })),
            ]);
            event.currentTarget.value = '';
          }}
        />
      </label>
      {manualPdfs.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {manualPdfs.map((manual, index) => (
            <div key={manual.id} className="inset" style={{ display: 'grid', gap: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ overflowWrap: 'anywhere' }}>{index + 1}. {manual.name}</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    URL.revokeObjectURL(manual.previewUrl);
                    onChange(manualPdfs.filter((item) => item.id !== manual.id));
                  }}
                  disabled={disabled}
                >
                  <X size={13} />
                  移除
                </button>
              </div>
              <iframe title={`PDF preview ${manual.name}`} src={manual.previewUrl} style={{ width: '100%', height: 320, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="inset" style={{ padding: 12, color: 'var(--t-secondary)', fontSize: 13 }}>尚未上传产品说明 PDF。</div>
      )}
    </section>
  );
}

function ProductRow({
  product,
  brandCode,
  canWrite,
  draft,
  structuredDraft,
  taxonomy,
  structuredExpanded,
  saving,
  savingStructured,
  feedback,
  structuredFeedback,
  shelfAssignment,
  shelfLoading,
  shelfBusy,
  shelfFeedback,
  onChange,
  onStructuredChange,
  onSave,
  onReset,
  onStructuredSave,
  onStructuredReset,
  onStructuredToggle,
  actionBusy,
  onToggleStatus,
  onArchive,
  onPublishShelf,
  onHideShelf,
  imageBusy,
  onUploadMainImage,
  onDeleteMainImage,
  onMoveDetailImage,
}: {
  product: BrandProductRow;
  brandCode: string;
  canWrite: boolean;
  draft: BrandProductEditDraft;
  structuredDraft: BrandStructuredContentDraft;
  taxonomy: Record<string, unknown>;
  structuredExpanded: boolean;
  saving: boolean;
  savingStructured: boolean;
  feedback?: { tone: 'success' | 'error'; text: string };
  structuredFeedback?: { tone: 'success' | 'error'; text: string };
  shelfAssignment?: WebsiteShelfAssignment;
  shelfLoading: boolean;
  shelfBusy: boolean;
  shelfFeedback?: { tone: 'success' | 'error'; text: string };
  onChange: (patch: Partial<BrandProductEditDraft>) => void;
  onStructuredChange: (patch: Partial<BrandStructuredContentDraft>) => void;
  onSave: () => void;
  onReset: () => void;
  onStructuredSave: () => void;
  onStructuredReset: () => void;
  onStructuredToggle: () => void;
  actionBusy: boolean;
  onToggleStatus: () => void;
  onArchive: () => void;
  onPublishShelf: () => void;
  onHideShelf: () => void;
  imageBusy: boolean;
  onUploadMainImage: (file: File | null) => void;
  onDeleteMainImage: () => void;
  onMoveDetailImage: (artifactId: string, direction: -1 | 1) => void;
}) {
  const dirty = canWrite && isDirtyProductDraft(product, draft);
  const structuredDirty =
    canWrite && isDirtyStructuredContentDraft(product, String(product.raw.brand || ''), structuredDraft);
  const status = productStatusMeta(product.status);
  const shelfMeta = websiteShelfMeta(shelfAssignment);
  const canHideShelf = shelfAssignment?.status === 'published' && !shelfAssignment.deletedAt;
  const menuGroupOptions = getBrandMenuGroupOptions(
    String(product.raw.brand || brandCode),
    draft.websiteMenuCategory
  );
  const categoryOptions = optionsWithCurrent(PRODUCT_CATEGORY_SELECT_OPTIONS, draft.category, productCategoryLabel);
  const systemOptions = optionsWithCurrent(PRODUCT_SYSTEM_SELECT_OPTIONS, draft.system, productDisplaySystem);
  return (
    <>
    <tr className={dirty || structuredDirty ? 'is-dirty' : undefined}>
      <td className="brand-product-identity-col">
        <div className="brand-product-identity-cell">
          <div className="brand-product-identity-head">
            <strong className="mono-cell">{product.sku || '未配置 SKU'}</strong>
            <StatusPill tone={statusTone(status.className)}>{status.label}</StatusPill>
          </div>
          <EditableField
            canWrite={canWrite}
            value={draft.name}
            fallback="缺少名称"
            onChange={(name) => onChange({ ...draft, name })}
          />
          <div className="brand-product-meta-line">
            <EditableField
              canWrite={canWrite}
              value={draft.model}
              fallback="缺少型号"
              compact
              onChange={(model) => onChange({ ...draft, model })}
            />
            <EditableField
              canWrite={canWrite}
              value={draft.publicSlug}
              fallback="缺少 slug"
              compact
              onChange={(publicSlug) => onChange({ ...draft, publicSlug })}
            />
          </div>
          <input type="hidden" value={draft.publicSlug || product.publicSlug || ''} readOnly aria-hidden="true" />
        </div>
      </td>
      <td className="brand-product-taxonomy-col">
        <div className="brand-product-taxonomy-cell">
          <LabeledCompactField
            label="分类"
            canWrite={canWrite}
            value={draft.category}
            fallback="未设置"
            options={categoryOptions}
            onChange={(category) => onChange({ ...draft, category })}
          />
          <LabeledCompactField
            label="系统"
            canWrite={canWrite}
            value={draft.system}
            fallback="未设置"
            options={systemOptions}
            onChange={(system) => onChange({ ...draft, system })}
          />
          <LabeledCompactField
            label="菜单"
            canWrite={canWrite}
            value={draft.websiteMenuCategory}
            fallback="未设置"
            options={menuGroupOptions}
            onChange={(websiteMenuCategory) => onChange({ ...draft, websiteMenuCategory })}
          />
        </div>
      </td>
      <td className="brand-product-image-col">
        <ProductImageAssets
          product={product}
          canWrite={canWrite}
          busy={imageBusy}
          onUploadMainImage={onUploadMainImage}
          onDeleteMainImage={onDeleteMainImage}
          onUploadDetailImage={() => {}}
          onDeleteDetailImage={() => {}}
          onMoveDetailImage={onMoveDetailImage}
        />
      </td>
      <td className="brand-product-shelf-col">
        <div className="website-shelf-cell">
          <span data-testid={`website-shelf-status-${product.sku}`}>
            <StatusPill tone={statusTone(shelfMeta.className)}>{shelfMeta.label}</StatusPill>
          </span>
          {canWrite ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={canHideShelf ? onHideShelf : onPublishShelf}
              disabled={shelfBusy || shelfLoading}
              title={canHideShelf ? '从当前品牌官网隐藏' : '发布到当前品牌官网'}
              data-testid={`website-shelf-action-${product.sku}`}
            >
              {canHideShelf ? <EyeOff size={13} /> : <Rocket size={13} />}
              {canHideShelf ? '下架' : '上架'}
            </button>
          ) : (
            <span className="muted-value">只读</span>
          )}
          {shelfFeedback && (shelfBusy || shelfFeedback.tone === 'error') && <span className={`row-feedback ${shelfFeedback.tone}`}>{shelfFeedback.text}</span>}
        </div>
      </td>
      <td className="brand-product-order-col">
        <div className="readiness-cell" title={product.metadataReadiness.missing.join(', ')}>
          <label className="edit-field-caption">排序</label>
          <EditableField
            canWrite={canWrite}
            value={draft.sortOrder}
            fallback="0"
            type="number"
            compact
            onChange={(sortOrder) => onChange({ ...draft, sortOrder })}
          />
          <span className={product.metadataReadiness.ready ? 'badge badge-success' : 'badge badge-warning'}>
            {product.metadataReadiness.score}%
          </span>
          <span className="readiness-track">
            <span className="readiness-fill" style={{ width: `${product.metadataReadiness.score}%` }} />
          </span>
        </div>
      </td>
      <td className="brand-product-actions-col">
        {canWrite ? (
          <div className="row-edit-actions">
            <button type="button" className="btn btn-brand btn-sm" onClick={onSave} disabled={!dirty || saving}>
              <Save size={13} />
              {saving ? '保存中' : '保存'}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={onReset} disabled={!dirty || saving}>
              <X size={13} />
              重置
            </button>
            <div className="product-status-actions">
            <button
              type="button"
              className={`btn btn-outline btn-sm product-status-action${actionBusy ? ' is-transitioning' : ''}`}
              onClick={onToggleStatus}
              disabled={actionBusy}
              title={product.status === 'active' ? '下架产品' : '上架产品'}
            >
              {product.status === 'active' ? <ArrowDownCircle size={13} /> : <ArrowUpCircle size={13} />}
              {actionBusy ? '处理中' : product.status === 'active' ? '产品库下架' : '产品库上架'}
            </button>
              <button
                type="button"
                className="btn btn-outline btn-sm btn-danger"
                onClick={onArchive}
                disabled={actionBusy}
                title="归档产品"
              >
                <Archive size={13} />
                归档
              </button>
            </div>
            <button type="button" className="btn btn-outline btn-sm structured-toggle" onClick={onStructuredToggle}>
              <ChevronDown size={13} />
              官网内容
            </button>
            {dirty && <span className="dirty-chip">有修改</span>}
            {structuredDirty && <span className="dirty-chip">官网内容有修改</span>}
            {feedback && <span className={`row-feedback ${feedback.tone}`}>{feedback.text}</span>}
          </div>
        ) : (
          <span className="muted-value">只读</span>
        )}
      </td>
    </tr>
    {structuredExpanded && (
      <tr className="structured-editor-row">
        <td colSpan={PRODUCT_COLUMNS.length}>
          <StructuredContentEditor
            canWrite={canWrite}
            draft={structuredDraft}
            taxonomy={taxonomy}
            dirty={structuredDirty}
            saving={savingStructured}
            feedback={structuredFeedback}
            onChange={onStructuredChange}
            onSave={onStructuredSave}
            onReset={onStructuredReset}
          />
        </td>
      </tr>
    )}
    </>
  );
}

function StructuredContentEditor({
  canWrite,
  draft,
  taxonomy,
  dirty,
  saving,
  feedback,
  showActions = true,
  onChange,
  onSave,
  onReset,
}: {
  canWrite: boolean;
  draft: BrandStructuredContentDraft;
  taxonomy: Record<string, unknown>;
  dirty: boolean;
  saving: boolean;
  feedback?: { tone: 'success' | 'error'; text: string };
  showActions?: boolean;
  onChange: (patch: Partial<BrandStructuredContentDraft>) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const terms = taxonomyTermGroups(taxonomy);
  const update = (patch: Partial<BrandStructuredContentDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="structured-editor" data-testid="structured-content-editor">
      <div className="structured-editor-head">
        <div>
          <p className="t-label">结构化官网内容</p>
          <strong>官网文案、规格、富内容与分类词表</strong>
        </div>
        {canWrite && showActions ? (
          <div className="structured-actions">
            {feedback && <span className={`row-feedback ${feedback.tone}`}>{feedback.text}</span>}
            <button type="button" className="btn btn-outline btn-sm" onClick={onReset} disabled={!dirty || saving}>
              <X size={13} />
              重置内容
            </button>
            <button type="button" className="btn btn-brand btn-sm" onClick={onSave} disabled={!dirty || saving}>
              <Save size={13} />
              {saving ? '保存中' : '保存内容'}
            </button>
          </div>
        ) : (
          <span className="muted-value">只读内容视图</span>
        )}
      </div>

      <div className="structured-grid">
        <section className="structured-section">
          <h3>官网文案</h3>
          <div className="structured-field-grid">
            <StructuredTextField label="标语" value={draft.tagline} canWrite={canWrite} onChange={(tagline) => update({ tagline })} />
            <StructuredTextField label="系列" value={draft.series} canWrite={canWrite} onChange={(series) => update({ series })} />
            <StructuredTextField
              label="英文名"
              value={draft.officialEnglishName}
              canWrite={canWrite}
              onChange={(officialEnglishName) => update({ officialEnglishName })}
            />
            <StructuredTextField label="官网标题" value={draft.websiteTitle} canWrite={canWrite} onChange={(websiteTitle) => update({ websiteTitle })} />
            <StructuredTextField
              label="描述"
              value={draft.websiteDescription}
              canWrite={canWrite}
              multiline
              onChange={(websiteDescription) => update({ websiteDescription })}
            />
            <StructuredTextField label="官方文案" value={draft.officialCopy} canWrite={canWrite} multiline onChange={(officialCopy) => update({ officialCopy })} />
            <StructuredTextField label="图标" value={draft.icon} canWrite={canWrite} onChange={(icon) => update({ icon })} />
            <StructuredTextField label="规格图地址" value={draft.specImage} canWrite={canWrite} onChange={(specImage) => update({ specImage })} />
          </div>
        </section>

        <KeyValueEditor
          title="规格"
          canWrite={canWrite}
          rows={draft.specs}
          keyLabel="参数"
          valueLabel="值"
          onChange={(specs) => update({ specs })}
        />
        <StringListEditor title="标签" canWrite={canWrite} values={draft.badges} onChange={(badges) => update({ badges })} />
        <FeatureEditor title="功能卖点" canWrite={canWrite} rows={draft.features} onChange={(features) => update({ features })} />
        <KeyValueEditor
          title="亮点指标"
          canWrite={canWrite}
          rows={draft.highlights}
          keyLabel="名称"
          valueLabel="值"
          onChange={(highlights) => update({ highlights })}
        />
        <StringListEditor title="认证" canWrite={canWrite} values={draft.certs} onChange={(certs) => update({ certs })} />
        <FaqEditor title="常见问题" canWrite={canWrite} rows={draft.faqs} onChange={(faqs) => update({ faqs })} />
        <GalleryEditor title="图库" canWrite={canWrite} rows={draft.gallery} onChange={(gallery) => update({ gallery })} />

        <section className="structured-section structured-section-wide">
          <h3>定位词表</h3>
          <div className="taxonomy-grid">
            {Object.entries(terms).map(([key, options]) => (
              <TaxonomyPicker
                key={key}
                label={taxonomyLabel(key)}
                canWrite={canWrite}
                options={options}
                selected={draft.positioning[key] || []}
                onChange={(values) =>
                  update({ positioning: { ...draft.positioning, [key]: values } })
                }
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StructuredTextField({
  label,
  value,
  canWrite,
  multiline,
  onChange,
}: {
  label: string;
  value: string;
  canWrite: boolean;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  if (!canWrite) {
    return (
      <label className="structured-field">
        <span>{label}</span>
        <strong>{value || '未设置'}</strong>
      </label>
    );
  }
  return (
    <label className="structured-field">
      <span>{label}</span>
      {multiline ? (
        <textarea className="input" value={value} rows={3} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function KeyValueEditor({
  title,
  canWrite,
  rows,
  keyLabel,
  valueLabel,
  onChange,
}: {
  title: string;
  canWrite: boolean;
  rows: { key: string; value: string }[];
  keyLabel: string;
  valueLabel: string;
  onChange: (rows: { key: string; value: string }[]) => void;
}) {
  return (
    <section className="structured-section">
      <StructuredSectionTitle title={title} canWrite={canWrite} onAdd={() => onChange([...rows, { key: '', value: '' }])} />
      <div className="structured-list">
        {(rows.length ? rows : [{ key: '', value: '' }]).map((row, index) => (
          <div className="structured-pair" key={`${title}-${index}`}>
            <StructuredInlineInput canWrite={canWrite} value={row.key} placeholder={keyLabel} onChange={(key) => onChange(replaceAt(rows, index, { ...row, key }))} />
            <StructuredInlineInput canWrite={canWrite} value={row.value} placeholder={valueLabel} onChange={(value) => onChange(replaceAt(rows, index, { ...row, value }))} />
            {canWrite && (
              <button type="button" className="btn btn-outline btn-sm icon-only" onClick={() => onChange(removeAt(rows, index))}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function StringListEditor({
  title,
  canWrite,
  values,
  onChange,
}: {
  title: string;
  canWrite: boolean;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <section className="structured-section">
      <StructuredSectionTitle title={title} canWrite={canWrite} onAdd={() => onChange([...values, ''])} />
      <div className="structured-list">
        {(values.length ? values : ['']).map((value, index) => (
          <div className="structured-single" key={`${title}-${index}`}>
            <StructuredInlineInput canWrite={canWrite} value={value} placeholder={title} onChange={(next) => onChange(replaceAt(values, index, next))} />
            {canWrite && (
              <button type="button" className="btn btn-outline btn-sm icon-only" onClick={() => onChange(removeAt(values, index))}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureEditor({
  title,
  canWrite,
  rows,
  onChange,
}: {
  title: string;
  canWrite: boolean;
  rows: { title: string; description: string }[];
  onChange: (rows: { title: string; description: string }[]) => void;
}) {
  return (
    <section className="structured-section">
      <StructuredSectionTitle title={title} canWrite={canWrite} onAdd={() => onChange([...rows, { title: '', description: '' }])} />
      <div className="structured-list">
        {(rows.length ? rows : [{ title: '', description: '' }]).map((row, index) => (
          <div className="structured-pair" key={`${title}-${index}`}>
            <StructuredInlineInput canWrite={canWrite} value={row.title} placeholder="标题" onChange={(nextTitle) => onChange(replaceAt(rows, index, { ...row, title: nextTitle }))} />
            <StructuredInlineInput canWrite={canWrite} value={row.description} placeholder="描述" onChange={(description) => onChange(replaceAt(rows, index, { ...row, description }))} />
            {canWrite && (
              <button type="button" className="btn btn-outline btn-sm icon-only" onClick={() => onChange(removeAt(rows, index))}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function FaqEditor({
  title,
  canWrite,
  rows,
  onChange,
}: {
  title: string;
  canWrite: boolean;
  rows: { question: string; answer: string }[];
  onChange: (rows: { question: string; answer: string }[]) => void;
}) {
  return (
    <section className="structured-section">
      <StructuredSectionTitle title={title} canWrite={canWrite} onAdd={() => onChange([...rows, { question: '', answer: '' }])} />
      <div className="structured-list">
        {(rows.length ? rows : [{ question: '', answer: '' }]).map((row, index) => (
          <div className="structured-pair" key={`${title}-${index}`}>
            <StructuredInlineInput canWrite={canWrite} value={row.question} placeholder="问题" onChange={(question) => onChange(replaceAt(rows, index, { ...row, question }))} />
            <StructuredInlineInput canWrite={canWrite} value={row.answer} placeholder="答案" onChange={(answer) => onChange(replaceAt(rows, index, { ...row, answer }))} />
            {canWrite && (
              <button type="button" className="btn btn-outline btn-sm icon-only" onClick={() => onChange(removeAt(rows, index))}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function GalleryEditor({
  title,
  canWrite,
  rows,
  onChange,
}: {
  title: string;
  canWrite: boolean;
  rows: { url: string; alt: string }[];
  onChange: (rows: { url: string; alt: string }[]) => void;
}) {
  return (
    <section className="structured-section">
      <StructuredSectionTitle title={title} canWrite={canWrite} onAdd={() => onChange([...rows, { url: '', alt: '' }])} />
      <div className="structured-list">
        {(rows.length ? rows : [{ url: '', alt: '' }]).map((row, index) => (
          <div className="structured-pair" key={`${title}-${index}`}>
            <StructuredInlineInput canWrite={canWrite} value={row.url} placeholder="URL" onChange={(url) => onChange(replaceAt(rows, index, { ...row, url }))} />
            <StructuredInlineInput canWrite={canWrite} value={row.alt} placeholder="图片说明" onChange={(alt) => onChange(replaceAt(rows, index, { ...row, alt }))} />
            {canWrite && (
              <button type="button" className="btn btn-outline btn-sm icon-only" onClick={() => onChange(removeAt(rows, index))}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function StructuredSectionTitle({ title, canWrite, onAdd }: { title: string; canWrite: boolean; onAdd: () => void }) {
  return (
    <div className="structured-section-title">
      <h3>{title}</h3>
      {canWrite && (
        <button type="button" className="btn btn-outline btn-sm" onClick={onAdd}>
          <Plus size={13} />
          添加
        </button>
      )}
    </div>
  );
}

function StructuredInlineInput({
  canWrite,
  value,
  placeholder,
  onChange,
}: {
  canWrite: boolean;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  if (!canWrite) return <span className={value ? undefined : 'muted-value'}>{value || placeholder}</span>;
  return <input className="input structured-inline-input" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

function TaxonomyPicker({
  label,
  canWrite,
  options,
  selected,
  onChange,
}: {
  label: string;
  canWrite: boolean;
  options: TaxonomyOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const visibleOptions = options.length ? options : selected.map((code) => ({ code, label: taxonomyDisplayLabel(code) }));
  return (
    <div className="taxonomy-picker">
      <strong>{label}</strong>
      <div className="taxonomy-options">
        {visibleOptions.length ? (
          visibleOptions.map((option) => {
            const checked = selected.includes(option.code);
            return (
              <label className={`${checked ? 'taxonomy-chip selected' : 'taxonomy-chip'}${canWrite ? '' : ' is-disabled'}`} key={option.code}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!canWrite}
                  onChange={(event) => {
                    if (event.target.checked) onChange([...selected, option.code]);
                    else onChange(selected.filter((item) => item !== option.code));
                  }}
                />
                <span className="taxonomy-check" aria-hidden="true">
                  <Check size={11} />
                </span>
                <span>{option.label}</span>
              </label>
            );
          })
        ) : (
          <span className="muted-value">暂无词表项</span>
        )}
      </div>
    </div>
  );
}

function taxonomyTermGroups(taxonomy: Record<string, unknown>): Record<string, TaxonomyOption[]> {
  const keys = ['targetSegments', 'channels', 'userPersonas', 'markets', 'applicationScenarios'];
  return keys.reduce<Record<string, TaxonomyOption[]>>((groups, key) => {
    groups[key] = taxonomyOptions(taxonomy[key]);
    return groups;
  }, {});
}

function taxonomyOptions(value: unknown): TaxonomyOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') {
        const code = item.trim();
        return code ? { code, label: taxonomyDisplayLabel(code) } : null;
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const code = String(record.code || record.value || record.key || record.name || record.label || '').trim();
        const label = String(record.label || record.name || '').trim() || taxonomyDisplayLabel(code);
        return code ? { code, label } : null;
      }
      return null;
    })
    .filter((option): option is TaxonomyOption => Boolean(option));
}

function taxonomyDisplayLabel(code: string) {
  return TAXONOMY_LABELS[code] || code;
}

function taxonomyLabel(key: string) {
  const labels: Record<string, string> = {
    targetSegments: '目标客群',
    channels: '渠道',
    userPersonas: '用户画像',
    markets: '市场',
    applicationScenarios: '应用场景',
  };
  return labels[key] || key;
}

function replaceAt<T>(rows: T[], index: number, value: T): T[] {
  const next = rows.length ? [...rows] : [];
  next[index] = value;
  return next;
}

function removeAt<T>(rows: T[], index: number): T[] {
  return rows.filter((_, rowIndex) => rowIndex !== index);
}

function ProductImagePreview({ product }: { product: BrandProductRow }) {
  const imageUrl = product.imageState.mainImageUrl;
  const [failed, setFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);
  if (!imageUrl || failed) {
    return (
      <div className="product-image-preview is-empty" title={imageUrl ? '图片加载失败' : '暂无设备图片'}>
        <Image size={18} />
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        className="image-preview-button"
        onClick={() => setPreviewOpen(true)}
        title="点击查看大图"
      >
        <img
          className="product-image-preview"
          src={imageUrl}
          alt={product.name || product.model || '设备图片'}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </button>
      {previewOpen && (
        <ImageLightbox
          src={imageUrl}
          alt={product.name || product.model || '产品图片'}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="image-lightbox" role="presentation" onMouseDown={onClose}>
      <div className="image-lightbox-panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="btn btn-outline btn-sm icon-only image-lightbox-close" onClick={onClose} aria-label="关闭图片预览">
          <X size={15} />
        </button>
        <div className="image-lightbox-media">
          {!loaded && !failed && (
            <div className="image-lightbox-state" role="status">
              <span className="image-lightbox-spinner" aria-hidden="true" />
              <span>图片加载中...</span>
            </div>
          )}
          {failed ? (
            <div className="image-lightbox-state" role="alert">
              <Image size={26} />
              <span>图片加载失败，请检查图片是否已上传成功。</span>
            </div>
          ) : (
            <img
              className={`image-lightbox-image${loaded ? '' : ' is-loading'}`}
              src={src}
              alt={alt}
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
function detailImageUrl(ref: { artifactId?: string; url?: string }) {
  const url = String(ref.url || '').trim();
  const artifactId = String(ref.artifactId || '').trim();
  return url || (artifactId ? `/api/v2/file-artifact/${encodeURIComponent(artifactId)}/content` : '');
}

function ProductImageAssets({
  product,
  canWrite,
  busy,
  feedback,
  onUploadMainImage,
  onDeleteMainImage,
}: {
  product: BrandProductRow;
  canWrite: boolean;
  busy: boolean;
  feedback?: ImageActionFeedback;
  onUploadMainImage: (file: File | null) => void;
  onDeleteMainImage: () => void;
  onUploadDetailImage: (file: File | null) => void;
  onDeleteDetailImage: (artifactId: string) => void;
  onMoveDetailImage: (artifactId: string, direction: -1 | 1) => void;
}) {
  const inputId = `main-image-${product.id || product.sku}`;
  return (
    <div className="image-asset-cell" data-testid={`image-assets-${product.sku}`}>
      <div className="image-main-preview">
        <ProductImagePreview product={product} />
      </div>
      <div className="image-asset-status">
        <span className={product.imageState.hasMainImage ? 'pill-brand' : 'pill-neutral'}>
          {product.imageState.hasMainImage ? '主图已就绪' : '缺少主图'}
        </span>
        <span className="image-format-hint">只能上传 JPG / PNG 图片</span>
      </div>
      {canWrite && (
        <div className="image-asset-actions">
          <input
            id={inputId}
            data-testid={`main-image-input-${product.sku}`}
            className="sr-only-file"
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            disabled={busy}
            onChange={(event) => {
              onUploadMainImage(event.target.files?.[0] || null);
              event.currentTarget.value = '';
            }}
          />
          <label className={`btn btn-outline btn-sm image-upload-label${busy ? ' is-disabled' : ''}`} htmlFor={inputId} title="上传或替换主图">
            <Upload size={13} />
            {busy ? '处理中' : product.imageState.hasMainImage ? '替换' : '上传'}
          </label>
          <button
            type="button"
            className="btn btn-outline btn-sm btn-danger"
            disabled={busy || !product.imageState.mainArtifactId}
            onClick={onDeleteMainImage}
            title="删除主图"
            data-testid={`delete-main-image-${product.sku}`}
          >
            <Trash2 size={13} />
            {busy ? '处理中' : '删除'}
          </button>
        </div>
      )}
      {feedback && (
        <div className={`image-action-feedback ${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}

function productStatusMeta(status: string) {
  if (status === 'active') return { label: '产品库在架', className: 'badge-success' };
  if (status === 'archived') return { label: '产品库已归档', className: 'badge-grey' };
  return { label: '产品库下架', className: 'badge-warning' };
}

function websiteShelfMeta(assignment?: WebsiteShelfAssignment, transition?: WebsiteShelfTransition) {
  if (transition === 'publishing') return { label: '官网上架中', className: 'badge-info' };
  if (transition === 'hiding') return { label: '官网下架中', className: 'badge-warning' };
  if (!assignment) return { label: '官网未上架', className: 'badge-grey' };
  if (assignment.deletedAt || assignment.status === 'hidden') return { label: '官网已下架', className: 'badge-warning' };
  if (assignment.status === 'published') return { label: '官网已上架', className: 'badge-success' };
  return { label: '官网未上架', className: 'badge-grey' };
}

function isWebsiteShelfPublished(assignment?: WebsiteShelfAssignment, transition?: WebsiteShelfTransition) {
  if (transition === 'publishing') return true;
  if (transition === 'hiding') return false;
  return assignment?.status === 'published' && !assignment.deletedAt;
}

function productMatchesShelfFilter(assignment: WebsiteShelfAssignment | undefined, filter: WebsiteShelfFilter) {
  if (filter === 'all') return true;
  const published = isWebsiteShelfPublished(assignment);
  return filter === 'published' ? published : !published;
}

function statusTone(className: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (className.includes('badge-success')) return 'success';
  if (className.includes('badge-warning')) return 'warning';
  if (className.includes('badge-danger')) return 'danger';
  if (className.includes('badge-info')) return 'info';
  return 'neutral';
}

function shelfAssignmentPriority(assignment: WebsiteShelfAssignment) {
  if (assignment.deletedAt) return 1;
  if (assignment.status === 'published') return 4;
  if (assignment.status === 'hidden') return 3;
  return 2;
}

function shelfSortRank(assignment?: WebsiteShelfAssignment) {
  if (!assignment || assignment.deletedAt) return 0;
  if (assignment.status === 'published') return 3;
  if (assignment.status === 'hidden') return 2;
  return 1;
}

function LabeledCompactField({
  label,
  canWrite,
  value,
  fallback,
  options,
  onChange,
}: {
  label: string;
  canWrite: boolean;
  value: string;
  fallback: string;
  options?: BrandMenuGroupOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="brand-product-labeled-field">
      <span className="edit-field-caption">{label}</span>
      <EditableField
        canWrite={canWrite}
        value={value}
        fallback={fallback}
        options={options}
        compact
        onChange={onChange}
      />
    </div>
  );
}

function EditableField({
  canWrite,
  value,
  fallback,
  compact,
  options,
  type = 'text',
  onChange,
}: {
  canWrite: boolean;
  value: string;
  fallback: string;
  compact?: boolean;
  options?: BrandMenuGroupOption[];
  type?: string;
  onChange: (value: string) => void;
}) {
  if (!canWrite) return value ? <span>{value}</span> : <span className="muted-value">{fallback}</span>;
  if (options?.length) {
    return (
      <select
        className={`input inline-edit-input${compact ? ' compact' : ''}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{fallback}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className={`input inline-edit-input${compact ? ' compact' : ''}`}
      type={type}
      value={value}
      placeholder={fallback}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function FormField({
  label,
  value,
  options,
  type = 'text',
  onChange,
}: {
  label: string;
  value: string;
  options?: BrandMenuGroupOption[];
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="product-create-field">
      <span>{label}</span>
      {options?.length ? (
        <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">未设置</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function decodeMaybe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function readBrowserFileBase64(file: File): Promise<string> {
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

async function uploadProductManualPdfRefs(manualPdfs: ProductManualPdfDraft[], sku: string) {
  const clean = (value: unknown) => String(value || '').trim();
  return Promise.all(
    manualPdfs.map(async (manual, index) => {
      if (!manual.file) throw new Error('PDF file is missing.');
      const artifact = await fileArtifacts.uploadBase64({
        entityType: 'product-manual-pdf',
        entityId: sku,
        filename: manual.name || manual.file.name || `${sku}-manual-${index + 1}.pdf`,
        mimeType: manual.file.type || 'application/pdf',
        dataBase64: await readBrowserFileBase64(manual.file),
      });
      const artifactId = clean((artifact as any)?.id || (artifact as any)?.artifactId);
      if (!artifactId) throw new Error('PDF upload did not return an artifact id.');
      return {
        role: 'doc',
        artifactId,
        objectKey: clean((artifact as any)?.fileKey || (artifact as any)?.objectKey),
        filename: clean((artifact as any)?.originalName) || manual.name || manual.file.name,
        mimeType: clean((artifact as any)?.mimeType) || manual.file.type || 'application/pdf',
        sortOrder: index,
        url: clean((artifact as any)?.contentUrl) || `/api/v2/file-artifact/${encodeURIComponent(artifactId)}/content`,
      };
    }),
  );
}

function SummaryItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="summary-item">
      <label>{label}</label>
      <div>{children}</div>
    </div>
  );
}

function ConsoleModule({
  icon,
  title,
  value,
}: {
  icon: ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="console-module">
      {icon}
      <strong>{title}</strong>
      <span>{value}</span>
    </div>
  );
}
