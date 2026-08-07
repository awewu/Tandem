'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Edit3,
  Eye,
  FileImage,
  FileText,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { WorkbenchPaginationFooter } from './WorkbenchCore';
import { fileArtifacts, growthMaterials } from '../lib/api';

type MarketingMaterial = {
  id: string;
  title: string;
  materialType: string;
  brandSlug: string | null;
  channel: string | null;
  summary: string | null;
  tags: string[];
  fileArtifactId: string | null;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  fileFormat: string | null;
  versionLabel: string;
  status: string;
  downloadCount: number;
  updatedAt: string;
  archivedAt: string | null;
};

type MaterialForm = {
  title: string;
  materialType: string;
  brandSlug: string;
  channel: string;
  summary: string;
  tags: string;
  fileArtifactId: string;
  fileUrl: string;
  fileFormat: string;
  versionLabel: string;
};

type SortBy = 'title' | 'materialType' | 'brandSlug' | 'fileFormat' | 'versionLabel' | 'updatedAt' | 'downloadCount';
type SortOrder = 'ASC' | 'DESC';

const DEFAULT_CATEGORIES = ['品牌物料', '产品物料', '活动物料', '销售话术', '案例素材', '培训合规'];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const SORTABLE_COLUMNS: { key: SortBy; label: string }[] = [
  { key: 'title', label: '物料名称' },
  { key: 'materialType', label: '分类' },
  { key: 'brandSlug', label: '品牌' },
  { key: 'fileFormat', label: '格式' },
  { key: 'versionLabel', label: '版本' },
  { key: 'updatedAt', label: '更新时间' },
  { key: 'downloadCount', label: '下载' },
];

const EMPTY_FORM: MaterialForm = {
  title: '',
  materialType: '产品物料',
  brandSlug: 'Rheem',
  channel: '官网 / 私域',
  summary: '',
  tags: '',
  fileArtifactId: '',
  fileUrl: '',
  fileFormat: 'PDF',
  versionLabel: 'v1',
};

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
const PDF_EXT = ['pdf'];

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toForm(item: MarketingMaterial): MaterialForm {
  return {
    title: item.title || '',
    materialType: item.materialType || '产品物料',
    brandSlug: item.brandSlug || '',
    channel: item.channel || '',
    summary: item.summary || '',
    tags: (item.tags || []).join(', '),
    fileArtifactId: item.fileArtifactId || '',
    fileUrl: item.fileUrl || '',
    fileFormat: item.fileFormat || '',
    versionLabel: item.versionLabel || 'v1',
  };
}

function toPayload(form: MaterialForm) {
  return {
    ...form,
    tags: form.tags.split(',').map((item) => item.trim()).filter(Boolean),
  };
}

function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^;]+;base64,/, ''));
    reader.onerror = () => reject(reader.error || new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}

function extensionLabel(file: File) {
  const ext = file.name.split('.').pop();
  return ext ? ext.toUpperCase() : (file.type || 'FILE').toUpperCase();
}

function getExtension(filename?: string | null): string {
  if (!filename) return '';
  return (filename.split('.').pop() || '').toLowerCase();
}

function base64ToBlobUrl(dataBase64: string, mimeType: string): string {
  const binary = atob(dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
  return URL.createObjectURL(blob);
}

function downloadBase64File(filename: string, mimeType: string | null | undefined, dataBase64: string) {
  const url = base64ToBlobUrl(dataBase64, mimeType || 'application/octet-stream');
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'marketing-material';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function GrowthMaterialsTable() {
  const [items, setItems] = useState<MarketingMaterial[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<SortBy>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [includeArchived, setIncludeArchived] = useState(false);

  const [form, setForm] = useState<MaterialForm>(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // 批量操作状态
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');

  // 文件预览状态
  const [previewItem, setPreviewItem] = useState<MarketingMaterial | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  // 多模态生成：AI 文生图
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBrand, setAiBrand] = useState('rheem');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<'image' | 'pdf' | 'none'>('none');

  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const query = useMemo(() => {
    const next: Record<string, string> = {};
    if (debouncedKeyword) next.keyword = debouncedKeyword;
    if (categoryFilter !== 'all') next.materialType = categoryFilter;
    next.page = String(page);
    next.pageSize = String(pageSize);
    next.sortBy = sortBy;
    next.sortOrder = sortOrder;
    if (includeArchived) next.includeArchived = 'true';
    return next;
  }, [debouncedKeyword, categoryFilter, page, pageSize, sortBy, sortOrder, includeArchived]);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await growthMaterials.list(query);
      setItems(Array.isArray(result?.items) ? result.items : []);
      setTotal(typeof result?.total === 'number' ? result.total : 0);
      setTotalPages(typeof result?.totalPages === 'number' ? result.totalPages : 1);
      const materialTypes = Array.isArray(result?.materialTypes) ? result.materialTypes : [];
      setCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...materialTypes.filter(Boolean)])));
    } catch (e) {
      setError((e as Error).message || '物料加载失败');
    } finally {
      setBusy(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  // 派生批量选择状态
  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.includes(id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  function toggleVisibleSelection(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return Array.from(next);
    });
  }

  function toggleRowSelection(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return Array.from(next);
    });
  }

  function toggleSort(column: SortBy) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
    setPage(1);
  }

  function patchForm(patch: Partial<MaterialForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function resetForm() {
    setEditingId('');
    setForm(EMPTY_FORM);
    setSelectedFile(null);
  }

  function edit(item: MarketingMaterial) {
    setEditingId(item.id);
    setForm(toForm(item));
    setSelectedFile(null);
    setMessage('');
    setError('');
  }

  async function save() {
    if (!form.title.trim()) {
      setError('请填写物料名称');
      return;
    }
    if (!form.materialType.trim()) {
      setError('请填写分类');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let payload = toPayload(form);
      if (selectedFile) {
        const artifact = await fileArtifacts.uploadBase64({
          entityType: 'growth_marketing_material',
          entityId: editingId || 'pending',
          filename: selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          dataBase64: await readFileBase64(selectedFile),
        });
        payload = {
          ...payload,
          fileArtifactId: String(artifact?.id || ''),
          fileUrl: String(artifact?.contentUrl || ''),
          fileFormat: form.fileFormat.trim() || extensionLabel(selectedFile),
        };
      }
      if (editingId) {
        await growthMaterials.update(editingId, payload);
        setMessage('物料已更新');
      } else {
        await growthMaterials.create(payload);
        setMessage('物料已新增');
      }
      resetForm();
      await load();
    } catch (e) {
      setError((e as Error).message || '保存失败');
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    setBusy(true);
    setError('');
    try {
      await growthMaterials.archive(id);
      setMessage('物料已归档');
      await load();
    } catch (e) {
      setError((e as Error).message || '归档失败');
    } finally {
      setBusy(false);
    }
  }

  async function download(item: MarketingMaterial) {
    if (!item.fileArtifactId) {
      setError('该物料还没有上传文件');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await growthMaterials.recordDownload(item.id);
      const artifact = await fileArtifacts.getBase64(item.fileArtifactId);
      downloadBase64File(
        String(artifact?.originalName || item.title || 'marketing-material'),
        artifact?.mimeType,
        String(artifact?.dataBase64 || '')
      );
      setMessage('已记录下载');
      await load();
    } catch (e) {
      setError((e as Error).message || '下载失败');
    } finally {
      setBusy(false);
    }
  }

  async function openPreview(item: MarketingMaterial) {
    if (!item.fileArtifactId) {
      setError('该物料没有可预览的文件');
      return;
    }
    setPreviewItem(item);
    setPreviewBusy(true);
    setPreviewUrl(null);
    setPreviewKind('none');
    setError('');
    try {
      const artifact = await fileArtifacts.getBase64(item.fileArtifactId);
      const ext = getExtension(artifact?.originalName) || getExtension(item.fileUrl) || (item.fileFormat || '').toLowerCase();
      const mime = artifact?.mimeType || '';
      const data = String(artifact?.dataBase64 || '');
      if (IMAGE_EXT.includes(ext) || mime.startsWith('image/')) {
        setPreviewUrl(`data:${mime || 'image/png'};base64,${data}`);
        setPreviewKind('image');
      } else if (PDF_EXT.includes(ext) || mime === 'application/pdf') {
        setPreviewUrl(base64ToBlobUrl(data, mime || 'application/pdf'));
        setPreviewKind('pdf');
      } else {
        setPreviewKind('none');
      }
    } catch (e) {
      setError((e as Error).message || '预览加载失败');
      setPreviewKind('none');
    } finally {
      setPreviewBusy(false);
    }
  }

  function closePreview() {
    if (previewUrl && previewKind === 'pdf') URL.revokeObjectURL(previewUrl);
    setPreviewItem(null);
    setPreviewUrl(null);
    setPreviewKind('none');
  }

  // 批量归档
  async function bulkArchive() {
    if (!selectedIds.length) return;
    setBulkBusy(true);
    setError('');
    try {
      await Promise.all(selectedIds.map((id) => growthMaterials.archive(id)));
      setMessage(`已批量归档 ${selectedIds.length} 条物料`);
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError((e as Error).message || '批量归档失败');
    } finally {
      setBulkBusy(false);
    }
  }

  // 批量下载
  async function bulkDownload() {
    const downloadable = items.filter((item) => selectedIds.includes(item.id) && item.fileArtifactId);
    if (!downloadable.length) {
      setError('选中的物料中没有可下载的文件');
      return;
    }
    setBulkBusy(true);
    setError('');
    try {
      for (const item of downloadable) {
        await growthMaterials.recordDownload(item.id);
        const artifact = await fileArtifacts.getBase64(item.fileArtifactId!);
        downloadBase64File(
          String(artifact?.originalName || item.title || 'marketing-material'),
          artifact?.mimeType,
          String(artifact?.dataBase64 || '')
        );
      }
      setMessage(`已批量下载 ${downloadable.length} 个文件`);
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError((e as Error).message || '批量下载失败');
    } finally {
      setBulkBusy(false);
    }
  }

  // 批量打标签
  async function bulkTag() {
    const newTags = bulkTagInput.split(',').map((t) => t.trim()).filter(Boolean);
    if (!newTags.length || !selectedIds.length) return;
    setBulkBusy(true);
    setError('');
    try {
      const selected = items.filter((item) => selectedIds.includes(item.id));
      await Promise.all(
        selected.map((item) => {
          const merged = Array.from(new Set([...(item.tags || []), ...newTags]));
          return growthMaterials.update(item.id, { tags: merged });
        })
      );
      setMessage(`已为 ${selected.length} 条物料添加标签`);
      setBulkTagInput('');
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError((e as Error).message || '批量打标签失败');
    } finally {
      setBulkBusy(false);
    }
  }

  const sortIcon = (column: SortBy) => {
    if (sortBy !== column) return <ChevronsUpDown size={12} style={{ color: 'var(--t-tertiary)' }} />;
    return sortOrder === 'ASC'
      ? <ChevronUp size={12} style={{ color: 'var(--brand)' }} />
      : <ChevronDown size={12} style={{ color: 'var(--brand)' }} />;
  };

  async function handleGenerateImage() {
    if (!aiPrompt.trim()) { setError('请输入图片描述'); return; }
    setAiBusy(true);
    setError('');
    setAiPreview(null);
    try {
      const res: any = await growthMaterials.generateImage({
        prompt: aiPrompt.trim(),
        brandSlug: aiBrand || undefined,
        title: aiPrompt.trim().slice(0, 30),
      });
      const url = res?.material?.fileUrl || res?.data?.material?.fileUrl;
      setAiPreview(url || null);
      setMessage(`AI 生成图已入库（模型 ${res?.model || res?.data?.model || '-'}）`);
      await load();
    } catch (e: any) {
      // 文生图 provider 未配置时后端返回 503 可读提示，如实展示，不静默
      setError(e?.message || 'AI 生成图失败');
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
      {/* 标题区 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <p className="t-label">营销物料管理</p>
          <h2 className="t-headline" style={{ marginTop: 4 }}>基础物料库</h2>
          <p style={{ marginTop: 4, color: 'var(--t-secondary)', fontSize: 13 }}>
            维护物料名称、分类、品牌、适用场景、格式、版本和标签。支持分页、排序、批量操作与文件预览。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-brand btn-sm" onClick={() => setAiOpen((v) => !v)} disabled={busy}>
            <Sparkles size={13} />AI 生成图
          </button>
          <button className="btn btn-outline btn-sm" onClick={load} disabled={busy}>
            <RefreshCw size={13} />刷新
          </button>
        </div>
      </div>

      {/* 多模态生成：AI 文生图 */}
      {aiOpen ? (
        <div className="inset" style={{ display: 'grid', gap: 12, padding: 16, borderLeft: '3px solid var(--brand)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} style={{ color: 'var(--brand)' }} />
            <strong style={{ fontSize: 14, color: 'var(--t-strong)' }}>AI 生成营销图</strong>
            <span style={{ fontSize: 12, color: 'var(--t-tertiary)' }}>经 Tandem 图像网关，生成图自动入库为物料</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">图片描述（prompt）</span>
              <input
                className="input"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="例：瑞美空气源热泵热水器 产品海报 简洁科技风 红白配色"
                onKeyDown={(e) => { if (e.key === 'Enter' && !aiBusy) handleGenerateImage(); }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">品牌</span>
              <input className="input" value={aiBrand} onChange={(e) => setAiBrand(e.target.value)} placeholder="rheem" />
            </label>
            <button className="btn btn-brand" onClick={handleGenerateImage} disabled={aiBusy || !aiPrompt.trim()}>
              {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}生成
            </button>
          </div>
          {aiPreview ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={aiPreview} alt="AI 生成预览" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--surface-3)' }} />
              <div style={{ fontSize: 13, color: 'var(--success)' }}>
                已生成并入库，可在下方物料列表查看。
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 新增/编辑表单 */}
      <div className="inset" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">物料名称</span>
            <input className="input" value={form.title} onChange={(event) => patchForm({ title: event.target.value })} placeholder="例如 夏季活动海报" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">分类</span>
            <input className="input" list="growth-material-categories" value={form.materialType} onChange={(event) => patchForm({ materialType: event.target.value })} placeholder="输入或选择分类" />
            <datalist id="growth-material-categories">
              {categories.map((item) => <option key={item} value={item} />)}
            </datalist>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">品牌</span>
            <input className="input" value={form.brandSlug} onChange={(event) => patchForm({ brandSlug: event.target.value })} placeholder="Rheem / Ruud / Everhot" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">适用场景</span>
            <input className="input" value={form.channel} onChange={(event) => patchForm({ channel: event.target.value })} placeholder="官网 / 门店 / 朋友圈 / 培训" />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <input className="input" value={form.fileFormat} onChange={(event) => patchForm({ fileFormat: event.target.value })} placeholder="格式：PDF / PNG / PPTX" />
          <input className="input" value={form.versionLabel} onChange={(event) => patchForm({ versionLabel: event.target.value })} placeholder="版本：v1" />
          <input className="input" value={form.tags} onChange={(event) => patchForm({ tags: event.target.value })} placeholder="标签，用逗号分隔" />
          <label className="input" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', overflow: 'hidden' }}>
            <input
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setSelectedFile(file);
                if (file) patchForm({ fileFormat: extensionLabel(file) });
              }}
              style={{ display: 'none' }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedFile || form.fileArtifactId ? 'var(--t-primary)' : 'var(--t-tertiary)' }}>
              {selectedFile?.name || (form.fileArtifactId ? '已上传文件，可重新选择' : '选择上传文件')}
            </span>
          </label>
        </div>
        <textarea className="input" rows={2} value={form.summary} onChange={(event) => patchForm({ summary: event.target.value })} placeholder="备注说明" style={{ resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-brand btn-sm" onClick={save} disabled={busy}>
            {editingId ? <Edit3 size={14} /> : <Plus size={14} />}
            {editingId ? '保存修改' : '新增物料'}
          </button>
          {editingId && <button className="btn btn-outline btn-sm" onClick={resetForm} disabled={busy}>取消编辑</button>}
          {message && <span className="badge badge-success">{message}</span>}
          {error && <span className="badge badge-warning">{error}</span>}
        </div>
      </div>

      {/* 筛选与搜索 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Search size={16} style={{ color: 'var(--t-tertiary)' }} />
        <input className="input" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索物料名称或备注" style={{ width: 240 }} />
        <select className="input" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }} style={{ width: 180 }}>
          <option value="all">全部分类</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--t-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => { setIncludeArchived(event.target.checked); setPage(1); }}
            style={{ accentColor: 'var(--brand)', width: 16, height: 16, cursor: 'pointer' }}
          />
          <ArchiveRestore size={14} />
          查看已归档
        </label>
      </div>

      {/* 批量操作栏 */}
      {selectedIds.length > 0 && (
        <div role="status" style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'color-mix(in srgb, var(--brand-50) 42%, var(--surface-1) 58%)', borderRadius: 'var(--r-lg)' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--t-primary)' }}>已选 {selectedIds.length} 个物料</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-outline btn-sm" onClick={bulkArchive} disabled={bulkBusy || busy}>
              <Archive size={13} />
              {bulkBusy ? '批量归档中' : '批量归档'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={bulkDownload} disabled={bulkBusy || busy}>
              <Download size={13} />
              {bulkBusy ? '批量下载中' : '批量下载'}
            </button>
            <input
              className="input"
              style={{ width: 200 }}
              value={bulkTagInput}
              onChange={(event) => setBulkTagInput(event.target.value)}
              placeholder="输入标签，逗号分隔"
            />
            <button className="btn btn-brand btn-sm" onClick={bulkTag} disabled={bulkBusy || busy || !bulkTagInput.trim()}>
              <Tag size={13} />
              {bulkBusy ? '批量打标中' : '批量打标'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])} disabled={bulkBusy || busy}>
              取消选择
            </button>
          </div>
        </div>
      )}

      {/* 数据表格 */}
      <div className="table-shell">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={!visibleIds.length || busy}
                  onChange={(event) => toggleVisibleSelection(event.target.checked)}
                  style={{ accentColor: 'var(--brand)', width: 16, height: 16, cursor: 'pointer' }}
                  aria-label="选择当前页全部物料"
                />
              </th>
              {SORTABLE_COLUMNS.map((col) => (
                <th key={col.key}>
                  <button
                    onClick={() => toggleSort(col.key)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: sortBy === col.key ? 'var(--brand)' : 'var(--t-tertiary)', padding: 0, textTransform: 'inherit', letterSpacing: 'inherit' }}
                  >
                    {col.label}
                    {sortIcon(col.key)}
                  </button>
                </th>
              ))}
              <th>标签</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isRowSelected = selectedIds.includes(item.id);
              const hasFile = Boolean(item.fileArtifactId);
              const rowStyle = isRowSelected
                ? { background: 'color-mix(in srgb, var(--brand-50) 48%, var(--surface-1) 52%)' }
                : undefined;
              return (
                <tr key={item.id} style={rowStyle}>
                  <td>
                    <input
                      type="checkbox"
                      checked={isRowSelected}
                      disabled={busy}
                      onChange={(event) => toggleRowSelection(item.id, event.target.checked)}
                      style={{ accentColor: 'var(--brand)', width: 16, height: 16, cursor: 'pointer' }}
                      aria-label={`选择${item.title}`}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'grid', gap: 3 }}>
                      <strong style={{ color: 'var(--t-primary)' }}>{item.title}</strong>
                      {item.summary && <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>{item.summary}</span>}
                    </div>
                  </td>
                  <td><span className="badge badge-info">{item.materialType}</span></td>
                  <td>{item.brandSlug || '-'}</td>
                  <td>{item.fileFormat || '-'}</td>
                  <td>{item.versionLabel || 'v1'}</td>
                  <td>{formatDate(item.updatedAt)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{item.downloadCount || 0}</td>
                  <td>{(item.tags || []).length ? item.tags.join(' / ') : '-'}</td>
                  <td>
                    {item.archivedAt ? (
                      <span className="badge badge-grey">已归档</span>
                    ) : (
                      <span className="badge badge-success">活跃</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => edit(item)} disabled={busy}><Edit3 size={13} />编辑</button>
                      <button className="btn btn-outline btn-sm" onClick={() => openPreview(item)} disabled={busy || !hasFile}><Eye size={13} />预览</button>
                      <button className="btn btn-outline btn-sm" onClick={() => download(item)} disabled={busy || !hasFile}><Download size={13} />下载</button>
                      {!item.archivedAt && (
                        <button className="btn btn-outline btn-sm" onClick={() => archive(item.id)} disabled={busy}><Archive size={13} />归档</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!busy && !items.length && (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', color: 'var(--t-secondary)', padding: 28 }}>
                  <FolderOpen size={20} style={{ color: 'var(--brand)', verticalAlign: 'middle', marginRight: 8 }} />
                  {includeArchived ? '暂无物料（含已归档）' : '暂无物料，先新增一条基础物料，或开启「查看已归档」'}
                </td>
              </tr>
            )}
            {busy && (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: 28 }}>
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--brand)', verticalAlign: 'middle' }} />
                  <span style={{ marginLeft: 8, color: 'var(--t-secondary)', fontSize: 13 }}>加载中</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <WorkbenchPaginationFooter
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        onPageChange={busy ? undefined : setPage}
        onPrevious={busy || page <= 1 ? undefined : () => setPage(Math.max(page - 1, 1))}
        onNext={busy || page >= totalPages ? undefined : () => setPage(page + 1)}
      />

      {/* 文件预览弹层 */}
      {previewItem && (
        <div
          onClick={closePreview}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.46)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="card-elevated"
            style={{ padding: 16, width: 'min(100%, 960px)', maxHeight: 'min(92vh, 820px)', overflow: 'auto', display: 'grid', gap: 12, boxShadow: 'var(--sh-modal)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <p className="t-label">文件预览</p>
                <h3 className="t-headline" style={{ marginTop: 4 }}>{previewItem.title}</h3>
                <p style={{ fontSize: 12, color: 'var(--t-tertiary)', marginTop: 4 }}>
                  {previewItem.fileFormat || '-'} · {previewItem.brandSlug || '-'} · v{previewItem.versionLabel}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm icon-only" onClick={closePreview} aria-label="关闭预览">
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', placeItems: 'center', minHeight: 240, maxHeight: 'calc(88vh - 120px)', overflow: 'auto', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              {previewBusy ? (
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--brand)' }} />
              ) : previewKind === 'image' && previewUrl ? (
                <img src={previewUrl} alt={previewItem.title} style={{ maxWidth: '100%', maxHeight: 'calc(88vh - 120px)', objectFit: 'contain' }} />
              ) : previewKind === 'pdf' && previewUrl ? (
                <iframe src={previewUrl} title={previewItem.title} style={{ width: '100%', height: 'calc(88vh - 120px)', border: 'none', borderRadius: 'var(--r-lg)' }} />
              ) : (
                <div style={{ textAlign: 'center', padding: 32, display: 'grid', gap: 10, placeContent: 'center' }}>
                  <FileText size={32} style={{ color: 'var(--t-tertiary)', justifySelf: 'center' }} />
                  <p style={{ color: 'var(--t-secondary)', fontSize: 13 }}>该格式暂不支持在线预览</p>
                  <button className="btn btn-outline btn-sm" onClick={() => download(previewItem)} disabled={busy}>
                    <Download size={13} />
                    下载文件
                  </button>
                </div>
              )}
            </div>

            {previewUrl && previewKind === 'pdf' && (
              <p style={{ fontSize: 11, color: 'var(--t-tertiary)', textAlign: 'center' }}>
                <FileImage size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                PDF 预览依赖浏览器内置阅读器
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
