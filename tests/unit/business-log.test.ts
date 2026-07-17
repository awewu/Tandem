import { beforeEach, describe, expect, it } from 'vitest';
import { audit } from '@/lib/audit/log';
import { runWithBusinessLogContext } from '@/lib/business-log/context';
import { redactBusinessLogData } from '@/lib/business-log/redact';
import { instrumentBusinessRepositories } from '@/lib/business-log/repository';
import { queryBusinessLogs, resetBusinessLogsForTests } from '@/lib/business-log/service';
import type { TandemStore } from '@/lib/storage/repository';

async function flushDeferredWrites(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('business log', () => {
  beforeEach(() => resetBusinessLogsForTests());

  it('redacts secrets, PII, and free-form content', () => {
    const result = redactBusinessLogData({
      password: 'plain-secret',
      smtpPass: 'mail-secret',
      smtpPassEncrypted: 'encrypted-mail-secret',
      accessToken: 'bearer-secret',
      email: 'alice@example.com',
      phone: '13812345678',
      message: 'confidential business content',
      title: 'Quarterly review',
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('plain-secret');
    expect(serialized).not.toContain('bearer-secret');
    expect(serialized).not.toContain('mail-secret');
    expect(serialized).not.toContain('encrypted-mail-secret');
    expect(serialized).not.toContain('confidential business content');
    expect(serialized).not.toContain('alice@example.com');
    expect(serialized).not.toContain('13812345678');
    expect(result?.title).toBe('Quarterly review');
    expect(result?.password).toBe('[REDACTED]');
  });

  it('records repository mutations as domain operations with request actor context', async () => {
    const values = new Map<string, { id: string; name: string; content?: string }>();
    const widgets = {
      async get(id: string) { return values.get(id) ?? null; },
      async list() { return Array.from(values.values()); },
      async create(data: { id?: string; name: string; content?: string }) {
        const item = { ...data, id: data.id ?? 'widget_1' };
        values.set(item.id, item);
        return item;
      },
      async update(id: string, data: Partial<{ name: string; content: string }>) {
        const item = values.get(id);
        if (!item) throw new Error('not found');
        const updated = { ...item, ...data };
        values.set(id, updated);
        return updated;
      },
      async delete(id: string) { values.delete(id); },
    };
    instrumentBusinessRepositories({ widgets } as unknown as TandemStore);

    await runWithBusinessLogContext({
      requestId: 'req_business_1', tenantId: 'tenant_business_1', actorId: 'user_1', actorType: 'user',
    }, () => widgets.create({ id: 'widget_1', name: 'Widget', content: 'private document body' }));
    await flushDeferredWrites();

    const result = await queryBusinessLogs({ tenantId: 'tenant_business_1' });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      requestId: 'req_business_1',
      actorId: 'user_1',
      source: 'repository',
      category: 'widgets',
      operation: 'widgets.create',
      action: 'create',
      targetType: 'widgets',
      targetId: 'widget_1',
      outcome: 'success',
    });
    expect(JSON.stringify(result.entries[0].details)).not.toContain('private document body');
  });

  it('mirrors immutable audit actions into searchable domain operations', async () => {
    await audit('system.provider_switch', 'system', {
      tenantId: 'tenant_audit_1',
      targetType: 'provider',
      targetId: 'provider_1',
      metadata: { requestId: 'req_audit_1', reason: 'health check' },
    });
    await flushDeferredWrites();

    const result = await queryBusinessLogs({ tenantId: 'tenant_audit_1', operation: 'system.provider_switch' });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      source: 'audit', actorId: 'system', actorType: 'system', targetId: 'provider_1', requestId: 'req_audit_1',
    });
  });
});
