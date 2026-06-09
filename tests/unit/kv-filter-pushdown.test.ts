/**
 * DB-AUDIT P1 · classifyKvFilter 单测 (2026-06-09)
 *
 * 验证 DrizzleKvRepository.list() 的 filter 分类逻辑:
 *   - string + 合法标识符 → SQL 下推 (期望命中 0007 partial 索引)
 *   - number / boolean / object → 留 JS 端兜底过滤 (避免 ->> 类型坑)
 *   - tenantId → 走 KvStore.tenantId 列 (不进 JSONB 表达式)
 *   - 任意 JS 兜底键存在 → canPushLimit=false (避免 SQL 限行早于 JS 过滤)
 *   - 非法 key 形状 → 不下推 (防 SQL 注入兜底)
 */
import { describe, it, expect } from 'vitest';
import { classifyKvFilter, SAFE_KEY_RE } from '@/lib/storage/kv-filter';

describe('DB-AUDIT P1 · classifyKvFilter', () => {
  it('无 filter → 全空, 可下推 limit', () => {
    const r = classifyKvFilter(undefined);
    expect(r.tenantId).toBeUndefined();
    expect(r.jsonbStringKeys).toEqual([]);
    expect(r.jsFallbackKeys).toEqual([]);
    expect(r.canPushLimit).toBe(true);
  });

  it('空对象 → 全空, 可下推 limit', () => {
    const r = classifyKvFilter({});
    expect(r.jsonbStringKeys).toEqual([]);
    expect(r.jsFallbackKeys).toEqual([]);
    expect(r.canPushLimit).toBe(true);
  });

  it('tenantId 单独走列, 不进 JSONB', () => {
    const r = classifyKvFilter({ tenantId: 't1' });
    expect(r.tenantId).toBe('t1');
    expect(r.jsonbStringKeys).toEqual([]);
    expect(r.canPushLimit).toBe(true);
  });

  it('string 值 + 合法 key → 进 JSONB 下推', () => {
    const r = classifyKvFilter({ channelId: 'c-123', senderId: 'u-7' });
    expect(r.jsonbStringKeys).toEqual([
      { key: 'channelId', value: 'c-123' },
      { key: 'senderId', value: 'u-7' },
    ]);
    expect(r.jsFallbackKeys).toEqual([]);
    expect(r.canPushLimit).toBe(true);
  });

  it('tenantId + JSONB string 键混合', () => {
    const r = classifyKvFilter({
      tenantId: 't1',
      ownershipLevel: 'company',
      status: 'active',
    });
    expect(r.tenantId).toBe('t1');
    expect(r.jsonbStringKeys).toEqual([
      { key: 'ownershipLevel', value: 'company' },
      { key: 'status', value: 'active' },
    ]);
    expect(r.canPushLimit).toBe(true);
  });

  it('number / boolean / object 值 → JS 兜底, 阻止 limit 下推', () => {
    const r = classifyKvFilter({
      tenantId: 't1',
      ownershipLevel: 'company', // string → SQL
      priority: 5,                // number → JS
      archived: false,            // boolean → JS
      meta: { foo: 'bar' },       // object → JS
    });
    expect(r.tenantId).toBe('t1');
    expect(r.jsonbStringKeys).toEqual([
      { key: 'ownershipLevel', value: 'company' },
    ]);
    expect(r.jsFallbackKeys).toEqual(['priority', 'archived', 'meta']);
    expect(r.canPushLimit).toBe(false); // 关键: 有 JS 兜底键就不能 SQL 截断
  });

  it('undefined 值跳过 (不下推也不兜底)', () => {
    const r = classifyKvFilter({
      tenantId: 't1',
      status: undefined,
      ownershipLevel: 'company',
    });
    expect(r.jsonbStringKeys).toEqual([
      { key: 'ownershipLevel', value: 'company' },
    ]);
    expect(r.jsFallbackKeys).toEqual([]);
    expect(r.canPushLimit).toBe(true);
  });

  it('null 值 → 走 JS 兜底 (非 string)', () => {
    const r = classifyKvFilter({ status: null as unknown });
    expect(r.jsonbStringKeys).toEqual([]);
    expect(r.jsFallbackKeys).toEqual(['status']);
    expect(r.canPushLimit).toBe(false);
  });

  it('非法 key 形状 (含特殊字符 / 注入) → 不下推', () => {
    const r = classifyKvFilter({
      "evil'; DROP TABLE--": 'x',
      'with space': 'y',
      '123starts_with_digit': 'z',
      '-dash': 'a',
    });
    expect(r.jsonbStringKeys).toEqual([]);
    expect(r.jsFallbackKeys).toHaveLength(4);
    expect(r.canPushLimit).toBe(false);
  });

  it('SAFE_KEY_RE 接受标准标识符, 拒绝其他形状', () => {
    expect(SAFE_KEY_RE.test('channelId')).toBe(true);
    expect(SAFE_KEY_RE.test('ownership_level')).toBe(true);
    expect(SAFE_KEY_RE.test('_private')).toBe(true);
    expect(SAFE_KEY_RE.test('a1b2')).toBe(true);
    expect(SAFE_KEY_RE.test('1leading_digit')).toBe(false);
    expect(SAFE_KEY_RE.test('with space')).toBe(false);
    expect(SAFE_KEY_RE.test("inj'ection")).toBe(false);
    expect(SAFE_KEY_RE.test('data->>x')).toBe(false);
    expect(SAFE_KEY_RE.test('')).toBe(false);
  });

  it('tenantId 类型非 string → 不走 tenantId 列 (兜底)', () => {
    const r = classifyKvFilter({ tenantId: 123 as unknown });
    expect(r.tenantId).toBeUndefined();
    expect(r.jsFallbackKeys).toContain('tenantId');
  });
});
