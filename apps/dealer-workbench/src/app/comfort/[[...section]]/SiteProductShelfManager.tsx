'use client';

import { Archive, Check, EyeOff, Pencil, Plus, RefreshCw, Save, Star, X } from 'lucide-react';
import { PageHeader } from '@rhautt/ui';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { products, siteProductAssignments } from '../../../lib/api';

type AssignmentStatus = 'draft' | 'published' | 'hidden';

type Assignment = {
  id: string;
  productTenantId: string;
  productId: string;
  brand: string | null;
  publicSlug: string;
  websiteCategory: string | null;
  menuGroup: string | null;
  displayOrder: number;
  isFeatured: boolean;
  status: AssignmentStatus;
  siteTitle: string | null;
  siteSummary: string | null;
  publishedAt: string | null;
};

type AssignmentDraft = {
  productTenantId: string;
  productId: string;
  publicSlug: string;
  websiteCategory: string;
  menuGroup: string;
  displayOrder: string;
  isFeatured: boolean;
  siteTitle: string;
  siteSummary: string;
};

type ProductOption = {
  id: string;
  tenantId: string;
  brand: string;
  sku: string;
  name: string;
  model: string;
  slug: string;
};

const SITE_OPTIONS = [
  { code: 'rheem', label: '瑞美 Rheem' },
  { code: 'ruud', label: '瑞德 Ruud' },
  { code: 'everhot', label: '恒热 Everhot' },
  { code: 'rhautt-group', label: '瑞合集团官网' },
] as const;

const PRODUCT_BRANDS = ['rheem', 'ruud', 'everhot'] as const;
const BRAND_PRODUCT_TENANTS: Record<string, string | undefined> = {
  rheem: process.env.NEXT_PUBLIC_RHEEM_TENANT_ID,
  ruud: process.env.NEXT_PUBLIC_RUUD_TENANT_ID,
  everhot: process.env.NEXT_PUBLIC_EVERHOT_TENANT_ID,
};

const EMPTY_DRAFT: AssignmentDraft = {
  productTenantId: '', productId: '', publicSlug: '', websiteCategory: '', menuGroup: '',
  displayOrder: '0', isFeatured: false, siteTitle: '', siteSummary: '',
};

function draftFromAssignment(row: Assignment): AssignmentDraft {
  return {
    productTenantId: row.productTenantId,
    productId: row.productId,
    publicSlug: row.publicSlug,
    websiteCategory: row.websiteCategory || '',
    menuGroup: row.menuGroup || '',
    displayOrder: String(row.displayOrder || 0),
    isFeatured: row.isFeatured,
    siteTitle: row.siteTitle || '',
    siteSummary: row.siteSummary || '',
  };
}

function assignmentPayload(draft: AssignmentDraft, includeProduct: boolean) {
  return {
    ...(includeProduct ? {
      productId: draft.productId.trim(),
      productTenantId: draft.productTenantId.trim(),
    } : {}),
    publicSlug: draft.publicSlug.trim().toLowerCase(),
    websiteCategory: draft.websiteCategory.trim() || null,
    menuGroup: draft.menuGroup.trim() || null,
    displayOrder: Number(draft.displayOrder || 0),
    isFeatured: draft.isFeatured,
    siteTitle: draft.siteTitle.trim() || null,
    siteSummary: draft.siteSummary.trim() || null,
  };
}

function statusLabel(status: AssignmentStatus) {
  if (status === 'published') return '已发布';
  if (status === 'hidden') return '已隐藏';
  return '草稿';
}

function productOption(raw: Record<string, any>, brand: string): ProductOption {
  const brandMeta = raw.meta?.[brand] || {};
  const model = String(raw.spec?.officialModel || raw.model || raw.sku || '').trim();
  return {
    id: String(raw.id || raw._id || '').trim(),
    tenantId: String(raw.tenantId || BRAND_PRODUCT_TENANTS[brand] || '').trim(),
    brand: String(raw.brand || brand).trim().toLowerCase(),
    sku: String(raw.sku || '').trim(),
    name: String(brandMeta.name || raw.name || model).trim(),
    model,
    slug: String(brandMeta.slug || raw.sku || raw.name || '').trim().toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''),
  };
}

export default function SiteProductShelfManager({ siteCode }: { siteCode: string }) {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState<AssignmentDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [editDraft, setEditDraft] = useState<AssignmentDraft>(EMPTY_DRAFT);
  const fixedBrand = PRODUCT_BRANDS.includes(siteCode as (typeof PRODUCT_BRANDS)[number]) ? siteCode : '';
  const [createBrand, setCreateBrand] = useState(fixedBrand || 'rheem');
  const [productQuery, setProductQuery] = useState('');
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productError, setProductError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await siteProductAssignments.list(siteCode);
      setItems(Array.isArray(result?.items) ? result.items : []);
    } catch (e) {
      setError((e as Error).message || '官网货架加载失败。');
    } finally {
      setLoading(false);
    }
  }, [siteCode]);

  useEffect(() => {
    setShowCreate(false);
    setEditing(null);
    setCreateDraft(EMPTY_DRAFT);
    setCreateBrand(fixedBrand || 'rheem');
    setProductQuery('');
    load();
  }, [fixedBrand, load]);

  useEffect(() => {
    if (!showCreate) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setProductsLoading(true);
      setProductError('');
      try {
        const tenantId = BRAND_PRODUCT_TENANTS[createBrand] || '';
        const result = await products.list({
          brand: createBrand,
          status: 'active',
          q: productQuery.trim(),
          page: '1',
          pageSize: '50',
          ...(tenantId ? { tenantId } : {}),
        });
        if (cancelled) return;
        const rows = Array.isArray(result?.items) ? result.items : [];
        setProductOptions(rows.map((row: Record<string, any>) => productOption(row, createBrand)).filter((row: ProductOption) => row.id && row.tenantId));
      } catch (e) {
        if (!cancelled) {
          setProductOptions([]);
          setProductError((e as Error).message || '产品数据加载失败。');
        }
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [createBrand, productQuery, showCreate]);

  const counts = useMemo(() => ({
    published: items.filter((item) => item.status === 'published').length,
    draft: items.filter((item) => item.status === 'draft').length,
    hidden: items.filter((item) => item.status === 'hidden').length,
  }), [items]);

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2400);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusyId('create');
    setError('');
    try {
      await siteProductAssignments.create(siteCode, assignmentPayload(createDraft, true));
      setShowCreate(false);
      setCreateDraft(EMPTY_DRAFT);
      await load();
      flash('产品已作为草稿加入官网货架。');
    } catch (e) {
      setError((e as Error).message || '产品分配创建失败。');
    } finally {
      setBusyId('');
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusyId(editing.id);
    setError('');
    try {
      await siteProductAssignments.update(siteCode, editing.id, assignmentPayload(editDraft, false));
      setEditing(null);
      await load();
      flash('官网货架设置已保存。');
    } catch (e) {
      setError((e as Error).message || '产品分配更新失败。');
    } finally {
      setBusyId('');
    }
  }

  async function changeStatus(row: Assignment, action: 'publish' | 'hide') {
    setBusyId(row.id);
    setError('');
    try {
      await siteProductAssignments[action](siteCode, row.id);
      await load();
      flash(action === 'publish' ? '产品已发布到官网。' : '产品已从官网隐藏。');
    } catch (e) {
      setError((e as Error).message || '发布状态修改失败。');
    } finally {
      setBusyId('');
    }
  }

  async function archive(row: Assignment) {
    if (!window.confirm(`确认从官网货架归档 ${row.siteTitle || row.publicSlug}？`)) return;
    setBusyId(row.id);
    setError('');
    try {
      await siteProductAssignments.archive(siteCode, row.id);
      await load();
      flash('产品分配已归档。');
    } catch (e) {
      setError((e as Error).message || '产品分配归档失败。');
    } finally {
      setBusyId('');
    }
  }

  function beginEdit(row: Assignment) {
    setEditing(row);
    setEditDraft(draftFromAssignment(row));
  }

  return (
    <div className="page-container site-shelf-page">
      <PageHeader
        title={`${SITE_OPTIONS.find((site) => site.code === siteCode)?.label || siteCode} 官网货架`}
        subtitle="分配产品并控制官网前台可以展示的产品内容。"
        actions={<a className="btn btn-outline" href={`/comfort/sites/${siteCode}/library`}>产品源库</a>}
      />
      <section className="card-elevated site-shelf-panel" aria-label="官网产品货架">
      <header className="site-shelf-head">
        <div><p className="t-label">官网产品货架</p><h2>产品分配</h2></div>
        <div className="site-shelf-head-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={load} disabled={loading}><RefreshCw size={14} /> 刷新</button>
          <button type="button" className="btn btn-brand btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> 添加产品</button>
        </div>
      </header>

      <nav className="site-shelf-sites" aria-label="切换官网">
        {SITE_OPTIONS.map((site) => (
          <a key={site.code} href={`/comfort/sites/${site.code}`} className={site.code === siteCode ? 'is-active' : undefined} aria-current={site.code === siteCode ? 'page' : undefined}>
            {site.label}
          </a>
        ))}
        <span>{counts.published} 已发布 · {counts.draft} 草稿 · {counts.hidden} 已隐藏</span>
      </nav>

      {error && <div className="site-shelf-notice error" role="alert">{error}</div>}
      {message && <div className="site-shelf-notice success" role="status">{message}</div>}
      {showCreate && (
        <AssignmentForm
          title="添加产品到当前官网"
          draft={createDraft}
          includeProduct
          busy={busyId === 'create'}
          siteCode={siteCode}
          selectedBrand={createBrand}
          productQuery={productQuery}
          productOptions={productOptions}
          productsLoading={productsLoading}
          productError={productError}
          onBrandChange={(brand) => {
            setCreateBrand(brand);
            setProductQuery('');
            setCreateDraft((current) => ({ ...current, productId: '', productTenantId: '' }));
          }}
          onProductQueryChange={setProductQuery}
          onProductSelect={(product) => setCreateDraft((current) => ({
            ...current,
            productId: product.id,
            productTenantId: product.tenantId,
            publicSlug: current.publicSlug || product.slug,
            siteTitle: current.siteTitle || product.name,
          }))}
          onChange={setCreateDraft}
          onSubmit={create}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="site-shelf-table-wrap">
        <table className="table site-shelf-table">
          <thead><tr><th>官网展示</th><th>产品</th><th>分组</th><th>状态</th><th>排序</th><th>操作</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="site-shelf-empty">正在加载官网货架...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="site-shelf-empty">当前官网还没有分配产品。</td></tr>
            ) : items.map((row) => (
              <tr key={row.id}>
                <td><div className="site-shelf-primary"><strong>{row.siteTitle || row.publicSlug}</strong><span>/{row.publicSlug}</span>{row.isFeatured && <small><Star size={12} fill="currentColor" /> 官网精选</small>}</div></td>
                <td><div className="site-shelf-product"><strong>{row.brand || '未指定品牌'}</strong><code>{row.productId}</code></div></td>
                <td><div className="site-shelf-product"><span>{row.websiteCategory || '未设置分类'}</span><small>{row.menuGroup || '未设置菜单分组'}</small></div></td>
                <td><span className={`badge site-shelf-status status-${row.status}`}>{statusLabel(row.status)}</span></td>
                <td>{row.displayOrder}</td>
                <td><div className="site-shelf-row-actions">
                  <button type="button" title="编辑" aria-label={`编辑 ${row.publicSlug}`} onClick={() => beginEdit(row)} disabled={Boolean(busyId)}><Pencil size={14} /></button>
                  {row.status !== 'published' && <button type="button" title="发布" aria-label={`发布 ${row.publicSlug}`} onClick={() => changeStatus(row, 'publish')} disabled={Boolean(busyId)}><Check size={14} /></button>}
                  {row.status === 'published' && <button type="button" title="隐藏" aria-label={`隐藏 ${row.publicSlug}`} onClick={() => changeStatus(row, 'hide')} disabled={Boolean(busyId)}><EyeOff size={14} /></button>}
                  <button type="button" title="归档" aria-label={`归档 ${row.publicSlug}`} onClick={() => archive(row)} disabled={Boolean(busyId)}><Archive size={14} /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="site-shelf-dialog-backdrop" role="presentation" onMouseDown={() => setEditing(null)}>
          <div className="site-shelf-dialog" role="dialog" aria-modal="true" aria-labelledby="site-shelf-edit-title" onMouseDown={(event) => event.stopPropagation()}>
            <AssignmentForm title="编辑官网展示" draft={editDraft} busy={busyId === editing.id} onChange={setEditDraft} onSubmit={save} onCancel={() => setEditing(null)} />
          </div>
        </div>
      )}

      <style>{`
        .site-shelf-page { display: grid; gap: 20px; max-width: 1280px; }
        .site-shelf-panel { overflow: hidden; border-radius: var(--r-lg); }
        .site-shelf-head { min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; border-bottom: 1px solid var(--border); }
        .site-shelf-head h2 { margin: 2px 0 0; color: var(--t-strong); font-size: 18px; }
        .site-shelf-head-actions, .site-shelf-row-actions { display: flex; align-items: center; gap: 6px; }
        .site-shelf-sites { display: flex; align-items: center; gap: 4px; min-height: 50px; padding: 8px 16px; border-bottom: 1px solid var(--border); overflow-x: auto; }
        .site-shelf-sites a { flex: 0 0 auto; padding: 7px 10px; border-radius: var(--r-sm); color: var(--t-secondary); font-size: 12px; font-weight: 700; text-decoration: none; }
        .site-shelf-sites a:hover { background: var(--surface-2); color: var(--t-strong); }
        .site-shelf-sites a.is-active { background: var(--brand); color: #fff; }
        .site-shelf-sites > span { margin-left: auto; color: var(--t-tertiary); font-size: 12px; white-space: nowrap; }
        .site-shelf-notice { margin: 12px 16px 0; padding: 9px 11px; border: 1px solid; border-radius: var(--r-sm); font-size: 12px; font-weight: 600; }
        .site-shelf-notice.success { color: var(--success); background: var(--success-bg); border-color: rgba(120,157,74,.28); }
        .site-shelf-notice.error { color: var(--danger); background: var(--danger-bg); border-color: rgba(220,38,38,.22); }
        .site-shelf-table-wrap { overflow-x: auto; }
        .site-shelf-table { min-width: 920px; }
        .site-shelf-primary, .site-shelf-product { display: grid; gap: 3px; }
        .site-shelf-primary strong, .site-shelf-product strong { color: var(--t-strong); font-size: 13px; }
        .site-shelf-primary span, .site-shelf-product span, .site-shelf-product small { color: var(--t-secondary); font-size: 12px; }
        .site-shelf-primary small { display: inline-flex; align-items: center; gap: 4px; color: var(--brand); font-size: 11px; }
        .site-shelf-product code { color: var(--t-tertiary); font-size: 10px; }
        .site-shelf-row-actions button { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface-1); color: var(--t-secondary); cursor: pointer; }
        .site-shelf-row-actions button:hover { border-color: var(--brand); color: var(--brand); }
        .site-shelf-row-actions button:disabled { opacity: .45; cursor: not-allowed; }
        .site-shelf-status.status-published { color: var(--success); background: var(--success-bg); }
        .site-shelf-status.status-hidden { color: var(--warning); background: var(--warning-bg); }
        .site-shelf-status.status-draft { color: var(--t-secondary); background: var(--surface-3); }
        .site-shelf-empty { height: 100px; color: var(--t-tertiary); text-align: center; }
        .site-shelf-form { display: grid; gap: 14px; padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--surface-2); }
        .site-shelf-form-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .site-shelf-form-head h3 { margin: 0; color: var(--t-strong); font-size: 15px; }
        .site-shelf-icon-button { width: 30px; height: 30px; display: grid; place-items: center; border: 0; background: transparent; color: var(--t-secondary); cursor: pointer; }
        .site-shelf-form-grid { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 10px; }
        .site-shelf-field { display: grid; gap: 5px; color: var(--t-secondary); font-size: 11px; font-weight: 700; }
        .site-shelf-field.wide { grid-column: span 2; }
        .site-shelf-field.checkbox { display: flex; align-items: center; align-self: end; min-height: 38px; }
        .site-shelf-field.checkbox input { width: 16px; height: 16px; accent-color: var(--brand); }
        .site-shelf-form-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .site-shelf-product-picker { display: grid; gap: 10px; }
        .site-shelf-brand-picker { display: flex; gap: 4px; }
        .site-shelf-brand-picker button { padding: 7px 11px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface-1); color: var(--t-secondary); font-size: 12px; font-weight: 700; cursor: pointer; }
        .site-shelf-brand-picker button.is-active { border-color: var(--brand); background: var(--brand); color: #fff; }
        .site-shelf-product-search { display: grid; gap: 5px; color: var(--t-secondary); font-size: 11px; font-weight: 700; }
        .site-shelf-product-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; max-height: 230px; overflow-y: auto; }
        .site-shelf-product-option { min-width: 0; display: grid; gap: 3px; padding: 10px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface-1); color: var(--t-secondary); text-align: left; cursor: pointer; }
        .site-shelf-product-option:hover, .site-shelf-product-option.is-selected { border-color: var(--brand); background: var(--brand-soft); }
        .site-shelf-product-option strong { overflow: hidden; color: var(--t-strong); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
        .site-shelf-product-option span { font-size: 11px; }
        .site-shelf-product-help { margin: 0; color: var(--t-tertiary); font-size: 12px; }
        .site-shelf-product-help.error { color: var(--danger); }
        .site-shelf-advanced { border-top: 1px solid var(--border); padding-top: 10px; }
        .site-shelf-advanced summary { color: var(--t-secondary); font-size: 12px; font-weight: 700; cursor: pointer; }
        .site-shelf-advanced-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding-top: 10px; }
        .site-shelf-dialog-backdrop { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 20px; background: rgba(15,23,42,.46); }
        .site-shelf-dialog { width: min(900px, 100%); max-height: calc(100vh - 40px); overflow: auto; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface-1); box-shadow: var(--sh-lg); }
        .site-shelf-dialog .site-shelf-form { border-bottom: 0; background: var(--surface-1); }
        @media (max-width: 900px) { .site-shelf-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 620px) { .site-shelf-head { align-items: flex-start; flex-direction: column; } .site-shelf-form-grid, .site-shelf-product-options, .site-shelf-advanced-fields { grid-template-columns: 1fr; } .site-shelf-field.wide { grid-column: auto; } .site-shelf-sites > span { display: none; } }
      `}</style>
      </section>
    </div>
  );
}

function AssignmentForm({
  title, draft, includeProduct = false, busy, siteCode, selectedBrand, productQuery,
  productOptions = [], productsLoading = false, productError, onBrandChange,
  onProductQueryChange, onProductSelect, onChange, onSubmit, onCancel,
}: {
  title: string;
  draft: AssignmentDraft;
  includeProduct?: boolean;
  busy: boolean;
  siteCode?: string;
  selectedBrand?: string;
  productQuery?: string;
  productOptions?: ProductOption[];
  productsLoading?: boolean;
  productError?: string;
  onBrandChange?: (brand: string) => void;
  onProductQueryChange?: (query: string) => void;
  onProductSelect?: (product: ProductOption) => void;
  onChange: (draft: AssignmentDraft) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  const patch = (value: Partial<AssignmentDraft>) => onChange({ ...draft, ...value });
  return (
    <form className="site-shelf-form" onSubmit={onSubmit}>
      <div className="site-shelf-form-head"><h3 id="site-shelf-edit-title">{title}</h3><button type="button" className="site-shelf-icon-button" title="关闭" aria-label="关闭" onClick={onCancel}><X size={17} /></button></div>
      {includeProduct && <div className="site-shelf-product-picker">
        {siteCode === 'rhautt-group' ? <div className="site-shelf-brand-picker" aria-label="产品品牌">
          {PRODUCT_BRANDS.map((brand) => <button key={brand} type="button" className={selectedBrand === brand ? 'is-active' : undefined} onClick={() => onBrandChange?.(brand)}>{brand === 'rheem' ? '瑞美 Rheem' : brand === 'ruud' ? '瑞德 Ruud' : '恒热 Everhot'}</button>)}
        </div> : <p className="site-shelf-product-help">正在显示当前官网可选的 {selectedBrand} 在架产品。</p>}
        <label className="site-shelf-product-search">搜索现有产品<input className="input" value={productQuery || ''} onChange={(event) => onProductQueryChange?.(event.target.value)} placeholder="SKU、产品名称、型号或系列" /></label>
        {productError ? <p className="site-shelf-product-help error">{productError}</p> : productsLoading ? <p className="site-shelf-product-help">正在加载产品...</p> : productOptions.length ? <div className="site-shelf-product-options">
          {productOptions.map((product) => <button key={`${product.tenantId}:${product.id}`} type="button" className={`site-shelf-product-option${draft.productId === product.id ? ' is-selected' : ''}`} onClick={() => onProductSelect?.(product)}>
            <strong>{product.name || product.model || product.sku}</strong><span>{product.sku}{product.model && product.model !== product.sku ? ` · ${product.model}` : ''}</span>
          </button>)}
        </div> : <p className="site-shelf-product-help">没有匹配的在架产品，请检查品牌租户配置或使用高级输入。</p>}
        {draft.productId && <p className="site-shelf-product-help">已选择产品：{productOptions.find((product) => product.id === draft.productId)?.sku || draft.productId}</p>}
        <details className="site-shelf-advanced"><summary>高级：手动输入 ID</summary><div className="site-shelf-advanced-fields">
          <label className="site-shelf-field">产品 UUID<input className="input" required value={draft.productId} onChange={(event) => patch({ productId: event.target.value })} /></label>
          <label className="site-shelf-field">产品租户 UUID<input className="input" required value={draft.productTenantId} onChange={(event) => patch({ productTenantId: event.target.value })} /></label>
        </div></details>
      </div>}
      <div className="site-shelf-form-grid">
        <label className="site-shelf-field">公开 Slug<input className="input" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.publicSlug} onChange={(event) => patch({ publicSlug: event.target.value })} /></label>
        <label className="site-shelf-field">官网分类<input className="input" value={draft.websiteCategory} onChange={(event) => patch({ websiteCategory: event.target.value })} /></label>
        <label className="site-shelf-field">菜单分组<input className="input" value={draft.menuGroup} onChange={(event) => patch({ menuGroup: event.target.value })} /></label>
        <label className="site-shelf-field">排序<input className="input" type="number" min="0" max="999999" required value={draft.displayOrder} onChange={(event) => patch({ displayOrder: event.target.value })} /></label>
        <label className="site-shelf-field wide">官网标题<input className="input" value={draft.siteTitle} onChange={(event) => patch({ siteTitle: event.target.value })} /></label>
        <label className="site-shelf-field wide">官网摘要<input className="input" value={draft.siteSummary} onChange={(event) => patch({ siteSummary: event.target.value })} /></label>
        <label className="site-shelf-field checkbox"><input type="checkbox" checked={draft.isFeatured} onChange={(event) => patch({ isFeatured: event.target.checked })} /> 官网精选</label>
      </div>
      <div className="site-shelf-form-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={busy}><X size={14} /> 取消</button>
        <button type="submit" className="btn btn-brand btn-sm" disabled={busy}><Save size={14} /> {busy ? '保存中...' : '保存'}</button>
      </div>
    </form>
  );
}
