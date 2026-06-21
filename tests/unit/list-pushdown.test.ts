/**
 * Anti-regression — §23 热路径 list() 过滤下推到存储层
 *
 * 锁死: 调用方不得"全集合 list() + JS 过滤", 必须把 tenantId/userId 等等值条件
 * 作为 filter 传给 store.list() (下推到 SQL WHERE). 用 spy 验证 filter 真传入,
 * 并验证跨租户/跨用户数据被正确隔离 (行为保持).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { kpiCycleRepo } from '@/lib/domain/kpi/kpi-cycle-repo-impl';
import { listMyChannels } from '@/lib/im/service';

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('§23 pushdown · kpiCycleRepo.findByTenant', () => {
  it('list 收到 { tenantId } 且只返回本租户周期', async () => {
    const store = getStore();
    await store.kpiCycles.create({ tenantId: 'default', name: 'A', status: 'active' } as never);
    await store.kpiCycles.create({ tenantId: 'other', name: 'B', status: 'active' } as never);

    const spy = vi.spyOn(store.kpiCycles, 'list');
    const res = await kpiCycleRepo.findByTenant('default');

    expect(spy).toHaveBeenCalledWith({ tenantId: 'default' });
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe('A');
  });
});

describe('§23 pushdown · IM listMyChannels', () => {
  it('imMemberships.list 收到 { userId } 且不加载他人成员关系', async () => {
    const store = getStore();
    const ch = await store.imChannels.create({
      tenantId: 'default',
      name: 'general',
      visibility: 'public',
      memberIds: ['u1', 'u2'],
      createdBy: 'u1',
    } as never);
    await store.imMemberships.create({
      channelId: ch.id,
      userId: 'u1',
      unreadCount: 0,
    } as never);
    await store.imMemberships.create({
      channelId: ch.id,
      userId: 'u2',
      unreadCount: 0,
    } as never);

    const spy = vi.spyOn(store.imMemberships, 'list');
    const res = await listMyChannels('u1', 'default');

    expect(spy).toHaveBeenCalledWith({ userId: 'u1' });
    expect(res).toHaveLength(1);
    expect(res[0].membership.userId).toBe('u1');
  });
});
