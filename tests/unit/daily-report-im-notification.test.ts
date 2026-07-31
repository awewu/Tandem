import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { ensureCoreActions } from '@/lib/ontology';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore } from '@/lib/storage/repository';
import { COOKIE_ACCESS, signAccessToken as signSessionToken } from '@/lib/auth/session';
import { signAccessToken as signOidcAccessToken } from '@/lib/oidc/tokens';
import type { AuthUser } from '@/lib/storage/repository';
import type { KeyResult, Objective } from '@/lib/types/okr-tti';

vi.mock('@/lib/boot', async () => {
  const repo = await import('@/lib/storage/repository');
  return {
    boot: vi.fn(async () => {}),
    bootHotPath: vi.fn(() => {}),
    getStore: repo.getStore,
  };
});

const NOW = '2026-07-25T00:00:00.000Z';

function objective(patch: Partial<Objective> & Pick<Objective, 'id' | 'ownerId'>): Objective {
  return {
    cycleId: 'cycle-1',
    level: 'individual',
    title: `Objective ${patch.id}`,
    visibility: 'private',
    weight: 100,
    status: 'active',
    confidence: 'on-track',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    tenantId: 'tenant-a',
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
    id: patch.id,
    ownerId: patch.ownerId,
  };
}

function keyResult(patch: Partial<KeyResult> & Pick<KeyResult, 'id' | 'objectiveId' | 'ownerId'>): KeyResult {
  return {
    coOwnerIds: [],
    title: `KR ${patch.id}`,
    measureType: 'numeric',
    computeMethod: 'latest',
    startValue: 0,
    targetValue: 100,
    currentValue: 40,
    confidence: 'on-track',
    riskStatus: 'on_track',
    weight: 1,
    status: 'active',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    tenantId: 'tenant-a',
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
    id: patch.id,
    objectiveId: patch.objectiveId,
    ownerId: patch.ownerId,
  };
}

async function seedAuthor(): Promise<AuthUser> {
  return getStore().auth.users.create({
    email: 'daily-author@example.com',
    name: '日报作者',
    roles: ['employee'],
    tenantId: 'tenant-a',
    departmentId: 'dept-sales',
  });
}

async function seedOkr(authorId: string): Promise<void> {
  await getStore().objectives.create(objective({ id: 'obj-a', ownerId: authorId }));
  await getStore().keyResults.create(keyResult({ id: 'kr-a', objectiveId: 'obj-a', ownerId: authorId }));
}

function sessionReq(user: AuthUser) {
  const token = signSessionToken({
    sub: user.id,
    email: user.email,
    roles: user.roles ?? ['employee'],
    tenantId: user.tenantId ?? 'tenant-a',
    mfa: true,
    sid: 'sid-daily-report',
  });
  return new NextRequest(new Request('http://test.local/api/okr/checkins', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${COOKIE_ACCESS}=${token}`,
    },
    body: JSON.stringify({
      scope: 'kr',
      scopeId: 'kr-a',
      progressBefore: 40,
      progressAfter: 45,
      currentValue: 45,
      confidenceBefore: 'on-track',
      confidenceAfter: 'on-track',
      achievements: '完成客户日报联动',
      blockers: '',
      nextSteps: '继续验证部门群通知',
      mood: 'neutral',
    }),
  }));
}

async function oidcReq(user: AuthUser) {
  const token = await signOidcAccessToken({
    issuer: 'https://idp.test',
    clientId: 'innovation-studio',
    userId: user.id,
    tenantId: user.tenantId ?? 'tenant-a',
    scope: 'openid api.read api.write',
    email: user.email,
    roles: ['employee'],
  });
  return new NextRequest('http://test.local/api/integrations/plm/daily-reports', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: 'plm.daily-report.v1',
      sourceSystem: 'innovation-studio',
      externalReportId: 'innovation-studio:2026-07-25',
      reportDate: '2026-07-25',
      replaceExisting: true,
      entries: [
        {
          externalEntryId: 'entry-okr',
          krId: 'kr-a',
          projectCode: 'TANDEM:kr-a',
          hours: 2,
          workType: 'software_dev',
          content: 'PLM 推送日报内容',
        },
      ],
    }),
  });
}

beforeEach(async () => {
  ensureCoreActions();
  setStore(createInMemoryStore());
});

describe('daily report department IM notification', () => {
  it('手工日报 check-in 成功后自动发送到作者部门群', async () => {
    const user = await seedAuthor();
    await seedOkr(user.id);
    const { POST } = await import('@/app/api/okr/checkins/route');

    const res = await POST(sessionReq(user));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.imNotification).toMatchObject({ sent: true });
    const channels = await getStore().imChannels.list();
    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({ departmentId: 'dept-sales', autoCreated: true });
    const messages = await getStore().imMessages.list({ channelId: channels[0].id });
    expect(messages).toHaveLength(1);
    expect(messages[0].senderId).toBe(user.id);
    expect(messages[0].senderKind).toBe('user');
    expect(messages[0].body).not.toContain('日报同步');
    expect(messages[0].body).toContain('完成客户日报联动');
  });

  it('PLM 日报同步成功后自动发送到作者部门群', async () => {
    const user = await seedAuthor();
    await seedOkr(user.id);
    const { POST } = await import('@/app/api/integrations/plm/daily-reports/route');

    const res = await POST(await oidcReq(user));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.imNotifications).toMatchObject([{ sent: true }]);
    const channels = await getStore().imChannels.list();
    expect(channels).toHaveLength(1);
    const messages = await getStore().imMessages.list({ channelId: channels[0].id });
    expect(messages).toHaveLength(1);
    expect(messages[0].senderId).toBe(user.id);
    expect(messages[0].senderKind).toBe('user');
    expect(messages[0].body).not.toContain('日报同步');
    expect(messages[0].body).toContain('PLM 日报');
    expect(messages[0].body).toContain('PLM 推送日报内容');
  });

  it('复用已有部门群时先补作者成员再以作者身份发消息', async () => {
    const user = await seedAuthor();
    await seedOkr(user.id);
    const { createChannel } = await import('@/lib/im/service');
    const owner = await getStore().auth.users.create({
      email: 'dept-owner@example.com',
      name: '部门群主',
      roles: ['employee'],
      tenantId: 'tenant-a',
      departmentId: 'dept-sales',
    });
    const channel = await createChannel({
      type: 'department',
      name: '销售部',
      memberIds: [owner.id],
      createdBy: owner.id,
      tenantId: 'tenant-a',
      departmentId: 'dept-sales',
      autoCreated: true,
    });
    expect(channel.memberIds).not.toContain(user.id);

    const { POST } = await import('@/app/api/okr/checkins/route');
    const res = await POST(sessionReq(user));

    expect(res.status).toBe(200);
    const updated = await getStore().imChannels.get(channel.id);
    expect(updated?.memberIds).toContain(user.id);
    const messages = await getStore().imMessages.list({ channelId: channel.id });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ senderId: user.id, senderKind: 'user' });
  });
});
