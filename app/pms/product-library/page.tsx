/**
 * PMS · 营销产品库 (独立主数据)
 * 面向报价/渠道/项目的营销产品体系, 由 PMS 独立建设与维护, 与 YS(用友)物料档案解耦。
 * 报价选型只认这套库。写操作仅内部角色。
 */

'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Boxes, Pencil, Plus, RefreshCw, Search, Upload, X } from 'lucide-react';

interface LibProduct {
  id: string;
  series: string;
  seriesCode?: string;
  model: string;
  modelCode?: string;
  category?: string;
  specification?: string;
  unit?: string;
  listPrice?: number;
  costPrice?: number;
  minPrice?: number;
  parentModel?: string;
  attributes?: Record<string, string>;
  source?: 'ys' | 'import' | 'manual';
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductForm {
  series: string;
  seriesCode: string;
  model: string;
  modelCode: string;
  category: string;
  specification: string;
  unit: string;
  listPrice: string;
  costPrice: string;
  minPrice: string;
}

const EMPTY_FORM: ProductForm = {
  series: '',
  seriesCode: '',
  model: '',
  modelCode: '',
  category: '',
  specification: '',
  unit: '',
  listPrice: '',
  costPrice: '',
  minPrice: '',
};

function toForm(p: LibProduct): ProductForm {
  return {
    series: p.series ?? '',
    seriesCode: p.seriesCode ?? '',
    model: p.model ?? '',
    modelCode: p.modelCode ?? '',
    category: p.category ?? '',
    specification: p.specification ?? '',
    unit: p.unit ?? '',
    listPrice: p.listPrice != null ? String(p.listPrice) : '',
    costPrice: p.costPrice != null ? String(p.costPrice) : '',
    minPrice: p.minPrice != null ? String(p.minPrice) : '',
  };
}

function num(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function margin(listPrice?: number, costPrice?: number): number | null {
  if (listPrice == null || costPrice == null || !(listPrice > 0)) return null;
  return Math.round(((listPrice - costPrice) / listPrice) * 1000) / 10;
}

export default function PmsProductLibraryPage() {
  const [products, setProducts] = useState<LibProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [showArchived]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const url = new URL('/api/pms/products', window.location.origin);
      url.searchParams.set('type', 'products');
      url.searchParams.set('limit', '5000');
      if (!showArchived) url.searchParams.set('status', 'active');
      const res = await fetch(url.toString(), { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.series, p.seriesCode, p.model, p.modelCode, p.category, p.specification]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [products, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditorOpen(true);
  }

  function openEdit(p: LibProduct) {
    setEditingId(p.id);
    setForm(toForm(p));
    setFormError(null);
    setEditorOpen(true);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!form.series.trim() || !form.model.trim()) {
      setFormError('系列与型号为必填');
      return;
    }
    const payload = {
      series: form.series.trim(),
      seriesCode: form.seriesCode.trim() || undefined,
      model: form.model.trim(),
      modelCode: form.modelCode.trim() || undefined,
      category: form.category.trim() || undefined,
      specification: form.specification.trim() || undefined,
      unit: form.unit.trim() || undefined,
      listPrice: num(form.listPrice),
      costPrice: num(form.costPrice),
      minPrice: num(form.minPrice),
    };
    try {
      setSaving(true);
      setFormError(null);
      const body = editingId
        ? { action: 'update_product', id: editingId, ...payload }
        : { action: 'create_product', source: 'manual', ...payload };
      const res = await fetch('/api/pms/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || '保存失败');
      setEditorOpen(false);
      await load();
    } catch (err: any) {
      setFormError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(p: LibProduct) {
    const next = p.status === 'archived' ? 'active' : 'archived';
    try {
      const res = await fetch('/api/pms/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'update_product', id: p.id, status: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '操作失败');
      await load();
    } catch (err: any) {
      setError(err.message || '操作失败');
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface-1 p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-title-lg font-bold text-ink-primary">
          <Boxes className="h-6 w-6 text-brand-500" />
          营销产品库
        </h1>
        <p className="mt-1 text-body text-ink-secondary">
          PMS 独立维护的营销产品体系 · 报价选型的唯一数据源 · 与 YS 物料档案解耦
        </p>
        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand-600 px-3 text-caption font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            新增产品
          </button>
          <Link
            href="/pms/products/import"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface-1 px-3 text-caption text-ink-secondary hover:bg-surface-2"
          >
            <Upload className="h-4 w-4" />
            批量导入
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface-1 px-3 text-caption text-ink-secondary hover:bg-surface-2 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-ink-tertiary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="系列/型号/编码/规格"
              className="min-w-0 flex-1 bg-transparent text-caption outline-none placeholder:text-ink-tertiary"
            />
          </div>
          <label className="inline-flex shrink-0 items-center gap-2 text-caption text-ink-secondary">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            显示停用
          </label>
        </div>
        <p className="mt-2 text-caption text-ink-tertiary">共 {filtered.length} 个产品</p>
      </div>

      {error && (
        <Card className="mb-4 border-danger/30">
          <CardContent className="p-4 text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-brand-500" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">
            暂无产品 · 点「新增产品」或「批量导入」开始建库
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
          <table className="w-full min-w-[860px] text-caption">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-ink-secondary">
                <th className="px-3 py-2 font-semibold">系列 / 型号</th>
                <th className="px-3 py-2 font-semibold">品类 / 规格</th>
                <th className="px-3 py-2 font-semibold">单位</th>
                <th className="px-3 py-2 text-right font-semibold">标准价</th>
                <th className="px-3 py-2 text-right font-semibold">最低价</th>
                <th className="px-3 py-2 text-right font-semibold">毛利率</th>
                <th className="px-3 py-2 font-semibold">状态</th>
                <th className="px-3 py-2 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const m = margin(p.listPrice, p.costPrice);
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-ink-primary">{p.model}</div>
                      <div className="text-ink-tertiary">
                        {p.series}
                        {p.modelCode ? ` · ${p.modelCode}` : ''}
                        {p.source === 'import' ? ' · 导入' : p.source === 'manual' ? ' · 手工' : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-ink-secondary">
                      {p.category || '—'}
                      {p.specification ? <div className="text-ink-tertiary">{p.specification}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-ink-secondary">{p.unit || '—'}</td>
                    <td className="px-3 py-2 text-right text-ink-primary">
                      {p.listPrice != null ? `¥${p.listPrice.toLocaleString('zh-CN')}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-secondary">
                      {p.minPrice != null ? `¥${p.minPrice.toLocaleString('zh-CN')}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-secondary">
                      {m != null ? `${m}%` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 ${
                          p.status === 'archived' ? 'bg-surface-2 text-ink-tertiary' : 'bg-success/10 text-success'
                        }`}
                      >
                        {p.status === 'archived' ? '停用' : '启用'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-ink-secondary hover:bg-surface-2"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(p)}
                          className="inline-flex h-7 items-center rounded-md border border-border px-2 text-ink-secondary hover:bg-surface-2"
                        >
                          {p.status === 'archived' ? '启用' : '停用'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface-1 shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-headline font-semibold text-ink-primary">
                {editingId ? '编辑产品' : '新增产品'}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-md p-1 text-ink-tertiary hover:bg-surface-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="系列 *" value={form.series} onChange={(v) => setForm({ ...form, series: v })} />
                <Field label="系列编码" value={form.seriesCode} onChange={(v) => setForm({ ...form, seriesCode: v })} />
                <Field label="型号 *" value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
                <Field label="型号编码" value={form.modelCode} onChange={(v) => setForm({ ...form, modelCode: v })} />
                <Field label="品类" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
                <Field label="规格" value={form.specification} onChange={(v) => setForm({ ...form, specification: v })} />
                <Field label="单位" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
                <Field label="标准价" value={form.listPrice} onChange={(v) => setForm({ ...form, listPrice: v })} type="number" />
                <Field label="最低价 (底线)" value={form.minPrice} onChange={(v) => setForm({ ...form, minPrice: v })} type="number" />
                <Field label="成本价 (内部)" value={form.costPrice} onChange={(v) => setForm({ ...form, costPrice: v })} type="number" />
              </div>
              {formError && <p className="text-caption text-danger">{formError}</p>}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="inline-flex h-9 items-center rounded-md border border-border px-3 text-caption text-ink-secondary hover:bg-surface-2"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-caption font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-caption text-ink-secondary">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-caption text-ink-primary outline-none focus:border-brand-500"
      />
    </label>
  );
}
