/**
 * 搭子手抄 · 数据库视图纯逻辑 (筛选 / 排序 / 分组) — 无 React / DB 依赖, 便于单测.
 */

import type {
  ShouchaoRow,
  ShouchaoFilter,
  ShouchaoSort,
  ShouchaoProperty,
} from '../types/shouchao-db';

/** 取单元格的可比较字符串 (用于排序/筛选/分组). */
export function cellText(row: ShouchaoRow, propId: string): string {
  const v = row.cells[propId];
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

/** 单条筛选判定. */
export function matchFilter(row: ShouchaoRow, f: ShouchaoFilter): boolean {
  const v = row.cells[f.propId];
  switch (f.op) {
    case 'isTrue':
      return v === true;
    case 'isFalse':
      return v === false || v == null;
    case 'eq':
      return cellText(row, f.propId) === (f.value ?? '');
    case 'contains': {
      const hay = cellText(row, f.propId).toLowerCase();
      return hay.includes((f.value ?? '').toLowerCase());
    }
    default:
      return true;
  }
}

/** 应用多条筛选 (AND). */
export function applyFilters(rows: ShouchaoRow[], filters?: ShouchaoFilter[]): ShouchaoRow[] {
  if (!filters || filters.length === 0) return rows;
  return rows.filter((r) => filters.every((f) => matchFilter(r, f)));
}

/** 应用多级排序 (稳定, 前面的优先). number 按数值比, 其余按文本. */
export function applySorts(
  rows: ShouchaoRow[],
  sorts: ShouchaoSort[] | undefined,
  props: ShouchaoProperty[],
): ShouchaoRow[] {
  if (!sorts || sorts.length === 0) return rows;
  const typeOf = new Map(props.map((p) => [p.id, p.type]));
  const withIdx = rows.map((r, i) => ({ r, i }));
  withIdx.sort((a, b) => {
    for (const s of sorts) {
      const isNum = typeOf.get(s.propId) === 'number';
      let cmp: number;
      if (isNum) {
        const av = Number(a.r.cells[s.propId] ?? 0);
        const bv = Number(b.r.cells[s.propId] ?? 0);
        cmp = av === bv ? 0 : av < bv ? -1 : 1;
      } else {
        cmp = cellText(a.r, s.propId).localeCompare(cellText(b.r, s.propId));
      }
      if (cmp !== 0) return s.dir === 'desc' ? -cmp : cmp;
    }
    return a.i - b.i; // 稳定
  });
  return withIdx.map((x) => x.r);
}

export interface RowGroup {
  key: string;
  rows: ShouchaoRow[];
}

/**
 * 按属性分组 (看板/画廊). 无值归入 '__none__' 组.
 * groupOptions 给定时按其顺序输出 (含空组), 便于看板展示所有列.
 */
export function groupRows(
  rows: ShouchaoRow[],
  propId: string,
  groupOptions?: string[],
): RowGroup[] {
  const map = new Map<string, ShouchaoRow[]>();
  for (const r of rows) {
    const raw = r.cells[propId];
    const key = raw == null || raw === '' ? '__none__' : Array.isArray(raw) ? (raw[0] ?? '__none__') : String(raw);
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }
  const keys = groupOptions && groupOptions.length ? [...groupOptions, '__none__'] : Array.from(map.keys());
  const seen = new Set<string>();
  const out: RowGroup[] = [];
  for (const k of keys) {
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ key: k, rows: map.get(k) ?? [] });
  }
  // 补上 groupOptions 未覆盖到的动态键
  for (const k of Array.from(map.keys())) {
    if (!seen.has(k)) {
      out.push({ key: k, rows: map.get(k) ?? [] });
      seen.add(k);
    }
  }
  return out;
}

/** 组合视图: 先筛选, 再排序. */
export function computeView(
  rows: ShouchaoRow[],
  props: ShouchaoProperty[],
  opts: { filters?: ShouchaoFilter[]; sorts?: ShouchaoSort[] },
): ShouchaoRow[] {
  return applySorts(applyFilters(rows, opts.filters), opts.sorts, props);
}
