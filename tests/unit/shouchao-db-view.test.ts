/**
 * 搭子手抄 · 数据库视图纯逻辑 (筛选/排序/分组/组合)
 */
import { describe, it, expect } from 'vitest';
import {
  applyFilters,
  applySorts,
  groupRows,
  computeView,
  cellText,
} from '@/lib/shouchao/db-view';
import type { ShouchaoRow, ShouchaoProperty } from '@/lib/types/shouchao-db';

function row(id: string, cells: Record<string, unknown>): ShouchaoRow {
  return {
    id,
    databaseId: 'db',
    ownerId: 'u',
    tenantId: 'default',
    cells: cells as ShouchaoRow['cells'],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

const props: ShouchaoProperty[] = [
  { id: 'name', name: '名称', type: 'text' },
  { id: 'age', name: '年龄', type: 'number' },
  { id: 'status', name: '状态', type: 'select', options: ['A', 'B'] },
  { id: 'done', name: '完成', type: 'checkbox' },
];

describe('cellText', () => {
  it('多选拼接、布尔转字符串、空值为空串', () => {
    expect(cellText(row('1', { tags: ['x', 'y'] }), 'tags')).toBe('x, y');
    expect(cellText(row('1', { done: true }), 'done')).toBe('true');
    expect(cellText(row('1', {}), 'missing')).toBe('');
  });
});

describe('applyFilters', () => {
  const rows = [
    row('1', { name: '苹果', status: 'A', done: true }),
    row('2', { name: '香蕉', status: 'B', done: false }),
    row('3', { name: '橙子', status: 'A' }),
  ];
  it('eq 等值筛选', () => {
    expect(applyFilters(rows, [{ propId: 'status', op: 'eq', value: 'A' }]).map((r) => r.id)).toEqual(['1', '3']);
  });
  it('contains 模糊筛选', () => {
    expect(applyFilters(rows, [{ propId: 'name', op: 'contains', value: '子' }]).map((r) => r.id)).toEqual(['3']);
  });
  it('isTrue / isFalse 布尔筛选 (缺值视为 false)', () => {
    expect(applyFilters(rows, [{ propId: 'done', op: 'isTrue' }]).map((r) => r.id)).toEqual(['1']);
    expect(applyFilters(rows, [{ propId: 'done', op: 'isFalse' }]).map((r) => r.id)).toEqual(['2', '3']);
  });
  it('多筛选 AND', () => {
    const out = applyFilters(rows, [
      { propId: 'status', op: 'eq', value: 'A' },
      { propId: 'done', op: 'isTrue' },
    ]);
    expect(out.map((r) => r.id)).toEqual(['1']);
  });
});

describe('applySorts', () => {
  const rows = [row('1', { age: 30 }), row('2', { age: 5 }), row('3', { age: 12 })];
  it('number 按数值排序 (非字典序)', () => {
    expect(applySorts(rows, [{ propId: 'age', dir: 'asc' }], props).map((r) => r.id)).toEqual(['2', '3', '1']);
    expect(applySorts(rows, [{ propId: 'age', dir: 'desc' }], props).map((r) => r.id)).toEqual(['1', '3', '2']);
  });
  it('无排序保持原序', () => {
    expect(applySorts(rows, undefined, props).map((r) => r.id)).toEqual(['1', '2', '3']);
  });
});

describe('groupRows', () => {
  const rows = [
    row('1', { status: 'A' }),
    row('2', { status: 'B' }),
    row('3', { status: 'A' }),
    row('4', {}),
  ];
  it('按 select 分组, 无值归入 __none__', () => {
    const groups = groupRows(rows, 'status', ['A', 'B']);
    const map = Object.fromEntries(groups.map((g) => [g.key, g.rows.map((r) => r.id)]));
    expect(map['A']).toEqual(['1', '3']);
    expect(map['B']).toEqual(['2']);
    expect(map['__none__']).toEqual(['4']);
  });
  it('groupOptions 保证空列也出现', () => {
    const groups = groupRows([row('1', { status: 'A' })], 'status', ['A', 'B']);
    expect(groups.find((g) => g.key === 'B')?.rows).toEqual([]);
  });
});

describe('computeView', () => {
  it('先筛选再排序', () => {
    const rows = [
      row('1', { status: 'A', age: 9 }),
      row('2', { status: 'B', age: 1 }),
      row('3', { status: 'A', age: 3 }),
    ];
    const out = computeView(rows, props, {
      filters: [{ propId: 'status', op: 'eq', value: 'A' }],
      sorts: [{ propId: 'age', dir: 'asc' }],
    });
    expect(out.map((r) => r.id)).toEqual(['3', '1']);
  });
});
