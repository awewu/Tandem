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
          <h1 className="text-xl font-semibold text-slate-900">产品主数据导入</h1>
          <p className="mt-1 text-sm text-slate-500">上传 Excel/CSV 或粘贴数据。以型号编码(或型号)为稳定键幂等更新, 可重复导入。</p>
        </div>
        <button onClick={() => router.push('/pms')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          返回
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,text/csv"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-slate-700"
        />
        <button onClick={downloadTemplate} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
          下载模板
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => updateText(e.target.value)}
        placeholder={PLACEHOLDER}
        className="min-h-40 w-full rounded-lg border border-dashed border-slate-300 bg-white p-3 font-mono text-xs text-slate-800 outline-none placeholder:whitespace-pre-line placeholder:text-slate-400 focus:border-blue-500"
      />

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
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
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-2 py-1.5 text-slate-700">{r.series || '—'}</td>
                  <td className="px-2 py-1.5 text-slate-700">{r.model || '—'}</td>
                  <td className="px-2 py-1.5 text-slate-500">{r.category || '—'}</td>
                  <td className="px-2 py-1.5 text-slate-500">{r.specification || '—'}</td>
                  <td className="px-2 py-1.5 text-slate-500">{r.unit || '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{r.listPrice ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 8 && <div className="px-2 py-1.5 text-center text-xs text-slate-400">…共 {rows.length} 行</div>}
        </div>
      )}

      {err && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}

      {result && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${result.failed.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
          已处理 {result.total} 行 · 新建 {result.created} · 更新 {result.updated} · 失败 {result.failed.length}
          {result.failed.length > 0 && (
            <div className="mt-1 text-slate-600">{result.failed.slice(0, 3).map((f) => `第${f.row}行: ${f.reason}`).join('；')}</div>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={submit}
          disabled={busy || rows.length === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? '导入中…' : rows.length > 0 ? `导入 ${rows.filter((r) => r.series && r.model).length} 条` : '导入'}
        </button>
      </div>
    </div>
  );
}
