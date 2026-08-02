/**
 * Tenant Scope · 存储层租户隔离机制测试
 *
 * 覆盖:
 *   - 无作用域: 行为不变 (向后兼容, get/list 不隔离).
 *   - 作用域激活: get(跨租户) → null; list 强制按有效租户 (tenantId ?? 'default') 过滤.
 *   - 无 tenantId 字段记录 (如 ImMessage): 有效租户 'default', 仅 default 作用域可见 (回归).
 *   - list 覆盖调用方传入的 tenantId (防越权).
 *   - enforceTenantScope: 给不感知作用域的 typed 仓储 (KPI drizzle) 补隔离.
 *   - 纯 helper (isRecordVisibleInScope / applyTenantScopeToFilter) 单元行为.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { setStore, getStore } from '@/lib/storage/repository';
import {
  runInTenantScope,
  getActiveTenantScope,
  isRecordVisibleInScope,
  applyTenantScopeToFilter,
  enforceTenantScope,
} from '@/lib/storage/tenant-scope';
import type { Repository } from '@/lib/storage/repository';

type Note = { id: string; tenantId?: string; title: string };

beforeEach(() => {
  setStore(createInMemoryStore());
});

// 借用一个现成的 Repository (intranetPosts 结构简单, 带 tenantId) 做行为验证.
// 这里直接用 shouchaoNotes 仓储 (Partial 结构足够).
function repo() {
  return getStore().shouchaoNotes as unknown as {
    get(id: string): Promise<Note | null>;
    list(filter?: Partial<Note>): Promise<Note[]>;
    create(data: Omit<Note, 'id'> & { id?: string }): Promise<Note>;
  };
}

describe('tenant-scope · 纯 helper', () => {
  it('无作用域: 恒可见, filter 原样返回', () => {
    expect(getActiveTenantScope()).toBeUndefined();
    expect(isRecordVisibleInScope({ tenantId: 'acme' })).toBe(true);
    expect(applyTenantScopeToFilter({ title: 'x' } as Partial<Note>)).toEqual({ title: 'x' });
  });

  it('作用域激活: 有效租户 (tenantId ?? default) 与作用域一致才可见', () => {
    runInTenantScope('acme', () => {
      expect(getActiveTenantScope()).toBe('acme');
      expect(isRecordVisibleInScope({ tenantId: 'acme' })).toBe(true);
      expect(isRecordVisibleInScope({ tenantId: 'other' })).toBe(false);
      // 无 tenantId 字段 = 有效租户 'default'; 在 'acme' 作用域下不可见.
      expect(isRecordVisibleInScope({ title: 'x' })).toBe(false);
      expect(isRecordVisibleInScope(null)).toBe(false);
    });
  });

  it('作用域=default: 无 tenantId 字段记录 (如 ImMessage) 可见 (回归: 防误滤为空)', () => {
    runInTenantScope('default', () => {
      // ImMessage 无 tenantId 字段, KvStore 列默认 'default' → 有效租户 'default' → 命中.
      expect(isRecordVisibleInScope({ channelId: 'c1', body: 'hi' })).toBe(true);
      expect(isRecordVisibleInScope({ tenantId: 'default' })).toBe(true);
      expect(isRecordVisibleInScope({ tenantId: 'other' })).toBe(false);
    });
  });

  it('作用域激活: list filter 强制覆盖 tenantId', () => {
    runInTenantScope('acme', () => {
      // 即便调用方试图传别的租户, 也被覆盖为作用域租户.
      expect(applyTenantScopeToFilter({ tenantId: 'evil' } as Partial<Note>)).toEqual({
        tenantId: 'acme',
      });
      expect(applyTenantScopeToFilter(undefined)).toEqual({ tenantId: 'acme' });
    });
  });

  it('嵌套作用域以最内层为准', () => {
    runInTenantScope('outer', () => {
      runInTenantScope('inner', () => {
        expect(getActiveTenantScope()).toBe('inner');
      });
      expect(getActiveTenantScope()).toBe('outer');
    });
  });
});

describe('tenant-scope · 存储层强制隔离 (InMemoryStore)', () => {
  it('无作用域: get/list 不隔离 (向后兼容)', async () => {
    await repo().create({ id: 'n1', tenantId: 'acme', title: 'A' });
    await repo().create({ id: 'n2', tenantId: 'other', title: 'B' });

    expect(await repo().get('n1')).not.toBeNull();
    expect(await repo().get('n2')).not.toBeNull();
    expect(await repo().list()).toHaveLength(2);
  });

  it('作用域激活: get 跨租户记录返回 null', async () => {
    await repo().create({ id: 'n1', tenantId: 'acme', title: 'A' });
    await repo().create({ id: 'n2', tenantId: 'other', title: 'B' });

    await runInTenantScope('acme', async () => {
      expect(await repo().get('n1')).not.toBeNull();
      expect(await repo().get('n2')).toBeNull(); // 跨租户 → not-found
    });
  });

  it('作用域激活: list 只返回本租户记录', async () => {
    await repo().create({ id: 'n1', tenantId: 'acme', title: 'A' });
    await repo().create({ id: 'n2', tenantId: 'other', title: 'B' });
    await repo().create({ id: 'n3', tenantId: 'acme', title: 'C' });

    await runInTenantScope('acme', async () => {
      const rows = await repo().list();
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.tenantId === 'acme')).toBe(true);
    });
  });

  it('作用域激活: list 无视调用方传入的越权 tenantId', async () => {
    await repo().create({ id: 'n1', tenantId: 'acme', title: 'A' });
    await repo().create({ id: 'n2', tenantId: 'other', title: 'B' });

    await runInTenantScope('acme', async () => {
      // 调用方试图列举 other 租户 → 被作用域覆盖为 acme, 只见 acme (n1), 绝不泄漏 other.
      const rows = await repo().list({ tenantId: 'other' } as Partial<Note>);
      expect(rows).toHaveLength(1);
      expect(rows[0].tenantId).toBe('acme');
    });
  });

  it('enforceTenantScope: 给不感知作用域的 typed 仓储 (如 KPI drizzle) 补上隔离', async () => {
    // 模拟一个完全不理会作用域的 typed 仓储 (drizzle KPI list 只按显式 filter.tenantId).
    type Row = { id: string; tenantId: string; v: number };
    const data = new Map<string, Row>([
      ['a', { id: 'a', tenantId: 'acme', v: 1 }],
      ['b', { id: 'b', tenantId: 'other', v: 2 }],
      ['c', { id: 'c', tenantId: 'acme', v: 3 }],
    ]);
    const unscoped: Repository<Row> = {
      async get(id) { return data.get(id) ?? null; },
      async list() { return Array.from(data.values()); }, // 忽略作用域
      async create(d) { const r = d as Row; data.set(r.id, r); return r; },
      async update(id, p) { const r = { ...data.get(id)!, ...p, id }; data.set(id, r); return r; },
      async delete(id) { data.delete(id); },
    };
    const scoped = enforceTenantScope(unscoped);

    // 无作用域: 透传, 全量可见.
    expect(await scoped.list()).toHaveLength(3);
    expect(await scoped.get('b')).not.toBeNull();

    // acme 作用域: 只见 acme 两条, 跨租户 get 返回 null.
    await runInTenantScope('acme', async () => {
      const rows = await scoped.list();
      expect(rows.map((r) => r.id).sort()).toEqual(['a', 'c']);
      expect(await scoped.get('b')).toBeNull();
      expect(await scoped.get('a')).not.toBeNull();
    });
  });

  it('回归: 无 tenantId 字段的记录 (如 ImMessage) 在 default 作用域下 list 不被误滤为空', async () => {
    // 模拟 ImMessage: 记录无 tenantId 字段. memory-store 逐条判定应按有效租户 'default' 命中.
    await repo().create({ id: 'm1', title: 'msg1' }); // 无 tenantId
    await repo().create({ id: 'm2', title: 'msg2' }); // 无 tenantId

    await runInTenantScope('default', async () => {
      const rows = await repo().list();
      expect(rows).toHaveLength(2); // 修复前: 返回 0 (被误滤)
      expect(await repo().get('m1')).not.toBeNull();
    });
    // 非 default 作用域下, 有效租户 'default' 记录不可见.
    await runInTenantScope('acme', async () => {
      expect(await repo().list()).toHaveLength(0);
      expect(await repo().get('m1')).toBeNull();
    });
  });
});
