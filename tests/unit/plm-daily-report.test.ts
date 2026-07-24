import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore } from '@/lib/storage/repository';
import { boot } from '@/lib/boot';
import { ensureCoreActions } from '@/lib/ontology';
import { signAccessToken } from '@/lib/oidc/tokens';
import { queryApiLogs, resetApiLogsForTests } from '@/lib/api-log/service';
import type { KeyResult, Objective } from '@/lib/types/okr-tti';
import type { DailyReport } from '@/lib/types/daily-report';

const NOW = '2026-07-24T00:00:00.000Z';

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

function payload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'plm.daily-report.v1',
    sourceSystem: 'innovation-studio',
    externalReportId: 'innovation-studio:2026-07-24',
    reportDate: '2026-07-24',
    replaceExisting: true,
    entries: [
      {
        externalEntryId: 'entry-okr',
        krId: 'kr-a',
        projectCode: 'TANDEM:kr-a',
        hours: 6,
        workType: 'software_dev',
        content: '完成日报同步接口',
      },
      {
        externalEntryId: 'entry-non-okr',
        krId: null,
        projectCode: 'NON_OKR',
        hours: 1,
        workType: 'standup_sync',
        content: '跨部门方案确认',
      },
    ],
    ...overrides,
  };
}

async function token(userId: string, scope = 'openid api.read api.write', tenantId = 'tenant-a') {
  return signAccessToken({
    issuer: 'https://idp.test',
    clientId: 'innovation-studio',
    userId,
    tenantId,
    scope,
    email: `${userId}@example.com`,
    roles: ['employee'],
  });
}

function postReq(accessToken: string, body: unknown, requestId = 'req_daily_report') {
  return new NextRequest('http://test.local/api/integrations/plm/daily-reports', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-request-id': requestId,
    },
    body: JSON.stringify(body),
  });
}

function getReq(accessToken: string) {
  return new NextRequest('http://test.local/api/integrations/plm/daily-reports', {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

async function seedBase() {
  const store = getStore();
  await store.objectives.create(objective({ id: 'obj-a', ownerId: 'user-a' }));
  await store.objectives.create(objective({ id: 'obj-b', ownerId: 'user-b' }));
  await store.keyResults.create(keyResult({ id: 'kr-a', objectiveId: 'obj-a', ownerId: 'user-a' }));
  await store.keyResults.create(keyResult({ id: 'kr-b', objectiveId: 'obj-b', ownerId: 'user-b' }));
}

async function callPost(userId: string, body: unknown, scope?: string) {
  const { POST } = await import('@/app/api/integrations/plm/daily-reports/route');
  return POST(postReq(await token(userId, scope), body));
}

async function flushDeferredWrites(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

describe('PLM daily report integration', () => {
  beforeEach(async () => {
    process.env.DISABLE_DEMO_SEED = '1';
    ensureCoreActions();
    resetApiLogsForTests();
    setStore(createInMemoryStore());
    await boot();
    setStore(createInMemoryStore());
    await seedBase();
  });

  it('strictly isolates A/B users with the same external report id', async () => {
    const a = await callPost('user-a', payload());
    expect(a.status).toBe(200);
    const b = await callPost('user-b', payload({
      entries: [
        {
          externalEntryId: 'entry-b',
          krId: 'kr-b',
          projectCode: 'TANDEM:kr-b',
          hours: 2,
          workType: 'software_dev',
          content: 'B 用户日报',
        },
      ],
    }));
    expect(b.status).toBe(200);

    const reports = await getStore().dailyReports.list();
    expect(reports).toHaveLength(2);
    expect(new Set(reports.map((r) => r.id)).size).toBe(2);
    expect(reports.map((r) => r.authorId).sort()).toEqual(['user-a', 'user-b']);

    const { GET } = await import('@/app/api/integrations/plm/daily-reports/route');
    const getA = await GET(getReq(await token('user-a')));
    const getAJson = await getA.json();
    expect(getAJson.dailyReports).toHaveLength(1);
    expect(getAJson.dailyReports[0].authorId).toBe('user-a');
  });

  it('ignores forged author and tenant fields in the request body', async () => {
    const res = await callPost('user-a', payload({
      authorId: 'user-b',
      userId: 'user-b',
      email: 'user-b@example.com',
      tenantId: 'tenant-b',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    const report = await getStore().dailyReports.get(json.reportId) as DailyReport;
    expect(report.authorId).toBe('user-a');
    expect(report.tenantId).toBe('tenant-a');
  });

  it('returns 403 when Bearer token lacks api.write', async () => {
    const res = await callPost('user-a', payload(), 'openid api.read');
    expect(res.status).toBe(403);
    expect(await getStore().dailyReports.list()).toHaveLength(0);
  });

  it('returns 403 when the user is not the KR owner or co-owner', async () => {
    const res = await callPost('user-a', payload({
      entries: [
        {
          externalEntryId: 'entry-forbidden',
          krId: 'kr-b',
          projectCode: 'TANDEM:kr-b',
          hours: 1,
          workType: 'software_dev',
          content: '越权关联他人 KR',
        },
      ],
    }));
    expect(res.status).toBe(403);
    expect(await getStore().dailyReports.list()).toHaveLength(0);
    expect(await getStore().checkIns.list()).toHaveLength(0);
  });

  it('saves both OKR and non-OKR entries with structured hours without changing KR progress', async () => {
    const before = await getStore().keyResults.get('kr-a');
    const res = await callPost('user-a', payload());
    expect(res.status).toBe(200);
    const json = await res.json();

    const report = await getStore().dailyReports.get(json.reportId);
    expect(report?.entries).toHaveLength(2);
    expect(report?.entries[0]).toMatchObject({ krId: 'kr-a', hours: 6 });
    expect(report?.entries[0].checkInId).toBeTruthy();
    expect(report?.entries[1]).toMatchObject({ krId: null, hours: 1, checkInId: null });

    const checkIns = await getStore().checkIns.list();
    expect(checkIns).toHaveLength(1);
    expect(checkIns[0].achievements).toBe('完成日报同步接口');
    expect((await getStore().keyResults.get('kr-a'))?.currentValue).toBe(before?.currentValue);
  });

  it('keeps repeated same-day submissions idempotent', async () => {
    const first = await callPost('user-a', payload());
    const firstJson = await first.json();
    const firstReport = await getStore().dailyReports.get(firstJson.reportId);
    const firstCheckInId = firstReport?.entries.find((e) => e.krId === 'kr-a')?.checkInId;

    const second = await callPost('user-a', payload({
      entries: [
        {
          externalEntryId: 'entry-okr',
          krId: 'kr-a',
          projectCode: 'TANDEM:kr-a',
          hours: 4,
          workType: 'software_dev',
          content: '修改后的日报成果',
        },
      ],
    }));
    expect(second.status).toBe(200);
    const secondJson = await second.json();
    expect(secondJson).toMatchObject({ reportId: firstJson.reportId, updated: true, entryCount: 1 });

    const reports = await getStore().dailyReports.list();
    const checkIns = await getStore().checkIns.list();
    expect(reports).toHaveLength(1);
    expect(checkIns).toHaveLength(1);
    expect(checkIns[0].id).toBe(firstCheckInId);
    expect(checkIns[0].achievements).toBe('修改后的日报成果');
  });

  it('removes deleted integration check-ins on replace without deleting manual check-ins', async () => {
    const first = await callPost('user-a', payload({
      entries: [
        {
          externalEntryId: 'entry-1',
          krId: 'kr-a',
          projectCode: 'TANDEM:kr-a',
          hours: 2,
          workType: 'software_dev',
          content: '第一条',
        },
        {
          externalEntryId: 'entry-2',
          krId: 'kr-a',
          projectCode: 'TANDEM:kr-a',
          hours: 3,
          workType: 'software_dev',
          content: '第二条',
        },
      ],
    }));
    expect(first.status).toBe(200);
    await getStore().checkIns.create({
      scope: 'kr',
      scopeId: 'kr-a',
      authorId: 'user-a',
      progressBefore: 40,
      progressAfter: 40,
      confidenceBefore: 'on-track',
      confidenceAfter: 'on-track',
      achievements: '手工填写，不应删除',
      tenantId: 'tenant-a',
      createdAt: NOW,
    });

    const second = await callPost('user-a', payload({
      entries: [
        {
          externalEntryId: 'entry-1',
          krId: 'kr-a',
          projectCode: 'TANDEM:kr-a',
          hours: 2,
          workType: 'software_dev',
          content: '第一条更新',
        },
      ],
    }));
    expect(second.status).toBe(200);
    const checkIns = await getStore().checkIns.list();
    expect(checkIns).toHaveLength(2);
    expect(checkIns.map((c) => c.achievements).sort()).toEqual(['手工填写，不应删除', '第一条更新']);
  });

  it('records API logs for success and failure', async () => {
    const success = await callPost('user-a', payload(), undefined);
    expect(success.status).toBe(200);
    const failure = await callPost('user-a', payload({ reportDate: 'not-a-date' }), undefined);
    expect(failure.status).toBe(400);
    await flushDeferredWrites();

    const logs = await queryApiLogs({
      tenantId: 'tenant-a',
      route: '/api/integrations/plm/daily-reports',
      limit: 10,
    });
    expect(logs.entries.map((entry) => entry.statusCode).sort()).toEqual([200, 400]);
    expect(logs.entries.map((entry) => entry.outcome).sort()).toEqual(['failure', 'success']);
  });
});
