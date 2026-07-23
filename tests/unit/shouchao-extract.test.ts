/**
 * A1 · 手抄→数据库抽取纯逻辑 (schema 生成 / 单元格归一 / 草稿行归一)
 */
import { describe, it, expect } from 'vitest';
import {
  buildExtractionJsonSchema,
  normalizeCell,
  normalizeDraftRows,
} from '@/lib/shouchao/extract';
import type { ShouchaoProperty } from '@/lib/types/shouchao-db';

const props: ShouchaoProperty[] = [
  { id: 'name', name: '名称', type: 'text' },
  { id: 'count', name: '数量', type: 'number' },
  { id: 'status', name: '状态', type: 'select', options: ['A', 'B'] },
  { id: 'tags', name: '标签', type: 'multiSelect', options: ['x', 'y'] },
  { id: 'done', name: '完成', type: 'checkbox' },
];

describe('buildExtractionJsonSchema', () => {
  const schema = buildExtractionJsonSchema(props) as any;
  it('顶层是 {rows:[...]}, 严格模式', () => {
    expect(schema.required).toEqual(['rows']);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.rows.type).toBe('array');
  });
  it('行 item 的 required 覆盖所有 propId (strict)', () => {
    expect(schema.properties.rows.items.required).toEqual(['name', 'count', 'status', 'tags', 'done']);
  });
  it('select 的 enum 含候选值 + null; number 允许 null; checkbox 为 boolean', () => {
    const cell = schema.properties.rows.items.properties;
    expect(cell.status.enum).toEqual(['A', 'B', null]);
    expect(cell.count.type).toEqual(['number', 'null']);
    expect(cell.done.type).toBe('boolean');
  });
});

describe('normalizeCell', () => {
  const byId = Object.fromEntries(props.map((p) => [p.id, p]));
  it('number 解析, 脏字符剥离, 非数→null', () => {
    expect(normalizeCell(byId.count, '12')).toBe(12);
    expect(normalizeCell(byId.count, '￥3.5')).toBe(3.5);
    expect(normalizeCell(byId.count, 'abc')).toBeNull();
    expect(normalizeCell(byId.count, '')).toBeNull();
  });
  it('select 越界留空', () => {
    expect(normalizeCell(byId.status, 'A')).toBe('A');
    expect(normalizeCell(byId.status, 'Z')).toBeNull();
    expect(normalizeCell(byId.status, '')).toBeNull();
  });
  it('multiSelect 过滤到候选, 支持逗号串', () => {
    expect(normalizeCell(byId.tags, ['x', 'z'])).toEqual(['x']);
    expect(normalizeCell(byId.tags, 'x, y, q')).toEqual(['x', 'y']);
    expect(normalizeCell(byId.tags, null)).toEqual([]);
  });
  it('checkbox 多形态转 boolean', () => {
    expect(normalizeCell(byId.done, true)).toBe(true);
    expect(normalizeCell(byId.done, 'true')).toBe(true);
    expect(normalizeCell(byId.done, 1)).toBe(true);
    expect(normalizeCell(byId.done, null)).toBe(false);
  });
  it('text 去空白, 空→null', () => {
    expect(normalizeCell(byId.name, '  hi ')).toBe('hi');
    expect(normalizeCell(byId.name, '   ')).toBeNull();
  });
});

describe('normalizeDraftRows', () => {
  it('跳过非对象, 丢弃全空行, 保留有值行', () => {
    const rows = normalizeDraftRows(props, [
      { name: '苹果', count: '3', status: 'A', tags: ['x'], done: true },
      { name: '', count: '', status: 'Z', tags: [], done: false }, // 全空 → 丢
      'garbage',
      null,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].cells).toEqual({ name: '苹果', count: 3, status: 'A', tags: ['x'], done: true });
  });
  it('非数组输入返回空', () => {
    expect(normalizeDraftRows(props, null)).toEqual([]);
    expect(normalizeDraftRows(props, { rows: 1 })).toEqual([]);
  });
});
