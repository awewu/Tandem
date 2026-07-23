'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EMPTY_POSITIONING,
  archiveProductDevice,
  formatMoney,
  isEditableProduct,
  loadProductWorkspace,
  tenantBrand,
  updateProductDevice,
  type ProductFacets,
  type Positioning,
  type ProductRecord,
  type Taxonomy,
  type TenantOption,
  requestJson,
} from '../lib/product-operations';

type View = 'products' | 'packs';

interface ProductForm {
  sku: string;
  name: string;
  brand: string;
  category: string;
  listPrice: number;
  costPrice: number;
  status: string;
  spec: string;
  positioning: Positioning;
}

interface SystemPack {
  id?: string;
  packId?: string;
  name?: string;
  title?: string;
  description?: string;
  positioning?: string;
  scenario?: string;
  category?: string;
  level?: string;
  edition?: string;
  bundlePrice?: number;
  price?: number;
  items?: unknown[];
  modules?: unknown[];
  standards?: unknown[];
}

const EMPTY_FORM: ProductForm = {
  sku: '',
  name: '',
  brand: '',
  category: '',
  listPrice: 0,
  costPrice: 0,
  status: 'active',
  spec: '',
  positioning: { ...EMPTY_POSITIONING },
};

const POSITION_DIMS: { key: keyof Positioning; label: string }[] = [
  { key: 'targetSegments', label: '目标客户' },
  { key: 'channels', label: '销售渠道' },
  { key: 'userPersonas', label: '用户画像' },
  { key: 'markets', label: '目标市场' },
];

function productToForm(product?: ProductRecord | null, brand = ''): ProductForm {
  if (!product) return { ...EMPTY_FORM, brand, positioning: { ...EMPTY_POSITIONING } };
  const positioning = { ...EMPTY_POSITIONING, ...(product.positioning || {}) };
  const spec = typeof product.spec?.text === 'string'
    ? product.spec.text
    : String(product.meta?.description || product.spec?.officialModel || '');
  return {
    sku: product.sku,
    name: product.name,
    brand: product.brand || brand,
    category: product.category || '',
    listPrice: Number(product.listPrice || 0),
    costPrice: Number(product.costPrice || 0),
    status: product.status || 'active',
    spec,
    positioning,
  };
}

function lines(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function unpackPacks(payload: any): SystemPack[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.packs)) return payload.packs;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function packCategoryLabel(category?: string) {
  return {
    hot_water: '中央热水',
    heating: '采暖',
    whole_air: '全空气',
    smart_control: '智能控制',
  }[category || ''] || category || '系统包';
}

function safeBrand(value: string) {
  return ['rheem', 'ruud', 'everhot'].includes(value) ? value : '';
}

function resolveCatalogImageUrl(value: unknown, sourceOrigin: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  const origin = typeof sourceOrigin === 'string' ? sourceOrigin.trim() : '';
  if (origin) {
    try {
      return new URL(raw, origin).toString();
    } catch {
      return raw;
    }
  }
  return raw.startsWith('/assets/') ? `http://localhost:4017${raw}` : raw;
}

function productImageUrl(product: ProductRecord) {
  const everhot = product.meta?.everhot || {};
  const sourceOrigin = everhot.sourceOrigin || product.meta?.sourceOrigin || '';
  const mainImage = (product as any).mainImage?.url;
  return resolveCatalogImageUrl(
    mainImage || everhot.image || product.meta?.imageUrl || product.meta?.image || everhot.specImage,
    sourceOrigin,
  );
}

export default function ProductCatalogManager() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [taxonomy, setTaxonomy] = useState<Taxonomy>({});
  const [tenantId, setTenantId] = useState('');
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [facets, setFacets] = useState<ProductFacets>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('active');
  const [view, setView] = useState<View>('products');
  const [editing, setEditing] = useState<ProductRecord | null | undefined>(undefined);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [packs, setPacks] = useState<SystemPack[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [packsError, setPacksError] = useState('');

  const selectedTenant = useMemo(
    () => tenantOptions.find((tenant) => tenant.id === tenantId) || null,
    [tenantId, tenantOptions],
  );
  const selectedBrand = safeBrand(tenantBrand(selectedTenant));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const workspace = await loadProductWorkspace({
        tenantId: selectedTenantId,
        page,
        pageSize,
        q: query,
        category,
        status,
      });
      setProducts(workspace.products);
      setTaxonomy(workspace.taxonomy);
      setTenantId(workspace.tenantId);
      setSelectedTenantId(workspace.tenantId);
      setTenantOptions(workspace.tenants);
      setFacets(workspace.facets);
      setTotal(workspace.total);
      setPages(Math.max(workspace.pages || 1, 1));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '产品目录加载失败');
    } finally {
      setLoading(false);
    }
  }, [category, page, pageSize, query, selectedTenantId, status]);

  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener('nexus-session-changed', reload);
    return () => window.removeEventListener('nexus-session-changed', reload);
  }, [load]);

  async function switchView(next: View) {
    setView(next);
    if (next !== 'packs' || packs.length || packsLoading) return;
    setPacksLoading(true);
    setPacksError('');
    try {
      setPacks(unpackPacks(await requestJson('/api/system-packs')));
    } catch (cause) {
      setPacksError(cause instanceof Error ? cause.message : '系统方案包加载失败');
    } finally {
      setPacksLoading(false);
    }
  }

  const categories = useMemo(
    () => (facets.categories || []).map((item) => item.value),
    [facets.categories],
  );

  function updateFilter(next: { q?: string; category?: string; status?: string; tenantId?: string }) {
    if (next.q !== undefined) setQuery(next.q);
    if (next.category !== undefined) setCategory(next.category);
    if (next.status !== undefined) setStatus(next.status);
    if (next.tenantId !== undefined) setSelectedTenantId(next.tenantId);
    setPage(1);
  }

  function openCreate() {
    if (!tenantId || tenantId === 'rhautt_shared') {
      setError('当前登录账号缺少可写品牌租户，无法上新。');
      return;
    }
    setEditing(null);
    setForm(productToForm(null, selectedBrand));
  }

  function openEdit(product: ProductRecord) {
    setEditing(product);
    setForm(productToForm(product, selectedBrand));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!tenantId || tenantId === 'rhautt_shared') return;
    setSaving(true);
    setError('');
    try {
      const previous = editing || undefined;
      const body = {
        tenantId,
        name: form.name.trim(),
        brand: selectedBrand || form.brand.trim(),
        category: form.category.trim() || null,
        listPrice: Number(form.listPrice || 0),
        costPrice: Number(form.costPrice || 0),
        status: form.status,
        spec: { ...(previous?.spec || {}), text: form.spec.trim() },
        positioning: form.positioning,
        assetRefs: previous?.assetRefs || [],
        meta: previous?.meta || {},
      };
      if (editing?.id) {
        await updateProductDevice(editing.id, body);
      } else {
        await requestJson('/api/product-catalog/devices', {
          method: 'POST',
          body: JSON.stringify({ ...body, sku: form.sku.trim() }),
        });
      }
      setEditing(undefined);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '产品保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function archive(product: ProductRecord) {
    if (!product.id || !tenantId) return;
    if (!window.confirm(`归档产品 ${product.name}？`)) return;
    setSaving(true);
    setError('');
    try {
      await archiveProductDevice(product.id, tenantId);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '产品归档失败');
    } finally {
      setSaving(false);
    }
  }

  function toggleTerm(key: keyof Positioning, code: string) {
    const current = Array.isArray(form.positioning[key]) ? form.positioning[key] as string[] : [];
    const next = current.includes(code)
      ? current.filter((item) => item !== code)
      : [...current, code];
    setForm({ ...form, positioning: { ...form.positioning, [key]: next } });
  }

  return (
    <div className="operations-workspace">
      <div className="manager-toolbar catalog-toolbar">
        <div className="segmented" aria-label="产品库视图">
          <button className={view === 'products' ? 'active' : ''} onClick={() => void switchView('products')}>单品目录</button>
          <button className={view === 'packs' ? 'active' : ''} onClick={() => void switchView('packs')}>系统方案包</button>
        </div>
        {tenantOptions.length > 1 && (
          <label className="toolbar-field">
            <span>品牌</span>
            <select value={tenantId} onChange={(event) => updateFilter({ tenantId: event.target.value })}>
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name || tenant.code || tenant.id}</option>
              ))}
            </select>
          </label>
        )}
        <div className="toolbar-actions">
          <button className="btn ghost" type="button" onClick={() => void load()} disabled={loading}>刷新</button>
          <button className="btn" type="button" onClick={openCreate}>上新产品</button>
        </div>
      </div>

      {error && <div className="manager-alert" role="alert">{error}</div>}

      {view === 'products' ? (
        <>
          <div className="catalog-filters">
            <label>
              <span>搜索</span>
              <input value={query} onChange={(event) => updateFilter({ q: event.target.value })} placeholder="产品名、SKU、官网型号" />
            </label>
            <label>
              <span>分类</span>
              <select value={category} onChange={(event) => updateFilter({ category: event.target.value })}>
                <option value="all">全部分类</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>状态</span>
              <select value={status} onChange={(event) => updateFilter({ status: event.target.value })}>
                <option value="active">在架</option>
                <option value="archived">已归档</option>
                <option value="all">全部</option>
              </select>
            </label>
            <div className="catalog-summary">
              <span>产品条目</span>
              <strong>{total}</strong>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>产品</th>
                  <th>品牌 / 分类</th>
                  <th>价格</th>
                  <th>官网资料</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="empty" colSpan={6}>加载中...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td className="empty" colSpan={6}>暂无匹配产品。</td></tr>
                ) : products.map((product) => {
                  const editable = isEditableProduct(product, tenantId);
                  const sourceUrl = String(product.spec?.sourceUrl || product.meta?.sourceUrl || '');
                  const officialModel = String(product.spec?.officialModel || product.meta?.officialModel || '');
                  const warningCount = Array.isArray(product.meta?.warnings) ? product.meta.warnings.length : 0;
                  const imageUrl = productImageUrl(product);
                  return (
                    <tr key={`${product.tenantId}:${product.sku}`}>
                      <td>
                        <div className="product-cell">
                          {imageUrl ? (
                            <img className="product-thumb" src={imageUrl} alt={product.name} loading="lazy" />
                          ) : (
                            <span className="product-thumb-empty">无图</span>
                          )}
                          <div>
                            <strong>{product.name}</strong>
                            <small>{product.sku}{officialModel ? ` · ${officialModel}` : ''}</small>
                          </div>
                        </div>
                      </td>
                      <td>{product.brand || '未配置'}<small>{product.category || '未分类'}</small></td>
                      <td>
                        {formatMoney(product.listPrice, product.currency)}
                        <small>{editable ? `成本 ${formatMoney(product.costPrice, product.currency)}` : '公开建议价'}</small>
                      </td>
                      <td>
                        {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">官网来源</a> : <span className="badge warn">缺来源</span>}
                        {warningCount > 0 && <small>{warningCount} 条数据提示</small>}
                      </td>
                      <td><span className={`badge ${product.status === 'active' ? 'ok' : 'warn'}`}>{product.status === 'active' ? '在架' : '已归档'}</span></td>
                      <td>
                        <div className="row-actions">
                          <button className="btn ghost" type="button" disabled={!editable} onClick={() => openEdit(product)}>编辑</button>
                          <button className="btn ghost danger" type="button" disabled={!editable || product.status === 'archived' || saving} onClick={() => void archive(product)}>归档</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pagination-bar">
            <button className="btn ghost" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(value - 1, 1))}>上一页</button>
            <span>{page} / {pages}</span>
            <button className="btn ghost" type="button" disabled={page >= pages || loading} onClick={() => setPage((value) => Math.min(value + 1, pages))}>下一页</button>
          </div>
        </>
      ) : (
        <div className="pack-grid">
          {packsLoading ? <div className="card"><p className="d">系统方案包加载中...</p></div> : packsError ? (
            <div className="manager-alert" role="alert">{packsError}</div>
          ) : packs.length === 0 ? (
            <div className="empty-panel">暂无系统方案包数据。</div>
          ) : packs.map((pack, index) => (
            <article className="card pack-card" key={pack.id || pack.packId || index}>
              <div className="pack-head"><strong>{pack.name || pack.title || '未命名方案包'}</strong><span className="badge red">{pack.level || pack.edition || '标准包'}</span></div>
              <p className="d">{pack.description || pack.positioning || pack.scenario || '-'}</p>
              <div className="pack-meta">
                <span>{pack.items?.length || pack.modules?.length || 0} 个组成项 · {pack.standards?.length || 0} 项标准</span>
                <strong>{pack.bundlePrice != null || pack.price != null ? formatMoney(pack.bundlePrice ?? pack.price) : packCategoryLabel(pack.category)}</strong>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(undefined); }}>
          <form className="brand-dialog product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title" onSubmit={save}>
            <div className="dialog-head">
              <h2 id="product-dialog-title">{editing ? '编辑产品' : '上新产品'}</h2>
              <button className="icon-close" type="button" aria-label="关闭" onClick={() => setEditing(undefined)}>x</button>
            </div>
            <div className="form-grid">
              <label>SKU<input required disabled={Boolean(editing)} value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></label>
              <label>品牌<input required disabled value={form.brand || selectedBrand || '由租户决定'} /></label>
              <label>产品名称<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>产品分类<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
              <label>市场牌价（元）<input type="number" min="0" value={form.listPrice} onChange={(event) => setForm({ ...form, listPrice: Number(event.target.value) })} /></label>
              <label>成本价（元）<input type="number" min="0" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: Number(event.target.value) })} /></label>
              <label>状态<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">在架</option><option value="archived">已归档</option></select></label>
              <label className="span-2">规格摘要<textarea rows={3} value={form.spec} onChange={(event) => setForm({ ...form, spec: event.target.value })} /></label>
              <div className="span-2 positioning-grid">
                {POSITION_DIMS.map((dimension) => (
                  <fieldset key={dimension.key}>
                    <legend>{dimension.label}</legend>
                    <div className="term-list">
                      {(taxonomy[dimension.key] || []).map((term) => {
                        const selected = (form.positioning[dimension.key] as string[]).includes(term.code);
                        return <button className={`term ${selected ? 'active' : ''}`} type="button" key={term.code} onClick={() => toggleTerm(dimension.key, term.code)}>{term.label}</button>;
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
              <label className="span-2">价值主张<input value={form.positioning.valueProposition} onChange={(event) => setForm({ ...form, positioning: { ...form.positioning, valueProposition: event.target.value } })} /></label>
              <label>解决痛点<textarea rows={3} value={form.positioning.painPoints.join('\n')} onChange={(event) => setForm({ ...form, positioning: { ...form.positioning, painPoints: lines(event.target.value) } })} /></label>
              <label>适用场景<textarea rows={3} value={form.positioning.scenarios.join('\n')} onChange={(event) => setForm({ ...form, positioning: { ...form.positioning, scenarios: lines(event.target.value) } })} /></label>
            </div>
            <div className="dialog-actions">
              <button className="btn ghost" type="button" onClick={() => setEditing(undefined)}>取消</button>
              <button className="btn" disabled={saving}>{saving ? '保存中...' : '保存产品'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
