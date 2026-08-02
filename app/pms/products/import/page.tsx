'use client';

/**
 * PMS · 产品主数据批量导入 (内部)
 *
 * 支持上传 Excel/CSV 或从 Excel 复制粘贴。列: 系列* 型号* 系列编码 型号编码 品类 规格 单位 面价 成本价 最低限价。
 * 幂等 upsert (以 型号编码 优先, 否则 型号 为稳定键) → 重复导入更新而非重复插入。
 * 导入后报价编辑器「从产品目录选设备」即基于真实主数据而非占位。
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Row {
  series: string;
  model: string;
  seriesCode?: string;
  modelCode?: string;
  category?: string;
  specification?: string;
  unit?: string;
  listPrice?: number;
  costPrice?: number;
  minPrice?: number;
}

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  failed: { row: number; reason: string }[];
}

const HEADERS = ['系列', '型号', '系列编码', '型号编码', '品类', '规格', '单位', '面价', '成本价', '最低限价'];
const PLACEHOLDER = `系列\t型号\t系列编码\t型号编码\t品类\t规格\t单位\t面价\t成本价\t最低限价
Rheem 商用空气源热泵\tHP-12 变频\tRH-HP\tHP12INV\theat_pump\t制热量12kW\t台\t28000\t19600\t23800`;

function num(v: string): number | undefined {
  const n = parseFloat((v ?? '').toString().replace(/[,¥\s]/g, ''));
  return Number.isNaN(n) ? undefined : n;
}

function parseRows(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const split = (l: string) => (l.includes('\t') ? l.split('\t') : l.split(','));
  // 跳过表头 (第一列含 "系列")
  const first = split(lines[0]).map((c) => c.trim());
  const startIdx = first[0]?.includes('系列') ? 1 : 0;
  const out: Row[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const c = split(lines[i]).map((x) => x.trim());
    if (!c[0] && !c[1]) continue;
    out.push({
      series: c[0] ?? '',
      model: c[1] ?? '',
      seriesCode: c[2] || undefined,
      modelCode: c[3] || undefined,
      category: c[4] || undefined,
      specification: c[5] || undefined,
      unit: c[6] || undefined,
      listPrice: num(c[7]),
      costPrice: num(c[8]),
      minPrice: num(c[9]),
    });
  }
  return out;
}

export default function ProductImportPage() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState('');

  function updateText(t: string) {
    setText(t);
    setRows(parseRows(t));
    setResult(null);
    setErr('');
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setResult(null);
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
      updateText(grid.map((r) => r.map((v) => String(v ?? '')).join('\t')).join('\n'));
      return;
    }
    updateText(await file.text());
  }

  function downloadTemplate() {
    const blob = new Blob([HEADERS.join(',') + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function submit() {
    const valid = rows.filter((r) => r.series && r.model);
    if (valid.length === 0) {
      setErr('无有效行 (系列与型号必填)');
      return;
    }
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const r = await fetch('/api/pms/products', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'import_products', rows: valid }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '导入失败');
      setResult(d.result);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-headline font-semibold text-ink-primary">产品主数据导入</h1>
          <p className="mt-1 text-caption text-ink-tertiary">上传 Excel/CSV 或粘贴数据。以型号编码(或型号)为稳定键幂等更新, 可重复导入。</p>
        </div>
        <button onClick={() => router.push('/pms')} className="rounded-lg border border-border bg-white px-3 py-2 text-caption text-ink-secondary hover:bg-surface-2">
          返回
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,text/csv"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          className="text-caption text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-caption file:text-ink-secondary"
        />
        <button onClick={downloadTemplate} className="rounded-md border border-border bg-white px-3 py-1.5 text-caption text-ink-secondary hover:bg-surface-3">
          下载模板
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => updateText(e.target.value)}
        placeholder={PLACEHOLDER}
        className="min-h-40 w-full rounded-lg border border-dashed border-border bg-white p-3 font-mono text-footnote text-ink-primary outline-none placeholder:whitespace-pre-line placeholder:text-ink-tertiary focus:border-info"
      />

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-footnote">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-ink-tertiary">
                <th className="px-2 py-1.5">系列</th>
                <th className="px-2 py-1.5">型号</th>
                <th className="px-2 py-1.5">品类</th>
                <th className="px-2 py-1.5">规格</th>
                <th className="px-2 py-1.5">单位</th>
                <th className="px-2 py-1.5 text-right">面价</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((r, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-2 py-1.5 text-ink-secondary">{r.series || '—'}</td>
                  <td className="px-2 py-1.5 text-ink-secondary">{r.model || '—'}</td>
                  <td className="px-2 py-1.5 text-ink-tertiary">{r.category || '—'}</td>
                  <td className="px-2 py-1.5 text-ink-tertiary">{r.specification || '—'}</td>
                  <td className="px-2 py-1.5 text-ink-tertiary">{r.unit || '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-ink-secondary">{r.listPrice ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 8 && <div className="px-2 py-1.5 text-center text-footnote text-ink-tertiary">…共 {rows.length} 行</div>}
        </div>
      )}

      {err && <div className="mt-3 rounded-lg bg-danger/5 px-3 py-2 text-caption text-danger">{err}</div>}

      {result && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-caption ${result.failed.length > 0 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
          已处理 {result.total} 行 · 新建 {result.created} · 更新 {result.updated} · 失败 {result.failed.length}
          {result.failed.length > 0 && (
            <div className="mt-1 text-ink-secondary">{result.failed.slice(0, 3).map((f) => `第${f.row}行: ${f.reason}`).join('；')}</div>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={submit}
          disabled={busy || rows.length === 0}
          className="rounded-lg bg-info/80 px-4 py-2 text-caption font-medium text-white hover:bg-info/70 disabled:opacity-50"
        >
          {busy ? '导入中…' : rows.length > 0 ? `导入 ${rows.filter((r) => r.series && r.model).length} 条` : '导入'}
        </button>
      </div>
    </div>
  );
}
