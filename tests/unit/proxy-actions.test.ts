/**
 * ProxyAction 闭环单元测试
 *
 * 覆盖:
 *   - 红区永禁
 *   - 绿区直接 executed
 *   - 黄区 awaiting_veto + vetoUntil
 *   - veto / confirm 状态转移
 *   - reconcile 自动落定
 *   - 已 executed 不可再 veto
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  createProxyAction,
  vetoProxyAction,
  confirmProxyAction,
  reconcilePendingActions,
  listProxyActionsForUser,
} from '../../lib/persona/proxy-actions';
import { getStore, setStore } from '../../lib/storage/repository';
import { createInMemoryStore } from '../../lib/storage/memory-store';
import { DEFAULT_VETO_WINDOW_MS } from '../../lib/types/proxy-action';

beforeAll(() => {
  setStore(createInMemoryStore());
});

const TENANT = 'default';
const USER = 'user_test_proxy';
const PERSONA = 'persona_test_proxy';

async function reset() {
  // 内存 store 每个测试间需要清; 直接清空 proxyActions
  const store = getStore();
  const all = await store.proxyActions.list();
  for (const a of all) await store.proxyActions.delete(a.id);
}

describe('ProxyAction state machine', () => {
  beforeEach(reset);

  it('rejects red zone unconditionally', async () => {
    await expect(
      createProxyAction({
        userId: USER,
        personaId: PERSONA,
        tenantId: TENANT,
        kind: 'communication',
        zone: 'red',
        title: '应被拒绝',
      })
    ).rejects.toThrow(/红区/);
  });

  it('green zone is immediately executed (no veto window)', async () => {
    const a = await createProxyAction({
      userId: USER,
      personaId: PERSONA,
      tenantId: TENANT,
      kind: 'im_reply',
      zone: 'green',
      title: '绿区: 自动确认',
    });
    expect(a.status).toBe('executed');
    expect(a.executedAt).toBeTruthy();
    expect(a.vetoUntil).toBeUndefined();
  });

  it('yellow zone defaults to awaiting_veto with 24h window', async () => {
    const a = await createProxyAction({
      userId: USER,
      personaId: PERSONA,
      tenantId: TENANT,
      kind: 'im_reply',
      zone: 'yellow',
      title: '黄区: 等否决',
    });
    expect(a.status).toBe('awaiting_veto');
    expect(a.vetoUntil).toBeTruthy();
    const remaining = new Date(a.vetoUntil!).getTime() - Date.now();
    // 应在 24h ± 5s 之内
    expect(remaining).toBeGreaterThan(DEFAULT_VETO_WINDOW_MS - 5000);
    expect(remaining).toBeLessThanOrEqual(DEFAULT_VETO_WINDOW_MS);
  });

  it('drafted status stays drafted until confirm/veto', async () => {
    const a = await createProxyAction({
      userId: USER,
      personaId: PERSONA,
      tenantId: TENANT,
      kind: 'communication',
      zone: 'yellow',
      title: '草稿等确认',
      initialStatus: 'drafted',
    });
    expect(a.status).toBe('drafted');
  });

  it('veto transitions awaiting_veto → vetoed with reason', async () => {
    const a = await createProxyAction({
      userId: USER,
      personaId: PERSONA,
      tenantId: TENANT,
      kind: 'im_reply',
      zone: 'yellow',
      title: '将被否决',
    });
    const v = await vetoProxyAction(a.id, USER, '语气不对');
    expect(v.status).toBe('vetoed');
    expect(v.vetoedBy).toBe(USER);
    expect(v.vetoReason).toBe('语气不对');
  });

  it('confirm transitions awaiting_veto → executed immediately', async () => {
    const a = await createProxyAction({
      userId: USER,
      personaId: PERSONA,
      tenantId: TENANT,
      kind: 'im_reply',
      zone: 'yellow',
      title: '将被立即确认',
    });
    const c = await confirmProxyAction(a.id, USER);
    expect(c.status).toBe('executed');
    expect(c.confirmedBy).toBe(USER);
    expect(c.executedAt).toBeTruthy();
  });

  it('cannot veto an executed action', async () => {
    const a = await createProxyAction({
      userId: USER,
      personaId: PERSONA,
      tenantId: TENANT,
      kind: 'im_reply',
      zone: 'green', // green 立刻 executed
      title: '已执行',
    });
    await expect(vetoProxyAction(a.id, USER, 'too late')).rejects.toThrow(/已执行/);
  });

  it('reconcile turns expired veto window into executed', async () => {
    // 手工造一条 vetoUntil 已过期的 awaiting_veto
    const store = getStore();
    const past = new Date(Date.now() - 1000).toISOString();
    const created = await store.proxyActions.create({
      userId: USER,
      personaId: PERSONA,
      tenantId: TENANT,
      kind: 'im_reply',
      zone: 'yellow',
      status: 'awaiting_veto',
      title: '过期 awaiting',
      vetoUntil: past,
      createdAt: past,
      updatedAt: past,
    } as never);

    const result = await reconcilePendingActions();
    expect(result.executed).toBeGreaterThanOrEqual(1);

    const after = await store.proxyActions.get(created.id);
    expect(after?.status).toBe('executed');
  });

  it('reconcile turns expired drafted into expired (not executed)', async () => {
    const store = getStore();
    const past = new Date(Date.now() - 1000).toISOString();
    const created = await store.proxyActions.create({
      userId: USER,
      personaId: PERSONA,
      tenantId: TENANT,
      kind: 'communication',
      zone: 'yellow',
      status: 'drafted',
      title: '过期 draft',
      vetoUntil: past,
      createdAt: past,
      updatedAt: past,
    } as never);

    const result = await reconcilePendingActions();
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const after = await store.proxyActions.get(created.id);
    expect(after?.status).toBe('expired');
  });

  it('listProxyActionsForUser filters by user + tenant', async () => {
    await createProxyAction({
      userId: USER,
      personaId: PERSONA,
      tenantId: TENANT,
      kind: 'im_reply',
      zone: 'yellow',
      title: 'mine',
    });
    await createProxyAction({
      userId: 'other_user',
      personaId: PERSONA,
      tenantId: TENANT,
      kind: 'im_reply',
      zone: 'yellow',
      title: 'theirs',
    });
    const mine = await listProxyActionsForUser(USER, TENANT);
    expect(mine).toHaveLength(1);
    expect(mine[0].title).toBe('mine');
  });
});
