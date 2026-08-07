'use client';

import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FilterDef } from '../lib/useListView';

interface ListToolbarProps {
  q: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  filterVals: Record<string, string>;
  onFilter: (key: string, value: string) => void;
  total: number;
  onExport?: () => void;
  // 分页
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}

export default function ListToolbar(props: ListToolbarProps) {
  const { q, onSearch, searchPlaceholder, filters = [], filterVals, onFilter, total, onExport, page, pageCount, onPage } = props;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-tertiary)' }} />
        <input className="input" value={q} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder || '搜索…'} style={{ paddingLeft: 30, width: '100%' }} />
      </div>
      {filters.map((f) => (
        <select key={f.key} className="input" value={filterVals[f.key] || ''} onChange={(e) => onFilter(f.key, e.target.value)} style={{ width: 'auto', minWidth: 120 }}>
          <option value="">{f.label}（全部）</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      <span className="t-xs" style={{ color: 'var(--t-tertiary)', marginLeft: 4 }}>共 {total} 条</span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {pageCount > 1 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="上一页"><ChevronLeft size={14} /></button>
            <span className="t-xs" style={{ color: 'var(--t-secondary)', minWidth: 48, textAlign: 'center' }}>{page}/{pageCount}</span>
            <button className="btn btn-outline btn-sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="下一页"><ChevronRight size={14} /></button>
          </span>
        )}
        {onExport && <button className="btn btn-outline btn-sm" onClick={onExport}><Download size={14} />导出 CSV</button>}
      </div>
    </div>
  );
}
