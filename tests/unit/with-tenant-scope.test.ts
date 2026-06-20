/**
 * withTenantScope · 单元测试 (宪章 §23 铁律 #1 收敛层)
 *
 * 用一个内存 fake repo 验证 5 个方法的租户隔离不变量:
 *   - create: tenantId 由 scope 强制注入, 覆盖 body 注入
 *   - list:   只返回本租户, 调用方无法借 filter 覆盖隔离
 *   - get:    他租户记录视同不存在 (null)
 *   - update: 命中他租户 → 抛 TenantScopeViolationError; 不可改写 tenantId
 *   - delete: 命中他租户 → 抛错, 不删除
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { ListOptions, Repository } from '@/lib/storage/repository';
import { withTenantScope, TenantScopeViolationError } from '@/lib/multi-tenant/with-tenant-scope';

interface Row {
  id: string;
  tenantId?: string;
  title: string;
}

function fakeRepo(): Repository<Row> {
  const data = new Map<string, Row>();
  let seq = 0;
  return {
    async get(id) {
      return data.get(id) ?? null;
    },
    async list(filter?: Partial<Row>, opts?: ListOptions) {
      let rows = Array.from(data.values());
      if (filter) {
        rows = rows.filter((r) =>
          Object.entries(filter).every(([k, v]) => (r as never)[k] === v),
        );
      }
      if (opts?.offset) rows = rows.slice(opts.offset);
      if (opts?.limit !== undefined) rows = rows.slice(0, opts.limit);
      return rows;
    },
    async create(d) {
      const id = d.id ?? `r${++seq}`;
      const row = { ...(d as object), id } as Row;
      data.set(id, row);
      return row;
    },
    async update(id, d) {
      const ex = data.get(id);
      if (!ex) throw new Error('not found');
      const next = { ...ex, ...d, id };
      data.set(id, next);
      return next;
    },
    async delete(id) {
      data.delete(id);
    },
  };
}

describe('withTenantScope', () => {
  let base: Repository<Row>;

  beforeEach(() => {
    base = fakeRepo();
  });

  it('create 强制注入 tenantId, 覆盖 body 注入值', async () => {
    const scoped = withTenantScope(base, 'tenant-a');
    const row = await scoped.create({ title: 'x', tenantId: 'evil-tenant' } as never);
    expect(row.tenantId).toBe('tenant-a');
    // 直接从底层 repo 读, 确认落库的就是 tenant-a
    const raw = await base.get(row.id);
    expect(raw?.tenantId).toBe('tenant-a');
  });

  it('list 只返回本租户, filter 无法覆盖隔离', async () => {
    await base.create({ id: 'a1', tenantId: 'tenant-a', title: 'A1' });
    await base.create({ id: 'b1', tenantId: 'tenant-b', title: 'B1' });
    const scoped = withTenantScope(base, 'tenant-a');

    const mine = await scoped.list();
    expect(mine.map((r) => r.id)).toEqual(['a1']);

    // 即便调用方试图借 filter 注入他租户, 也被强制覆盖
    const attempt = await scoped.list({ tenantId: 'tenant-b' } as Partial<Row>);
    expect(attempt.map((r) => r.id)).toEqual(['a1']);
  });

  it('list 缺省 tenantId 记录归属 default (兼容历史数据, 真实租户取不到)', async () => {
    await base.create({ id: 'n1', title: 'no-tenant' }); // 无 tenantId
    const scopedDefault = withTenantScope(base, 'default');
    const scopedA = withTenantScope(base, 'tenant-a');
    // default scope: 历史无 tenantId 行视为 default, 可见 (drop-in 兼容现有 ?? 'default' 语义)
    expect((await scopedDefault.list()).map((r) => r.id)).toEqual(['n1']);
    // 真实租户 scope: 无 tenantId 行不属于该租户, 不可见
    expect((await scopedA.list()).map((r) => r.id)).toEqual([]);
  });

  it('get 他租户记录视同不存在 (null)', async () => {
    await base.create({ id: 'b1', tenantId: 'tenant-b', title: 'B1' });
    const scoped = withTenantScope(base, 'tenant-a');
    expect(await scoped.get('b1')).toBeNull();
  });

  it('get 本租户记录正常返回', async () => {
    await base.create({ id: 'a1', tenantId: 'tenant-a', title: 'A1' });
    const scoped = withTenantScope(base, 'tenant-a');
    expect((await scoped.get('a1'))?.title).toBe('A1');
  });

  it('update 命中他租户 → 抛 TenantScopeViolationError, 不改动', async () => {
    await base.create({ id: 'b1', tenantId: 'tenant-b', title: 'B1' });
    const scoped = withTenantScope(base, 'tenant-a');
    await expect(scoped.update('b1', { title: 'hacked' })).rejects.toBeInstanceOf(
      TenantScopeViolationError,
    );
    expect((await base.get('b1'))?.title).toBe('B1');
  });

  it('update 不可改写 tenantId (越界搬移)', async () => {
    await base.create({ id: 'a1', tenantId: 'tenant-a', title: 'A1' });
    const scoped = withTenantScope(base, 'tenant-a');
    await scoped.update('a1', { title: 'A1b', tenantId: 'tenant-b' } as Partial<Row>);
    expect((await base.get('a1'))?.tenantId).toBe('tenant-a');
  });

  it('delete 命中他租户 → 抛错, 不删除', async () => {
    await base.create({ id: 'b1', tenantId: 'tenant-b', title: 'B1' });
    const scoped = withTenantScope(base, 'tenant-a');
    await expect(scoped.delete('b1')).rejects.toBeInstanceOf(TenantScopeViolationError);
    expect(await base.get('b1')).not.toBeNull();
  });
});
