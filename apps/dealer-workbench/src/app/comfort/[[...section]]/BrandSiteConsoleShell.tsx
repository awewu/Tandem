'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import {
  Archive,
  ArrowDownCircle,
  ArrowUpCircle,
  Bold,
  Calendar,
  ChevronDown,
  Check,
  Download,
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
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { PageHeader } from '@rhautt/ui';
import { auth, brandProductCategories, brandSites, fileArtifacts, products, siteBasicSettings, siteInquiries, siteMaterials, siteNews, siteProductAssignments } from '../../../lib/api';
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
  saveBrandProductRow,
  saveBrandStructuredContent,
  structuredDraftFromProductRow,
  toBrandProductRow,
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

const SITE_MATERIALS_API = process.env.NEXT_PUBLIC_API_URL || '';

type SiteStatus = 'active' | 'inactive';
type DeliveryType = 'self_hosted' | 'external';
type ContentTab = 'basic' | 'products' | 'materials' | 'news' | 'inquiries';
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
type ProductPendingImageDraft = {
  file: File;
  previewUrl: string;
};
type FloatingDialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};
type FloatingPromptOptions = FloatingDialogOptions & {
  defaultValue?: string;
  placeholder?: string;
};
type FloatingDialogState =
  | (FloatingDialogOptions & { kind: 'confirm'; resolve: (value: boolean) => void })
  | (FloatingPromptOptions & { kind: 'prompt'; resolve: (value: string | null) => void });
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

function useFloatingDialog() {
  const [dialog, setDialog] = useState<FloatingDialogState | null>(null);

  const confirmFloating = useCallback((options: FloatingDialogOptions) => new Promise<boolean>((resolve) => {
    setDialog({
      kind: 'confirm',
      title: options.title || '操作确认',
      message: options.message,
      confirmLabel: options.confirmLabel || '确定',
      cancelLabel: options.cancelLabel || '取消',
      tone: options.tone || 'default',
      resolve,
    });
  }), []);

  const promptFloating = useCallback((options: FloatingPromptOptions) => new Promise<string | null>((resolve) => {
    setDialog({
      kind: 'prompt',
      title: options.title || '请输入内容',
      message: options.message,
      defaultValue: options.defaultValue || '',
      placeholder: options.placeholder || '',
      confirmLabel: options.confirmLabel || '确定',
      cancelLabel: options.cancelLabel || '取消',
      tone: options.tone || 'default',
      resolve,
    });
  }), []);

  const closeDialog = useCallback((value: boolean | string | null) => {
    setDialog((current) => {
      if (!current) return current;
      current.resolve(value as never);
      return null;
    });
  }, []);

  const floatingDialog = dialog ? (
    <FloatingDialog dialog={dialog} onClose={closeDialog} />
  ) : null;

  return { confirmFloating, promptFloating, floatingDialog };
}

function FloatingDialog({
  dialog,
  onClose,
}: {
  dialog: FloatingDialogState;
  onClose: (value: boolean | string | null) => void;
}) {
  const [inputValue, setInputValue] = useState(dialog.kind === 'prompt' ? dialog.defaultValue || '' : '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (dialog.kind !== 'prompt') return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dialog.kind]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    onClose(dialog.kind === 'prompt' ? inputValue : true);
  }

  const content = (
    <div className="floating-dialog-backdrop" role="presentation" onMouseDown={() => onClose(dialog.kind === 'prompt' ? null : false)}>
      <form
        className={`floating-dialog-card${dialog.tone === 'danger' ? ' is-danger' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="floating-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <header className="floating-dialog-head">
          <div>
            <p className="t-label">系统提示</p>
            <h2 id="floating-dialog-title">{dialog.title}</h2>
          </div>
          <button type="button" className="btn btn-outline btn-sm icon-only" onClick={() => onClose(dialog.kind === 'prompt' ? null : false)} aria-label="关闭弹框">
            <X size={15} />
          </button>
        </header>
        <div className="floating-dialog-body">
          <p>{dialog.message}</p>
          {dialog.kind === 'prompt' ? (
            <input
              ref={inputRef}
              className="input floating-dialog-input"
              value={inputValue}
              placeholder={dialog.placeholder}
              onChange={(event) => setInputValue(event.target.value)}
            />
          ) : null}
        </div>
        <footer className="floating-dialog-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onClose(dialog.kind === 'prompt' ? null : false)}>
            {dialog.cancelLabel || '取消'}
          </button>
          <button type="submit" className={`btn btn-sm ${dialog.tone === 'danger' ? 'btn-danger' : 'btn-brand'}`}>
            {dialog.confirmLabel || '确定'}
          </button>
        </footer>
      </form>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
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
  const [activeContentTab, setActiveContentTab] = useState<ContentTab>('basic');
  const [createDraft, setCreateDraft] = useState<BrandProductEditDraft>(() => blankNewProductDraft(normalizedBrandCode));
  const [createStructuredDraft, setCreateStructuredDraft] = useState<BrandStructuredContentDraft>(() => blankCreateStructuredDraft(normalizedBrandCode));
  const [createManualPdfs, setCreateManualPdfs] = useState<ProductManualPdfDraft[]>([]);
  const [createMainImage, setCreateMainImage] = useState<ProductPendingImageDraft | null>(null);
  const [createOfficialDetailHtml, setCreateOfficialDetailHtml] = useState('');
  const [createImageFeedback, setCreateImageFeedback] = useState<ImageActionFeedback | undefined>();
  const [postCreateProduct, setPostCreateProduct] = useState<BrandProductRow | null>(null);
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
  const [showBackTop, setShowBackTop] = useState(false);
  const { confirmFloating, floatingDialog } = useFloatingDialog();
  const loadRequestRef = useRef(0);
  const imageFeedbackTimersRef = useRef<Record<string, number>>({});
  const backTopButtonRef = useRef<HTMLButtonElement | null>(null);

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
    function scrollTopValue(source?: EventTarget | null) {
      const targets = [
        document.querySelector('.app-main'),
        document.querySelector('.content'),
        document.querySelector('main'),
        document.scrollingElement,
        document.documentElement,
        document.body,
      ].filter(Boolean) as HTMLElement[];
      const sourceTop = source instanceof HTMLElement ? source.scrollTop || 0 : 0;
      return Math.max(window.scrollY || 0, sourceTop, ...targets.map((target) => target.scrollTop || 0));
    }

    function updateBackTopVisibility(event?: Event) {
      const isVisible = scrollTopValue(event?.target) > 360;
      const button = backTopButtonRef.current;
      if (!button) return;
      button.classList.toggle('is-visible', isVisible);
      button.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
      button.tabIndex = isVisible ? 0 : -1;
    }

    const scrollTargets = [
      document.querySelector('.app-main'),
      document.querySelector('.content'),
      document.querySelector('main'),
      window,
    ].filter(Boolean) as (HTMLElement | Window)[];

    updateBackTopVisibility();
    scrollTargets.forEach((target) => target.addEventListener('scroll', updateBackTopVisibility, { passive: true }));
    document.addEventListener('scroll', updateBackTopVisibility, { passive: true, capture: true });
    window.addEventListener('resize', updateBackTopVisibility);
    const visibilityTimer = window.setInterval(updateBackTopVisibility, 160);
    return () => {
      scrollTargets.forEach((target) => target.removeEventListener('scroll', updateBackTopVisibility));
      document.removeEventListener('scroll', updateBackTopVisibility, true);
      window.removeEventListener('resize', updateBackTopVisibility);
      window.clearInterval(visibilityTimer);
    };
  }, []);

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
    if (createMainImage) URL.revokeObjectURL(createMainImage.previewUrl);
    setCreateMainImage(null);
    setCreateOfficialDetailHtml('');
    setCreateImageFeedback(undefined);
    setPostCreateProduct(null);
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

  const publishCapability = site.publishCapability || UNSUPPORTED_PUBLISH;
  const canCreateProduct = productPermissions.canCreateProduct;
  const canUpdateProduct = productPermissions.canUpdateProduct;
  const canDeleteProduct = productPermissions.canDeleteProduct;
  const canPublishProduct = productPermissions.canPublishProduct;
  const canUpdateBrandLibrary = productPermissions.canUpdateBrandLibrary;
  const canPublishBrandLibrary = productPermissions.canPublishBrandLibrary;
  const canPublishWebsiteShelf = productPermissions.canCreateBrandLibrary && productPermissions.canPublishBrandLibrary;
  const canWrite = canUpdateProduct;
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
    return visibleProducts.find((product) => product.id === editingProductId) || (postCreateProduct?.id === editingProductId ? postCreateProduct : null);
  }, [editingProductId, postCreateProduct, visibleProducts]);
  const createProductPreview = useMemo(
    () => {
      const preview = productRowFromCreateDraft(createDraft, normalizedBrandCode);
      if (!createMainImage) return preview;
      return {
        ...preview,
        imageState: {
          ...preview.imageState,
          hasMainImage: true,
          mainImageUrl: createMainImage.previewUrl,
          mainArtifactId: '__pending_main_image__',
          label: createMainImage.file.name || '待上传主图',
        },
      };
    },
    [createDraft, createMainImage, normalizedBrandCode]
  );

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
    setPostCreateProduct(null);
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
    setPostCreateProduct(null);
  }

  function beginProductCreate() {
    setEditingProductId('');
    setPostCreateProduct(null);
    const nextDraft = blankNewProductDraft(normalizedBrandCode);
    createManualPdfs.forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
    if (createMainImage) URL.revokeObjectURL(createMainImage.previewUrl);
    setCreateDraft(nextDraft);
    setCreateStructuredDraft(blankCreateStructuredDraft(normalizedBrandCode));
    setCreateManualPdfs([]);
    setCreateMainImage(null);
    setCreateOfficialDetailHtml('');
    setCreateImageFeedback(undefined);
    setCreateError('');
    setActiveContentTab('products');
    setShowCreate(true);
  }

  function closeProductCreate() {
    setShowCreate(false);
    setCreateError('');
    createManualPdfs.forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
    if (createMainImage) URL.revokeObjectURL(createMainImage.previewUrl);
    setCreateDraft(blankNewProductDraft(normalizedBrandCode));
    setCreateStructuredDraft(blankCreateStructuredDraft(normalizedBrandCode));
    setCreateManualPdfs([]);
    setCreateMainImage(null);
    setCreateOfficialDetailHtml('');
    setCreateImageFeedback(undefined);
  }

  function selectCreateMainImage(file: File | null) {
    if (!file) return;
    if (!isAllowedJpgOrPng(file)) {
      const text = imageTypeErrorText();
      setCreateImageFeedback({ tone: 'error', text });
      setCreateError(text);
      return;
    }
    if (createMainImage) URL.revokeObjectURL(createMainImage.previewUrl);
    setCreateMainImage({ file, previewUrl: URL.createObjectURL(file) });
    setCreateImageFeedback({ tone: 'success', text: '主图已选择，创建产品时会自动上传。' });
  }

  function clearCreateMainImage() {
    if (createMainImage) URL.revokeObjectURL(createMainImage.previewUrl);
    setCreateMainImage(null);
    setCreateImageFeedback(undefined);
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

  async function createProduct(overrides?: { officialDetailHtml?: string }) {
    if (!canCreateProduct || !data?.site) return;
    setCreating(true);
    setCreateError('');
    try {
      const officialDetailHtml = overrides?.officialDetailHtml ?? createOfficialDetailHtml;
      const manualPdfRefs = await uploadProductManualPdfRefs(
        createManualPdfs,
        createDraft.model || createDraft.publicSlug || createDraft.name || normalizedBrandCode,
      );
      const created = await createBrandProduct(normalizedBrandCode, createDraft, createStructuredDraft, manualPdfRefs);
      const createdData = ((created as any)?.data ?? created) as Record<string, unknown>;
      const createdRow = toBrandProductRow(createdData, normalizedBrandCode);
      if (!createdRow.id) throw new Error('产品创建成功但未返回产品 ID，无法继续添加资源。');
      if (createMainImage?.file) {
        await uploadBrandProductMainImage(normalizedBrandCode, createdRow, createMainImage.file);
      }
      if (officialDetailHtml.trim()) {
        await products.upsertContent(createdRow.id, {
          tenantId: rowTenantId(createdRow),
          locale: 'zh-CN',
          status: 'published',
          officialDetailHtml,
        });
      }
      const refreshed = await products.get(createdRow.id, { tenantId: rowTenantId(createdRow) }).catch(() => ({ data: createdData }));
      const refreshedRow = toBrandProductRow(((refreshed as any)?.data ?? refreshed) as Record<string, unknown>, normalizedBrandCode);
      setPostCreateProduct(refreshedRow);
      setDrafts((current) => ({ ...current, [refreshedRow.id]: draftFromProductRow(refreshedRow) }));
      setStructuredDrafts((current) => ({ ...current, [refreshedRow.id]: structuredDraftFromProductRow(refreshedRow, normalizedBrandCode) }));
      setOfficialDetailDrafts((current) => ({ ...current, [refreshedRow.id]: officialDetailHtml }));
      setOfficialDetailInitials((current) => ({ ...current, [refreshedRow.id]: officialDetailHtml }));
      setManualPdfDrafts((current) => ({ ...current, [refreshedRow.id]: savedProductManualPdfs(refreshedRow) }));
      setShowCreate(false);
      createManualPdfs.forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
      if (createMainImage) URL.revokeObjectURL(createMainImage.previewUrl);
      setCreateDraft(blankNewProductDraft(normalizedBrandCode));
      setCreateStructuredDraft(blankCreateStructuredDraft(normalizedBrandCode));
      setCreateManualPdfs([]);
      setCreateMainImage(null);
      setCreateOfficialDetailHtml('');
      setCreateImageFeedback(undefined);
      setEditingProductId(refreshedRow.id);
      await load();
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
    const confirmed = await confirmFloating({
      title: '归档产品',
      message: `确认归档 ${row.name || row.sku}？归档后官网不再展示该产品，后台记录会保留。`,
      confirmLabel: '归档',
      tone: 'danger',
    });
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

  function scrollBrandConsoleToTop() {
    const targets = [
      document.querySelector('.app-main'),
      document.querySelector('.content'),
      document.querySelector('main'),
      document.scrollingElement,
      document.documentElement,
      document.body,
    ].filter(Boolean) as HTMLElement[];
    targets.forEach((target) => {
      if (typeof target.scrollTo === 'function') target.scrollTo({ top: 0, behavior: 'smooth' });
      else target.scrollTop = 0;
    });
  }

  return (
    <div className="brand-console-shell">
      <div className="page-container brand-console-page">
        <PageHeader
          title={`${site.nameCn || site.nameEn} 官网内容控制台`}
          subtitle="集中维护官网内容、产品货架与发布状态"
          actions={
            <>
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

        <section className="card-elevated brand-product-panel" aria-label="官网内容管理">
          <div className="brand-product-head">
            <div>
              <p className="t-label">官网内容</p>
              <div className="brand-product-title-row">
                <h2>{site.nameCn || site.nameEn || site.code} 官网内容</h2>
                <div className="brand-content-switch" aria-label="官网内容类型切换">
                  <button
                    type="button"
                    className={activeContentTab === 'basic' ? 'is-active' : undefined}
                    aria-pressed={activeContentTab === 'basic'}
                    onClick={() => setActiveContentTab('basic')}
                  >
                    基本信息
                  </button>
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
                    首页模块
                  </button>
                  <button
                    type="button"
                    className={activeContentTab === 'news' ? 'is-active' : undefined}
                    aria-pressed={activeContentTab === 'news'}
                    onClick={() => setActiveContentTab('news')}
                  >
                    资讯
                  </button>
                  <button
                    type="button"
                    className={activeContentTab === 'inquiries' ? 'is-active' : undefined}
                    aria-pressed={activeContentTab === 'inquiries'}
                    onClick={() => setActiveContentTab('inquiries')}
                  >
                    咨询
                  </button>
                </div>
              </div>
            </div>
            <div className="brand-product-head-actions" />
          </div>
          {activeContentTab === 'basic' ? (
            <SiteBasicInfoPanel siteCode={site.code || normalizedBrandCode} canWrite={canUpdateBrandLibrary} />
          ) : activeContentTab === 'products' ? (
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
            <div className="brand-product-toolbar-actions">
              {canCreateProduct && data?.site && (
                <button type="button" className="btn btn-outline btn-sm" onClick={beginProductCreate}>
                  <PackagePlus size={13} />
                  新增产品
                </button>
              )}
              <button type="button" className="btn btn-outline btn-sm" onClick={load} disabled={isLoading}>
                <RefreshCw size={13} />
                刷新
              </button>
            </div>
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
              officialDetailHtml={createOfficialDetailHtml}
              officialDetailDirty={Boolean(createOfficialDetailHtml.trim())}
              manualPdfs={createManualPdfs}
              manualPdfsDirty={createManualPdfs.length > 0}
              taxonomy={data?.taxonomy || {}}
              saving={creating}
              savingStructured={false}
              feedback={createError ? { tone: 'error', text: createError } : undefined}
              officialDetailFeedback={createOfficialDetailHtml.trim() ? { tone: 'success', text: '详情内容会在创建产品时自动保存。' } : undefined}
              shelfLoading={false}
              shelfBusy={false}
              actionBusy={false}
              imageBusy={creating}
              imageFeedback={createImageFeedback}
              onChange={(patch) => setCreateDraft((current) => ({ ...current, ...patch }))}
              onStructuredChange={(patch) => setCreateStructuredDraft((current) => ({ ...current, ...patch }))}
              onOfficialDetailChange={setCreateOfficialDetailHtml}
              onOfficialDetailFeedback={(feedback) => setCreateError(feedback.tone === 'error' ? feedback.text : '')}
              onManualPdfsChange={setCreateManualPdfs}
              onSave={createProduct}
              onReset={() => {
                createManualPdfs.forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
                if (createMainImage) URL.revokeObjectURL(createMainImage.previewUrl);
                setCreateDraft(blankNewProductDraft(normalizedBrandCode));
                setCreateStructuredDraft(blankCreateStructuredDraft(normalizedBrandCode));
                setCreateManualPdfs([]);
                setCreateMainImage(null);
                setCreateOfficialDetailHtml('');
                setCreateImageFeedback(undefined);
              }}
              onStructuredSave={() => {}}
              onStructuredReset={() => {}}
              onClose={closeProductCreate}
              onToggleStatus={() => {}}
              onArchive={() => {}}
              onPublishShelf={() => {}}
              onHideShelf={() => {}}
              onUploadMainImage={selectCreateMainImage}
              onDeleteMainImage={clearCreateMainImage}
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
          ) : activeContentTab === 'news' ? (
            <SiteNewsPanel
              siteCode={site.code || normalizedBrandCode}
              siteAssetBaseUrl={site.developmentUrl || site.productionUrl || site.resolvedUrl || ''}
              canWrite={canUpdateBrandLibrary}
            />
          ) : (
            <SiteInquiryPanel
              siteCode={site.code || normalizedBrandCode}
              canWrite={canUpdateBrandLibrary}
            />
          )}
        </section>
      </div>

      <button
        ref={backTopButtonRef}
        type="button"
        className="brand-console-backtop"
        onClick={scrollBrandConsoleToTop}
        aria-hidden="true"
        tabIndex={-1}
        aria-label="回到顶部"
        title="回到顶部"
      >
        <ArrowUpCircle size={18} />
      </button>
      <script
        dangerouslySetInnerHTML={{
          __html: `
(() => {
  const button = document.querySelector('.brand-console-backtop');
  if (!button || button.dataset.bound === 'true') return;
  button.dataset.bound = 'true';
  const targets = () => [
    document.querySelector('.app-main'),
    document.querySelector('.content'),
    document.querySelector('main'),
    document.scrollingElement,
    document.documentElement,
    document.body,
  ].filter(Boolean);
  const topValue = () => Math.max(window.scrollY || 0, ...targets().map((target) => target.scrollTop || 0));
  const update = () => {
    const visible = topValue() > 360;
    button.classList.toggle('is-visible', visible);
    button.setAttribute('aria-hidden', visible ? 'false' : 'true');
    button.tabIndex = visible ? 0 : -1;
  };
  const backTop = () => {
    targets().forEach((target) => {
      if (typeof target.scrollTo === 'function') target.scrollTo({ top: 0, behavior: 'smooth' });
      else target.scrollTop = 0;
    });
  };
  targets().forEach((target) => target.addEventListener('scroll', update, { passive: true }));
  document.addEventListener('scroll', update, { passive: true, capture: true });
  window.addEventListener('resize', update);
  button.addEventListener('click', backTop);
  window.setInterval(update, 160);
  update();
})();
          `.trim(),
        }}
      />
      {floatingDialog}

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
        .brand-console-backtop {
          position: fixed;
          right: 22px;
          bottom: 24px;
          z-index: 45;
          width: 42px;
          height: 42px;
          display: inline-grid;
          place-items: center;
          border: 1px solid rgba(200, 32, 44, 0.22);
          border-radius: 999px;
          background: var(--brand);
          color: #fff;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.2);
          cursor: pointer;
          opacity: 0;
          visibility: hidden;
          transform: translateY(10px);
          pointer-events: none;
          transition: opacity 0.16s ease, visibility 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }
        .brand-console-backtop.is-visible {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
          pointer-events: auto;
        }
        .brand-console-backtop.is-visible:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.24);
        }
        .brand-console-backtop:focus-visible {
          outline: 3px solid rgba(200, 32, 44, 0.24);
          outline-offset: 3px;
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
        .site-inquiry-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0 2px;
        }
        .site-inquiry-date-filter {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-wrap: nowrap;
          min-height: 38px;
          padding: 4px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-1);
          box-shadow: var(--sh-xs);
        }
        .site-inquiry-date-filter-label {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 8px;
          color: var(--t-secondary);
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .site-inquiry-date-filter-label svg {
          color: var(--brand);
        }
        .site-inquiry-date-picker {
          position: relative;
        }
        .site-inquiry-date-input {
          width: 132px;
          min-width: 132px;
          min-height: 30px;
          padding: 6px 8px;
          border: 1px solid transparent;
          border-radius: var(--r-sm);
          border-color: transparent;
          background: var(--surface-2);
          color: var(--t-strong);
          font-size: 12px;
          font-weight: 650;
          text-align: center;
          cursor: pointer;
        }
        .site-inquiry-date-input:not(.has-value) {
          color: var(--t-tertiary);
        }
        .site-inquiry-date-input:hover,
        .site-inquiry-date-input.is-open,
        .site-inquiry-date-input:focus-visible {
          border-color: rgba(200, 32, 44, 0.34);
          background: #fff;
          outline: none;
        }
        .site-inquiry-calendar {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          z-index: 70;
          width: 246px;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: #fff;
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.16);
        }
        .site-inquiry-calendar-head {
          display: grid;
          grid-template-columns: 30px 1fr 30px;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .site-inquiry-calendar-head strong {
          color: var(--t-strong);
          font-size: 13px;
          text-align: center;
        }
        .site-inquiry-calendar-nav {
          width: 30px;
          height: 30px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-1);
          color: var(--t-secondary);
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }
        .site-inquiry-calendar-nav:hover {
          border-color: rgba(200, 32, 44, 0.3);
          color: var(--brand);
          background: var(--brand-soft);
        }
        .site-inquiry-calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .site-inquiry-calendar-weekdays {
          margin-bottom: 5px;
        }
        .site-inquiry-calendar-weekdays span {
          color: var(--t-tertiary);
          font-size: 11px;
          font-weight: 800;
          text-align: center;
        }
        .site-inquiry-calendar-empty {
          min-height: 28px;
        }
        .site-inquiry-calendar-day {
          min-width: 0;
          height: 28px;
          border: 1px solid transparent;
          border-radius: var(--r-sm);
          background: transparent;
          color: var(--t-strong);
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
        }
        .site-inquiry-calendar-day:hover {
          border-color: rgba(200, 32, 44, 0.25);
          background: var(--brand-soft);
          color: var(--brand);
        }
        .site-inquiry-calendar-day.is-today {
          border-color: rgba(200, 32, 44, 0.38);
          color: var(--brand);
        }
        .site-inquiry-calendar-day.is-selected {
          border-color: var(--brand);
          background: var(--brand);
          color: #fff;
          box-shadow: 0 8px 16px rgba(200, 32, 44, 0.22);
        }
        .site-inquiry-calendar-day:disabled {
          cursor: not-allowed;
          color: var(--t-disabled);
          background: transparent;
          opacity: 0.45;
        }
        .site-inquiry-calendar-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--border);
        }
        .site-inquiry-calendar-actions .btn {
          min-height: 28px;
        }
        .site-inquiry-date-filter-separator {
          color: var(--t-tertiary);
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .site-inquiry-date-filter .btn {
          min-height: 30px;
          padding: 0 10px;
        }
        .site-inquiry-table th,
        .site-inquiry-table td {
          vertical-align: middle;
        }
        .site-inquiry-table {
          table-layout: fixed;
          min-width: 1120px;
        }
        .site-inquiry-table th,
        .site-inquiry-table td {
          text-align: center;
          white-space: normal;
          word-break: normal;
          overflow-wrap: anywhere;
        }
        .site-inquiry-table th:nth-child(1),
        .site-inquiry-table td:nth-child(1) {
          width: 16%;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .site-inquiry-table th:nth-child(2),
        .site-inquiry-table td:nth-child(2) {
          width: 12%;
          text-align: center;
          white-space: nowrap;
        }
        .site-inquiry-table th:nth-child(3),
        .site-inquiry-table td:nth-child(3) {
          width: 10%;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .site-inquiry-table th:nth-child(4),
        .site-inquiry-table td:nth-child(4) {
          width: 12%;
          text-align: center;
        }
        .site-inquiry-table th:nth-child(5),
        .site-inquiry-table td:nth-child(5) {
          width: 26%;
          text-align: center;
        }
        .site-inquiry-table th:nth-child(6),
        .site-inquiry-table td:nth-child(6) {
          width: 14%;
          text-align: center;
          white-space: nowrap;
        }
        .site-inquiry-table th:nth-child(7),
        .site-inquiry-table td:nth-child(7) {
          width: 10%;
          text-align: right;
          white-space: nowrap;
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
        .brand-product-toolbar-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
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
          box-shadow: 0 0 0 2px rgba(200, 32, 44, 0.08);
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
          grid-template-columns: repeat(3, minmax(0, 1fr));
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
          background: rgba(200, 32, 44, 0.08);
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
        .site-basic-panel {
          display: grid;
          gap: 14px;
          min-height: 397px;
          padding: 16px;
          border-top: 1px solid var(--border);
          background: var(--surface-2);
        }
        .site-basic-jump-nav {
          position: sticky;
          top: 0;
          z-index: 3;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: rgba(255, 255, 255, .96);
          box-shadow: 0 8px 22px rgba(15, 23, 42, .06);
        }
        .site-basic-jump-nav .btn {
          transition: border-color .16s ease, background .16s ease, box-shadow .16s ease, color .16s ease;
        }
        .site-basic-jump-nav .btn.is-active {
          color: var(--brand);
          border-color: color-mix(in srgb, var(--brand) 45%, var(--border));
          background: var(--brand-50);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brand) 22%, transparent);
        }
        .site-basic-section {
          scroll-margin-top: 72px;
          display: grid;
          gap: 14px;
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-1);
        }
        .site-basic-section-stats .site-basic-grid {
          grid-template-columns: minmax(116px, .42fr) minmax(136px, .48fr) minmax(280px, 1.4fr);
          align-items: end;
        }
        .site-basic-section-stats .site-basic-field {
          gap: 4px;
        }
        .site-basic-section-stats .input {
          min-height: 34px;
          padding-top: 7px;
          padding-bottom: 7px;
        }
        .site-basic-section-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
        }
        .site-basic-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: start;
          gap: 12px;
        }
        .site-basic-section-identity .site-basic-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .site-basic-field {
          display: grid;
          align-self: start;
          gap: 6px;
          min-width: 0;
        }
        .site-basic-section-identity .site-basic-field {
          grid-column: auto;
        }
        .site-basic-field.wide {
          grid-column: 1 / -1;
        }
        .site-basic-section-identity .site-basic-field.image-field.wide {
          grid-column: auto;
        }
        .site-basic-section-identity .site-basic-field.image-field:not(.wide) {
          grid-column: auto;
        }
        .site-basic-section-identity .site-basic-field.image-field:not(.wide) {
          min-height: 224px;
        }
        .site-basic-field.image-field {
          gap: 10px;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: #fff;
          box-shadow: 0 4px 14px rgba(15, 23, 42, .04);
        }
        .site-basic-field span {
          color: var(--t-secondary);
          font-size: 12px;
          font-weight: 700;
        }
        .site-basic-field em {
          margin-top: -2px;
          color: var(--t-tertiary);
          font-size: 11px;
          font-style: normal;
          line-height: 1.35;
        }
        .site-basic-field .input,
        .hero-carousel-table .input {
          width: 100%;
          min-width: 0;
        }
        .site-basic-image-control {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          align-items: start;
          min-width: 0;
        }
        .site-basic-image-preview {
          display: grid;
          place-items: center;
          height: 116px;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: #fff;
        }
        .site-basic-field.wide .site-basic-image-preview {
          height: 116px;
        }
        .site-basic-section-identity .site-basic-field.image-field:not(.wide) .site-basic-image-preview {
          height: 116px;
        }
        .site-basic-image-preview.is-dark {
          background: #111827;
        }
        .site-basic-image-preview img {
          max-width: 100%;
          max-height: 86px;
          object-fit: contain;
        }
        .site-basic-field.wide .site-basic-image-preview img {
          max-height: 86px;
        }
        .site-basic-section-identity .site-basic-field.image-field:not(.wide) .site-basic-image-preview img {
          max-height: 86px;
        }
        .site-basic-image-preview span {
          color: var(--t-tertiary);
          padding: 8px;
          font-weight: 600;
          text-align: center;
        }
        .site-basic-image-stack {
          display: grid;
          gap: 8px;
          min-width: 0;
        }
        .site-basic-image-preview.is-error {
          border-color: rgba(200, 32, 44, .32);
          background: #fff5f6;
        }
        .site-basic-image-purpose {
          display: grid;
          gap: 3px;
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: #fff;
        }
        .site-basic-image-purpose strong {
          color: var(--t-primary);
          font-size: 12px;
        }
        .site-basic-image-purpose p,
        .site-basic-share-preview p {
          margin: 0;
          color: var(--t-secondary);
          font-size: 11px;
          line-height: 1.45;
        }
        .site-basic-image-purpose small,
        .site-basic-share-preview small {
          color: var(--t-tertiary);
          font-size: 10.5px;
        }
        .site-basic-share-preview {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          padding: 8px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: #fff;
          box-shadow: 0 8px 18px rgba(15, 23, 42, .05);
        }
        .site-basic-share-preview strong {
          display: block;
          margin-bottom: 2px;
          overflow: hidden;
          color: var(--t-primary);
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .site-basic-share-thumb {
          display: grid;
          place-items: center;
          aspect-ratio: 1.91 / 1;
          overflow: hidden;
          border-radius: 6px;
          background: var(--surface-2);
        }
        .site-basic-share-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .site-basic-share-thumb span {
          color: var(--t-tertiary);
          font-size: 11px;
          font-weight: 700;
        }
        .site-basic-image-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .site-basic-image-meta {
          display: flex;
          min-width: 0;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .site-basic-image-meta > div {
          display: grid;
          min-width: 0;
          gap: 2px;
        }
        .site-basic-image-meta strong {
          color: var(--t-primary);
          font-size: 13px;
        }
        .site-basic-image-meta code {
          width: 100%;
          min-width: 0;
          overflow: hidden;
          color: var(--t-tertiary);
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .site-basic-contact-table {
          min-width: 1480px;
        }
        .site-basic-panel .hero-carousel-table tbody tr {
          cursor: default;
        }
        .hero-carousel-manager {
          scroll-margin-top: 72px;
          display: grid;
          gap: 14px;
          padding: 16px;
          border: 1px solid rgba(200, 32, 44, 0.14);
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 10px 28px rgba(15, 23, 42, .06);
        }
        .hero-carousel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .hero-carousel-head h4 {
          margin: 1px 0 2px;
          color: var(--brand-600);
          font-size: 15px;
        }
        .hero-carousel-head span {
          color: var(--t-secondary);
          font-size: 12px;
        }
        .hero-carousel-table-wrap {
          overflow-x: auto;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: #fff;
        }
        .hero-carousel-table {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
          font-size: 12px;
        }
        .hero-carousel-table th {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--t-secondary);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .04em;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .hero-carousel-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          color: var(--t-secondary);
          vertical-align: middle;
        }
        .hero-carousel-table tbody tr {
          background: #fff;
          cursor: grab;
          transition: background .15s, opacity .15s;
        }
        .hero-carousel-table tbody tr:hover {
          background: rgba(200, 32, 44, .035);
        }
        .hero-carousel-table tbody tr.is-dragging {
          opacity: .56;
        }
        .hero-carousel-table tbody tr:last-child td {
          border-bottom: 0;
        }
        .hero-carousel-drag {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--t-secondary);
          font-weight: 800;
          white-space: nowrap;
        }
        .hero-carousel-thumb {
          display: block;
          width: 126px;
          height: 42px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface-3);
          object-fit: cover;
        }
        .hero-carousel-thumb-button {
          display: inline-flex;
          padding: 0;
          border: 0;
          border-radius: 6px;
          background: transparent;
          cursor: zoom-in;
        }
        .hero-carousel-thumb-button:focus-visible {
          outline: 3px solid rgba(200, 32, 44, .16);
          outline-offset: 2px;
        }
        .hero-carousel-file {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .hero-carousel-file strong {
          max-width: 220px;
          overflow: hidden;
          color: var(--t-strong);
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .hero-carousel-file span {
          color: var(--t-tertiary);
          font-size: 11px;
        }
        .hero-carousel-order {
          width: 58px;
          padding: 7px 8px;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: #fff;
          color: var(--t-strong);
          font-size: 12px;
          text-align: center;
        }
        .hero-carousel-link-control {
          display: flex;
          align-items: center;
          gap: 7px;
          min-width: 300px;
          padding: 7px 9px;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: #fff;
        }
        .hero-carousel-link-control:focus-within,
        .hero-carousel-order:focus,
        .hero-carousel-remark:focus {
          border-color: rgba(200, 32, 44, .42);
          box-shadow: 0 0 0 3px rgba(200, 32, 44, .08);
          outline: none;
        }
        .hero-carousel-link-control input {
          min-width: 0;
          flex: 1;
          border: 0;
          background: transparent;
          color: var(--t-strong);
          font-size: 12px;
          outline: none;
        }
        .hero-carousel-link-actions {
          display: flex;
          gap: 6px;
          white-space: nowrap;
        }
        .site-audience-table {
          min-width: 0;
          table-layout: fixed;
        }
        .site-audience-table-wrap {
          overflow-x: hidden;
        }
        .site-audience-table th,
        .site-audience-table td {
          padding: 8px 9px;
        }
        .site-audience-table th:nth-child(1),
        .site-audience-table td:nth-child(1) {
          width: 5%;
        }
        .site-audience-table th:nth-child(2),
        .site-audience-table td:nth-child(2) {
          width: 17%;
        }
        .site-audience-table th:nth-child(3),
        .site-audience-table td:nth-child(3) {
          width: 16%;
        }
        .site-audience-table th:nth-child(4),
        .site-audience-table td:nth-child(4) {
          width: 18%;
        }
        .site-audience-table th:nth-child(5),
        .site-audience-table td:nth-child(5),
        .site-audience-table th:nth-child(6),
        .site-audience-table td:nth-child(6) {
          width: 19%;
        }
        .site-audience-table th:nth-child(7),
        .site-audience-table td:nth-child(7) {
          width: 6%;
        }
        .site-audience-table tbody tr {
          cursor: default;
        }
        .site-audience-field-pair {
          display: grid;
          gap: 6px;
          min-width: 0;
        }
        .site-audience-table .input {
          width: 100%;
          min-width: 0;
          min-height: 34px;
          padding: 7px 9px;
          font-size: 12px;
        }
        .site-audience-textarea {
          width: 100%;
          min-width: 0;
          min-height: 74px;
          resize: vertical;
        }
        .hero-carousel-order-text {
          color: var(--t-strong);
          font-weight: 900;
        }
        .hero-carousel-remark {
          width: 220px;
          min-width: 0;
          padding: 7px 9px;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: #fff;
          color: var(--t-strong);
          font-size: 12px;
        }
        .hero-carousel-visible-toggle {
          border: 0;
          cursor: pointer;
        }
        .hero-carousel-visible-toggle:disabled {
          cursor: wait;
          opacity: .7;
        }
        .hero-carousel-empty {
          padding: 18px;
          border: 1px dashed var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-1);
          color: var(--t-secondary);
          font-size: 13px;
          text-align: center;
        }
        .hero-carousel-strip {
          overflow-x: auto;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: #fff;
        }
        .hero-carousel-strip::before {
          content: "拖拽  图片 / 文件 / 跳转链接 / 操作";
          display: block;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--t-secondary);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .04em;
        }
        .hero-carousel-card {
          display: grid;
          grid-template-columns: 168px minmax(520px, 1fr);
          gap: 12px;
          align-items: center;
          min-width: 860px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          background: #fff;
          cursor: grab;
          transition: background .15s, opacity .15s;
        }
        .hero-carousel-card:hover {
          background: rgba(200, 32, 44, .035);
        }
        .hero-carousel-card.is-dragging {
          opacity: .56;
        }
        .hero-carousel-card:last-child {
          border-bottom: 0;
        }
        .hero-carousel-preview {
          display: grid;
          grid-template-columns: 40px 118px;
          gap: 8px;
          align-items: center;
        }
        .hero-carousel-preview img {
          order: 2;
          display: block;
          width: 118px;
          height: 40px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface-3);
          object-fit: cover;
        }
        .hero-carousel-cardbar {
          display: contents;
        }
        .hero-carousel-cardbar span:first-child {
          order: 1;
          color: var(--t-secondary);
          font-size: 12px;
          font-weight: 900;
        }
        .hero-carousel-cardbar span:nth-child(2) {
          display: none;
        }
        .hero-carousel-cardbar button {
          display: none;
        }
        .hero-carousel-cardbody {
          display: grid;
          grid-template-columns: minmax(160px, 220px) minmax(320px, 1fr) auto;
          gap: 12px;
          align-items: center;
        }
        .hero-carousel-link-row {
          display: block;
        }
        .hero-carousel-link-row label {
          display: none;
        }
        .hero-carousel-preview-backdrop {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(15, 23, 42, .68);
        }
        .hero-carousel-preview-modal {
          position: relative;
          display: grid;
          gap: 10px;
          width: min(1040px, 92vw);
          max-height: 88vh;
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, .22);
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 24px 80px rgba(15, 23, 42, .28);
        }
        .hero-carousel-preview-modal img {
          display: block;
          width: 100%;
          max-height: calc(88vh - 72px);
          border-radius: 7px;
          object-fit: contain;
          background: var(--surface-2);
        }
        .hero-carousel-preview-modal span {
          overflow: hidden;
          color: var(--t-secondary);
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .hero-carousel-preview-close {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border: 1px solid var(--border);
          border-radius: 50%;
          background: rgba(255, 255, 255, .92);
          color: var(--t-strong);
          cursor: pointer;
          box-shadow: var(--sh-xs);
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
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--surface-1);
          box-shadow: var(--sh-xs);
        }
        .site-news-preview-img {
          display: block;
          width: 100%;
          aspect-ratio: 1280 / 600;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
          object-fit: contain;
          object-position: center;
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
          display: flex;
          flex: 1;
          flex-direction: column;
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
          display: -webkit-box;
          overflow: hidden;
          margin: 0;
          color: var(--t-secondary);
          font-size: 12px;
          line-height: 1.65;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }
        .news-preview-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: auto;
          padding-top: 12px;
        }
        .news-preview-link {
          flex-shrink: 0;
          color: var(--brand);
          font-size: 12px;
          font-weight: 800;
        }
        .site-news-detail-preview {
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--surface-1);
          box-shadow: var(--sh-xs);
        }
        .site-news-detail-preview-img {
          display: block;
          width: 100%;
          aspect-ratio: 1280 / 600;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
          object-fit: contain;
          object-position: center;
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
          box-shadow: 0 0 0 3px rgba(200, 32, 44, 0.14);
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
          box-shadow: 0 0 0 3px rgba(200, 32, 44, 0.14);
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
          box-shadow: inset 0 0 0 1px rgba(200, 32, 44, 0.14);
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
        .floating-dialog-backdrop {
          position: fixed;
          inset: 0;
          z-index: 120;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 34px 20px;
          background: rgba(15, 23, 42, 0.12);
        }
        .floating-dialog-card {
          width: min(448px, calc(100vw - 32px));
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          background: var(--surface-1);
          box-shadow: var(--sh-lg);
        }
        .floating-dialog-card.is-danger {
          border-color: rgba(200, 32, 44, .28);
        }
        .floating-dialog-head,
        .floating-dialog-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 18px;
        }
        .floating-dialog-head {
          border-bottom: 1px solid var(--border);
        }
        .floating-dialog-head h2 {
          margin: 2px 0 0;
          color: var(--t-primary);
          font-size: 16px;
          font-weight: 900;
        }
        .floating-dialog-body {
          display: grid;
          gap: 14px;
          padding: 18px;
        }
        .floating-dialog-body p {
          margin: 0;
          color: var(--t-secondary);
          font-size: 14px;
          line-height: 1.7;
        }
        .floating-dialog-input {
          width: 100%;
        }
        .floating-dialog-actions {
          justify-content: flex-end;
          border-top: 1px solid var(--border);
          background: var(--surface-2);
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
        .product-edit-section-basic {
          grid-column: 1;
          grid-row: span 2;
        }
        .product-edit-section-website,
        .product-edit-section-assets {
          grid-column: 2;
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
        .product-manual-pdf-upload-row {
          min-height: 42px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 8px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-1);
        }
        .product-manual-pdf-inline-list {
          min-width: 0;
          flex: 1 1 auto;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .product-manual-pdf-chip {
          position: relative;
          min-width: 0;
          max-width: 100%;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 26px 6px 10px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-2);
        }
        .product-manual-pdf-chip strong {
          min-width: 0;
          max-width: min(420px, 50vw);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--t-strong);
          font-size: 13px;
          line-height: 1.35;
        }
        .product-manual-pdf-remove {
          position: absolute;
          top: 3px;
          right: 3px;
          width: 18px;
          height: 18px;
          display: inline-grid;
          place-items: center;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: var(--t-tertiary);
          cursor: pointer;
        }
        .product-manual-pdf-remove:hover:not(:disabled) {
          background: rgba(200, 32, 44, 0.1);
          color: var(--brand);
        }
        .product-manual-pdf-remove:disabled {
          cursor: not-allowed;
          opacity: 0.45;
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
        .site-news-cover-asset {
          display: grid;
          gap: 10px;
          align-content: start;
        }
        .site-news-cover-preview {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 96px;
          aspect-ratio: 1280 / 600;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-2);
          box-shadow: var(--sh-xs);
        }
        .site-news-cover-preview img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
        }
        .site-news-cover-preview.is-empty {
          color: var(--t-tertiary);
          border-style: dashed;
        }
        .site-news-cover-status {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          color: var(--t-secondary);
          font-size: 12px;
        }
        .site-news-cover-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
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
          box-shadow: 0 8px 22px rgba(200, 32, 44, 0.12);
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
          box-shadow: 0 8px 22px rgba(200, 32, 44, 0.1);
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
          .hero-carousel-strip,
          .site-basic-grid,
          .site-material-grid {
            grid-template-columns: 1fr;
          }
          .site-basic-section-identity .site-basic-grid {
            grid-template-columns: 1fr;
          }
          .site-basic-section-identity .site-basic-field,
          .site-basic-section-identity .site-basic-field.image-field.wide,
          .site-basic-section-identity .site-basic-field.image-field:not(.wide) {
            grid-column: 1 / -1;
          }
          .site-basic-image-control {
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
          .brand-product-toolbar-actions {
            width: 100%;
            margin-left: 0;
          }
          .brand-product-toolbar-actions .btn {
            width: 100%;
            justify-content: center;
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
          .product-edit-section-basic,
          .product-edit-section-website,
          .product-edit-section-assets {
            grid-column: 1;
            grid-row: auto;
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

type SiteMaterialUpload = { name: string; size: number; url?: string; homepageSrc?: string; synced?: boolean };
type HeroCarouselItem = {
  id: string;
  src: string;
  filename: string;
  mimeType: string;
  size: number;
  updatedAt: string;
  linkUrl?: string;
  remark?: string;
  visible?: boolean;
  sortOrder: number;
};
type AudienceCardItem = {
  id: 'residential' | 'commercial' | 'professionals';
  tagZh: string;
  tagEn: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  visible: boolean;
  sortOrder: number;
};

const DEFAULT_AUDIENCE_CARDS: AudienceCardItem[] = [
  {
    id: 'residential',
    tagZh: '家用',
    tagEn: 'RESIDENTIAL',
    title: '为家庭打造的舒适系统',
    description: '热水 · 采暖为核心，兼顾制冷，全屋舒适一站解决',
    primaryLabel: '热水 Water →',
    primaryHref: '/products/residential/water-heating/',
    secondaryLabel: '采暖制冷 Air →',
    secondaryHref: '/products/residential/heating-cooling/',
    visible: true,
    sortOrder: 0,
  },
  {
    id: 'commercial',
    tagZh: '商用',
    tagEn: 'COMMERCIAL',
    title: '为建筑而生的工程系统',
    description: '酒店 · 公寓 · 综合体，高并发连续供热水、稳定供暖，兼顾供冷',
    primaryLabel: '热水 Water →',
    primaryHref: '/products/commercial/water-heating/',
    secondaryLabel: '采暖制冷 Air →',
    secondaryHref: '/products/commercial/heating-cooling/',
    visible: true,
    sortOrder: 1,
  },
  {
    id: 'professionals',
    tagZh: '专业人士',
    tagEn: 'PROFESSIONALS',
    title: '为经销商与工程师赋能',
    description: '培训 · 技术资料 · BIM/CAD · 合作计划',
    primaryLabel: '专业人士中心 →',
    primaryHref: '/professionals/',
    secondaryLabel: '查找经销商 →',
    secondaryHref: '/find-a-pro/',
    visible: true,
    sortOrder: 2,
  },
];

function normalizeAudienceCards(value: unknown): AudienceCardItem[] {
  const rows = Array.isArray(value) ? value : [];
  return DEFAULT_AUDIENCE_CARDS.map((fallback, index) => {
    const found = rows.find((row) => row && (row as any).id === fallback.id) as Partial<AudienceCardItem> | undefined;
    return {
      ...fallback,
      ...found,
      id: fallback.id,
      visible: found?.visible !== false,
      sortOrder: Number(found?.sortOrder ?? index),
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

function siteMaterialPreviewSrc(brandCode: string, src: string) {
  if (/^https?:\/\//i.test(src) || src.startsWith('blob:')) return src;
  return `${SITE_MATERIALS_API}/api/v2/site-materials/${encodeURIComponent(brandCode)}?asset=${encodeURIComponent(src)}`;
}

type BasicSettings = Record<string, Record<string, any>>;

const BASIC_INFO_FIELD_GROUPS: Array<{
  section: string;
  title: string;
  eyebrow: string;
  fields: Array<{ key: string; label: string; span?: boolean }>;
}> = [
  { section: 'identity', title: '站点身份', eyebrow: 'Identity', fields: [
    { key: 'siteTitle', label: '网站标题', span: true }, { key: 'siteName', label: '站点名称' },
    { key: 'brandNameCn', label: '品牌中文名' }, { key: 'brandNameEn', label: '品牌英文名' },
    { key: 'logoUrl', label: '品牌 Logo', span: true }, { key: 'whiteLogoUrl', label: '白色 Logo', span: true },
    { key: 'favicon16Url', label: 'Favicon 16' }, { key: 'favicon32Url', label: 'Favicon 32' },
    { key: 'faviconIcoUrl', label: 'Favicon ICO' }, { key: 'appleTouchIconUrl', label: 'Apple Touch Icon' },
    { key: 'siteUrl', label: '官网域名' }, { key: 'localeLabel', label: '地区/语言' },
  ] },
  { section: 'brandClaims', title: '品牌主张', eyebrow: 'Brand Claims', fields: [
    { key: 'heroEyebrow', label: 'Hero 顶部说明', span: true }, { key: 'heroTitleLine1', label: 'Hero 主标题第一行' },
    { key: 'heroTitleLine2', label: 'Hero 主标题第二行' }, { key: 'heroSloganEn', label: '英文口号' },
    { key: 'heroClaim', label: '中文广告语', span: true }, { key: 'ctaSlogan', label: 'CTA 口号', span: true },
  ] },
  { section: 'stats', title: '服务网络数字', eyebrow: 'Stats', fields: [
    { key: 'serviceProvinceCount', label: '服务覆盖省市' }, { key: 'serviceOutletCount', label: '授权服务网点' },
    { key: 'serviceNetworkText', label: '服务网络文案' },
  ] },
  { section: 'organization', title: '企业与集团关系', eyebrow: 'Organization', fields: [
    { key: 'operatorGroupName', label: '运营集团名称' }, { key: 'operatorGroupNameEn', label: '运营集团英文/系统名' },
    { key: 'operatorGroupUrl', label: '集团官网链接', span: true }, { key: 'parentBrandRelationText', label: '母品牌关系文案', span: true },
    { key: 'rheemUrl', label: 'Rheem 链接' }, { key: 'ruudUrl', label: 'Ruud 链接' }, { key: 'groupSiteUrl', label: '集团官网链接' },
  ] },
  { section: 'contact', title: '联系信息', eyebrow: 'Contact', fields: [
    { key: 'customerServiceHotline', label: '全国客服热线' }, { key: 'customerServiceTelHref', label: '电话链接' },
    { key: 'serviceHours', label: '服务时间' }, { key: 'businessEmail', label: '商务合作邮箱' },
    { key: 'mediaEmail', label: '媒体/品牌邮箱' }, { key: 'privacyEmail', label: '隐私负责人邮箱' },
    { key: 'dealerJoinEmail', label: '经销商加盟邮箱' }, { key: 'contactFormSuccessText', label: '联系表单成功文案', span: true },
    { key: 'urgentRepairNote', label: '紧急报修提示', span: true },
  ] },
  { section: 'dealerService', title: '经销商服务入口', eyebrow: 'Dealer Service', fields: [
    { key: 'dealerLocatorButtonText', label: '查找经销商按钮' }, { key: 'dealerLocatorPageTitle', label: '查找经销商页标题', span: true },
    { key: 'dealerLocatorDescription', label: '查找经销商页描述', span: true }, { key: 'dealerSearchPlaceholder', label: '搜索占位文案', span: true },
    { key: 'nearestDealerButtonText', label: '定位按钮文案' }, { key: 'dealerJoinTitle', label: '加盟标题' },
    { key: 'dealerJoinDescription', label: '加盟说明', span: true }, { key: 'dealerJoinButtonText', label: '加盟按钮文案' },
    { key: 'dealerJoinHref', label: '加盟按钮链接' },
  ] },
  { section: 'legal', title: '备案版权', eyebrow: 'Legal', fields: [
    { key: 'icpNumber', label: 'ICP备案号' }, { key: 'icpUrl', label: '备案链接' },
    { key: 'copyrightText', label: '版权所有文案', span: true }, { key: 'copyrightYear', label: '版权年份' },
    { key: 'copyrightOwner', label: '版权主体' }, { key: 'trademarkText', label: '商标声明', span: true },
  ] },
  { section: 'privacy', title: '隐私法务', eyebrow: 'Privacy', fields: [
    { key: 'privacyEffectiveDate', label: '隐私政策生效日期' }, { key: 'privacyLastUpdatedDate', label: '隐私政策最近更新' },
    { key: 'privacyVersion', label: '隐私政策版本' }, { key: 'legalOperatorName', label: '运营主体全称', span: true },
    { key: 'registeredAddress', label: '注册地址', span: true }, { key: 'privacyContactEmail', label: '隐私负责人邮箱' },
    { key: 'privacyContactHotline', label: '隐私联系热线' },
  ] },
  { section: 'seo', title: 'SEO / 分享', eyebrow: 'SEO', fields: [
    { key: 'homeMetaTitle', label: '首页 SEO 标题', span: true }, { key: 'homeMetaDescription', label: '首页 SEO 描述', span: true },
    { key: 'homeMetaKeywords', label: '首页关键词', span: true }, { key: 'ogSiteName', label: 'OG 站点名' },
    { key: 'defaultOgImage', label: '默认分享图', span: true }, { key: 'defaultTwitterImage', label: 'Twitter 默认图', span: true },
    { key: 'canonicalBaseUrl', label: 'Canonical 基础地址' }, { key: 'organizationName', label: '组织名称' },
    { key: 'organizationLogo', label: '组织 Logo', span: true }, { key: 'parentOrganizationName', label: '上级组织名称' },
    { key: 'parentOrganizationUrl', label: '上级组织链接' }, { key: 'sameAs', label: 'sameAs' }, { key: 'sitemapUrl', label: 'Sitemap 地址' },
  ] },
  { section: 'analytics', title: 'Cookie / 统计', eyebrow: 'Analytics', fields: [
    { key: 'analyticsEndpoint', label: '统计上报端点', span: true }, { key: 'cookieConsentText', label: 'Cookie 告知文案', span: true },
    { key: 'cookieDenyText', label: '拒绝按钮文案' }, { key: 'cookieAcceptText', label: '同意按钮文案' },
  ] },
];

const BASIC_INFO_TABLES = [
  { section: 'stats', key: 'technicalStats', title: '技术卖点数字', source: '首页产品能力/系统亮点数字' },
  { section: 'stats', key: 'sustainabilityStats', title: '可持续发展数字', source: '首页可持续发展/节能减排数字' },
  { section: 'dealerService', key: 'authorizedServiceStandards', title: '授权服务标准', source: '查找经销商页服务标准' },
] as const;

function cloneBasicSettings(value: unknown): BasicSettings {
  return JSON.parse(JSON.stringify(value || {}));
}

const EVERHOT_BASIC_INFO_CURRENT: BasicSettings = {
  identity: {
    siteTitle: '恒热 Everhot | 中央采暖·热水·制冷整体解决方案',
    siteName: 'Everhot 中国 Everhot China',
    brandNameCn: '恒热',
    brandNameEn: 'Everhot',
    logoUrl: '/assets/img/brand/everhot-logo.png',
    whiteLogoUrl: '/assets/img/brand/everhot-logo-white.png',
    favicon16Url: '/favicon-16x16.png',
    favicon32Url: '/favicon-32x32.png',
    faviconIcoUrl: '/favicon.ico',
    appleTouchIconUrl: '/apple-touch-icon.png',
    siteUrl: 'https://www.everhot.com.cn',
    localeLabel: '中国 · 简体中文',
  },
  brandClaims: {
    heroEyebrow: '瑞美（Rheem）集团旗下 · 瑞合瑞德集团中国运营',
    heroTitleLine1: '百年恒续',
    heroTitleLine2: '为爱恒热',
    heroSloganEn: 'EVERHOT FOR EVERLOVE',
    heroClaim: '大户型选恒热，多点用水没烦恼',
    ctaSlogan: '大户型选恒热 · 多点用水没烦恼',
  },
  stats: {
    technicalStats: [
      { value: '≥105%', label: '冷凝热效率', sortOrder: 0, visible: true },
      { value: '≤5s', label: '出热水时间', sortOrder: 1, visible: true },
      { value: 'COP 4.2+', label: '系统能效比', sortOrder: 2, visible: true },
      { value: '24h', label: '商用连续供热', sortOrder: 3, visible: true },
    ],
    sustainabilityStats: [
      { value: '38%', label: '平均能耗降低', sortOrder: 0, visible: true },
      { value: '1,200+', label: '节能改造项目', sortOrder: 1, visible: true },
      { value: '6,800t', label: '年减少碳排放', sortOrder: 2, visible: true },
    ],
    serviceProvinceCount: '30',
    serviceOutletCount: '200+',
    serviceNetworkText: '覆盖全国 30 省市，200+ 授权服务网点',
  },
  organization: {
    operatorGroupName: '瑞合瑞德暖通科技集团',
    operatorGroupNameEn: 'Rhautt Comfort',
    operatorGroupUrl: 'https://rhautt.com',
    parentBrandRelationText: '瑞美（Rheem）集团旗下 · 瑞合瑞德集团中国运营',
    rheemUrl: 'https://www.rheem.com.cn',
    ruudUrl: 'https://www.ruud.com.cn',
    groupSiteUrl: 'https://rhautt.com',
  },
  contact: {
    customerServiceHotline: '400-888-8888',
    customerServiceTelHref: 'tel:4008888888',
    serviceHours: '周一至周六 9:00—18:00',
    businessEmail: 'business@everhot.com.cn',
    mediaEmail: 'pr@everhot.com.cn',
    privacyEmail: 'privacy@everhot.com.cn',
    dealerJoinEmail: 'dealer@rhautt.com',
    contactFormSuccessText: '留言已提交，恒热客服将尽快与您联系。',
    urgentRepairNote: '提交后将由客服回拨。紧急报修请直接致电 400-888-8888。',
    contactCards: [
      { tag: '客服', title: '全国客服热线', body: '产品咨询、使用指导、售后报修', linkText: '400-888-8888', href: 'tel:4008888888', sortOrder: 0, visible: true },
      { tag: '售后', title: '预约上门维修', body: '在线预约授权服务工程师上门检测维修。', linkText: '立即预约', href: '/find-a-pro/', sortOrder: 1, visible: true },
      { tag: '商务', title: '工程与商务合作', body: '酒店、公寓、综合体项目与集采合作。', linkText: 'business@everhot.com.cn', href: 'mailto:business@everhot.com.cn', sortOrder: 2, visible: true },
      { tag: '加盟', title: '经销商加盟', body: '申请成为恒热授权经销商。', linkText: '加盟申请', href: '/professionals/residential/partner-programs/', sortOrder: 3, visible: true },
      { tag: '媒体', title: '媒体与品牌', body: '媒体采访与品牌合作。', linkText: 'pr@everhot.com.cn', href: 'mailto:pr@everhot.com.cn', sortOrder: 4, visible: true },
      { tag: '集团', title: '集团与其他品牌', body: '瑞美（Rheem）集团品牌矩阵，瑞合瑞德集团中国运营。', linkText: '访问集团官网', href: 'https://rhautt.com', sortOrder: 5, visible: true },
    ],
  },
  dealerService: {
    dealerLocatorButtonText: '查找经销商',
    dealerLocatorPageTitle: '查找授权经销商 | 恒热 Everhot',
    dealerLocatorDescription: '覆盖全国 30 省市，200+ 授权服务网点，专业安装工程师，完善售后保障。',
    dealerSearchPlaceholder: '输入城市 / 区域 / 地址，如：上海 浦东',
    nearestDealerButtonText: '离我最近',
    dealerJoinTitle: '成为恒热授权经销商',
    dealerJoinDescription: '加入恒热经销商网络，获取独家授权、培训支持与市场资源',
    dealerJoinButtonText: '申请加盟',
    dealerJoinHref: 'mailto:dealer@rhautt.com',
    authorizedServiceStandards: [
      { value: 'Rheem认证', label: '官方认证安装工程师', sortOrder: 0, visible: true },
      { value: '5年质保', label: '整机售后保障', sortOrder: 1, visible: true },
      { value: '48h响应', label: '售后上门时效', sortOrder: 2, visible: true },
      { value: '正品承诺', label: '官方渠道授权货源', sortOrder: 3, visible: true },
    ],
  },
  legal: {
    icpNumber: '沪ICP备XXXXXXXX号',
    icpUrl: 'https://beian.miit.gov.cn/',
    copyrightText: '© 2026 Everhot 恒热 · 瑞合瑞德暖通科技集团 · Everhot 为注册商标',
    copyrightYear: '2026',
    copyrightOwner: '瑞合瑞德暖通科技集团',
    trademarkText: 'Everhot / 恒热 为注册商标',
  },
  privacy: {
    privacyEffectiveDate: '2026-XX-XX',
    privacyLastUpdatedDate: '2026-XX-XX',
    privacyVersion: 'v1.0',
    legalOperatorName: '【运营主体全称】',
    registeredAddress: '【注册地址】',
    privacyContactEmail: 'privacy@everhot.com.cn',
    privacyContactHotline: '400-888-8888',
  },
  seo: {
    homeMetaTitle: '恒热 Everhot | 中央采暖·热水·制冷整体解决方案',
    homeMetaDescription: '恒热 Everhot —— 百年恒续，为爱恒热。专注家用与商用中央采暖、热水、制冷整体解决方案，瑞美集团旗下品牌。',
    homeMetaKeywords: '恒热,Everhot,壁挂炉,热水器,中央热水,中央采暖,空气能,商用热水,家用采暖',
    ogSiteName: 'Everhot 中国 Everhot China',
    defaultOgImage: 'https://www.everhot.com.cn/assets/img/hero-poster-desktop.webp',
    defaultTwitterImage: 'https://www.everhot.com.cn/assets/img/hero-poster-desktop.webp',
    canonicalBaseUrl: 'https://www.everhot.com.cn/',
    organizationName: 'Everhot 中国 Everhot China',
    organizationLogo: 'https://www.everhot.com.cn/assets/img/brand/everhot-logo.png',
    parentOrganizationName: 'Rhautt Comfort 瑞合瑞德暖通科技集团',
    parentOrganizationUrl: 'https://rhautt.com',
    sameAs: 'https://rhautt.com',
    sitemapUrl: 'https://www.everhot.com.cn/sitemap.xml',
  },
  analytics: {
    analyticsEndpoint: '',
    analyticsConsentEnabled: true,
    cookieConsentText: '本站使用 Cookie 与匿名统计以保障基本功能并改善体验。继续浏览即表示同意，您也可拒绝非必要统计。详见隐私政策。',
    cookieDenyText: '拒绝非必要',
    cookieAcceptText: '同意',
  },
};

function normalizeBasicSettingsPayload(value: unknown): BasicSettings {
  const payload = (value as any)?.data ?? value;
  return cloneBasicSettings(payload);
}

function sectionLabel(section: string) {
  return BASIC_INFO_FIELD_GROUPS.find((group) => group.section === section)?.title || section;
}

const BASIC_INFO_IMAGE_FIELDS = new Set([
  'identity.logoUrl',
  'identity.whiteLogoUrl',
  'identity.favicon16Url',
  'identity.favicon32Url',
  'identity.faviconIcoUrl',
  'identity.appleTouchIconUrl',
  'seo.defaultOgImage',
  'seo.defaultTwitterImage',
  'seo.organizationLogo',
]);

function isBasicInfoImageField(section: string, key: string) {
  return BASIC_INFO_IMAGE_FIELDS.has(`${section}.${key}`);
}

function basicInfoImagePreviewSrc(siteCode: string, value: unknown) {
  const src = String(value || '').trim();
  if (!src) return '';
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (src.startsWith('/api/')) return src;
  return `${SITE_MATERIALS_API}/api/v2/site-materials/${encodeURIComponent(siteCode || 'everhot')}?asset=${encodeURIComponent(src)}`;
}

function basicInfoImagePurpose(fieldKey: string) {
  if (fieldKey === 'seo.defaultOgImage') {
    return {
      title: '分享卡片封面',
      detail: '用于微信、企业微信、飞书、浏览器收藏和搜索引擎抓取官网链接时的 og:image 预览图。',
      recommended: '建议 1200 x 630 px 或同等 1.91:1 横图。',
    };
  }
  if (fieldKey === 'seo.defaultTwitterImage') {
    return {
      title: 'Twitter/X 分享封面',
      detail: '用于 Twitter/X 等平台分享官网链接时的 twitter:image 卡片图；国内低频，但国际传播需要保留。',
      recommended: '建议 1200 x 630 px。',
    };
  }
  if (fieldKey === 'seo.organizationLogo') {
    return {
      title: '搜索引擎品牌 Logo',
      detail: '用于 Organization 结构化数据，帮助搜索引擎识别官网主体和品牌标识，不一定直接显示在页面正文。',
      recommended: '建议透明背景 PNG，方形或横版均可，但要清晰可读。',
    };
  }
  return null;
}

function BasicInfoImagePreview({
  fieldKey,
  label,
  siteName,
  src,
  value,
  dark,
}: {
  fieldKey: string;
  label: string;
  siteName: string;
  src: string;
  value: string;
  dark?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const purpose = basicInfoImagePurpose(fieldKey);
  const showShareCard = fieldKey === 'seo.defaultOgImage' || fieldKey === 'seo.defaultTwitterImage';

  useEffect(() => {
    setFailed(false);
    setCopied(false);
  }, [src]);

  async function copyUrl() {
    if (!value || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <>
      <div className={`site-basic-image-preview ${dark ? 'is-dark' : ''}${failed ? ' is-error' : ''}`}>
        {src && !failed ? (
          <img src={src} alt={`${label}预览`} onError={() => setFailed(true)} />
        ) : (
          <span>{src ? '图片无法访问' : '暂无图片'}</span>
        )}
      </div>
      {purpose ? (
        <div className="site-basic-image-purpose">
          <strong>{purpose.title}</strong>
          <p>{purpose.detail}</p>
          <small>{purpose.recommended}</small>
        </div>
      ) : null}
      {showShareCard ? (
        <div className="site-basic-share-preview" aria-label={`${label}分享卡片效果预览`}>
          <div className={`site-basic-share-thumb${failed || !src ? ' is-empty' : ''}`}>
            {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : <span>分享图预览</span>}
          </div>
          <div>
            <strong>{siteName || 'Everhot 中国 Everhot China'}</strong>
            <p>官网链接被分享时，外部平台通常会用这张图作为卡片封面。</p>
            <small>www.everhot.com.cn</small>
          </div>
        </div>
      ) : null}
      {value ? (
        <div className="site-basic-image-actions">
          <a className="btn btn-outline btn-sm" href={src || value} target="_blank" rel="noreferrer">
            <ExternalLink size={13} />
            打开原图
          </a>
          <button type="button" className="btn btn-outline btn-sm" onClick={copyUrl}>
            {copied ? '已复制' : '复制链接'}
          </button>
        </div>
      ) : null}
    </>
  );
}
function uploadedArtifactContentUrl(artifact: any) {
  const id = String(artifact?.id || artifact?.artifactId || '').trim();
  return (
    String(artifact?.contentUrl || artifact?.url || '').trim() ||
    (id ? `/api/v2/file-artifact/${encodeURIComponent(id)}/content` : '')
  );
}

const BASIC_INFO_USAGE: Record<string, string> = {
  'identity.siteTitle': '首页 title / 浏览器标题',
  'identity.siteName': '页头品牌识别、结构化数据站点名',
  'identity.brandNameCn': '页头、页脚、品牌文案中文名',
  'identity.brandNameEn': '页头、页脚、品牌文案英文名',
  'identity.logoUrl': '页头导航 Logo',
  'identity.whiteLogoUrl': '页脚/深色区域 Logo',
  'identity.favicon16Url': 'favicon 16x16',
  'identity.favicon32Url': 'favicon 32x32',
  'identity.faviconIcoUrl': 'favicon.ico',
  'identity.appleTouchIconUrl': 'Apple touch icon',
  'identity.siteUrl': '官网 canonical/结构化数据域名',
  'identity.localeLabel': '页头地区/语言显示',
  'brandClaims.heroEyebrow': '首页首屏顶部说明',
  'brandClaims.heroTitleLine1': '首页首屏主标题第一行',
  'brandClaims.heroTitleLine2': '首页首屏主标题第二行',
  'brandClaims.heroSloganEn': '首页首屏英文口号',
  'brandClaims.heroClaim': '首页首屏中文广告语',
  'brandClaims.ctaSlogan': '首页 CTA 区域口号',
  'stats.serviceProvinceCount': '查找经销商页/服务网络省市数量',
  'stats.serviceOutletCount': '查找经销商页/服务网络网点数量',
  'stats.serviceNetworkText': '查找经销商页服务网络说明',
  'organization.operatorGroupName': '页脚版权、隐私政策运营主体',
  'organization.operatorGroupNameEn': '结构化数据上级组织英文名',
  'organization.operatorGroupUrl': '页脚集团官网链接',
  'organization.parentBrandRelationText': '首页首屏/品牌关系说明',
  'organization.rheemUrl': '页脚 Rheem 品牌链接',
  'organization.ruudUrl': '页脚 Ruud 品牌链接',
  'organization.groupSiteUrl': '页脚集团链接',
  'contact.customerServiceHotline': '页头/页脚/联系页客服热线',
  'contact.customerServiceTelHref': '电话按钮 tel 链接',
  'contact.serviceHours': '联系页服务时间',
  'contact.businessEmail': '联系页商务合作邮箱',
  'contact.mediaEmail': '联系页媒体品牌邮箱',
  'contact.privacyEmail': '隐私政策联系邮箱',
  'contact.dealerJoinEmail': '经销商加盟邮箱',
  'contact.contactFormSuccessText': '联系表单提交成功提示',
  'contact.urgentRepairNote': '报修表单紧急提示',
  'dealerService.dealerLocatorButtonText': '导航/首页查找经销商入口按钮',
  'dealerService.dealerLocatorPageTitle': '查找经销商页 title',
  'dealerService.dealerLocatorDescription': '查找经销商页说明',
  'dealerService.dealerSearchPlaceholder': '查找经销商页搜索框占位',
  'dealerService.nearestDealerButtonText': '查找经销商页定位按钮',
  'dealerService.dealerJoinTitle': '经销商加盟入口标题',
  'dealerService.dealerJoinDescription': '经销商加盟入口说明',
  'dealerService.dealerJoinButtonText': '经销商加盟按钮文案',
  'dealerService.dealerJoinHref': '经销商加盟按钮链接',
  'legal.icpNumber': '页脚 ICP 备案号',
  'legal.icpUrl': '页脚 ICP 备案链接',
  'legal.copyrightText': '页脚版权完整文案',
  'legal.copyrightYear': '页脚版权年份',
  'legal.copyrightOwner': '页脚版权主体',
  'legal.trademarkText': '页脚/隐私页商标声明',
  'privacy.privacyEffectiveDate': '隐私政策页生效日期',
  'privacy.privacyLastUpdatedDate': '隐私政策页最近更新日期',
  'privacy.privacyVersion': '隐私政策页版本号',
  'privacy.legalOperatorName': '隐私政策页运营主体',
  'privacy.registeredAddress': '隐私政策页注册地址',
  'privacy.privacyContactEmail': '隐私政策页联系邮箱',
  'privacy.privacyContactHotline': '隐私政策页联系热线',
  'seo.homeMetaTitle': '首页 meta title',
  'seo.homeMetaDescription': '首页 meta description',
  'seo.homeMetaKeywords': '首页 meta keywords',
  'seo.ogSiteName': '首页 og:site_name',
  'seo.defaultOgImage': '首页 og:image',
  'seo.defaultTwitterImage': '首页 twitter:image',
  'seo.canonicalBaseUrl': '首页 canonical',
  'seo.organizationName': '首页 Organization 结构化数据 name',
  'seo.organizationLogo': '首页 Organization 结构化数据 logo',
  'seo.parentOrganizationName': '首页 Organization 结构化数据 parentOrganization.name',
  'seo.parentOrganizationUrl': '首页 Organization 结构化数据 parentOrganization.url',
  'seo.sameAs': '首页 Organization 结构化数据 sameAs',
  'seo.sitemapUrl': 'robots.txt / sitemap.xml 地址',
  'analytics.analyticsEndpoint': 'js/analytics.js 上报端点',
  'analytics.cookieConsentText': 'Cookie 同意横幅文案',
  'analytics.cookieDenyText': 'Cookie 拒绝按钮',
  'analytics.cookieAcceptText': 'Cookie 同意按钮',
  'analytics.analyticsConsentEnabled': 'Cookie/匿名统计开关',
};

function SiteBasicInfoPanel({ siteCode, canWrite }: { siteCode: string; canWrite: boolean }) {
  const [settings, setSettings] = useState<BasicSettings | null>(null);
  const [draft, setDraft] = useState<BasicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSection, setSavingSection] = useState('');
  const [uploadingField, setUploadingField] = useState('');
  const [activeBasicSection, setActiveBasicSection] = useState(BASIC_INFO_FIELD_GROUPS[0]?.section || '');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const loadSettings = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setFeedback(null);
    siteBasicSettings.get(siteCode)
      .then((result) => {
        if (cancelled) return;
        const next = normalizeBasicSettingsPayload(result);
        setSettings(next);
        setDraft(next);
      })
      .catch((e) => {
        if (!cancelled) {
          const fallback = cloneBasicSettings(EVERHOT_BASIC_INFO_CURRENT);
          setSettings(fallback);
          setDraft(fallback);
          setFeedback({
            tone: 'error',
            text: `${(e as Error).message || '基本信息接口暂不可用'}，已回显当前恒热官网前端内容。`,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [siteCode]);

  useEffect(() => loadSettings(), [loadSettings]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const sectionIds = [
      ...BASIC_INFO_FIELD_GROUPS.map((group) => group.section),
      ...BASIC_INFO_TABLES.map((table) => `${table.section}-${table.key}`),
      'contact-cards',
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.id.replace(/^site-basic-/, '');
        if (id) setActiveBasicSection(id);
      },
      { rootMargin: '-96px 0px -62% 0px', threshold: [0.05, 0.2, 0.4] }
    );
    sectionIds.forEach((section) => {
      const element = document.getElementById(`site-basic-${section}`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [draft]);

  function setField(section: string, key: string, value: string | boolean) {
    setDraft((current) => ({ ...(current || {}), [section]: { ...((current || {})[section] || {}), [key]: value } }));
  }

  function resetFieldGroupToCurrentDefault(group: (typeof BASIC_INFO_FIELD_GROUPS)[number]) {
    const defaultSection = cloneBasicSettings(EVERHOT_BASIC_INFO_CURRENT)[group.section] || {};
    const resetKeys = new Set(group.fields.map((field) => field.key));
    if (group.section === 'analytics') resetKeys.add('analyticsConsentEnabled');
    setDraft((current) => {
      const base = current || {};
      const sectionData = base[group.section] || {};
      const nextSection = { ...sectionData };
      resetKeys.forEach((key) => {
        if (key in defaultSection) nextSection[key] = cloneBasicSettings(defaultSection)[key];
        else delete nextSection[key];
      });
      return { ...base, [group.section]: nextSection };
    });
    setFeedback({ tone: 'success', text: `${group.title}已恢复到当前官网重置状态，点击保存后生效。` });
  }

  function resetListToCurrentDefault(section: string, key: string, title: string) {
    const defaultSection = cloneBasicSettings(EVERHOT_BASIC_INFO_CURRENT)[section] || {};
    setDraft((current) => {
      const base = current || {};
      const sectionData = base[section] || {};
      return {
        ...base,
        [section]: {
          ...sectionData,
          [key]: cloneBasicSettings(defaultSection[key] || []),
        },
      };
    });
    setFeedback({ tone: 'success', text: `${title}已恢复到当前官网重置状态，点击保存后生效。` });
  }

  function scrollToBasicSection(section: string) {
    setActiveBasicSection(section);
    document.getElementById(`site-basic-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function uploadBasicImage(section: string, key: string, file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/') && !/\.ico$/i.test(file.name)) {
      setFeedback({ tone: 'error', text: '请上传图片文件。' });
      return;
    }
    const fieldKey = `${section}.${key}`;
    setUploadingField(fieldKey);
    setFeedback(null);
    try {
      const artifact = await fileArtifacts.uploadBase64({
        entityType: 'brand-site-basic-settings',
        entityId: `${siteCode}:${fieldKey}`,
        filename: file.name,
        mimeType: file.type || (/\.ico$/i.test(file.name) ? 'image/x-icon' : 'image/png'),
        dataBase64: await readBrowserFileBase64(file),
      });
      const contentUrl = uploadedArtifactContentUrl(artifact);
      if (!contentUrl) throw new Error('图片上传后未返回可访问地址。');
      setField(section, key, contentUrl);
      setFeedback({ tone: 'success', text: `${sectionLabel(section)}图片已上传，点击保存后生效。` });
    } catch (e) {
      setFeedback({ tone: 'error', text: (e as Error).message || '图片上传失败。' });
    } finally {
      setUploadingField('');
    }
  }

  function updateListItem(section: string, key: string, index: number, patch: Record<string, unknown>) {
    setDraft((current) => {
      const base = current || {};
      const sectionData = base[section] || {};
      const rows = Array.isArray(sectionData[key]) ? [...sectionData[key]] : [];
      rows[index] = { ...(rows[index] || {}), ...patch };
      return { ...base, [section]: { ...sectionData, [key]: rows } };
    });
  }

  function addListItem(section: string, key: string, shape: Record<string, unknown>) {
    setDraft((current) => {
      const base = current || {};
      const sectionData = base[section] || {};
      const rows = Array.isArray(sectionData[key]) ? [...sectionData[key]] : [];
      return { ...base, [section]: { ...sectionData, [key]: [...rows, { ...shape, sortOrder: rows.length, visible: true }] } };
    });
  }

  function removeListItem(section: string, key: string, index: number) {
    setDraft((current) => {
      const base = current || {};
      const sectionData = base[section] || {};
      const rows = Array.isArray(sectionData[key]) ? [...sectionData[key]] : [];
      rows.splice(index, 1);
      return { ...base, [section]: { ...sectionData, [key]: rows.map((item, sortOrder) => ({ ...item, sortOrder })) } };
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await siteBasicSettings.update(siteCode, draft);
      const next = normalizeBasicSettingsPayload(saved);
      setSettings(next);
      setDraft(next);
      setFeedback({ tone: 'success', text: '基本信息已保存。' });
    } catch (e) {
      setFeedback({ tone: 'error', text: (e as Error).message || '基本信息保存失败。' });
    } finally {
      setSaving(false);
    }
  }

  async function saveSection(section: string) {
    if (!draft) return;
    setSavingSection(section);
    setFeedback(null);
    try {
      const saved = await siteBasicSettings.updateSection(siteCode, section, draft[section] || {});
      const savedSection = normalizeBasicSettingsPayload(saved)[section] || draft[section] || {};
      const next = {
        ...(settings || draft || {}),
        [section]: savedSection,
        updatedAt: (saved as any)?.updatedAt || (settings as any)?.updatedAt || null,
      } as BasicSettings;
      setSettings(next);
      setDraft(next);
      setFeedback({ tone: 'success', text: `${sectionLabel(section)}已保存。` });
    } catch (e) {
      setFeedback({ tone: 'error', text: (e as Error).message || `${sectionLabel(section)}保存失败。` });
    } finally {
      setSavingSection('');
    }
  }

  if (loading && !draft) {
    return (
      <div className="brand-product-empty">
        <WorkbenchTableState type="loading" title="正在加载基本信息" description="正在读取恒热官网当前基础配置。" />
      </div>
    );
  }

  const current = draft || settings || {};
  const busy = saving || Boolean(savingSection) || Boolean(uploadingField);
  return (
    <div className="site-basic-panel" aria-label="恒热官网基本信息">
      <div className="site-material-panel-head">
        <div>
          <p className="t-label">基本信息</p>
          <h3>恒热官网基础配置</h3>
          <p>只维护当前恒热官网实际使用的站点身份、品牌主张、联系信息、备案版权和默认 SEO。</p>
        </div>
        <div className="site-material-transfer-actions">
          {feedback && <span className={`row-feedback ${feedback.tone}`}>{feedback.text}</span>}
          <button type="button" className="btn btn-outline btn-sm" onClick={loadSettings} disabled={loading || busy}>
            <RefreshCw size={13} />
            刷新
          </button>
          {canWrite ? (
            <button type="button" className="btn btn-brand btn-sm" onClick={save} disabled={busy || !draft}>
              <Save size={13} />
              {saving ? '保存中' : '保存基本信息'}
            </button>
          ) : <span className="badge badge-grey">只读查看</span>}
        </div>
      </div>

      <nav className="site-basic-jump-nav" aria-label="基本信息快捷跳转">
        {BASIC_INFO_FIELD_GROUPS.map((group) => (
          <button
            type="button"
            className={`btn btn-outline btn-sm${activeBasicSection === group.section ? ' is-active' : ''}`}
            key={`jump-${group.section}`}
            aria-pressed={activeBasicSection === group.section}
            onClick={() => scrollToBasicSection(group.section)}
          >
            {group.title}
          </button>
        ))}
        {BASIC_INFO_TABLES.map((table) => (
          <button
            type="button"
            className={`btn btn-outline btn-sm${activeBasicSection === `${table.section}-${table.key}` ? ' is-active' : ''}`}
            key={`jump-${table.section}-${table.key}`}
            aria-pressed={activeBasicSection === `${table.section}-${table.key}`}
            onClick={() => scrollToBasicSection(`${table.section}-${table.key}`)}
          >
            {table.title}
          </button>
        ))}
        <button
          type="button"
          className={`btn btn-outline btn-sm${activeBasicSection === 'contact-cards' ? ' is-active' : ''}`}
          aria-pressed={activeBasicSection === 'contact-cards'}
          onClick={() => scrollToBasicSection('contact-cards')}
        >
          联系页入口卡片
        </button>
      </nav>

      {BASIC_INFO_FIELD_GROUPS.map((group) => (
        <section className={`site-basic-section site-basic-section-${group.section}`} id={`site-basic-${group.section}`} key={group.section}>
          <div className="hero-carousel-head">
            <div><p className="t-label">{group.eyebrow}</p><h4>{group.title}</h4></div>
            {canWrite && (
              <div className="site-basic-section-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => resetFieldGroupToCurrentDefault(group)} disabled={busy || !draft}>
                  <RefreshCw size={13} />
                  恢复默认
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => saveSection(group.section)} disabled={busy || !draft}>
                  <Save size={13} />
                  {savingSection === group.section ? '保存中' : '保存设备'}
                </button>
              </div>
            )}
          </div>
          <div className="site-basic-grid">
            {group.fields.map((field) => {
              if (group.section === 'identity' && (field.key === 'siteUrl' || field.key === 'localeLabel')) return null;
              const value = String(current[group.section]?.[field.key] ?? '');
              const fieldKey = `${group.section}.${field.key}`;
              const isImageField = isBasicInfoImageField(group.section, field.key);
              const previewSrc = isImageField ? basicInfoImagePreviewSrc(siteCode, value) : '';
              const siteName = String(current.identity?.siteName || current.seo?.ogSiteName || current.seo?.organizationName || '');
              const fieldWide = group.section === 'identity' ? false : field.span;
              return (
                <div className={`${fieldWide ? 'site-basic-field wide' : 'site-basic-field'}${isImageField ? ' image-field' : ''}`} key={`${group.section}-${field.key}`}>
                  <span>{field.label}</span>
                  {BASIC_INFO_USAGE[fieldKey] ? (
                    <em>官网位置：{BASIC_INFO_USAGE[fieldKey]}</em>
                  ) : null}
                  {isImageField ? (
                    <div className="site-basic-image-control">
                      <div className="site-basic-image-stack">
                        <BasicInfoImagePreview
                          fieldKey={fieldKey}
                          label={field.label}
                          siteName={siteName}
                          src={previewSrc}
                          value={value}
                          dark={field.key === 'whiteLogoUrl'}
                        />
                      </div>
                      <div className="site-basic-image-meta">
                        <div>
                          <strong>{value ? '当前图片' : '未设置图片'}</strong>
                          {value ? <code title={value}>{value}</code> : null}
                        </div>
                        {canWrite ? (
                          <>
                            <input
                              id={`site-basic-image-${group.section}-${field.key}`}
                              className="sr-only-file"
                              type="file"
                              accept="image/*,.ico"
                              disabled={busy}
                              onChange={(event) => {
                                uploadBasicImage(group.section, field.key, event.target.files?.[0] || null);
                                event.currentTarget.value = '';
                              }}
                            />
                            <label
                              className="btn btn-outline btn-sm image-upload-label"
                              htmlFor={`site-basic-image-${group.section}-${field.key}`}
                            >
                              <Upload size={13} />
                              {uploadingField === fieldKey ? '上传中' : '上传图片'}
                            </label>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <input
                      className="input"
                      value={value}
                      disabled={!canWrite || busy}
                      onChange={(event) => setField(group.section, field.key, event.target.value)}
                    />
                  )}
                </div>
              );
            })}
            {group.section === 'analytics' && (
              <label className="site-basic-field">
                <span>启用匿名统计</span>
                <em>官网位置：{BASIC_INFO_USAGE['analytics.analyticsConsentEnabled']}</em>
                <select
                  className="input"
                  value={current.analytics?.analyticsConsentEnabled === false ? 'false' : 'true'}
                  disabled={!canWrite || busy}
                  onChange={(event) => setField('analytics', 'analyticsConsentEnabled', event.target.value === 'true')}
                >
                  <option value="true">启用</option>
                  <option value="false">关闭</option>
                </select>
              </label>
            )}
          </div>
        </section>
      ))}

      {BASIC_INFO_TABLES.map((table) => {
        const rows = Array.isArray(current[table.section]?.[table.key]) ? current[table.section][table.key] : [];
        return (
          <section className="hero-carousel-manager" id={`site-basic-${table.section}-${table.key}`} key={`${table.section}-${table.key}`}>
            <div className="hero-carousel-head">
              <div><p className="t-label">Table</p><h4>{table.title}</h4><span>官网位置：{table.source}</span></div>
              <div className="site-basic-section-actions">
                {canWrite && (
                  <>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => resetListToCurrentDefault(table.section, table.key, table.title)} disabled={busy || !draft}>
                      <RefreshCw size={13} />
                      恢复默认
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => addListItem(table.section, table.key, { value: '', label: '' })} disabled={busy}>
                      <Plus size={13} />
                      新增
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => saveSection(table.section)} disabled={busy || !draft}>
                      <Save size={13} />
                      {savingSection === table.section ? '保存中' : '保存设备'}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="hero-carousel-table-wrap">
              <table className="hero-carousel-table">
                <thead><tr><th>数值</th><th>标签</th><th>排序</th><th>官网显示</th><th>操作</th></tr></thead>
                <tbody>
                  {rows.length ? rows.map((row: Record<string, unknown>, index: number) => (
                    <tr key={`${table.key}-${index}`}>
                      <td><input className="input" value={String(row.value || '')} disabled={!canWrite || busy} onChange={(event) => updateListItem(table.section, table.key, index, { value: event.target.value })} /></td>
                      <td><input className="input" value={String(row.label || '')} disabled={!canWrite || busy} onChange={(event) => updateListItem(table.section, table.key, index, { label: event.target.value })} /></td>
                      <td><input className="input" type="number" value={String(row.sortOrder ?? index)} disabled={!canWrite || busy} onChange={(event) => updateListItem(table.section, table.key, index, { sortOrder: Number(event.target.value) || 0 })} /></td>
                      <td>
                        <button type="button" className={`badge hero-carousel-visible-toggle ${row.visible === false ? 'badge-grey' : 'badge-success'}`} disabled={!canWrite || busy} onClick={() => updateListItem(table.section, table.key, index, { visible: row.visible === false })}>
                          {row.visible === false ? '暂不显示' : '官网显示'}
                        </button>
                      </td>
                      <td><button type="button" className="btn btn-outline btn-sm btn-danger" disabled={!canWrite || busy} onClick={() => removeListItem(table.section, table.key, index)}><Trash2 size={13} />删除</button></td>
                    </tr>
                  )) : <tr><td colSpan={5} className="hero-carousel-empty">暂无数据</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section className="hero-carousel-manager" id="site-basic-contact-cards">
        <div className="hero-carousel-head">
          <div><p className="t-label">Contact</p><h4>联系页入口卡片</h4><span>官网位置：联系页入口卡片列表</span></div>
          <div className="site-basic-section-actions">
            {canWrite && (
              <>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => resetListToCurrentDefault('contact', 'contactCards', '联系页入口卡片')} disabled={busy || !draft}>
                  <RefreshCw size={13} />
                  恢复默认
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => addListItem('contact', 'contactCards', { tag: '', title: '', body: '', linkText: '', href: '' })} disabled={busy}>
                  <Plus size={13} />
                  新增
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => saveSection('contact')} disabled={busy || !draft}>
                  <Save size={13} />
                  {savingSection === 'contact' ? '保存中' : '保存设备'}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="hero-carousel-table-wrap site-audience-table-wrap">
          <table className="hero-carousel-table site-basic-contact-table">
            <thead><tr><th>类型</th><th>标题</th><th>说明</th><th>链接文案</th><th>链接</th><th>显示</th><th>操作</th></tr></thead>
            <tbody>
              {(Array.isArray(current.contact?.contactCards) ? current.contact.contactCards : []).length ? (
                (Array.isArray(current.contact?.contactCards) ? current.contact.contactCards : []).map((row: Record<string, unknown>, index: number) => (
                <tr key={`contact-card-${index}`}>
                  {['tag', 'title', 'body', 'linkText', 'href'].map((key) => (
                    <td key={key}>
                      <input className="input" value={String(row[key] || '')} disabled={!canWrite || busy} onChange={(event) => updateListItem('contact', 'contactCards', index, { [key]: event.target.value })} />
                    </td>
                  ))}
                  <td>
                    <button type="button" className={`badge hero-carousel-visible-toggle ${row.visible === false ? 'badge-grey' : 'badge-success'}`} disabled={!canWrite || busy} onClick={() => updateListItem('contact', 'contactCards', index, { visible: row.visible === false })}>
                      {row.visible === false ? '暂不显示' : '官网显示'}
                    </button>
                  </td>
                  <td><button type="button" className="btn btn-outline btn-sm btn-danger" disabled={!canWrite || busy} onClick={() => removeListItem('contact', 'contactCards', index)}><Trash2 size={13} />删除</button></td>
                </tr>
                ))
              ) : <tr><td colSpan={7} className="hero-carousel-empty">暂无联系入口</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SiteMaterialMockPanel({ brandCode }: { brandCode: string }) {
  const [uploadedMaterials, setUploadedMaterials] = useState<Record<string, SiteMaterialUpload>>({});
  const [heroCarousel, setHeroCarousel] = useState<HeroCarouselItem[]>([]);
  const [audienceCards, setAudienceCards] = useState<AudienceCardItem[]>(DEFAULT_AUDIENCE_CARDS);
  const [materialBusyKey, setMaterialBusyKey] = useState('');
  const [heroCarouselBusy, setHeroCarouselBusy] = useState(false);
  const [audienceCardsBusy, setAudienceCardsBusy] = useState(false);
  const [draggedHeroId, setDraggedHeroId] = useState('');
  const [previewHero, setPreviewHero] = useState<HeroCarouselItem | null>(null);
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
        const next: Record<string, SiteMaterialUpload> = {};
        for (const [key, value] of Object.entries(manifest as Record<string, any>)) {
          if (key === 'home-hero-carousel') continue;
          if (!value?.src) continue;
          next[key] = {
            name: String(value.filename || value.src),
            size: Number(value.size || 0),
            homepageSrc: String(value.src),
            synced: true,
          };
        }
        setUploadedMaterials(next);
        const carousel = Array.isArray((manifest as any)['home-hero-carousel'])
          ? ((manifest as any)['home-hero-carousel'] as any[])
          : [];
        setHeroCarousel(
          carousel
            .filter((item) => item?.src)
            .map((item, index) => ({
              id: String(item.id || `hero-${index}`),
              src: String(item.src),
              filename: String(item.filename || item.src),
              mimeType: String(item.mimeType || 'image/png'),
              size: Number(item.size || 0),
              updatedAt: String(item.updatedAt || ''),
              linkUrl: String(item.linkUrl || ''),
              remark: String(item.remark || ''),
              visible: item.visible !== false,
              sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
            }))
            .sort((a, b) => a.sortOrder - b.sortOrder)
        );
        setAudienceCards(normalizeAudienceCards((manifest as any)['home-audience-cards']));
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

  async function resetMaterialDefault(key: string) {
    setMaterialBusyKey(key);
    setMaterialFeedback((current) => ({ ...current, [key]: { tone: 'success', text: '正在恢复默认素材...' } }));
    try {
      const saved = await siteMaterials.resetDefault(brandCode, key);
      setUploadedMaterials((current) => {
        const previous = current[key];
        if (previous?.url) {
          URL.revokeObjectURL(previous.url);
          materialObjectUrls.current = materialObjectUrls.current.filter((item) => item !== previous.url);
        }
        return {
          ...current,
          [key]: {
            name: String((saved as any)?.filename || ''),
            size: Number((saved as any)?.size || 0),
            homepageSrc: String((saved as any)?.src || ''),
            synced: true,
          },
        };
      });
      setMaterialFeedback((current) => ({ ...current, [key]: { tone: 'success', text: '已恢复默认并同步首页' } }));
    } catch (e) {
      setMaterialFeedback((current) => ({
        ...current,
        [key]: { tone: 'error', text: (e as Error).message || '恢复默认失败' },
      }));
    } finally {
      setMaterialBusyKey('');
    }
  }

  async function uploadHeroCarousel(files: FileList | null) {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    if (selected.some((file) => !isAllowedJpgOrPng(file))) {
      setMaterialFeedback((current) => ({ ...current, 'home-hero-carousel': { tone: 'error', text: imageTypeErrorText() } }));
      return;
    }
    setHeroCarouselBusy(true);
    setMaterialFeedback((current) => ({
      ...current,
      'home-hero-carousel': { tone: 'success', text: `正在批量上传 ${selected.length} 张 Banner...` },
    }));
    try {
      const payload = await Promise.all(
        selected.map(async (file) => ({
          filename: file.name,
          mimeType: file.type || 'image/png',
          dataBase64: await readBrowserFileBase64(file),
        }))
      );
      const saved = await siteMaterials.uploadCarousel(brandCode, payload);
      setHeroCarousel(Array.isArray(saved) ? (saved as HeroCarouselItem[]) : []);
      setMaterialFeedback((current) => ({
        ...current,
        'home-hero-carousel': { tone: 'success', text: '轮播图已同步到官网首页' },
      }));
    } catch (e) {
      setMaterialFeedback((current) => ({
        ...current,
        'home-hero-carousel': { tone: 'error', text: (e as Error).message || '轮播图上传失败' },
      }));
    } finally {
      setHeroCarouselBusy(false);
    }
  }

  async function persistHeroCarousel(items: HeroCarouselItem[], message = '轮播图设置已保存') {
    setHeroCarouselBusy(true);
    const normalized = items.map((item, index) => ({ ...item, sortOrder: index }));
    try {
      const saved = await siteMaterials.saveCarousel(brandCode, normalized);
      setHeroCarousel(Array.isArray(saved) ? (saved as HeroCarouselItem[]) : normalized);
      setMaterialFeedback((current) => ({ ...current, 'home-hero-carousel': { tone: 'success', text: message } }));
    } catch (e) {
      setMaterialFeedback((current) => ({
        ...current,
        'home-hero-carousel': { tone: 'error', text: (e as Error).message || '轮播图设置保存失败' },
      }));
    } finally {
      setHeroCarouselBusy(false);
    }
  }

  function moveHeroCarouselItem(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const sourceIndex = heroCarousel.findIndex((item) => item.id === sourceId);
    const targetIndex = heroCarousel.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...heroCarousel];
    const [source] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, source);
    setHeroCarousel(next.map((item, index) => ({ ...item, sortOrder: index })));
    persistHeroCarousel(next, '轮播图排序已保存');
  }

  function updateHeroCarouselLink(id: string, linkUrl: string) {
    setHeroCarousel((current) => current.map((item) => (item.id === id ? { ...item, linkUrl } : item)));
  }

  function updateHeroCarouselRemark(id: string, remark: string) {
    setHeroCarousel((current) => current.map((item) => (item.id === id ? { ...item, remark } : item)));
  }

  function toggleHeroCarouselVisible(id: string) {
    const next = heroCarousel.map((item) => (item.id === id ? { ...item, visible: item.visible === false } : item));
    setHeroCarousel(next);
    persistHeroCarousel(next, '\u5b98\u7f51\u663e\u793a\u72b6\u6001\u5df2\u4fdd\u5b58');
  }

  function deleteHeroCarouselItem(id: string) {
    const next = heroCarousel.filter((item) => item.id !== id).map((item, index) => ({ ...item, sortOrder: index }));
    setHeroCarousel(next);
    persistHeroCarousel(next, '轮播图已移除');
  }

  function updateAudienceCard(id: AudienceCardItem['id'], patch: Partial<AudienceCardItem>) {
    setAudienceCards((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function persistAudienceCards(message = '首页入口卡片已保存') {
    setAudienceCardsBusy(true);
    const normalized = audienceCards.map((item, index) => ({ ...item, sortOrder: index }));
    try {
      const saved = await siteMaterials.saveModule(brandCode, 'home-audience-cards', normalized);
      setAudienceCards(normalizeAudienceCards(Array.isArray(saved) ? saved : normalized));
      setMaterialFeedback((current) => ({ ...current, 'home-audience-cards': { tone: 'success', text: message } }));
    } catch (e) {
      setMaterialFeedback((current) => ({
        ...current,
        'home-audience-cards': { tone: 'error', text: (e as Error).message || '首页入口卡片保存失败' },
      }));
    } finally {
      setAudienceCardsBusy(false);
    }
  }

  return (
    <div className="site-material-panel" aria-label="首页模块管理">
      <div className="site-material-panel-head">
        <div>
          <p className="t-label">首页模块</p>
          <h3>官网首页模块</h3>
          <p>维护 Everhot 官网首页轮播图、受众入口卡片和图文素材；内容保存到现有首页 manifest，不新增数据库表。</p>
        </div>
        <span className="pill-neutral">本地首页同步</span>
      </div>
      <section className="hero-carousel-manager" aria-label="\u9996\u9875\u8f6e\u64ad\u56fe\u7ba1\u7406">
        <div className="hero-carousel-head">
          <div>
            <p className="t-label">Banner</p>
            <h4>{'\u8f6e\u64ad\u56fe\u7ba1\u7406'}</h4>
            <span>{'Banner \u56fe\u7247\u6279\u91cf\u4e0a\u4f20\u3001\u62d6\u62fd\u6392\u5e8f\u53ca\u94fe\u63a5\u8df3\u8f6c\u8bbe\u7f6e\uff0c\u4e30\u5bcc\u9996\u9875\u89c6\u89c9\u3002'}</span>
          </div>
          <div className="site-material-transfer-actions">
            <input
              id="site-material-upload-home-hero-carousel"
              className="sr-only-file"
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              multiple
              disabled={heroCarouselBusy}
              data-testid="site-material-input-home-hero-carousel"
              onChange={(event) => {
                uploadHeroCarousel(event.target.files);
                event.currentTarget.value = '';
              }}
            />
            <label className="btn btn-outline btn-sm image-upload-label" htmlFor="site-material-upload-home-hero-carousel">
              <Upload size={13} />
              {heroCarouselBusy ? '\u540c\u6b65\u4e2d' : '\u6279\u91cf\u4e0a\u4f20'}
            </label>
            <button type="button" className="btn btn-outline btn-sm" disabled={heroCarouselBusy} onClick={() => persistHeroCarousel(heroCarousel)}>
              <Save size={13} />
              {'\u4fdd\u5b58\u8bbe\u7f6e'}
            </button>
          </div>
        </div>
        {materialFeedback['home-hero-carousel'] && (
          <span className={`row-feedback ${materialFeedback['home-hero-carousel'].tone}`}>
            {materialFeedback['home-hero-carousel'].text}
          </span>
        )}
        {heroCarousel.length ? (
          <div className="hero-carousel-table-wrap">
            <table className="hero-carousel-table">
              <thead>
                <tr>
                  <th>{'\u62d6\u62fd'}</th>
                  <th>{'\u56fe\u7247'}</th>
                  <th>{'\u6392\u5e8f'}</th>
                  <th>{'\u8df3\u8f6c\u94fe\u63a5'}</th>
                  <th>{'\u5907\u6ce8'}</th>
                  <th>{'\u5b98\u7f51\u663e\u793a'}</th>
                  <th>{'\u64cd\u4f5c'}</th>
                </tr>
              </thead>
              <tbody>
                {heroCarousel.map((item, index) => (
                  <tr
                    className={draggedHeroId === item.id ? 'is-dragging' : ''}
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggedHeroId(item.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      moveHeroCarouselItem(draggedHeroId, item.id);
                      setDraggedHeroId('');
                    }}
                    onDragEnd={() => setDraggedHeroId('')}
                  >
                    <td>
                      <span className="hero-carousel-drag">
                        <Rows3 size={14} />
                        #{index + 1}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="hero-carousel-thumb-button"
                        onClick={() => setPreviewHero(item)}
                        title={'\u70b9\u51fb\u653e\u5927\u67e5\u770b'}
                      >
                        <img className="hero-carousel-thumb" src={siteMaterialPreviewSrc(brandCode, item.src)} alt="" />
                      </button>
                    </td>
                    <td>
                      <span className="hero-carousel-order-text">#{index + 1}</span>
                    </td>
                    <td>
                      <div className="hero-carousel-link-control">
                        <Link size={14} />
                        <input
                          id={`hero-carousel-link-${item.id}`}
                          value={item.linkUrl || ''}
                          placeholder="/products/residential/ \u6216 https://..."
                          onChange={(event) => updateHeroCarouselLink(item.id, event.target.value)}
                          onBlur={(event) => {
                            const next = heroCarousel.map((row) =>
                              row.id === item.id ? { ...row, linkUrl: event.currentTarget.value } : row
                            );
                            persistHeroCarousel(next, '\u8f6e\u64ad\u56fe\u94fe\u63a5\u5df2\u4fdd\u5b58');
                          }}
                        />
                      </div>
                    </td>
                    <td>
                      <input
                        className="hero-carousel-remark"
                        value={item.remark || ''}
                        maxLength={200}
                        placeholder={'\u4f8b\uff1a\u9996\u9875\u6d3b\u52a8\u56fe'}
                        onChange={(event) => updateHeroCarouselRemark(item.id, event.target.value)}
                        onBlur={(event) => {
                          const next = heroCarousel.map((row) =>
                            row.id === item.id ? { ...row, remark: event.currentTarget.value } : row
                          );
                          persistHeroCarousel(next, '\u5907\u6ce8\u5df2\u4fdd\u5b58');
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`badge hero-carousel-visible-toggle ${item.visible === false ? 'badge-grey' : 'badge-success'}`}
                        disabled={heroCarouselBusy}
                        onClick={() => toggleHeroCarouselVisible(item.id)}
                      >
                        {item.visible === false ? '\u6682\u4e0d\u663e\u793a' : '\u5b98\u7f51\u663e\u793a'}
                      </button>
                    </td>
                    <td>
                      <div className="hero-carousel-link-actions">
                        <a
                          className="btn btn-outline btn-sm"
                          href={item.linkUrl || '#'}
                          target={item.linkUrl && /^https?:\/\//i.test(item.linkUrl) ? '_blank' : undefined}
                          rel={item.linkUrl && /^https?:\/\//i.test(item.linkUrl) ? 'noopener noreferrer' : undefined}
                          aria-disabled={!item.linkUrl}
                          onClick={(event) => {
                            if (!item.linkUrl) event.preventDefault();
                          }}
                        >
                          <ExternalLink size={13} />
                          {'\u6253\u5f00'}
                        </a>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm btn-danger"
                          disabled={heroCarouselBusy}
                          onClick={() => deleteHeroCarouselItem(item.id)}
                        >
                          <Trash2 size={13} />
                          {'\u5220\u9664'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="hero-carousel-empty">{'\u5c1a\u672a\u4e0a\u4f20\u8f6e\u64ad\u56fe\uff0c\u4e0a\u4f20\u540e\u4f1a\u4f18\u5148\u66ff\u6362\u9996\u9875 Hero \u4e3b\u89c6\u89c9\u3002'}</div>
        )}
        <div className="hero-carousel-strip" hidden>
          {heroCarousel.length ? (
            heroCarousel.map((item, index) => (
              <article
                className={`hero-carousel-card${draggedHeroId === item.id ? ' is-dragging' : ''}`}
                key={item.id}
                draggable
                onDragStart={() => setDraggedHeroId(item.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  moveHeroCarouselItem(draggedHeroId, item.id);
                  setDraggedHeroId('');
                }}
                onDragEnd={() => setDraggedHeroId('')}
              >
                <div className="hero-carousel-preview">
                  <img src={siteMaterialPreviewSrc(brandCode, item.src)} alt={item.filename || ''} />
                  <div className="hero-carousel-cardbar">
                    <span>#{index + 1}</span>
                    <span><Rows3 size={13} /> {'\u62d6\u62fd\u6392\u5e8f'}</span>
                    <button type="button" aria-label="\u79fb\u9664\u8f6e\u64ad\u56fe" onClick={() => deleteHeroCarouselItem(item.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="hero-carousel-cardbody">
                  <div className="hero-carousel-file" title={item.filename}>
                    {item.filename || item.src} · {Math.ceil(Number(item.size || 0) / 1024)} KB
                  </div>
                  <div className="hero-carousel-link-row">
                    <label htmlFor={`hero-carousel-link-${item.id}`}>链接地址</label>
                    <div className="hero-carousel-link-control">
                      <Link size={14} />
                      <input
                        id={`hero-carousel-link-${item.id}`}
                        value={item.linkUrl || ''}
                        placeholder="/products/residential/ 或 https://..."
                        onChange={(event) => updateHeroCarouselLink(item.id, event.target.value)}
                        onBlur={(event) => {
                          const next = heroCarousel.map((row) =>
                            row.id === item.id ? { ...row, linkUrl: event.currentTarget.value } : row
                          );
                          persistHeroCarousel(next, '\u8f6e\u64ad\u56fe\u94fe\u63a5\u5df2\u4fdd\u5b58');
                        }}
                      />
                    </div>
                  </div>
                  <div className="hero-carousel-link-actions">
                    <a
                      className="btn btn-outline btn-sm"
                      href={item.linkUrl || '#'}
                      target={item.linkUrl && /^https?:\/\//i.test(item.linkUrl) ? '_blank' : undefined}
                      rel={item.linkUrl && /^https?:\/\//i.test(item.linkUrl) ? 'noopener noreferrer' : undefined}
                      aria-disabled={!item.linkUrl}
                      onClick={(event) => {
                        if (!item.linkUrl) event.preventDefault();
                      }}
                    >
                      <ExternalLink size={13} />
                      打开链接
                    </a>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={heroCarouselBusy}
                      onClick={() => persistHeroCarousel(heroCarousel, '\u8f6e\u64ad\u56fe\u94fe\u63a5\u5df2\u4fdd\u5b58')}
                    >
                      <Save size={13} />
                      保存
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="hero-carousel-empty">{'\u5c1a\u672a\u4e0a\u4f20\u8f6e\u64ad\u56fe\uff0c\u4e0a\u4f20\u540e\u4f1a\u4f18\u5148\u66ff\u6362\u9996\u9875 Hero \u4e3b\u89c6\u89c9\u3002'}</div>
          )}
        </div>
        {previewHero && (
          <div className="hero-carousel-preview-backdrop" role="dialog" aria-modal="true" onClick={() => setPreviewHero(null)}>
            <div className="hero-carousel-preview-modal" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="hero-carousel-preview-close" onClick={() => setPreviewHero(null)} aria-label="Close">
                <X size={15} />
              </button>
              <img src={siteMaterialPreviewSrc(brandCode, previewHero.src)} alt="" />
              {previewHero.remark ? <span>{previewHero.remark}</span> : null}
            </div>
          </div>
        )}
      </section>
      <section className="hero-carousel-manager" aria-label="首页入口卡片管理">
        <div className="hero-carousel-head">
          <div>
            <p className="t-label">Audience Entries</p>
            <h4>首页入口卡片</h4>
            <span>维护首页家用、商用、专业人士三张导流卡片的标签、标题、说明、按钮文案和跳转链接。</span>
          </div>
          <div className="site-material-transfer-actions">
            {materialFeedback['home-audience-cards'] && (
              <span className={`row-feedback ${materialFeedback['home-audience-cards'].tone}`}>
                {materialFeedback['home-audience-cards'].text}
              </span>
            )}
            <button type="button" className="btn btn-outline btn-sm" disabled={audienceCardsBusy} onClick={() => setAudienceCards(DEFAULT_AUDIENCE_CARDS)}>
              <RefreshCw size={13} />
              恢复默认
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={audienceCardsBusy} onClick={() => persistAudienceCards()}>
              <Save size={13} />
              {audienceCardsBusy ? '保存中' : '保存设置'}
            </button>
          </div>
        </div>
        <div className="hero-carousel-table-wrap">
          <table className="hero-carousel-table site-audience-table">
            <thead>
              <tr>
                <th>模块</th>
                <th>小标签</th>
                <th>标题</th>
                <th>说明文案</th>
                <th>按钮 1</th>
                <th>按钮 2</th>
                <th>显示</th>
              </tr>
            </thead>
            <tbody>
              {audienceCards.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="hero-carousel-drag">#{item.sortOrder + 1}</span>
                  </td>
                  <td>
                    <div className="site-audience-field-pair">
                      <input className="input" value={item.tagZh} maxLength={24} disabled={audienceCardsBusy} onChange={(event) => updateAudienceCard(item.id, { tagZh: event.target.value })} />
                      <input className="input" value={item.tagEn} maxLength={32} disabled={audienceCardsBusy} onChange={(event) => updateAudienceCard(item.id, { tagEn: event.target.value })} />
                    </div>
                  </td>
                  <td>
                    <input className="input" value={item.title} maxLength={80} disabled={audienceCardsBusy} onChange={(event) => updateAudienceCard(item.id, { title: event.target.value })} />
                  </td>
                  <td>
                    <textarea className="input site-audience-textarea" value={item.description} maxLength={160} disabled={audienceCardsBusy} onChange={(event) => updateAudienceCard(item.id, { description: event.target.value })} />
                  </td>
                  <td>
                    <div className="site-audience-field-pair">
                      <input className="input" value={item.primaryLabel} maxLength={32} disabled={audienceCardsBusy} onChange={(event) => updateAudienceCard(item.id, { primaryLabel: event.target.value })} />
                      <input className="input" value={item.primaryHref} disabled={audienceCardsBusy} onChange={(event) => updateAudienceCard(item.id, { primaryHref: event.target.value })} />
                    </div>
                  </td>
                  <td>
                    <div className="site-audience-field-pair">
                      <input className="input" value={item.secondaryLabel} maxLength={32} disabled={audienceCardsBusy} onChange={(event) => updateAudienceCard(item.id, { secondaryLabel: event.target.value })} />
                      <input className="input" value={item.secondaryHref} disabled={audienceCardsBusy} onChange={(event) => updateAudienceCard(item.id, { secondaryHref: event.target.value })} />
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`badge hero-carousel-visible-toggle ${item.visible === false ? 'badge-grey' : 'badge-success'}`}
                      disabled={audienceCardsBusy}
                      onClick={() => updateAudienceCard(item.id, { visible: item.visible === false })}
                    >
                      {item.visible === false ? '暂不显示' : '官网显示'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={busy}
                    title="恢复为当前默认素材"
                    onClick={() => resetMaterialDefault(item.key)}
                  >
                    <RefreshCw size={13} />
                    恢复默认
                  </button>
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
  const { promptFloating, floatingDialog } = useFloatingDialog();
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

  async function addLink() {
    restoreSelection();
    const href = await promptFloating({
      title: '插入链接',
      message: '请输入链接地址',
      placeholder: 'https://',
      confirmLabel: '插入',
    });
    if (!href) return;
    const trimmedHref = href.trim();
    if (!trimmedHref) return;
    restoreSelection();
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

  async function editImageCaption() {
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
    const caption = await promptFloating({
      title: '图片图注',
      message: '请输入图片图注',
      defaultValue: current,
      confirmLabel: '保存',
    });
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
      {floatingDialog}
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
  const { confirmFloating, floatingDialog } = useFloatingDialog();
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
    const confirmed = await confirmFloating({
      title: '归档资讯',
      message: `确认归档「${article.title}」？归档后前台不再展示。`,
      confirmLabel: '归档',
      tone: 'danger',
    });
    if (!confirmed) return;
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
  const draftCoverImage = draft.coverImageArtifactId
    ? `/api/v2/file-artifact/${encodeURIComponent(draft.coverImageArtifactId)}/content`
    : draft.coverImageUrl
      ? siteNewsAssetUrl(draft.coverImageUrl, siteAssetBaseUrl)
      : '';
  const hasDraftCoverImage = Boolean(draft.coverImageArtifactId || draft.coverImageUrl);
  const coverInputId = `site-news-cover-${editingId || 'new'}`;

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
                  <div className="site-news-cover-asset">
                    <span className="t-label">上传封面</span>
                    <div className={`site-news-cover-preview${hasDraftCoverImage ? '' : ' is-empty'}`}>
                      {hasDraftCoverImage ? <img src={draftCoverImage} alt="" /> : <Image size={18} />}
                    </div>
                    <div className="site-news-cover-status">
                      <span className={hasDraftCoverImage ? 'pill-brand' : 'pill-neutral'}>
                        {hasDraftCoverImage ? '封面已就绪' : '缺少封面'}
                      </span>
                      <span>只能上传 JPG / PNG 图片 · 建议 1280 × 600px</span>
                    </div>
                    <div className="site-news-cover-actions">
                      <input
                        id={coverInputId}
                        className="sr-only-file"
                        type="file"
                        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                        onChange={(event) => {
                          uploadCover(event.target.files?.[0] || null);
                          event.currentTarget.value = '';
                        }}
                        disabled={uploading}
                      />
                      <label className={`btn btn-outline btn-sm image-upload-label${uploading ? ' is-disabled' : ''}`} htmlFor={coverInputId} title="上传或替换封面">
                        <Upload size={13} />
                        {uploading ? '上传中' : hasDraftCoverImage ? '替换' : '上传'}
                      </label>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm btn-danger"
                        disabled={uploading || !hasDraftCoverImage}
                        onClick={() => setDraft((current) => ({ ...current, coverImageArtifactId: '', coverImageUrl: '' }))}
                        title="删除封面"
                      >
                        <Trash2 size={13} />
                        删除
                      </button>
                    </div>
                  </div>
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
                      <img
                        className="site-news-preview-img"
                        src={draftPreviewImage}
                        alt=""
                      />
                      <div className="news-preview-body">
                        <strong>{draft.title || '资讯标题'}</strong>
                        <p>{draft.summary || '资讯摘要'}</p>
                        <div className="news-preview-meta">
                          <span>{draft.publishedAt ? draft.publishedAt.slice(0, 7) : '发布日期'}</span>
                          <span className="news-preview-link">了解更多 ›</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="site-news-preview-pane">
                    <span className="t-label">详情</span>
                    <div className="site-news-detail-preview">
                      <img className="site-news-detail-preview-img" src={draftPreviewImage} alt="" />
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
                        {article.isFeatured ? <span className="badge badge-info" style={{ marginLeft: 8 }}>精选</span> : null}
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
      {floatingDialog}
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

type SiteInquiryKind = 'customer' | 'dealer';
type SiteInquiryRow = {
  id: string;
  kind: SiteInquiryKind;
  name: string;
  phone: string;
  city: string;
  inquiryType: string;
  message: string;
  companyName: string;
  intendedRegion: string;
  businessSummary: string;
  submittedAt: string;
  createdAt: string;
};

function shortText(value: string, max = 80) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function formatSubmittedAt(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 19).replace('T', ' ');
  return date.toLocaleString('zh-CN', { hour12: false });
}

function formatExportFilenameTime(value = new Date()) {
  const pad = (input: number) => String(input).padStart(2, '0');
  return [
    value.getFullYear(),
    pad(value.getMonth() + 1),
    pad(value.getDate()),
    '_',
    pad(value.getHours()),
    pad(value.getMinutes()),
    pad(value.getSeconds()),
  ].join('');
}

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateValue(date: Date) {
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function sameDate(a: Date | null, b: Date | null) {
  return Boolean(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function SiteInquiryDatePicker({
  value,
  min,
  placeholder,
  label,
  onChange,
}: {
  value: string;
  min?: string;
  placeholder: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = parseDateValue(value);
  const minDate = parseDateValue(min || '');
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => selectedDate || today);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [
    ...Array.from({ length: leadingDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1)),
  ];
  while (days.length % 7 !== 0) days.push(null);

  useEffect(() => {
    if (open) setViewDate(selectedDate || today);
  }, [open, value]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div className="site-inquiry-date-picker" ref={rootRef}>
      <button
        type="button"
        className={`site-inquiry-date-input${value ? ' has-value' : ''}${open ? ' is-open' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-label={label}
        aria-expanded={open}
      >
        {value || placeholder}
      </button>
      {open && (
        <div className="site-inquiry-calendar" role="dialog" aria-label={label}>
          <div className="site-inquiry-calendar-head">
            <button type="button" className="site-inquiry-calendar-nav" onClick={() => setViewDate(addMonths(viewDate, -1))} aria-label="上个月">
              ‹
            </button>
            <strong>{year}年{month + 1}月</strong>
            <button type="button" className="site-inquiry-calendar-nav" onClick={() => setViewDate(addMonths(viewDate, 1))} aria-label="下个月">
              ›
            </button>
          </div>
          <div className="site-inquiry-calendar-grid site-inquiry-calendar-weekdays" aria-hidden="true">
            {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="site-inquiry-calendar-grid">
            {days.map((day, index) => {
              if (!day) return <span className="site-inquiry-calendar-empty" key={`empty-${index}`} />;
              const disabled = Boolean(minDate && day < minDate);
              const selected = sameDate(day, selectedDate);
              const current = sameDate(day, today);
              return (
                <button
                  type="button"
                  key={formatDateValue(day)}
                  className={`site-inquiry-calendar-day${selected ? ' is-selected' : ''}${current ? ' is-today' : ''}`}
                  disabled={disabled}
                  onClick={() => {
                    onChange(formatDateValue(day));
                    setOpen(false);
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="site-inquiry-calendar-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange('')}>清除</button>
            <button
              type="button"
              className="btn btn-brand btn-sm"
              onClick={() => {
                onChange(formatDateValue(today));
                setOpen(false);
              }}
            >
              今天
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SiteInquiryPanel({ siteCode, canWrite }: { siteCode: string; canWrite: boolean }) {
  const [kind, setKind] = useState<SiteInquiryKind>('customer');
  const [items, setItems] = useState<SiteInquiryRow[]>([]);
  const [keyword, setKeyword] = useState('');
  const [submittedFrom, setSubmittedFrom] = useState('');
  const [submittedTo, setSubmittedTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const { confirmFloating, floatingDialog } = useFloatingDialog();

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  const inquiryQuery = useCallback((nextPage: string, nextPageSize: string) => ({
    kind,
    page: nextPage,
    pageSize: nextPageSize,
    q: keyword,
    ...(submittedFrom ? { submittedFrom } : {}),
    ...(submittedTo ? { submittedTo } : {}),
  }), [kind, keyword, submittedFrom, submittedTo]);

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const result = await siteInquiries.list(siteCode, inquiryQuery(String(page), String(pageSize)));
      const data = (result as any)?.data || result || {};
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
    } catch (e) {
      setFeedback({ tone: 'error', text: (e as Error).message || '咨询数据加载失败。' });
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [inquiryQuery, page, pageSize, siteCode]);

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  async function deleteInquiry(row: SiteInquiryRow) {
    if (!canWrite) return;
    const confirmed = await confirmFloating({
      title: '删除咨询',
      message: '确认删除这条咨询记录？',
      confirmLabel: '删除',
      tone: 'danger',
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await siteInquiries.remove(siteCode, row.id);
      setFeedback({ tone: 'success', text: '咨询记录已删除。' });
      await loadInquiries();
    } catch (e) {
      setFeedback({ tone: 'error', text: (e as Error).message || '删除失败。' });
    } finally {
      setBusy(false);
    }
  }

  async function exportCurrent() {
    setBusy(true);
    let exportRows = items;
    try {
      const first = await siteInquiries.list(siteCode, inquiryQuery('1', '200'));
      const firstData = (first as any)?.data || first || {};
      exportRows = Array.isArray(firstData.items) ? firstData.items : [];
      const pages = Math.max(Number(firstData.pages || 1), 1);
      for (let nextPage = 2; nextPage <= pages; nextPage += 1) {
        const next = await siteInquiries.list(siteCode, inquiryQuery(String(nextPage), '200'));
        const nextData = (next as any)?.data || next || {};
        if (Array.isArray(nextData.items)) exportRows = [...exportRows, ...nextData.items];
      }
    } catch (e) {
      setFeedback({ tone: 'error', text: (e as Error).message || '导出失败。' });
      setBusy(false);
      return;
    }
    const headers = kind === 'customer'
      ? ['称呼', '电话', '城市', '咨询类型', '内容摘要', '提交时间']
      : ['联系人', '电话', '公司/门店', '意向区域', '主营业务摘要', '提交时间'];
    const rows = exportRows.map((row) => kind === 'customer'
      ? [row.name, row.phone, row.city, row.inquiryType, row.message, formatSubmittedAt(row.submittedAt || row.createdAt)]
      : [row.name, row.phone, row.companyName, row.intendedRegion, row.businessSummary, formatSubmittedAt(row.submittedAt || row.createdAt)]);
    try {
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      worksheet['!cols'] = kind === 'customer'
        ? [{ wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 42 }, { wch: 22 }]
        : [{ wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 42 }, { wch: 22 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, kind === 'customer' ? '客户咨询' : '加盟咨询');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const exportTitle = kind === 'customer' ? '客户咨询' : '加盟咨询';
      link.href = url;
      link.download = `${exportTitle}_${formatExportFilenameTime()}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setFeedback({ tone: 'error', text: (e as Error).message || '导出 Excel 失败。' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="site-news-panel site-inquiry-panel" aria-label="品牌官网咨询管理">
      <div className="site-material-panel-head">
        <div>
          <p className="t-label">咨询管理</p>
          <h3>官网咨询</h3>
          <p>统一查看官网客户咨询和加盟咨询；数据来自官网表单提交并保存到数据库。</p>
        </div>
        {loading && <span className="badge badge-info">加载中</span>}
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
            placeholder={kind === 'customer' ? '搜索称呼、电话、城市、类型或内容' : '搜索联系人、电话、公司、区域或主营业务'}
          />
        </div>
        <div className="site-inquiry-date-filter" aria-label="提交时间筛选">
          <span className="site-inquiry-date-filter-label">
            <Calendar size={14} />
            提交时间
          </span>
          <SiteInquiryDatePicker
            value={submittedFrom}
            placeholder="开始日期"
            label="开始日期"
            onChange={(nextValue) => {
              setSubmittedFrom(nextValue);
              if (submittedTo && nextValue && submittedTo < nextValue) setSubmittedTo(nextValue);
              setPage(1);
            }}
          />
          <span className="site-inquiry-date-filter-separator">至</span>
          <SiteInquiryDatePicker
            value={submittedTo}
            min={submittedFrom || undefined}
            placeholder="结束日期"
            label="结束日期"
            onChange={(nextValue) => {
              setSubmittedTo(nextValue);
              setPage(1);
            }}
          />
          {(submittedFrom || submittedTo) && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSubmittedFrom('');
                setSubmittedTo('');
                setPage(1);
              }}
            >
              清除
            </button>
          )}
        </div>
      </WorkbenchFilterToolbar>

      <div className="site-inquiry-toolbar">
        <div className="brand-content-switch" aria-label="咨询类型切换">
          <button
            type="button"
            className={kind === 'customer' ? 'is-active' : undefined}
            aria-pressed={kind === 'customer'}
            onClick={() => {
              setKind('customer');
              setPage(1);
            }}
          >
            客户咨询
          </button>
          <button
            type="button"
            className={kind === 'dealer' ? 'is-active' : undefined}
            aria-pressed={kind === 'dealer'}
            onClick={() => {
              setKind('dealer');
              setPage(1);
            }}
          >
            加盟咨询
          </button>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={exportCurrent} disabled={busy || !items.length}>
          <Download size={13} />
          导出
        </button>
      </div>

      {feedback && <div className={`brand-product-inline-feedback ${feedback.tone}`}>{feedback.text}</div>}

      <WorkbenchTableShell>
        <div className="brand-product-table-wrap">
          <table className="table brand-product-table site-inquiry-table">
            <thead>
              {kind === 'customer' ? (
                <tr>
                  <th>称呼</th>
                  <th>电话</th>
                  <th>城市</th>
                  <th>咨询类型</th>
                  <th>内容摘要</th>
                  <th>提交时间</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              ) : (
                <tr>
                  <th>联系人</th>
                  <th>电话</th>
                  <th>公司/门店</th>
                  <th>意向区域</th>
                  <th>主营业务摘要</th>
                  <th>提交时间</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              )}
            </thead>
            <tbody>
              {!loading && items.length ? (
                items.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.name || '-'}</strong></td>
                    <td><span className="mono-cell">{row.phone || '-'}</span></td>
                    {kind === 'customer' ? (
                      <>
                        <td>{row.city || '-'}</td>
                        <td>{row.inquiryType || '-'}</td>
                        <td title={row.message}>{shortText(row.message)}</td>
                      </>
                    ) : (
                      <>
                        <td>{row.companyName || '-'}</td>
                        <td>{row.intendedRegion || '-'}</td>
                        <td title={row.businessSummary}>{shortText(row.businessSummary)}</td>
                      </>
                    )}
                    <td>{formatSubmittedAt(row.submittedAt || row.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {canWrite ? (
                        <button type="button" className="btn btn-outline btn-sm btn-danger" onClick={() => deleteInquiry(row)} disabled={busy}>
                          <Trash2 size={13} />
                          删除
                        </button>
                      ) : (
                        <span className="muted-value">只读</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="brand-product-empty">
                    <WorkbenchTableState
                      type={loading ? 'loading' : 'empty'}
                      title={loading ? '正在加载咨询' : kind === 'customer' ? '暂无客户咨询' : '暂无加盟咨询'}
                      description={loading ? '正在从数据库读取当前品牌官网咨询。' : '官网表单提交后会显示在这里。'}
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
      {floatingDialog}
    </div>
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
    if (!officialDetailFlushRef.current) {
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
          <section className="product-edit-section product-edit-section-basic">
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
              <div className="product-edit-shelf-field">
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
              </div>
            </div>
          </section>

          <section className="product-edit-section product-edit-section-website">
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

          <section className="product-edit-section product-edit-section-assets">
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
          </section>

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

          <section className="product-edit-section product-edit-section-wide">
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
          </section>

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  function addFiles(files: FileList | null) {
    const selected = Array.from(files || []).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (!selected.length) return;
    onChange([
      ...manualPdfs,
      ...selected.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }

  return (
    <section className="product-edit-section product-edit-section-wide">
      <div className="product-edit-section-head">
        <h3>产品说明 PDF</h3>
        <span className="badge badge-grey">不限数量</span>
      </div>
      <label className="product-create-field">
        <span>上传 PDF</span>
        <div className="product-manual-pdf-upload-row">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            <Upload size={13} />
            选择文件
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={disabled}
            style={{ display: 'none' }}
            onChange={(event) => {
              addFiles(event.target.files);
              event.currentTarget.value = '';
            }}
          />
          <div className="product-manual-pdf-inline-list">
            {manualPdfs.length ? (
              manualPdfs.map((manual, index) => (
                <ProductManualPdfItem
                  key={manual.id}
                  manual={manual}
                  index={index}
                  disabled={disabled}
                  onRemove={() => {
                    URL.revokeObjectURL(manual.previewUrl);
                    onChange(manualPdfs.filter((item) => item.id !== manual.id));
                  }}
                />
              ))
            ) : (
              <span className="muted-value">未选择文件</span>
            )}
          </div>
        </div>
      </label>
    </section>
  );
}

function ProductManualPdfItem({
  manual,
  index,
  disabled,
  onRemove,
}: {
  manual: ProductManualPdfDraft;
  index: number;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="product-manual-pdf-chip">
      <strong>{index + 1}. {manual.name}</strong>
      <a className="btn btn-brand btn-sm" href={manual.previewUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={13} />
        预览
      </a>
      <button
        type="button"
        className="product-manual-pdf-remove"
        onClick={onRemove}
        disabled={disabled}
        title="移除"
        aria-label={`移除 ${manual.name}`}
      >
        <X size={11} />
      </button>
    </div>
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
