'use client';

import { useMemo, useState } from 'react';

export interface FilterDef {
  key: string; // 支持点路径，如 'metrics.status'
  label: string;
  options: { value: string; label: string }[];
}
export interface ExportColumn {
  key: string;
  label: string;
}
export interface ListViewConfig {
  searchFields?: string[]; // 点路径
  filters?: FilterDef[];
  pageSize?: number;
}

function getPath(row: any, path: string): unknown {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), row);
}

export function useListView<T extends Record<string, any>>(rows: T[], config: ListViewConfig = {}) {
  const [q, setQ] = useState('');
  const [filterVals, setFilterVals] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = config.pageSize ?? 20;

  const filtered = useMemo(() => {
    let out = rows || [];
    const query = q.trim().toLowerCase();
    if (query && config.searchFields?.length) {
      out = out.filter((r) => config.searchFields!.some((f) => String(getPath(r, f) ?? '').toLowerCase().includes(query)));
    }
    for (const [k, v] of Object.entries(filterVals)) {
      if (v) out = out.filter((r) => String(getPath(r, k) ?? '') === v);
    }
    return out;
  }, [rows, q, filterVals, config.searchFields]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  function setFilter(key: string, value: string) {
    setFilterVals((s) => ({ ...s, [key]: value }));
    setPage(1);
  }
  function onSearch(value: string) {
    setQ(value);
    setPage(1);
  }

  return { q, onSearch, filterVals, setFilter, page: clampedPage, setPage, pageCount, total, pageRows, filtered, pageSize };
}

/** 把当前(已筛选)行导出为 CSV 并下载。 */
export function exportCsv(rows: any[], columns: ExportColumn[], filename: string) {
  const esc = (v: unknown) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(getPath(r, c.key))).join(',')).join('\n');
  const csv = `\uFEFF${header}\n${body}`; // BOM 保中文 Excel 兼容
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
