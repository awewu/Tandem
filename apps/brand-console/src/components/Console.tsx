'use client';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

interface Positioning {
  targetSegments: string[]; channels: string[]; userPersonas: string[]; markets: string[];
  valueProposition: string; painPoints: string[]; scenarios: string[];
}
interface AssetRef { role: string; artifactId: string; filename?: string; mimeType?: string; sortOrder?: number }
interface SpecRow { k: string; v: string }
interface FeatureRow { title: string; desc: string }
interface HighlightRow { label: string; value: string }
interface GalleryRow { url: string; alt?: string; filename?: string; artifactId?: string; sortOrder?: number }
interface FaqRow { q: string; a: string }
interface Row {
  id: string; sku: string; slug: string; model: string; name: string; category: string | null; status: string;
  displayOrder: number; listPrice: number; tagline: string; cat: string; sys: string; series: string; tags: string[];
  specs: SpecRow[]; badges: string[]; features: FeatureRow[]; highlights: HighlightRow[];
  en: string; icon: string; image: string; specImage: string; gallery: GalleryRow[]; certs: string[]; faqs: FaqRow[];
  hasImage: boolean; imageRole: string | null; detailImageCount: number;
  positioning: Positioning;
  assetRefs: AssetRef[];
}
type Term = { code: string; label: string };
type Taxonomy = Record<string, Term[]>;

const EMPTY_POS: Positioning = {
  targetSegments: [], channels: [], userPersonas: [], markets: [],
  valueProposition: '', painPoints: [], scenarios: [],
};
// 受控词维度 → 中文标题（自由文本维度另处理）
const POS_DIMS: { key: keyof Positioning; label: string }[] = [
  { key: 'targetSegments', label: '卖给谁' },
  { key: 'channels', label: '渠道' },
  { key: 'userPersonas', label: '用户画像' },
  { key: 'markets', label: '市场/区域' },
];
const CATEGORY_OPTIONS = [
  { value: 'residential', label: '家用产品' },
  { value: 'commercial', label: '商用产品' },
];
const SYSTEM_OPTIONS = [
  { value: 'water-heating', label: '热水系统' },
  { value: 'heating-cooling', label: '采暖与制冷' },
];
const MENU_SERIES_OPTIONS: Record<string, Record<string, { value: string; label: string }[]>> = {
  residential: {
    'water-heating': [
      { value: '冷凝采暖热水两用', label: '燃气冷凝壁挂炉' },
      { value: '零冷水燃气', label: '零冷水燃气热水器' },
      { value: '家用空气能', label: '空气能热水器' },
      { value: '容积式', label: '容积式燃气热水器' },
      { value: '速热电热', label: '电热水器' },
      { value: '热泵两联供', label: '采暖热水两联供' },
    ],
    'heating-cooling': [
      { value: '变频多联机', label: '家用中央空调' },
      { value: '地暖系统', label: '地暖系统' },
      { value: '全热新风', label: '全热新风' },
      { value: '地源热泵', label: '地源热泵' },
    ],
  },
  commercial: {
    'water-heating': [
      { value: '大功率商用', label: '大功率燃气热水炉' },
      { value: '商用空气能', label: '商用空气能机组' },
      { value: '储热水箱', label: '大容积储热水箱' },
      { value: '集中热水站', label: '楼宇集中热水站' },
      { value: '主备热备', label: '串联备用系统' },
      { value: '数字运维', label: '远程运维平台' },
    ],
    'heating-cooling': [
      { value: '风冷热泵', label: '商用风冷热泵机组' },
      { value: '模块机组', label: '商用中央空调（模块机）' },
      { value: '商用采暖炉', label: '商用燃气采暖炉' },
      { value: '商用新风', label: '商用新风机组' },
      { value: '楼宇智控', label: '楼宇智能控制' },
      { value: '运维服务', label: '预防性维护服务' },
    ],
  },
};

function seriesOptionsFor(cat?: string | null, sys?: string | null, current?: string) {
  const options = MENU_SERIES_OPTIONS[cat || 'residential']?.[sys || 'water-heating'] || [];
  if (current && !options.some((option) => option.value === current)) {
    return [...options, { value: current, label: `${current}（当前自定义）` }];
  }
  return options;
}

function defaultSeriesFor(cat?: string | null, sys?: string | null) {
  return seriesOptionsFor(cat, sys)[0]?.value || '';
}

function posFilledCount(p: Positioning): number {
  return POS_DIMS.filter((d) => (p[d.key] as string[]).length > 0).length
    + (p.valueProposition.trim() ? 1 : 0)
    + (p.painPoints.length ? 1 : 0)
    + (p.scenarios.length ? 1 : 0);
}

function structuredFilledCount(r: Row): number {
  return (r.specs?.length ? 1 : 0)
    + (r.badges?.length ? 1 : 0)
    + (r.features?.length ? 1 : 0)
    + (r.highlights?.length ? 1 : 0);
}

function makeDraftProduct(displayOrder: number): Row {
  const seed = Date.now().toString(36);
  const sku = `everhot-new-${seed}`;
  return {
    id: `draft-${seed}`,
    sku,
    slug: sku,
    model: '',
    name: 'Everhot 新品',
    category: 'residential',
    status: 'active',
    displayOrder,
    listPrice: 0,
    tagline: '请填写产品一句话简介',
    cat: 'residential',
    sys: 'water-heating',
    series: defaultSeriesFor('residential', 'water-heating'),
    tags: ['新品'],
    specs: [
      { k: '产品型号', v: '请填写' },
      { k: '适用容量/空间', v: '请填写' },
      { k: '能源类型', v: '请填写' },
    ],
    badges: ['新品'],
    features: [
      { title: '核心功能', desc: '请填写功能说明' },
      { title: '安装适配', desc: '请填写安装条件' },
      { title: '售后保障', desc: '请填写服务保障' },
    ],
    highlights: [
      { label: '能效表现', value: '请填写' },
      { label: '舒适体验', value: '请填写' },
      { label: '适用场景', value: '请填写' },
    ],
    en: '',
    icon: '🔥',
    image: '',
    specImage: '',
    gallery: [],
    certs: ['能效等级：请填写', '认证信息：请填写'],
    faqs: [{ q: '这款产品适合什么场景？', a: '请填写' }],
    hasImage: false,
    imageRole: null,
    detailImageCount: 0,
    positioning: {
      ...EMPTY_POS,
      valueProposition: '请填写一句话价值主张',
      painPoints: ['请填写用户痛点'],
      scenarios: ['请填写适用场景'],
    },
    assetRefs: [],
  };
}

type Toast = { kind: 'ok' | 'bad'; msg: string } | null;
type PendingUpload = {
  sku: string;
  role: 'main' | 'detail' | 'icon';
  filename: string;
  mimeType: string;
  size: number;
  preview: string;
  dataBase64: string;
} | null;

export default function Console({
  userName,
  role,
  canWrite = false,
  initialRows = [],
  initialTotal = 0,
  initialPages = 1,
  initialTaxonomy = {},
}: {
  userName: string;
  role: string;
  canWrite?: boolean;
  initialRows?: Row[];
  initialTotal?: number;
  initialPages?: number;
  initialTaxonomy?: Taxonomy;
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(initialPages);
  const [total, setTotal] = useState(initialTotal || initialRows.length);
  const [dirty, setDirty] = useState<Record<string, Partial<Row>>>({});
  const [loading, setLoading] = useState(initialRows.length === 0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [publishLog, setPublishLog] = useState('');
  const [taxonomy, setTaxonomy] = useState<Taxonomy>(initialTaxonomy);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState<Row | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload>(null);
  const fileFor = useRef<string | null>(null);
  const roleFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const roleLabel = (code: string) => (taxonomy.assetRoles || []).find((t) => t.code === code)?.label || code;
  const mainAsset = (r: Row) => (r.assetRefs || []).find((a) => a.role === 'main') || (r.assetRefs || []).find((a) => a.role === 'card') || null;
  const detailAssets = (r: Row) => (r.assetRefs || []).filter((a) => a.role === 'detail').sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

  const flash = useCallback((kind: 'ok' | 'bad', msg: string) => {
    setToast({ kind, msg }); setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async (override?: { page?: number; query?: string }) => {
    setLoading(true);
    const nextPage = override?.page ?? page;
    const nextQuery = override?.query ?? query;
    const qs = new URLSearchParams({ page: String(nextPage), pageSize: '20' });
    if (nextQuery.trim()) qs.set('q', nextQuery.trim());
    const res = await fetch(`/api/products?${qs.toString()}`);
    if (res.ok) {
      const j = await res.json();
      setRows(j.data.items);
      setTaxonomy(j.data.taxonomy || {});
      setPages(j.data.pages || 1);
      setTotal(j.data.total || j.data.items.length);
      setDirty({});
    }
    else flash('bad', '加载失败：' + res.status);
    setLoading(false);
  }, [flash, page, query]);

  useEffect(() => { load(); }, [load]);

  function edit(sku: string, field: keyof Row, value: any) {
    setDirty((d) => ({ ...d, [sku]: { ...d[sku], [field]: value } }));
  }
  const val = (r: Row, f: keyof Row) => (dirty[r.sku]?.[f] ?? r[f]) as any;

  // ── 定位编辑 ──────────────────────────────────────────────────────────
  const pos = (r: Row): Positioning => (dirty[r.sku]?.positioning ?? r.positioning ?? EMPTY_POS) as Positioning;
  function editPos(r: Row, patch: Partial<Positioning>) {
    edit(r.sku, 'positioning', { ...pos(r), ...patch });
  }
  function toggleTerm(r: Row, dim: keyof Positioning, code: string) {
    const arr = pos(r)[dim] as string[];
    editPos(r, { [dim]: arr.includes(code) ? arr.filter((c) => c !== code) : [...arr, code] } as Partial<Positioning>);
  }
  const toLines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean);
  const draftPositioning = draft?.positioning ?? EMPTY_POS;
  const draftContentFilled = draft ? structuredFilledCount(draft) : 0;

  function editDraft(field: keyof Row, value: any) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  }

  function editDraftPos(patch: Partial<Positioning>) {
    setDraft((current) => current ? {
      ...current,
      positioning: { ...(current.positioning || EMPTY_POS), ...patch },
    } : current);
  }

  function toggleDraftTerm(dim: keyof Positioning, code: string) {
    const arr = (draftPositioning[dim] as string[]) || [];
    editDraftPos({ [dim]: arr.includes(code) ? arr.filter((c) => c !== code) : [...arr, code] } as Partial<Positioning>);
  }

  async function save(sku: string) {
    const patch = dirty[sku]; if (!patch) return;
    setBusy(true);
    const res = await fetch('/api/products', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sku, ...patch }),
    });
    setBusy(false);
    if (res.ok) { flash('ok', `已保存 ${sku}`); await load(); }
    else { const j = await res.json().catch(() => ({})); flash('bad', j.error || '保存失败'); }
  }

  async function toggleStatus(r: Row) {
    const next = val(r, 'status') === 'active' ? 'inactive' : 'active';
    setBusy(true);
    const res = await fetch('/api/products', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sku: r.sku, status: next }),
    });
    setBusy(false);
    if (res.ok) { flash('ok', `${r.sku} 已${next === 'active' ? '上架' : '下架'}`); await load(); }
    else flash('bad', '操作失败');
  }

  async function deleteProduct(r: Row) {
    if (!confirm(`删除 ${r.name}？删除后官网公开数据不再显示该产品，但后台仍保留记录。`)) return;
    setBusy(true);
    const res = await fetch('/api/products', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sku: r.sku, status: 'archived' }),
    });
    setBusy(false);
    if (res.ok) { flash('ok', `${r.sku} 已删除`); await load(); }
    else { const j = await res.json().catch(() => ({})); flash('bad', j.error || '删除失败'); }
  }

  function pickImage(sku: string, role = 'main') { fileFor.current = sku; roleFor.current = role; fileInput.current?.click(); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; const sku = fileFor.current;
    const role = roleFor.current === 'detail' ? 'detail' : roleFor.current === 'icon' ? 'icon' : 'main';
    e.target.value = '';
    if (!file || !sku) return;
    const preview = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.readAsDataURL(file);
    });
    const dataBase64 = preview.split(',')[1] || '';
    setPendingUpload({
      sku,
      role,
      filename: file.name,
      mimeType: file.type || 'image/jpeg',
      size: file.size,
      preview,
      dataBase64,
    });
  }

  async function confirmUpload() {
    const pending = pendingUpload;
    if (!pending) return;
    setBusy(true);
    const res = await fetch('/api/images', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(pending),
    });
    setBusy(false);
    if (res.ok) { flash('ok', `${pending.sku} 图片已保存`); setPendingUpload(null); await load(); }
    else { const j = await res.json().catch(() => ({})); flash('bad', j.error || '上传失败'); }
  }

  async function deleteImage(sku: string, artifactId: string) {
    if (!confirm('删除这张产品图片？')) return;
    setBusy(true);
    const res = await fetch(`/api/images?sku=${encodeURIComponent(sku)}&artifactId=${encodeURIComponent(artifactId)}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) { flash('ok', '图片已删除'); await load(); }
    else { const j = await res.json().catch(() => ({})); flash('bad', j.error || '删除失败'); }
  }

  async function moveDetail(r: Row, artifactId: string, dir: -1 | 1) {
    const details = detailAssets(r);
    const index = details.findIndex((a) => a.artifactId === artifactId);
    const nextIndex = index + dir;
    if (index < 0 || nextIndex < 0 || nextIndex >= details.length) return;
    const next = [...details];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setBusy(true);
    const res = await fetch('/api/images', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sku: r.sku, detailArtifactIds: next.map((a) => a.artifactId) }),
    });
    setBusy(false);
    if (res.ok) { flash('ok', '详情图顺序已更新'); await load(); }
    else { const j = await res.json().catch(() => ({})); flash('bad', j.error || '排序失败'); }
  }

  function addProduct() {
    setDraft((current) => current || makeDraftProduct(total + 1));
    setExpanded(null);
  }

  async function createProduct() {
    if (!draft) return;
    const sku = draft.sku.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(sku)) {
      flash('bad', 'SKU/slug 只能使用英文小写、数字和中横线，例如 evernew-x1');
      return;
    }
    if (rows.some((r) => r.sku === sku || r.slug === sku)) {
      flash('bad', `SKU/slug 已存在：${sku}`);
      return;
    }
    const payload = {
      ...draft,
      sku,
      slug: (draft.slug || sku).trim().toLowerCase(),
      name: draft.name.trim() || sku,
      model: draft.model.trim() || sku,
      createOnly: true,
    };
    setBusy(true);
    const res = await fetch('/api/products', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      setDraft(null);
      setQuery(sku);
      setPage(1);
      await load({ page: 1, query: sku });
      setExpanded(sku);
      flash('ok', `已上新 ${sku}，已打开编辑`);
    }
    else {
      const j = await res.json().catch(() => ({}));
      flash('bad', j.error || '上新失败');
    }
  }

  async function publish() {
    setBusy(true); setPublishLog('发布中…');
    const res = await fetch('/api/publish', { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setPublishLog(j.log || j.error || '(无输出)');
    flash(res.ok ? 'ok' : 'bad', res.ok ? '发布完成：站点数据已从 Nexus 重生成' : ('发布失败：' + (j.error || '')));
  }

  async function logout() { await fetch('/api/session', { method: 'DELETE' }); location.reload(); }

  return (
    <>
      <div className="topbar">
        <span className="brand"><span className="mark">Everhot</span> 品牌运营控制台</span>
        <span className="pill">板块一 · 内部</span>
        <div className="spacer" />
        <span className="pill" title="当前角色">{role === 'brand_admin' ? '管理员' : '只读'}</span>
        <span className="muted">{userName}</span>
        <button className="btn btn-sm" onClick={logout}>登出</button>
      </div>

      <div className="wrap">
        <div className="row" style={{ marginBottom: 16 }}>
          <div className="grow">
            <strong>产品库（{total}）</strong>{' '}
            <span className="muted">· 保存即入库；4017 刷新时从公开 API 读取最新产品信息</span>
          </div>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            placeholder="搜索名称 / slug / 系列"
            style={{ width: 220 }}
          />
          <button className="btn btn-sm" onClick={() => load()} disabled={busy}>刷新</button>
          {canWrite && <button className="btn btn-sm" onClick={addProduct} disabled={busy}>+ 上新</button>}
          {canWrite && <button className="btn btn-sm" onClick={publish} disabled={busy}>生成静态备份</button>}
        </div>

        {draft && (
          <NewProductDraftPanel
            draft={draft}
            taxonomy={taxonomy}
            busy={busy}
            positioning={draftPositioning}
            contentFilled={draftContentFilled}
            onField={editDraft}
            onToggle={toggleDraftTerm}
            onText={editDraftPos}
            toLines={toLines}
            onCreate={createProduct}
            onCancel={() => setDraft(null)}
            onUploadDetail={() => flash('bad', '请先保存新品，再上传产品图片')}
          />
        )}

        {loading ? <p className="muted">加载中…</p> : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="col-sku">SKU</th><th className="col-slug">公开 slug</th><th className="col-name">名称 / 型号</th><th className="col-category">分类</th><th className="col-menu">系统 / 官网菜单分类</th>
                <th className="col-status">状态</th><th className="col-order">排序</th><th className="col-image">图片</th><th className="col-detail">详情</th><th className="col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isDirty = !!dirty[r.sku];
                const status = val(r, 'status');
                const contentFilled = structuredFilledCount({ ...r, ...(dirty[r.sku] || {}) } as Row);
                const isOpen = expanded === r.sku;
                const imageUrl = String(val(r, 'image') || val(r, 'specImage') || '');
                return (
                  <Fragment key={r.sku}>
                  <tr className={isDirty ? 'dirty' : ''}>
                    <td className="muted col-sku">{r.sku}</td>
                    <td className="col-slug"><input value={val(r, 'slug')} onChange={(e) => edit(r.sku, 'slug', e.target.value)} readOnly={!canWrite} /></td>
                    <td className="col-name">
                      <input value={val(r, 'name')} onChange={(e) => edit(r.sku, 'name', e.target.value)} readOnly={!canWrite} />
                      <input value={val(r, 'model')} onChange={(e) => edit(r.sku, 'model', e.target.value)} placeholder="型号" readOnly={!canWrite} style={{ marginTop: 6 }} />
                    </td>
                    <td className="col-category">
                      <select value={val(r, 'category') || 'residential'} onChange={(e) => {
                        const nextCategory = e.target.value;
                        const nextSys = val(r, 'sys') || 'water-heating';
                        edit(r.sku, 'category', nextCategory);
                        edit(r.sku, 'series', defaultSeriesFor(nextCategory, nextSys));
                      }} disabled={!canWrite}>
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="col-menu">
                      <select value={val(r, 'sys') || 'water-heating'} onChange={(e) => {
                        const nextSys = e.target.value;
                        const nextCategory = val(r, 'category') || 'residential';
                        edit(r.sku, 'sys', nextSys);
                        edit(r.sku, 'series', defaultSeriesFor(nextCategory, nextSys));
                      }} disabled={!canWrite}>
                        {SYSTEM_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <select value={val(r, 'series') || ''} onChange={(e) => edit(r.sku, 'series', e.target.value)} disabled={!canWrite} style={{ marginTop: 6 }}>
                        {seriesOptionsFor(val(r, 'category'), val(r, 'sys'), val(r, 'series')).map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="col-status">
                      <span className={'tag ' + (status === 'active' ? 'tag-on' : 'tag-off')}>{status === 'active' ? '在架' : status === 'archived' ? '已删除' : '下架'}</span>
                    </td>
                    <td className="col-order">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={val(r, 'displayOrder') ?? 0}
                        onChange={(e) => edit(r.sku, 'displayOrder', Math.max(0, Number(e.target.value) || 0))}
                        readOnly={!canWrite}
                        style={{ width: 72 }}
                      />
                    </td>
                    <td className="col-image">
                      {imageUrl
                        ? <img src={imageUrl} alt={r.name} style={{ width: 54, height: 40, objectFit: 'contain', background: '#f7f7f7', borderRadius: 6 }} />
                        : r.hasImage
                        ? <span className="tag tag-img">主图{r.detailImageCount ? ` +${r.detailImageCount}` : ''}</span>
                        : <span className="muted">—</span>}
                    </td>
                    <td className="col-detail">
                      <button className="btn btn-sm" onClick={() => setExpanded(isOpen ? null : r.sku)}
                        title="编辑官网详情字段">
                        {isOpen ? '收起 ▲' : '编辑 ▾'}
                      </button>
                    </td>
                    <td className="col-actions">
                      {canWrite ? (
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => save(r.sku)} disabled={!isDirty || busy}>保存</button>
                        <button className="btn btn-sm" onClick={() => toggleStatus(r)} disabled={busy}>{status === 'active' ? '下架' : '上架'}</button>
                        <button className="btn btn-sm" onClick={() => deleteProduct(r)} disabled={busy}>删除</button>
                        <button className="btn btn-sm" onClick={() => pickImage(r.sku, 'main')} disabled={busy}>主图</button>
                      </div>
                      ) : <span className="muted">只读</span>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className={isDirty ? 'dirty' : ''}>
                      <td colSpan={10} style={{ background: '#fafafa', padding: '14px 18px' }}>
                        <ProductOfficialCopyEditor
                          tagline={val(r, 'tagline') || ''}
                          tags={val(r, 'tags') || []}
                          readOnly={!canWrite}
                          onTagline={(value) => edit(r.sku, 'tagline', value)}
                          onTags={(items) => edit(r.sku, 'tags', items)}
                        />
                        <ProductContentListsEditor
                          specs={val(r, 'specs') || []}
                          badges={val(r, 'badges') || []}
                          features={val(r, 'features') || []}
                          highlights={val(r, 'highlights') || []}
                          filled={contentFilled}
                          readOnly={!canWrite}
                          onSpecs={(items) => edit(r.sku, 'specs', items)}
                          onBadges={(items) => edit(r.sku, 'badges', items)}
                          onFeatures={(items) => edit(r.sku, 'features', items)}
                          onHighlights={(items) => edit(r.sku, 'highlights', items)}
                        />
                        <ProductWebsiteFieldsEditor
                          en={val(r, 'en') || ''}
                          icon={val(r, 'icon') || ''}
                          image={val(r, 'image') || ''}
                          specImage={val(r, 'specImage') || ''}
                          gallery={val(r, 'gallery') || []}
                          certs={val(r, 'certs') || []}
                          faqs={val(r, 'faqs') || []}
                          readOnly={!canWrite}
                          onEn={(value) => edit(r.sku, 'en', value)}
                          onIcon={(value) => edit(r.sku, 'icon', value)}
                          onImage={(value) => edit(r.sku, 'image', value)}
                          onSpecImage={(value) => edit(r.sku, 'specImage', value)}
                          onGallery={(items) => edit(r.sku, 'gallery', items)}
                          onCerts={(items) => edit(r.sku, 'certs', items)}
                          onFaqs={(items) => edit(r.sku, 'faqs', items)}
                          onUploadMain={() => pickImage(r.sku, 'main')}
                          onUploadIcon={() => pickImage(r.sku, 'icon')}
                        />
                        {canWrite && (
                          <div className="row" style={{ gap: 6, marginTop: 12 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => save(r.sku)} disabled={!isDirty || busy}>保存官网字段</button>
                            <span className="muted" style={{ fontSize: 12 }}>定位由 D2 录入；再次跑品牌同步脚本不会覆盖此处内容。</span>
                          </div>
                        )}

                        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #eee' }}>
                          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>素材引用（DAM，只存引用）</div>
                          <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            {(r.assetRefs || []).length === 0 && <span className="muted" style={{ fontSize: 12 }}>暂无素材</span>}
                            {(r.assetRefs || []).filter((a) => a.role === 'main' || a.role === 'card').map((a) => (
                              <span key={a.artifactId} className="tag tag-img" title={a.filename || a.artifactId}>{roleLabel(a.role)}</span>
                            ))}
                          </div>
                          {canWrite && (
                            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                              {(taxonomy.assetRoles || []).filter((t) => t.code === 'main').map((t) => (
                                <button key={t.code} className="btn btn-sm" disabled={busy}
                                  onClick={() => pickImage(r.sku, 'main')} title={`上传${t.label}`}>+ {t.label}</button>
                              ))}
                            </div>
                          )}
                          {canWrite && (
                            <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                              {mainAsset(r) && (
                                <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <span className="muted" style={{ fontSize: 12 }}>主图：{mainAsset(r)?.filename || mainAsset(r)?.artifactId}</span>
                                  <button className="btn btn-sm" disabled={busy} onClick={() => deleteImage(r.sku, mainAsset(r)!.artifactId)}>删除主图</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        )}

        {!loading && (
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button className="btn btn-sm" disabled={busy || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
            <span className="muted">第 {page} / {pages} 页</span>
            <button className="btn btn-sm" disabled={busy || page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>下一页</button>
          </div>
        )}

        {publishLog && <div className="log">{publishLog}</div>}
      </div>

      <input ref={fileInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />
      {pendingUpload && (
        <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 20, width: 320, background: '#fff', border: '1px solid #ddd', borderRadius: 8, boxShadow: '0 12px 30px rgba(0,0,0,.18)', padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {pendingUpload.role === 'main' ? '主图预览' : pendingUpload.role === 'icon' ? '图标预览' : '详情图预览'}
          </div>
          <img src={pendingUpload.preview} alt={pendingUpload.filename} style={{ width: '100%', maxHeight: 180, objectFit: 'contain', background: '#f7f7f7', borderRadius: 6, marginBottom: 10 }} />
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>
            <div>文件：{pendingUpload.filename}</div>
            <div>类型：{pendingUpload.mimeType}</div>
            <div>大小：{Math.round(pendingUpload.size / 1024)} KB</div>
          </div>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn btn-sm" disabled={busy} onClick={() => setPendingUpload(null)}>取消</button>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={confirmUpload}>确认上传</button>
          </div>
        </div>
      )}
      {toast && <div className={'toast ' + toast.kind}>{toast.msg}</div>}
    </>
  );
}

// ── 定位编辑器：受控词标签 + 自由文本（卖点/痛点/场景）───────────────────────
function listText(items: unknown): string {
  if (typeof items === 'string') return items;
  if (!Array.isArray(items)) return '';
  return (items || []).join('\n');
}

function pairText<T extends object>(items: unknown, left: keyof T, right: keyof T): string {
  if (typeof items === 'string') return items;
  if (!Array.isArray(items)) return '';
  return (items || [])
    .map((item) => [String(item[left] || ''), String(item[right] || '')].filter(Boolean).join(' | '))
    .join('\n');
}

function parseTextList(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function parsePairList<T extends object>(value: string, left: keyof T, right: keyof T): T[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s*[|:：]\s*/);
      return { [left]: String(parts.shift() || '').trim(), [right]: parts.join(' ').trim() } as T;
    })
    .filter((item) => item[left] || item[right]);
}

const toObjectList = parsePairList;

function galleryText(items: unknown): string {
  if (typeof items === 'string') return items;
  if (!Array.isArray(items)) return '';
  return (items || [])
    .map((item) => [item.url, item.alt].filter(Boolean).join(' | '))
    .join('\n');
}

function parseGalleryList(value: string): GalleryRow[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s*[|]\s*/);
      return { url: String(parts.shift() || '').trim(), alt: parts.join(' ').trim() };
    })
    .filter((item) => item.url);
}

function isImageUrl(value: string): boolean {
  return /^https?:\/\//.test(value) || value.startsWith('/api/') || value.startsWith('/assets/') || value.startsWith('data:image/');
}

function ProductOfficialCopyEditor({
  tagline, tags, readOnly, onTagline, onTags,
}: {
  tagline: string;
  tags: string[];
  readOnly: boolean;
  onTagline: (value: string) => void;
  onTags: (value: string[]) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(360px, 2fr)', gap: 12 }}>
      <label>
        <span className="muted" style={{ fontSize: 12 }}>营销/搜索标签，逗号分隔</span>
        <input style={{ width: '100%', marginTop: 6 }} value={(tags || []).join(', ')} readOnly={readOnly}
          placeholder="例如：新品, 高效节能, 商用"
          onChange={(e) => onTags(e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />
      </label>
      <label>
        <span className="muted" style={{ fontSize: 12 }}>官网详情简介 tagline：显示在产品名下方</span>
        <input style={{ width: '100%', marginTop: 6 }} value={tagline} readOnly={readOnly}
          placeholder="例如：直流变频一拖多，静音舒适，隐藏式安装更美观。"
          onChange={(e) => onTagline(e.target.value)} />
      </label>
    </div>
  );
}

function NewProductDraftPanel({
  draft,
  taxonomy,
  busy,
  positioning,
  contentFilled,
  onField,
  onToggle,
  onText,
  toLines,
  onCreate,
  onCancel,
  onUploadDetail,
}: {
  draft: Row;
  taxonomy: Taxonomy;
  busy: boolean;
  positioning: Positioning;
  contentFilled: number;
  onField: (field: keyof Row, value: any) => void;
  onToggle: (dim: keyof Positioning, code: string) => void;
  onText: (patch: Partial<Positioning>) => void;
  toLines: (value: string) => string[];
  onCreate: () => void;
  onCancel: () => void;
  onUploadDetail: () => void;
}) {
  const inputStyle = { width: '100%', marginTop: 6 };
  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="grow">
          <strong>新品模板</strong>{' '}
          <span className="muted">· 保存后会进入产品库，并自动打开同一套修改界面</span>
        </div>
        <button className="btn btn-sm" disabled={busy} onClick={onCancel}>取消</button>
        <button className="btn btn-primary btn-sm" disabled={busy || !draft.sku.trim()} onClick={onCreate}>保存新品</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>SKU</span>
          <input style={inputStyle} value={draft.sku}
            onChange={(e) => {
              const next = e.target.value.trim().toLowerCase();
              const shouldSyncSlug = !draft.slug || draft.slug === draft.sku;
              onField('sku', next);
              if (shouldSyncSlug) onField('slug', next);
            }} />
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>公开 slug</span>
          <input style={inputStyle} value={draft.slug}
            onChange={(e) => onField('slug', e.target.value.trim().toLowerCase())} />
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>产品名称</span>
          <input style={inputStyle} value={draft.name}
            onChange={(e) => onField('name', e.target.value)} />
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>型号</span>
          <input style={inputStyle} value={draft.model}
            onChange={(e) => onField('model', e.target.value)} />
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>分类</span>
          <select style={inputStyle} value={draft.category || 'residential'}
            onChange={(e) => {
              const nextCategory = e.target.value;
              const nextSys = draft.sys || 'water-heating';
              onField('category', nextCategory);
              onField('cat', nextCategory);
              onField('series', defaultSeriesFor(nextCategory, nextSys));
            }}>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>系统</span>
          <select style={inputStyle} value={draft.sys || 'water-heating'}
            onChange={(e) => {
              const nextSys = e.target.value;
              onField('sys', nextSys);
              onField('series', defaultSeriesFor(draft.category, nextSys));
            }}>
            {SYSTEM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>官网菜单分类</span>
          <select style={inputStyle} value={draft.series || ''}
            onChange={(e) => onField('series', e.target.value)}>
            {seriesOptionsFor(draft.category, draft.sys, draft.series).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>状态</span>
          <select style={inputStyle} value={draft.status || 'active'}
            onChange={(e) => onField('status', e.target.value)}>
            <option value="active">在架</option>
            <option value="inactive">下架</option>
          </select>
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>排序</span>
          <input style={inputStyle} type="number" min={0} step={1} value={draft.displayOrder}
            onChange={(e) => onField('displayOrder', Math.max(0, Number(e.target.value) || 0))} />
        </label>
      </div>

      <ProductOfficialCopyEditor
        tagline={draft.tagline}
        tags={draft.tags}
        readOnly={false}
        onTagline={(value) => onField('tagline', value)}
        onTags={(value) => onField('tags', value)}
      />
      <ProductContentListsEditor
        specs={draft.specs}
        badges={draft.badges}
        features={draft.features}
        highlights={draft.highlights}
        filled={contentFilled}
        readOnly={false}
        onSpecs={(value) => onField('specs', value)}
        onBadges={(value) => onField('badges', value)}
        onFeatures={(value) => onField('features', value)}
        onHighlights={(value) => onField('highlights', value)}
      />
      <ProductWebsiteFieldsEditor
        en={draft.en}
        icon={draft.icon}
        image={draft.image}
        specImage={draft.specImage}
        gallery={draft.gallery}
        certs={draft.certs}
        faqs={draft.faqs}
        readOnly={false}
        onEn={(value) => onField('en', value)}
        onIcon={(value) => onField('icon', value)}
        onImage={(value) => onField('image', value)}
        onSpecImage={(value) => onField('specImage', value)}
        onGallery={(value) => onField('gallery', value)}
        onCerts={(value) => onField('certs', value)}
        onFaqs={(value) => onField('faqs', value)}
        onUploadMain={onUploadDetail}
        onUploadIcon={onUploadDetail}
      />
    </div>
  );
}

function ProductContentListsEditor({
  specs, badges, features, highlights, filled, readOnly, onSpecs, onBadges, onFeatures, onHighlights,
}: {
  specs: unknown;
  badges: unknown;
  features: unknown;
  highlights: unknown;
  filled: number;
  readOnly: boolean;
  onSpecs: (value: string) => void;
  onBadges: (value: string) => void;
  onFeatures: (value: string) => void;
  onHighlights: (value: string) => void;
}) {
  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #eee' }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        规格与亮点 structured lists ({filled}/4)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>规格 specs：每行 参数 | 值</span>
          <textarea rows={5} style={{ width: '100%', marginTop: 6 }} readOnly={readOnly}
            value={pairText(specs, 'k', 'v')}
            onChange={(e) => onSpecs(e.target.value)} />
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>亮点 highlights：每行 指标 | 数值</span>
          <textarea rows={5} style={{ width: '100%', marginTop: 6 }} readOnly={readOnly}
            value={pairText(highlights, 'label', 'value')}
            onChange={(e) => onHighlights(e.target.value)} />
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>功能 features：每行 标题 | 描述</span>
          <textarea rows={5} style={{ width: '100%', marginTop: 6 }} readOnly={readOnly}
            value={pairText(features, 'title', 'desc')}
            onChange={(e) => onFeatures(e.target.value)} />
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>徽章 badges：每行一条</span>
          <textarea rows={5} style={{ width: '100%', marginTop: 6 }} readOnly={readOnly}
            value={listText(badges)}
            onChange={(e) => onBadges(e.target.value)} />
        </label>
      </div>
    </div>
  );
}

function ProductWebsiteFieldsEditor({
  en, icon, image, specImage, gallery, certs, faqs, readOnly,
  onEn, onIcon, onImage, onSpecImage, onGallery, onCerts, onFaqs, onUploadMain, onUploadIcon,
}: {
  en: string;
  icon: string;
  image: string;
  specImage: string;
  gallery: unknown;
  certs: unknown;
  faqs: unknown;
  readOnly: boolean;
  onEn: (value: string) => void;
  onIcon: (value: string) => void;
  onImage: (value: string) => void;
  onSpecImage: (value: string) => void;
  onGallery: (value: string) => void;
  onCerts: (value: string) => void;
  onFaqs: (value: string) => void;
  onUploadMain: () => void;
  onUploadIcon: () => void;
}) {
  const iconValue = icon || '🔥';
  const iconIsImage = isImageUrl(iconValue);
  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #eee' }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        官网展示字段
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))', gap: 14 }}>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>英文名 en</span>
          <input style={{ width: '100%', marginTop: 6 }} value={en} readOnly={readOnly}
            onChange={(e) => onEn(e.target.value)} />
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>产品图标</span>
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <span aria-hidden="true" style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #DDE0DC', borderRadius: 6, background: '#fff', fontSize: 20 }}>
              {iconIsImage
                ? <img src={iconValue} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 4 }} />
                : iconValue}
            </span>
            <button type="button" className="btn btn-sm" disabled={readOnly} onClick={onUploadIcon}>
              {iconIsImage ? '更换图标' : '上传图标'}
            </button>
            <span className="muted" style={{ fontSize: 12 }}>{iconIsImage ? '已上传图标' : '未上传时使用默认图标'}</span>
          </div>
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>产品主图</span>
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <button type="button" className="btn btn-sm" disabled={readOnly} onClick={onUploadMain}>
              {image ? '更换主图' : '上传主图'}
            </button>
            <span className="muted" style={{ fontSize: 12 }}>{image ? '已上传主图' : '建议上传 1 张清晰产品主图'}</span>
          </div>
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>参数图（可选 URL）</span>
          <input style={{ width: '100%', marginTop: 6 }} value={specImage} readOnly={readOnly}
            onChange={(e) => onSpecImage(e.target.value)} />
        </label>
      </div>
      {(image || specImage) && (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          {image && <img src={image} alt="主图预览" style={{ width: 120, height: 86, objectFit: 'contain', background: '#f7f7f7', borderRadius: 6 }} />}
          {specImage && <img src={specImage} alt="参数图预览" style={{ width: 120, height: 86, objectFit: 'contain', background: '#f7f7f7', borderRadius: 6 }} />}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginTop: 14 }}>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>认证 certs：每行一条</span>
          <textarea rows={5} style={{ width: '100%', marginTop: 6 }} readOnly={readOnly}
            value={listText(certs)}
            onChange={(e) => onCerts(e.target.value)} />
        </label>
        <label>
          <span className="muted" style={{ fontSize: 12 }}>FAQ：每行 问题 | 回答</span>
          <textarea rows={5} style={{ width: '100%', marginTop: 6 }} readOnly={readOnly}
            value={pairText(faqs, 'q', 'a')}
            onChange={(e) => onFaqs(e.target.value)} />
        </label>
      </div>
    </div>
  );
}

function PositioningEditor({
  p, taxonomy, readOnly, onToggle, onText, toLines,
}: {
  r: Row;
  p: Positioning;
  taxonomy: Taxonomy;
  readOnly: boolean;
  onToggle: (dim: keyof Positioning, code: string) => void;
  onText: (patch: Partial<Positioning>) => void;
  toLines: (v: string) => string[];
}) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))', gap: 14 }}>
        {POS_DIMS.map((dim) => {
          const terms = taxonomy[dim.key] || [];
          const selected = p[dim.key] as string[];
          return (
            <div key={dim.key}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{dim.label}</div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {terms.length === 0 && <span className="muted" style={{ fontSize: 12 }}>（无词表）</span>}
                {terms.map((t) => {
                  const on = selected.includes(t.code);
                  return (
                    <button key={t.code} type="button" disabled={readOnly}
                      onClick={() => onToggle(dim.key, t.code)}
                      className={'tag ' + (on ? 'tag-on' : 'tag-off')}
                      style={{ cursor: readOnly ? 'default' : 'pointer', border: 'none' }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>为何设计 · 一句话价值主张</div>
        <input style={{ width: '100%' }} value={p.valueProposition} readOnly={readOnly}
          placeholder="例：为南方潮湿别墅提供恒温恒湿的舒适解决方案"
          onChange={(e) => onText({ valueProposition: e.target.value })} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>解决的痛点（每行一条）</div>
          <textarea rows={3} style={{ width: '100%' }} readOnly={readOnly}
            value={p.painPoints.join('\n')}
            onChange={(e) => onText({ painPoints: toLines(e.target.value) })} />
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>适用场景（每行一条）</div>
          <textarea rows={3} style={{ width: '100%' }} readOnly={readOnly}
            value={p.scenarios.join('\n')}
            onChange={(e) => onText({ scenarios: toLines(e.target.value) })} />
        </div>
      </div>
    </div>
  );
}
