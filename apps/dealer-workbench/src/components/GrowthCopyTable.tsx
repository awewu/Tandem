'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { WorkbenchPaginationFooter } from './WorkbenchCore';
import { brandSites, growthCopy, wechatPublishing } from '../lib/api';

type CopyAsset = {
  id: string;
  channel: string;
  brandSlug: string | null;
  prompt: string;
  draft: string | null;
  status: string;
  reviewer: string | null;
  complianceFlags: string[];
  createdAt: string;
  updatedAt: string;
};

type SortBy = 'channel' | 'brandSlug' | 'status' | 'createdAt';
type SortOrder = 'ASC' | 'DESC';
type WechatAccountOption = { id: string; displayName: string; brandId: string; appIdMasked: string };
type BrandOption = { id: string; label: string };

const CHANNELS = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'douyin', label: '抖音' },
  { value: 'zhihu', label: '知乎' },
  { value: 'wechat', label: '微信公众号' },
  { value: 'seo', label: 'SEO' },
  { value: 'ad', label: '广告投放' },
];
const DEFAULT_BRANDS: BrandOption[] = [
  { id: 'rheem', label: 'Rheem' },
  { id: 'ruud', label: 'Ruud' },
  { id: 'everhot', label: 'Everhot' },
];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const SORTABLE_COLUMNS: Array<{ key: SortBy; label: string }> = [
  { key: 'channel', label: '渠道' },
  { key: 'brandSlug', label: '品牌' },
  { key: 'status', label: '状态' },
  { key: 'createdAt', label: '创建时间' },
];
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'badge badge-grey' },
  approved: { label: '已审核', className: 'badge badge-success' },
  rejected: { label: '已拒绝', className: 'badge badge-danger' },
  published: { label: '已发布', className: 'badge badge-info' },
};
const CHANNEL_HEADINGS: Record<string, string[]> = {
  xiaohongshu: ['小红书', 'xiaohongshu'],
  douyin: ['抖音', 'douyin'],
  zhihu: ['知乎', 'zhihu'],
  wechat: ['公众号', '微信公众号', 'wechat'],
  seo: ['seo'],
  ad: ['广告投放', '广告', 'ad'],
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function channelLabel(value?: string | null) {
  if (value?.startsWith('geo-')) return '中心AI';
  return CHANNELS.find((item) => item.value === value)?.label || value || '-';
}

function statusBadge(status: string) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'badge badge-grey' };
  return <span className={config.className} style={{ display: 'inline-flex', whiteSpace: 'nowrap' }}>{config.label}</span>;
}

function normalizeWechatBrand(value?: string | null) {
  const brand = String(value || '').trim().toLowerCase();
  if (brand.includes('ruud') || brand.includes('瑞德')) return 'ruud';
  if (brand.includes('everhot') || brand.includes('恒热')) return 'everhot';
  return 'rheem';
}

function wechatSubmitMissingReason(form: { accountIds: string[]; digest: string; coverAssetId: string }) {
  if (!form.accountIds.length) return '请先选择至少一个公众号';
  if (!form.coverAssetId.trim()) return '请填写封面素材 ID';
  if (!form.digest.trim()) return '请填写公众号摘要';
  return '';
}

function normalizeHeading(value: string) {
  return String(value || '').trim().replace(/\s+/g, '').replace(/[：:]/g, '').toLowerCase();
}

function extractChannelDraft(text: string, channel?: string | null) {
  const source = String(text || '').trim();
  const labels = (CHANNEL_HEADINGS[String(channel || '')] || [String(channel || '')]).map(normalizeHeading);
  const matches = Array.from(source.matchAll(/^#{1,6}\s*渠道\s*[：:]\s*([^\n\r#]+)\s*$/gim));
  for (let index = 0; index < matches.length; index += 1) {
    const heading = normalizeHeading(matches[index][1] || '');
    if (!labels.some((label) => label && heading.includes(label))) continue;
    const start = matches[index].index || 0;
    const end = index + 1 < matches.length ? matches[index + 1].index || source.length : source.length;
    return source.slice(start, end).trim().replace(/\n\s*---\s*$/g, '').trim();
  }
  return source;
}

function copyText(item?: Pick<CopyAsset, 'draft' | 'prompt' | 'channel'> | null, fallback = '') {
  return extractChannelDraft(item?.draft || fallback || item?.prompt || '', item?.channel);
}

function truncate(value: string, max = 150) {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max)}...` : compact;
}

export default function GrowthCopyTable() {
  const [allItems, setAllItems] = useState<CopyAsset[]>([]);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>(DEFAULT_BRANDS);
  const [generateForm, setGenerateForm] = useState({ channel: 'xiaohongshu', brandSlug: DEFAULT_BRANDS[0].id, prompt: '' });
  const [generateBusy, setGenerateBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewItem, setPreviewItem] = useState<CopyAsset | null>(null);
  const [previewDraft, setPreviewDraft] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [wechatSubmitOpen, setWechatSubmitOpen] = useState(false);
  const [wechatAccounts, setWechatAccounts] = useState<WechatAccountOption[]>([]);
  const [wechatForm, setWechatForm] = useState({ brandId: DEFAULT_BRANDS[0].id, accountIds: [] as string[], digest: '', coverAssetId: '', sourceUrl: '' });
  const [wechatBusy, setWechatBusy] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await growthCopy.list();
      setAllItems(Array.isArray(result?.items) ? result.items : []);
    } catch (loadError) {
      setError((loadError as Error).message || '文案加载失败');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    brandSites.list()
      .then((result) => {
        if (cancelled) return;
        const items = Array.isArray(result?.items) ? result.items : [];
        const next = items
          .filter((site: any) => String(site?.status || 'active') === 'active')
          .map((site: any) => {
            const id = String(site?.code || '').trim().toLowerCase();
            const label = `${site?.nameCn || site?.name_cn || site?.nameEn || site?.name_en || id} ${site?.nameEn || site?.name_en || ''}`.trim();
            return id ? { id, label } : null;
          })
          .filter(Boolean) as BrandOption[];
        if (!next.length) return;
        setBrandOptions(next);
        setGenerateForm((current) => next.some((brand) => brand.id === current.brandSlug)
          ? current
          : { ...current, brandSlug: next[0].id });
        setWechatForm((current) => next.some((brand) => brand.id === current.brandId)
          ? current
          : { ...current, brandId: next[0].id });
      })
      .catch(() => setBrandOptions(DEFAULT_BRANDS));
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveBrandOption = useCallback((value?: string | null) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    return brandOptions.find((brand) => {
      const label = brand.label.toLowerCase();
      return brand.id.toLowerCase() === normalized || label === normalized || label.includes(normalized) || normalized.includes(brand.id.toLowerCase());
    }) || null;
  }, [brandOptions]);

  const displayBrand = useCallback((value?: string | null) => {
    if (!value) return '-';
    return resolveBrandOption(value)?.label || value;
  }, [resolveBrandOption]);

  const filtered = useMemo(() => allItems.filter((item) => {
    const haystack = `${item.prompt || ''} ${item.draft || ''}`.toLowerCase();
    if (debouncedKeyword && !haystack.includes(debouncedKeyword.toLowerCase())) return false;
    if (channelFilter !== 'all' && item.channel !== channelFilter) return false;
    if (brandFilter !== 'all') {
      if (brandFilter === '' && item.brandSlug) return false;
      if (brandFilter !== '') {
        const option = resolveBrandOption(item.brandSlug);
        if ((option?.id || String(item.brandSlug || '').trim().toLowerCase()) !== brandFilter) return false;
      }
    }
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  }), [allItems, brandFilter, channelFilter, debouncedKeyword, resolveBrandOption, statusFilter]);

  const sorted = useMemo(() => [...filtered].sort((left, right) => {
    const leftValue = String(left[sortBy] || '').toLowerCase();
    const rightValue = String(right[sortBy] || '').toLowerCase();
    const result = leftValue.localeCompare(rightValue, 'zh-CN');
    return sortOrder === 'ASC' ? result : -result;
  }), [filtered, sortBy, sortOrder]);

  const totalPages = Math.max(Math.ceil(sorted.length / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const items = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleIds = items.map((item) => item.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      const selectedVisible = visibleIds.filter((id) => selectedIds.includes(id)).length;
      headerCheckboxRef.current.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
    }
  }, [selectedIds, visibleIds]);

  function patchGenerateForm(patch: Partial<typeof generateForm>) {
    setGenerateForm((current) => ({ ...current, ...patch }));
  }

  function toggleSort(column: SortBy) {
    if (sortBy === column) setSortOrder((current) => current === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(column); setSortOrder('ASC'); }
    setPage(1);
  }

  function sortIcon(column: SortBy) {
    if (sortBy !== column) return <ChevronsUpDown size={12} style={{ color: 'var(--t-tertiary)' }} />;
    return sortOrder === 'ASC' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  }

  function toggleVisible(checked: boolean) {
    setSelectedIds((current) => checked
      ? Array.from(new Set([...current, ...visibleIds]))
      : current.filter((id) => !visibleIds.includes(id)));
  }

  async function generate() {
    if (!generateForm.prompt.trim()) return setError('请填写文案需求');
    setGenerateBusy(true); setError(''); setMessage('');
    try {
      const result = await growthCopy.generate({
        channel: generateForm.channel,
        brandSlug: generateForm.brandSlug || undefined,
        prompt: generateForm.prompt.trim(),
      });
      if (result?.asset) {
        setPreviewItem(result.asset);
        setPreviewDraft(copyText(result.asset, result.draft));
      }
      setMessage('文案已生成');
      patchGenerateForm({ prompt: '' });
      await load();
    } catch (generateError) {
      setError((generateError as Error).message || '文案生成失败');
    } finally { setGenerateBusy(false); }
  }

  async function approve(id: string) {
    setBusy(true); setError('');
    try { await growthCopy.approve(id); setMessage('文案已审核通过'); await load(); }
    catch (approveError) { setError((approveError as Error).message || '审核失败'); }
    finally { setBusy(false); }
  }

  async function reject(id: string) {
    setBusy(true); setError('');
    try { await growthCopy.reject(id); setMessage('文案已拒绝'); await load(); }
    catch (rejectError) { setError((rejectError as Error).message || '拒绝失败'); }
    finally { setBusy(false); }
  }

  async function removeRejected(id: string) {
    if (!window.confirm('确定删除这条已拒绝文案吗？删除后不会进入归档复用。')) return;
    setBusy(true); setError('');
    try {
      await growthCopy.remove(id);
      setSelectedIds((current) => current.filter((item) => item !== id));
      setMessage('已删除废弃文案');
      await load();
    } catch (removeError) { setError((removeError as Error).message || '删除失败'); }
    finally { setBusy(false); }
  }

  async function bulkApprove() {
    const ids = allItems.filter((item) => selectedIds.includes(item.id) && item.status === 'draft' && !item.complianceFlags.length).map((item) => item.id);
    if (!ids.length) return setError('选中的文案中没有可审核通过的草稿');
    setBulkBusy(true); setError('');
    try { await Promise.all(ids.map(growthCopy.approve)); setMessage(`已批量审核通过 ${ids.length} 条文案`); setSelectedIds([]); await load(); }
    catch (bulkError) { setError((bulkError as Error).message || '批量审核失败'); }
    finally { setBulkBusy(false); }
  }

  async function bulkReject() {
    const ids = allItems.filter((item) => selectedIds.includes(item.id) && item.status === 'draft').map((item) => item.id);
    if (!ids.length) return setError('选中的文案中没有可拒绝的草稿');
    setBulkBusy(true); setError('');
    try { await Promise.all(ids.map(growthCopy.reject)); setMessage(`已批量拒绝 ${ids.length} 条文案`); setSelectedIds([]); await load(); }
    catch (bulkError) { setError((bulkError as Error).message || '批量拒绝失败'); }
    finally { setBulkBusy(false); }
  }

  async function savePreview() {
    if (!previewItem) return;
    setSaveBusy(true); setError('');
    try {
      const result = await growthCopy.update(previewItem.id, { draft: previewDraft });
      if (result?.asset) setPreviewItem(result.asset);
      setMessage('文案已保存');
      await load();
    } catch (saveError) { setError((saveError as Error).message || '保存失败'); }
    finally { setSaveBusy(false); }
  }

  async function approvePreview() {
    if (!previewItem) return;
    setBusy(true); setError('');
    try {
      if (previewDraft !== copyText(previewItem)) await growthCopy.update(previewItem.id, { draft: previewDraft });
      await growthCopy.approve(previewItem.id);
      setPreviewItem(null); setMessage('文案已审核通过'); await load();
    } catch (approveError) { setError((approveError as Error).message || '审核失败'); }
    finally { setBusy(false); }
  }

  async function loadWechatAccounts(brandId: string) {
    setWechatBusy(true);
    setError('');
    try {
      const result = await wechatPublishing.availableAccounts(brandId);
      const accounts = Array.isArray(result?.items) ? result.items : [];
      setWechatAccounts(accounts);
      setWechatForm((current) => ({ ...current, accountIds: accounts.length === 1 ? [accounts[0].id] : [] }));
    } catch (loadError) {
      setWechatAccounts([]);
      setError((loadError as Error).message || '公众号加载失败');
    } finally {
      setWechatBusy(false);
    }
  }

  async function openWechatSubmit() {
    if (!previewItem) return;
    const brandId = resolveBrandOption(previewItem.brandSlug)?.id || normalizeWechatBrand(previewItem.brandSlug);
    setWechatSubmitOpen(true);
    setWechatForm((current) => ({
      ...current,
      brandId,
      digest: current.digest || truncate(copyText(previewItem), 80),
      accountIds: [],
    }));
    await loadWechatAccounts(brandId);
  }

  async function submitWechatReview() {
    if (!previewItem) return;
    const missingReason = wechatSubmitMissingReason(wechatForm);
    if (missingReason) {
      setError(missingReason);
      return;
    }
    setWechatBusy(true);
    setError('');
    try {
      const title = truncate(copyText(previewItem).split(/\n/)[0] || previewItem.prompt, 56);
      const body = copyText({ ...previewItem, draft: previewDraft });
      await Promise.all(wechatForm.accountIds.map((accountId) => wechatPublishing.createReviewVersion({
        sourceContentId: previewItem.id,
        brandId: wechatForm.brandId,
        brandName: brandOptions.find((brand) => brand.id === wechatForm.brandId)?.label || wechatForm.brandId,
        accountId,
        title,
        digest: wechatForm.digest.trim(),
        author: 'Rhautt Comfort',
        contentHtml: `<p>${body.replace(/[<&>]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char] || char)).replace(/\n+/g, '</p><p>')}</p>`,
        sourceUrl: wechatForm.sourceUrl.trim() || undefined,
        coverImage: { assetId: wechatForm.coverAssetId.trim() },
        bodyImages: [],
      })));
      setMessage(`已提交 ${wechatForm.accountIds.length} 个公众号审核`);
      setWechatSubmitOpen(false);
      setPreviewItem(null);
      await load();
    } catch (submitError) {
      setError((submitError as Error).message || '提交审核失败');
    } finally {
      setWechatBusy(false);
    }
  }

  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <p className="t-label">文案管理</p>
          <h2 className="t-headline" style={{ marginTop: 4 }}>文案库</h2>
          <p style={{ marginTop: 4, color: 'var(--t-secondary)', fontSize: 13 }}>AI 生成文案草稿，合规审核后归档复用。支持按渠道、品牌、状态筛选与批量审核。</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={busy}><RefreshCw size={13} />刷新</button>
      </div>

      <div className="inset" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={16} style={{ color: 'var(--brand)' }} /><span className="t-label">AI 生成文案</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}><span className="t-label">渠道</span><select className="input" value={generateForm.channel} onChange={(event) => patchGenerateForm({ channel: event.target.value })}>{CHANNELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 6 }}><span className="t-label">品牌</span><select className="input" value={generateForm.brandSlug} onChange={(event) => patchGenerateForm({ brandSlug: event.target.value })}><option value="">未指定</option>{brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.label}</option>)}</select></label>
        </div>
        <textarea className="input" rows={3} value={generateForm.prompt} onChange={(event) => patchGenerateForm({ prompt: event.target.value })} placeholder="描述需要什么文案，例如：写一条夏季热泵推广文案，突出节能省电和即开即热" style={{ resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-brand btn-sm" onClick={generate} disabled={generateBusy || busy}>{generateBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{generateBusy ? '生成中' : '生成文案'}</button>
          {message && <span className="badge badge-success">{message}</span>}
          {error && <span className="badge badge-warning">{error}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Search size={16} style={{ color: 'var(--t-tertiary)' }} />
        <input className="input" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索提示词或文案内容" style={{ width: 240 }} />
        <select className="input" value={channelFilter} onChange={(event) => { setChannelFilter(event.target.value); setPage(1); }} style={{ width: 150 }}><option value="all">全部渠道</option>{CHANNELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <select className="input" value={brandFilter} onChange={(event) => { setBrandFilter(event.target.value); setPage(1); }} style={{ width: 140 }}><option value="all">全部品牌</option>{brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.label}</option>)}<option value="">未指定品牌</option></select>
        <select className="input" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} style={{ width: 140 }}><option value="all">全部状态</option><option value="draft">草稿</option><option value="approved">已审核</option><option value="rejected">已拒绝</option><option value="published">已发布</option></select>
      </div>

      {selectedIds.length > 0 && (
        <div role="status" style={{ padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)' }}>
          <strong style={{ fontSize: 12 }}>已选 {selectedIds.length} 条文案</strong>
          <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-brand btn-sm" onClick={bulkApprove} disabled={bulkBusy || busy}><CheckCircle2 size={13} />批量通过</button><button className="btn btn-outline btn-sm" onClick={bulkReject} disabled={bulkBusy || busy}><XCircle size={13} />批量拒绝</button><button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>取消选择</button></div>
        </div>
      )}

      <div className="table-shell growth-copy-table-shell">
        <table className="table growth-copy-table">
          <thead><tr>
            <th><input ref={headerCheckboxRef} type="checkbox" checked={allVisibleSelected} disabled={!visibleIds.length || busy} onChange={(event) => toggleVisible(event.target.checked)} aria-label="选择当前页全部文案" /></th>
            <th>文案摘要</th>
            {SORTABLE_COLUMNS.map((column) => <th key={column.key}><button onClick={() => toggleSort(column.key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, border: 0, background: 'none', color: sortBy === column.key ? 'var(--brand)' : 'inherit', font: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>{column.label}{sortIcon(column.key)}</button></th>)}
            <th>合规</th><th>审核人</th><th>操作</th>
          </tr></thead>
          <tbody>
            {items.map((item) => {
              const hasCompliance = Boolean(item.complianceFlags?.length);
              const selected = selectedIds.includes(item.id);
              return <tr key={item.id} style={selected ? { background: 'var(--brand-50)' } : undefined}>
                <td><input type="checkbox" checked={selected} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} aria-label={`选择${truncate(copyText(item), 20)}`} /></td>
                <td><div style={{ display: 'grid', gap: 3 }}><strong style={{ color: 'var(--t-primary)', fontSize: 13 }}>{truncate(copyText(item) || item.prompt)}</strong>{!item.draft && <span style={{ color: 'var(--t-tertiary)', fontSize: 11 }}>草稿为空，显示提示词</span>}</div></td>
                <td><span className="badge badge-info">{channelLabel(item.channel)}</span></td>
                <td>{displayBrand(item.brandSlug)}</td>
                <td>{statusBadge(item.status)}</td>
                <td>{formatDate(item.createdAt)}</td>
                <td>{hasCompliance ? <span className="badge badge-danger" title={item.complianceFlags.join('、')}>{item.complianceFlags.join('、')}</span> : <span style={{ color: 'var(--t-tertiary)' }}>—</span>}</td>
                <td style={{ fontSize: 12, color: 'var(--t-secondary)' }}>{item.reviewer || '—'}</td>
                <td><div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', justifyContent: 'center' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => { setPreviewItem(item); setPreviewDraft(copyText(item)); }} disabled={busy}><Search size={13} />预览</button>
                  {item.status === 'draft' && <button className="btn btn-brand btn-sm" onClick={() => approve(item.id)} disabled={busy || hasCompliance} title={hasCompliance ? '合规词命中，禁止核准' : undefined}><CheckCircle2 size={13} />通过</button>}
                  {item.status === 'draft' && <button className="btn btn-outline btn-sm" onClick={() => reject(item.id)} disabled={busy}><XCircle size={13} />拒绝</button>}
                  {item.status === 'rejected' && <button className="btn btn-outline btn-sm" onClick={() => removeRejected(item.id)} disabled={busy}><Trash2 size={13} />删除</button>}
                </div></td>
              </tr>;
            })}
            {!busy && !items.length && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 28, color: 'var(--t-secondary)' }}>暂无文案，请先生成一条草稿。</td></tr>}
            {busy && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 28 }}><Loader2 size={18} className="animate-spin" style={{ color: 'var(--brand)', verticalAlign: 'middle' }} /><span style={{ marginLeft: 8 }}>加载中</span></td></tr>}
          </tbody>
        </table>
      </div>

      <WorkbenchPaginationFooter currentPage={currentPage} totalPages={totalPages} totalItems={sorted.length} pageSize={pageSize} pageSizeOptions={PAGE_SIZE_OPTIONS} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} onPageChange={busy ? undefined : setPage} onPrevious={busy || currentPage <= 1 ? undefined : () => setPage(currentPage - 1)} onNext={busy || currentPage >= totalPages ? undefined : () => setPage(currentPage + 1)} />

      {previewItem && <div onClick={() => setPreviewItem(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(17,24,39,.46)' }}>
        <div onClick={(event) => event.stopPropagation()} className="card-elevated" style={{ width: 'min(100%,860px)', maxHeight: '92vh', overflow: 'auto', padding: 16, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><p className="t-label">文案预览</p><div style={{ display: 'flex', gap: 8, marginTop: 4 }}>{statusBadge(previewItem.status)}<span className="badge badge-info">{channelLabel(previewItem.channel)}</span>{previewItem.brandSlug && <span className="badge badge-grey">{displayBrand(previewItem.brandSlug)}</span>}</div></div><button className="btn btn-ghost btn-sm icon-only" onClick={() => setPreviewItem(null)} aria-label="关闭预览"><X size={18} /></button></div>
          <textarea className="input" value={previewDraft} onChange={(event) => setPreviewDraft(event.target.value)} rows={14} style={{ minHeight: 240, resize: 'vertical', lineHeight: 1.7 }} />
          {previewItem.complianceFlags.length > 0 && <div style={{ display: 'flex', gap: 8, color: 'var(--danger)', fontSize: 13 }}><AlertCircle size={16} />合规词命中：{previewItem.complianceFlags.join('、')}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={savePreview} disabled={saveBusy || busy || previewItem.status === 'rejected' || previewDraft === copyText(previewItem)}>{saveBusy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}保存</button>
            {previewItem.status === 'draft' && <button className="btn btn-brand btn-sm" onClick={approvePreview} disabled={busy || previewItem.complianceFlags.length > 0}><CheckCircle2 size={14} />审核通过</button>}
            <button className="btn btn-outline btn-sm" onClick={openWechatSubmit} disabled={busy || wechatBusy}><Send size={14} />提交公众号审核</button>
            {previewItem.status === 'draft' && <button className="btn btn-outline btn-sm" onClick={() => reject(previewItem.id).then(() => setPreviewItem(null))} disabled={busy}><XCircle size={14} />拒绝</button>}
            {previewItem.status === 'rejected' && <button className="btn btn-outline btn-sm" onClick={() => removeRejected(previewItem.id).then(() => setPreviewItem(null))} disabled={busy}><Trash2 size={14} />删除</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => setPreviewItem(null)}>关闭</button>
          </div>
          {wechatSubmitOpen && (
            <div className="inset" style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span className="t-label">微信公众号审核目标</span>
                {wechatBusy ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--brand)' }} /> : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <select className="input" value={wechatForm.brandId} onChange={(event) => {
                  const brandId = event.target.value;
                  setWechatForm({ ...wechatForm, brandId, accountIds: [] });
                  loadWechatAccounts(brandId);
                }}>
                  {brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.label}</option>)}
                </select>
                <input className="input" value={wechatForm.coverAssetId} onChange={(event) => setWechatForm({ ...wechatForm, coverAssetId: event.target.value })} placeholder="封面素材 ID" />
                <input className="input" value={wechatForm.sourceUrl} onChange={(event) => setWechatForm({ ...wechatForm, sourceUrl: event.target.value })} placeholder="原文链接（可选）" />
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>该品牌下可用公众号，支持单选或全选</span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={!wechatAccounts.length}
                    onClick={() => setWechatForm({
                      ...wechatForm,
                      accountIds: wechatForm.accountIds.length === wechatAccounts.length ? [] : wechatAccounts.map((account) => account.id),
                    })}
                  >
                    {wechatForm.accountIds.length === wechatAccounts.length && wechatAccounts.length ? '取消全选' : '全选'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                  {wechatAccounts.map((account) => {
                    const checked = wechatForm.accountIds.includes(account.id);
                    return (
                      <label key={account.id} className="inset" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderColor: checked ? 'var(--brand)' : 'var(--border)' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => setWechatForm({
                            ...wechatForm,
                            accountIds: event.target.checked
                              ? Array.from(new Set([...wechatForm.accountIds, account.id]))
                              : wechatForm.accountIds.filter((id) => id !== account.id),
                          })}
                        />
                        <span style={{ display: 'grid', gap: 2 }}>
                          <strong style={{ fontSize: 13 }}>{account.displayName}</strong>
                          <span style={{ color: 'var(--t-tertiary)', fontSize: 11 }}>{account.appIdMasked}</span>
                        </span>
                      </label>
                    );
                  })}
                  {!wechatBusy && !wechatAccounts.length ? (
                    <div className="inset" style={{ padding: 10, color: 'var(--danger)', fontSize: 12 }}>
                      当前品牌没有已启用且连接正常的公众号，请先到“发布账号配置”完成测试并启用。
                    </div>
                  ) : null}
                </div>
              </div>
              <textarea className="input" rows={2} value={wechatForm.digest} onChange={(event) => setWechatForm({ ...wechatForm, digest: event.target.value })} placeholder="公众号摘要" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className={wechatSubmitMissingReason(wechatForm) ? 'badge badge-warning' : 'badge badge-success'}>
                  {wechatSubmitMissingReason(wechatForm) || `将提交到 ${wechatForm.accountIds.length} 个公众号审核`}
                </span>
                <button
                  className="btn btn-brand btn-sm"
                  onClick={submitWechatReview}
                  disabled={wechatBusy || Boolean(wechatSubmitMissingReason(wechatForm))}
                  title={wechatSubmitMissingReason(wechatForm) || undefined}
                >
                  <Send size={14} />确认提交审核
                </button>
              </div>
            </div>
          )}
        </div>
      </div>}
    </section>
  );
}
