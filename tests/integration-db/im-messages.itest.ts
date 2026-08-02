/**
 * tests/integration-db/im-messages.itest.ts
 *
 * IM 消息热路径 DB 集成测试 (opt-in, 真库).
 *   验证 DrizzleImMessageRepository.listByChannel 的真 SQL 下推:
 *     - data->>'channelId' 过滤 + data->>'createdAt' DESC + reverse 为升序
 *     - data->>'deletedAt' IS NULL 排除软删
 *     - limit 取最新 N 条; before 游标 (排他)
 *     - 租户作用域 (KvStore.tenantId 列 eq) 隔离
 *   单测只覆盖 memory 实现, 这里补真 drizzle + 真 KvStore 的闭环 (防"假闭环")。
 *
 * 运行: npm run test:pms-integration  (需本地真库 localhost:5432 + .env.local DATABASE_URL)
 * 安全: 数据挂唯一 channelId + 唯一租户, afterAll/beforeEach 全清理, 不触碰真实 IM 数据。
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';

import { db, schema } from '@/lib/infra/drizzle-client';
import { createDrizzleStore } from '@/lib/storage/drizzle-store';
import { runInTenantScope } from '@/lib/storage/tenant-scope';
import type { TandemStore } from '@/lib/storage/repository';
import type { ImMessage } from '@/lib/types/im';

const kv = schema.kvStore;
const TEST_TENANT = '__im_itest__';
const CHANNEL = '__im_itest_channel__';
const OTHER_CHANNEL = '__im_itest_channel_other__';
const hasDb = !!process.env.DATABASE_URL;

let store: TandemStore;

async function cleanup(): Promise<void> {
  // 清理本测试租户的全部 im_messages 行 (幂等)。
  await db
    .delete(kv)
    .where(and(eq(kv.collection, 'im_messages'), eq(kv.tenantId, TEST_TENANT)));
}

async function seed(
  id: string,
  channelId: string,
  createdAt: string,
  extra: Partial<ImMessage> = {},
): Promise<void> {
  await store.imMessages.create({
    id,
    channelId,
    senderId: 'itest_u1',
    senderKind: 'user',
    body: id,
    mentions: [],
    tenantId: TEST_TENANT,
    createdAt,
    ...extra,
  } as Omit<ImMessage, 'id'> & { id?: string });
}

describe.runIf(hasDb)('IM · listByChannel (真库 drizzle)', () => {
  beforeAll(() => {
    store = createDrizzleStore();
  });
  beforeEach(cleanup);
  afterAll(cleanup);

  it('按 createdAt 升序返回, 只含目标频道', async () => {
    await seed('m2', CHANNEL, '2026-01-02T00:00:00.000Z');
    await seed('m1', CHANNEL, '2026-01-01T00:00:00.000Z');
    await seed('x1', OTHER_CHANNEL, '2026-01-01T12:00:00.000Z');
    await seed('m3', CHANNEL, '2026-01-03T00:00:00.000Z');

    const rows = await store.imMessages.listByChannel(CHANNEL);
    expect(rows.map((r) => r.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('排除软删 (data->>deletedAt IS NULL)', async () => {
    await seed('m1', CHANNEL, '2026-01-01T00:00:00.000Z');
    await seed('m2', CHANNEL, '2026-01-02T00:00:00.000Z', { deletedAt: '2026-01-02T01:00:00.000Z' });
    await seed('m3', CHANNEL, '2026-01-03T00:00:00.000Z');

    const rows = await store.imMessages.listByChannel(CHANNEL);
    expect(rows.map((r) => r.id)).toEqual(['m1', 'm3']);
  });

  it('limit 取最新 N 条 (仍升序返回)', async () => {
    for (let i = 1; i <= 5; i++) {
      await seed(`m${i}`, CHANNEL, `2026-01-0${i}T00:00:00.000Z`);
    }
    const rows = await store.imMessages.listByChannel(CHANNEL, { limit: 2 });
    expect(rows.map((r) => r.id)).toEqual(['m4', 'm5']);
  });

  it('before 游标: 只返回早于游标的消息 (排他)', async () => {
    for (let i = 1; i <= 5; i++) {
      await seed(`m${i}`, CHANNEL, `2026-01-0${i}T00:00:00.000Z`);
    }
    const rows = await store.imMessages.listByChannel(CHANNEL, {
      before: '2026-01-03T00:00:00.000Z',
      limit: 10,
    });
    expect(rows.map((r) => r.id)).toEqual(['m1', 'm2']);
  });

  it('租户作用域: 同租户可见, 异租户不可见', async () => {
    await seed('m1', CHANNEL, '2026-01-01T00:00:00.000Z');
    await seed('m2', CHANNEL, '2026-01-02T00:00:00.000Z');

    await runInTenantScope(TEST_TENANT, async () => {
      const rows = await store.imMessages.listByChannel(CHANNEL);
      expect(rows.map((r) => r.id)).toEqual(['m1', 'm2']);
    });
    await runInTenantScope('__im_itest_other_tenant__', async () => {
      const rows = await store.imMessages.listByChannel(CHANNEL);
      expect(rows).toEqual([]);
    });
  });

  it('空频道返回空数组', async () => {
    const rows = await store.imMessages.listByChannel('__im_itest_nope__');
    expect(rows).toEqual([]);
  });
});
