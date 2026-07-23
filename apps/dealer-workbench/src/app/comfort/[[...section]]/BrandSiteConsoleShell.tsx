'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Archive,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  Check,
  ExternalLink,
  EyeOff,
  Image,
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
import { PageHeader } from '@rhautt/ui';
import { auth, brandSites, siteProductAssignments } from '../../../lib/api';
import {
  archiveBrandProduct,
  blankNewProductDraft,
  canWriteBrandProducts,
  createBrandProduct,
  deleteBrandProductMainImage,
  draftFromProductRow,
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
  updateBrandProductStatus,
  type BrandStructuredContentDraft,
  type BrandProductEditDraft,
  type BrandProductConsoleData,
  type BrandProductRow,
  type BrandPublishCapability,
} from '../../../lib/brand-product-adapter';

type SiteStatus = 'active' | 'inactive';
type DeliveryType = 'self_hosted' | 'external';
type ContentTab = 'products' | 'materials';
type TaxonomyOption = { code: string; label: string };
type AssignmentStatus = 'draft' | 'published' | 'hidden';

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
  sortOrder: number;
  status: SiteStatus;
  siteNote: string | null;
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
};

const KNOWN_BRANDS: Record<string, Pick<BrandSite, 'code' | 'nameCn' | 'nameEn' | 'appKey' | 'sortOrder'>> = {
  rheem: { code: 'rheem', nameCn: '瑞美', nameEn: 'Rheem', appKey: 'rheem-cn', sortOrder: 10 },
  ruud: { code: 'ruud', nameCn: '瑞德', nameEn: 'Ruud', appKey: 'ruud-cn', sortOrder: 20 },
  everhot: { code: 'everhot', nameCn: '恒热', nameEn: 'Everhot', appKey: 'everhot-cn', sortOrder: 30 },
};

const PRODUCT_COLUMNS = [
  'SKU',
  '公开 Slug',
  '名称 / 型号',
  '分类',
  '系统',
  '菜单分类',
  '状态',
  '官网货架',
  '排序',
  '图片',
  '官网内容',
  '操作',
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
    name: '首页 Hero 主视觉',
    type: '图片 / 标题文案',
    location: '首页首屏',
    owner: '品牌运营',
    status: '模拟数据',
    note: '展示官网首页主图、标题和行动入口的占位流程。',
  },
  {
    key: 'brand-story',
    name: '品牌故事图文',
    type: '图文模块',
    location: '品牌介绍',
    owner: '市场内容',
    status: '模拟数据',
    note: '用于模拟品牌故事图片、段落摘要和官网落点。',
  },
  {
    key: 'service-banner',
    name: '服务入口 Banner',
    type: '图片 / 链接',
    location: '服务与支持',
    owner: '售后服务',
    status: '模拟数据',
    note: '用于模拟售后服务、保修注册和支持入口素材。',
  },
  {
    key: 'footer-cert',
    name: '页脚资质素材',
    type: '证书 / Logo',
    location: '全站页脚',
    owner: '合规运营',
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

function rowTenantId(row: BrandProductRow) {
  return String((row.raw as any)?.tenantId || (row.raw as any)?.tenant_id || '').trim();
}

export default function BrandSiteConsoleShell({ brandCode }: { brandCode: string }) {
  const normalizedBrandCode = normalizeBrandCode(decodeMaybe(brandCode));
  const [data, setData] = useState<BrandProductConsoleData | null>(null);
  const [keyword, setKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, BrandProductEditDraft>>({});
  const [structuredDrafts, setStructuredDrafts] = useState<Record<string, BrandStructuredContentDraft>>({});
  const [expandedStructuredId, setExpandedStructuredId] = useState('');
  const [savingId, setSavingId] = useState('');
  const [savingStructuredId, setSavingStructuredId] = useState('');
  const [actionProductId, setActionProductId] = useState('');
  const [imageActionId, setImageActionId] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [rowFeedback, setRowFeedback] = useState<Record<string, { tone: 'success' | 'error'; text: string }>>({});
  const [shelfAssignments, setShelfAssignments] = useState<WebsiteShelfAssignment[]>([]);
  const [shelfLoading, setShelfLoading] = useState(false);
  const [shelfError, setShelfError] = useState('');
  const [shelfBusyProductId, setShelfBusyProductId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [activeContentTab, setActiveContentTab] = useState<ContentTab>('products');
  const [createDraft, setCreateDraft] = useState<BrandProductEditDraft>(() => blankNewProductDraft(normalizedBrandCode));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    ok: boolean;
    log: string;
    error?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setShelfLoading(true);
    setError('');
    setShelfError('');
    try {
      const nextData = await loadBrandProductConsoleData(normalizedBrandCode);
      setData(nextData);
      if (!nextData.site) {
        setShelfAssignments([]);
        return;
      }
      try {
        const result = await siteProductAssignments.list(nextData.site.code || normalizedBrandCode);
        setShelfAssignments(assignmentItems(result));
      } catch (e) {
        setShelfAssignments([]);
        setShelfError((e as Error).message || '官网货架状态加载失败。');
      }
    } catch (e) {
      setError((e as Error).message || '品牌官网产品数据加载失败。');
    } finally {
      setIsLoading(false);
      setShelfLoading(false);
    }
  }, [normalizedBrandCode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    auth.me()
      .then((me) => {
        if (!cancelled) setCanWrite(canWriteBrandProducts(me));
      })
      .catch(() => {
        if (!cancelled) setCanWrite(false);
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
    setExpandedStructuredId('');
  }, [normalizedBrandCode]);

  const site = useMemo(() => {
    return (data?.site as BrandSite | null) || fallbackSite(normalizedBrandCode);
  }, [data, normalizedBrandCode]);

  const meta = statusMeta(site);
  const publishCapability = site.publishCapability || UNSUPPORTED_PUBLISH;
  const environmentLinks = useMemo(
    () => resolveBrandSiteEnvironmentLinks(data?.site || site, normalizedBrandCode),
    [data?.site, normalizedBrandCode, site]
  );
  const visibleProducts = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    const rows = data?.products || [];
    if (!query) return rows;
    return rows.filter((row) =>
      [row.sku, row.publicSlug, row.name, row.model, row.category, row.system, row.websiteMenuCategory]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [data, keyword]);
  const assignmentByProductId = useMemo(() => {
    const map = new Map<string, WebsiteShelfAssignment>();
    for (const assignment of shelfAssignments) {
      if (assignment.productId) map.set(assignment.productId, assignment);
    }
    return map;
  }, [shelfAssignments]);

  const taxonomyCount = useMemo(() => {
    if (!data?.taxonomy) return 0;
    return Object.values(data.taxonomy).filter((value) => Array.isArray(value)).length;
  }, [data]);

  function updateDraft(id: string, patch: Partial<BrandProductEditDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } as BrandProductEditDraft }));
  }

  function structuredDraft(row: BrandProductRow) {
    return structuredDrafts[row.id] || structuredDraftFromProductRow(row, normalizedBrandCode);
  }

  function updateStructuredDraft(id: string, patch: Partial<BrandStructuredContentDraft>) {
    setStructuredDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } as BrandStructuredContentDraft }));
  }

  function resetDraft(row: BrandProductRow) {
    setDrafts((current) => ({ ...current, [row.id]: draftFromProductRow(row) }));
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

  async function saveRow(row: BrandProductRow) {
    if (!canWrite) return;
    const draft = drafts[row.id] || draftFromProductRow(row);
    if (!isDirtyProductDraft(row, draft)) return;
    setSavingId(row.id);
    setRowFeedback((current) => ({ ...current, [row.id]: { tone: 'success', text: '保存中...' } }));
    try {
      await saveBrandProductRow(normalizedBrandCode, row, draft);
      await load();
      setDrafts((current) => {
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
    if (!canWrite || !data?.site) return;
    setCreating(true);
    setCreateError('');
    try {
      await createBrandProduct(normalizedBrandCode, createDraft);
      await load();
      setShowCreate(false);
      setCreateDraft(blankNewProductDraft(normalizedBrandCode));
    } catch (e) {
      setCreateError((e as Error).message || '上新失败');
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(row: BrandProductRow) {
    if (!canWrite) return;
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

  async function publishWebsiteShelf(row: BrandProductRow) {
    if (!canWrite) return;
    const siteCode = site.code || normalizedBrandCode;
    const existing = assignmentByProductId.get(row.id);
    setShelfBusyProductId(row.id);
    setRowFeedback((current) => ({ ...current, [`${row.id}:shelf`]: { tone: 'success', text: '官网货架发布中...' } }));
    try {
      let assignmentId = existing?.id || '';
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
    }
  }

  async function hideWebsiteShelf(row: BrandProductRow) {
    if (!canWrite) return;
    const assignment = assignmentByProductId.get(row.id);
    if (!assignment) return;
    setShelfBusyProductId(row.id);
    setRowFeedback((current) => ({ ...current, [`${row.id}:shelf`]: { tone: 'success', text: '官网货架隐藏中...' } }));
    try {
      await siteProductAssignments.hide(site.code || normalizedBrandCode, assignment.id);
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
    }
  }

  async function archiveProduct(row: BrandProductRow) {
    if (!canWrite) return;
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

  async function uploadMainImage(row: BrandProductRow, file: File | null) {
    if (!canWrite || !file) return;
    setImageActionId(`${row.id}:main`);
    setActionFeedback(null);
    try {
      await uploadBrandProductMainImage(normalizedBrandCode, row, file);
      setActionFeedback({ tone: 'success', text: `${row.sku} 主图已保存。` });
      await load();
    } catch (e) {
      setActionFeedback({ tone: 'error', text: (e as Error).message || '主图上传失败。' });
    } finally {
      setImageActionId('');
    }
  }

  async function deleteMainImage(row: BrandProductRow) {
    if (!canWrite) return;
    setImageActionId(`${row.id}:main`);
    setActionFeedback(null);
    try {
      await deleteBrandProductMainImage(normalizedBrandCode, row);
      setActionFeedback({ tone: 'success', text: `${row.sku} 主图已删除。` });
      await load();
    } catch (e) {
      setActionFeedback({ tone: 'error', text: (e as Error).message || '主图删除失败。' });
    } finally {
      setImageActionId('');
    }
  }

  async function moveDetailImage(row: BrandProductRow, artifactId: string, direction: -1 | 1) {
    if (!canWrite) return;
    const ids = row.imageState.detailRefs.map((ref) => ref.artifactId);
    const index = ids.indexOf(artifactId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    setImageActionId(`${row.id}:detail`);
    setActionFeedback(null);
    try {
      await reorderBrandProductDetailImages(normalizedBrandCode, row, ids);
      setActionFeedback({ tone: 'success', text: `${row.sku} 详情图顺序已保存。` });
      await load();
    } catch (e) {
      setActionFeedback({ tone: 'error', text: (e as Error).message || '详情图排序失败。' });
    } finally {
      setImageActionId('');
    }
  }

  async function publishBrandSite() {
    if (!canWrite || !data?.site || !publishCapability.supported) return;
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

  return (
    <div className="brand-console-shell">
      <div className="page-container brand-console-page">
        <PageHeader
          title={`${site.nameCn || site.nameEn} 官网内容控制台`}
          subtitle={`当前工作台原生管理 /comfort/sites/${normalizedBrandCode}`}
          actions={
            <>
              <button type="button" className="btn btn-outline" onClick={load} disabled={isLoading}>
                <RefreshCw size={15} />
                刷新
              </button>
              <a className="btn btn-outline" href={`/comfort/sites/${normalizedBrandCode}/library`}>
                官网货架
              </a>
              {canWrite && data?.site && (
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate((current) => !current)}>
                  <PackagePlus size={15} />
                  上新产品
                </button>
              )}
              {canWrite && data?.site && (
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
          <div className={`brand-console-notice ${actionFeedback.tone}`} role="status">
            {actionFeedback.text}
          </div>
        )}

        <section className="brand-console-hero" aria-label="品牌官网摘要">
          <div className="brand-console-identity">
            <div className="brand-console-mark">{(site.nameEn || site.code).slice(0, 1).toUpperCase()}</div>
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
                </div>
              </div>
            </div>
            <div className="brand-product-head-actions">
              <a className="btn btn-outline btn-sm" href={`/comfort/sites/${site.code}/library`}>
                <PackagePlus size={13} />
                官网上架设置
              </a>
              <span className="pill-brand">5000 原生适配器</span>
            </div>
          </div>
          {activeContentTab === 'products' ? (
            <>
          <div className="brand-product-toolbar">
            <div className="brand-product-search">
              <Search size={15} />
              <input
                className="input"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索 SKU、slug、名称、型号、分类或系统"
              />
            </div>
            <span className="pill-neutral">{data?.apiCalls.join(' · ')}</span>
            {shelfError && <span className="row-feedback error">{shelfError}</span>}
          </div>
          {showCreate && canWrite && (
            <ProductCreatePanel
              draft={createDraft}
              error={createError}
              creating={creating}
              onChange={(patch) => setCreateDraft((current) => ({ ...current, ...patch }))}
              onCancel={() => {
                setShowCreate(false);
                setCreateError('');
                setCreateDraft(blankNewProductDraft(normalizedBrandCode));
              }}
              onCreate={createProduct}
            />
          )}
          <div className="brand-product-table-wrap">
            <table className="table brand-product-table">
              <thead>
                <tr>
                  {PRODUCT_COLUMNS.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={PRODUCT_COLUMNS.length} className="brand-product-empty">
                      <strong>正在加载品牌产品行</strong>
                      <span>正在读取品牌官网主数据、产品目录和分类词表。</span>
                    </td>
                  </tr>
                ) : data?.emptyState ? (
                  <tr>
                    <td colSpan={PRODUCT_COLUMNS.length} className="brand-product-empty">
                      <strong>{data.emptyState.title}</strong>
                      <span>{data.emptyState.description}</span>
                      <a className="btn btn-brand btn-sm" href={data.emptyState.actionHref}>
                        {data.emptyState.actionLabel}
                        <ExternalLink size={13} />
                      </a>
                    </td>
                  </tr>
                ) : visibleProducts.length ? (
                  visibleProducts.map((product) => (
                    <ProductRow
                      key={product.id || product.sku}
                      product={product}
                      canWrite={canWrite}
                      draft={drafts[product.id] || draftFromProductRow(product)}
                      structuredDraft={structuredDraft(product)}
                      taxonomy={data?.taxonomy || {}}
                      structuredExpanded={expandedStructuredId === product.id}
                      saving={savingId === product.id}
                      savingStructured={savingStructuredId === product.id}
                      feedback={rowFeedback[product.id]}
                      structuredFeedback={rowFeedback[`${product.id}:structured`]}
                      shelfAssignment={assignmentByProductId.get(product.id)}
                      shelfLoading={shelfLoading}
                      shelfBusy={shelfBusyProductId === product.id}
                      shelfFeedback={rowFeedback[`${product.id}:shelf`]}
                      onChange={(patch) => updateDraft(product.id, patch)}
                      onStructuredChange={(patch) => updateStructuredDraft(product.id, patch)}
                      onSave={() => saveRow(product)}
                      onReset={() => resetDraft(product)}
                      onStructuredSave={() => saveStructured(product)}
                      onStructuredReset={() => resetStructuredDraft(product)}
                      onStructuredToggle={() =>
                        setExpandedStructuredId((current) => (current === product.id ? '' : product.id))
                      }
                      actionBusy={actionProductId === product.id}
                      onToggleStatus={() => toggleStatus(product)}
                      onArchive={() => archiveProduct(product)}
                      onPublishShelf={() => publishWebsiteShelf(product)}
                      onHideShelf={() => hideWebsiteShelf(product)}
                      imageBusy={imageActionId.startsWith(`${product.id}:`)}
                      onUploadMainImage={(file) => uploadMainImage(product, file)}
                      onDeleteMainImage={() => deleteMainImage(product)}
                      onMoveDetailImage={(artifactId, direction) => moveDetailImage(product, artifactId, direction)}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={PRODUCT_COLUMNS.length} className="brand-product-empty">
                      <strong>没有匹配当前搜索的产品</strong>
                      <span>清空搜索关键词后返回品牌产品列表。</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
            </>
          ) : (
            <SiteMaterialMockPanel />
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
          gap: 20px;
          max-width: 1280px;
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
          background: var(--brand);
          font-size: 24px;
          font-weight: 800;
          box-shadow: var(--sh-xs);
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
          min-height: 132px;
          display: grid;
          align-content: center;
          gap: 8px;
          padding: 16px;
          border-left: 1px solid var(--border);
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
          color: var(--brand);
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
        }
        .summary-item a span {
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
          overflow: hidden;
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
          min-height: 28px;
          padding: 0 10px;
          border: 0;
          border-radius: calc(var(--r-sm) - 2px);
          color: var(--t-secondary);
          background: transparent;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
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
          max-width: 520px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--t-tertiary);
        }
        .brand-product-table-wrap {
          overflow-x: auto;
        }
        .brand-product-table {
          min-width: 1480px;
        }
        .site-material-panel {
          display: grid;
          gap: 14px;
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
        .site-material-item-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: auto;
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
        .brand-product-main-cell {
          min-width: 190px;
          display: grid;
          gap: 3px;
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
        .brand-product-main-cell span,
        .muted-value {
          color: var(--t-tertiary);
          font-size: 12px;
        }
        .core-field-cell {
          min-width: 220px;
        }
        .inline-edit-input {
          min-width: 128px;
          padding: 5px 8px;
          font-size: 12px;
          border-color: color-mix(in srgb, var(--border) 75%, var(--brand) 25%);
          background: color-mix(in srgb, var(--surface-1) 92%, var(--brand-50) 8%);
        }
        .inline-edit-input.compact {
          min-width: 88px;
        }
        .mono-cell {
          font-family: var(--font-mono);
          font-size: 12px;
        }
        .readiness-cell {
          min-width: 116px;
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
          min-width: 118px;
          display: grid;
          gap: 6px;
          align-items: start;
        }
        .website-shelf-cell .btn {
          width: max-content;
          white-space: nowrap;
        }
        .image-asset-cell {
          min-width: 240px;
          display: grid;
          gap: 8px;
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
        .sr-only-file {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }
        .detail-image-list {
          display: grid;
          gap: 4px;
        }
        .detail-image-ref {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 6px;
          align-items: center;
          color: var(--t-secondary);
          font-size: 12px;
        }
        .detail-image-ref > span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .detail-image-actions {
          display: inline-flex;
          gap: 4px;
        }
        .icon-only {
          min-width: 28px;
          padding-left: 6px;
          padding-right: 6px;
        }
        .row-edit-actions {
          min-width: 220px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
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
          }
          .product-create-grid {
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

function SiteMaterialMockPanel() {
  return (
    <div className="site-material-panel" aria-label="其他官网素材">
      <div className="site-material-panel-head">
        <div>
          <p className="t-label">其他素材</p>
          <h3>官网非产品素材</h3>
          <p>当前仅用于验证运营流程，未接入真实 DAM、生产素材库或官网发布流程。</p>
        </div>
        <span className="pill-neutral">当前为模拟数据</span>
      </div>
      <div className="site-material-grid">
        {MOCK_SITE_MATERIALS.map((item) => (
          <article className="site-material-item" key={item.key}>
            <strong>{item.name}</strong>
            <span>{item.type} · {item.location}</span>
            <small>责任方：{item.owner}</small>
            <p>{item.note}</p>
            <div className="site-material-item-actions">
              <span className="badge badge-grey">{item.status}</span>
              <button type="button" className="btn btn-outline btn-sm" disabled title="真实 DAM 接入不在本次范围">
                待接入
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProductRow({
  product,
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
  const shelfMeta = websiteShelfMeta(shelfAssignment?.status);
  const canHideShelf = shelfAssignment?.status === 'published';
  return (
    <>
    <tr className={dirty || structuredDirty ? 'is-dirty' : undefined}>
      <td>
        <div className="brand-product-main-cell">
          <strong className="mono-cell">{product.sku || '未配置 SKU'}</strong>
          <span>{product.id}</span>
        </div>
      </td>
      <td>
        <EditableField
          canWrite={canWrite}
          value={draft.publicSlug}
          fallback="缺少 slug"
          onChange={(publicSlug) => onChange({ ...draft, publicSlug })}
        />
      </td>
      <td>
        <div className="brand-product-main-cell">
          <span className="edit-field-caption">名称</span>
          <EditableField
            canWrite={canWrite}
            value={draft.name}
            fallback="缺少名称"
            onChange={(name) => onChange({ ...draft, name })}
          />
          <span className="edit-field-caption">型号</span>
          <EditableField
            canWrite={canWrite}
            value={draft.model}
            fallback="缺少型号"
            compact
            onChange={(model) => onChange({ ...draft, model })}
          />
        </div>
      </td>
      <td>
        <EditableField
          canWrite={canWrite}
          value={draft.category}
          fallback="未设置"
          onChange={(category) => onChange({ ...draft, category })}
        />
      </td>
      <td>
        <EditableField
          canWrite={canWrite}
          value={draft.system}
          fallback="未设置"
          onChange={(system) => onChange({ ...draft, system })}
        />
      </td>
      <td>
        <EditableField
          canWrite={canWrite}
          value={draft.websiteMenuCategory}
          fallback="未设置"
          onChange={(websiteMenuCategory) => onChange({ ...draft, websiteMenuCategory })}
        />
      </td>
      <td>
        <span className={`badge ${status.className}`}>
          {status.label}
        </span>
      </td>
      <td>
        <div className="website-shelf-cell">
          <span className={`badge ${shelfMeta.className}`} data-testid={`website-shelf-status-${product.sku}`}>
            {shelfMeta.label}
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
          {shelfFeedback && <span className={`row-feedback ${shelfFeedback.tone}`}>{shelfFeedback.text}</span>}
        </div>
      </td>
      <td>
        <EditableField
          canWrite={canWrite}
          value={draft.sortOrder}
          fallback="0"
          type="number"
          compact
          onChange={(sortOrder) => onChange({ ...draft, sortOrder })}
        />
      </td>
      <td>
        <ProductImageAssets
          product={product}
          canWrite={canWrite}
          busy={imageBusy}
          onUploadMainImage={onUploadMainImage}
          onDeleteMainImage={onDeleteMainImage}
          onMoveDetailImage={onMoveDetailImage}
        />
      </td>
      <td>
        <div className="brand-product-main-cell core-field-cell">
          <EditableField
            canWrite={canWrite}
            value={draft.tagline}
            fallback="标语未设置"
            compact
            onChange={(tagline) => onChange({ ...draft, tagline })}
          />
          <EditableField
            canWrite={canWrite}
            value={draft.series}
            fallback="系列未设置"
            compact
            onChange={(series) => onChange({ ...draft, series })}
          />
          <EditableField
            canWrite={canWrite}
            value={draft.badges}
            fallback="标签未设置"
            compact
            onChange={(badges) => onChange({ ...draft, badges })}
          />
        </div>
      </td>
      <td>
        <div className="readiness-cell" title={product.metadataReadiness.missing.join(', ')}>
          <span className={product.metadataReadiness.ready ? 'badge badge-success' : 'badge badge-warning'}>
            {product.metadataReadiness.score}%
          </span>
          <span className="readiness-track">
            <span className="readiness-fill" style={{ width: `${product.metadataReadiness.score}%` }} />
          </span>
          <button type="button" className="btn btn-outline btn-sm structured-toggle" onClick={onStructuredToggle}>
            <ChevronDown size={13} />
            官网内容
          </button>
        </div>
      </td>
      <td>
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
                className="btn btn-outline btn-sm"
                onClick={onToggleStatus}
                disabled={actionBusy}
                title={product.status === 'active' ? '下架产品' : '上架产品'}
              >
                {product.status === 'active' ? <ArrowDownCircle size={13} /> : <ArrowUpCircle size={13} />}
                {product.status === 'active' ? '下架' : '上架'}
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
        {canWrite ? (
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
            <StructuredTextField label="主图地址" value={draft.image} canWrite={canWrite} onChange={(image) => update({ image })} />
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

function ProductImageAssets({
  product,
  canWrite,
  busy,
  onUploadMainImage,
  onDeleteMainImage,
  onMoveDetailImage,
}: {
  product: BrandProductRow;
  canWrite: boolean;
  busy: boolean;
  onUploadMainImage: (file: File | null) => void;
  onDeleteMainImage: () => void;
  onMoveDetailImage: (artifactId: string, direction: -1 | 1) => void;
}) {
  const inputId = `main-image-${product.id || product.sku}`;
  const details = product.imageState.detailRefs;
  return (
    <div className="image-asset-cell" data-testid={`image-assets-${product.sku}`}>
      <div className="image-asset-status">
        <span className={product.imageState.hasMainImage ? 'pill-brand' : 'pill-neutral'}>
          {product.imageState.hasMainImage ? '主图已就绪' : '缺少主图'}
        </span>
        <span className="muted-value">详情图：{product.imageState.galleryCount}</span>
      </div>
      {canWrite && (
        <div className="image-asset-actions">
          <input
            id={inputId}
            data-testid={`main-image-input-${product.sku}`}
            className="sr-only-file"
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(event) => {
              onUploadMainImage(event.target.files?.[0] || null);
              event.currentTarget.value = '';
            }}
          />
          <label className="btn btn-outline btn-sm image-upload-label" htmlFor={inputId} title="上传或替换主图">
            <Upload size={13} />
            {product.imageState.hasMainImage ? '替换' : '上传'}
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
            删除
          </button>
        </div>
      )}
      {details.length > 0 && (
        <div className="detail-image-list" aria-label={`${product.sku} 详情图引用`}>
          {details.map((ref, index) => (
            <div className="detail-image-ref" key={ref.artifactId}>
              <span title={ref.filename || ref.artifactId}>{ref.filename || ref.artifactId}</span>
              {canWrite && details.length > 1 && (
                <div className="detail-image-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm icon-only"
                    disabled={busy || index === 0}
                    onClick={() => onMoveDetailImage(ref.artifactId, -1)}
                    title="详情图上移"
                    data-testid={`detail-up-${product.sku}-${ref.artifactId}`}
                  >
                    <ArrowUpCircle size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm icon-only"
                    disabled={busy || index === details.length - 1}
                    onClick={() => onMoveDetailImage(ref.artifactId, 1)}
                    title="详情图下移"
                    data-testid={`detail-down-${product.sku}-${ref.artifactId}`}
                  >
                    <ArrowDownCircle size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function productStatusMeta(status: string) {
  if (status === 'active') return { label: '在架', className: 'badge-success' };
  if (status === 'archived') return { label: '已归档', className: 'badge-grey' };
  return { label: '下架', className: 'badge-warning' };
}

function websiteShelfMeta(status?: AssignmentStatus) {
  if (status === 'published') return { label: '已上架', className: 'badge-success' };
  if (status === 'hidden') return { label: '已下架', className: 'badge-warning' };
  return { label: '未上架', className: 'badge-grey' };
}

function ProductCreatePanel({
  draft,
  error,
  creating,
  onChange,
  onCancel,
  onCreate,
}: {
  draft: BrandProductEditDraft;
  error: string;
  creating: boolean;
  onChange: (patch: Partial<BrandProductEditDraft>) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  const ready = Boolean(draft.name.trim() && (draft.model.trim() || draft.publicSlug.trim()));
  return (
    <div className="product-create-panel">
      <div className="product-create-grid">
        <FormField label="公开 Slug" value={draft.publicSlug} onChange={(publicSlug) => onChange({ publicSlug })} />
        <FormField label="名称" value={draft.name} onChange={(name) => onChange({ name })} />
        <FormField label="型号" value={draft.model} onChange={(model) => onChange({ model })} />
        <FormField label="分类" value={draft.category} onChange={(category) => onChange({ category })} />
        <FormField label="系统" value={draft.system} onChange={(system) => onChange({ system })} />
        <FormField
          label="菜单分类"
          value={draft.websiteMenuCategory}
          onChange={(websiteMenuCategory) => onChange({ websiteMenuCategory })}
        />
        <FormField label="排序" value={draft.sortOrder} type="number" onChange={(sortOrder) => onChange({ sortOrder })} />
        <FormField label="标语" value={draft.tagline} onChange={(tagline) => onChange({ tagline })} />
        <FormField label="系列" value={draft.series} onChange={(series) => onChange({ series })} />
        <FormField
          label="英文名"
          value={draft.officialEnglishName}
          onChange={(officialEnglishName) => onChange({ officialEnglishName })}
        />
        <FormField label="标签" value={draft.badges} onChange={(badges) => onChange({ badges })} />
      </div>
      <div className="product-create-actions">
        {error && <span className="row-feedback error">{error}</span>}
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={creating}>
          <X size={13} />
          取消
        </button>
        <button type="button" className="btn btn-brand btn-sm" onClick={onCreate} disabled={!ready || creating}>
          <Check size={13} />
          {creating ? '创建中' : '创建产品骨架'}
        </button>
      </div>
    </div>
  );
}

function EditableField({
  canWrite,
  value,
  fallback,
  compact,
  type = 'text',
  onChange,
}: {
  canWrite: boolean;
  value: string;
  fallback: string;
  compact?: boolean;
  type?: string;
  onChange: (value: string) => void;
}) {
  if (!canWrite) return value ? <span>{value}</span> : <span className="muted-value">{fallback}</span>;
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
  type = 'text',
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="product-create-field">
      <span>{label}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
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
