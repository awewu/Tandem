import { beforeEach, describe, expect, it } from 'vitest';
import {
  createGlobalEmailConfig,
  listPublicGlobalEmailConfigs,
  selectGlobalEmailConfig,
  selectResolvedEmailSmtp,
  updateGlobalEmailConfig,
  type GlobalEmailConfig,
  type GlobalEmailConfigInput,
} from '@/lib/email/global-email-config';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { setStore } from '@/lib/storage/repository';

const now = '2026-07-16T00:00:00.000Z';

function config(overrides: Partial<GlobalEmailConfig>): GlobalEmailConfig {
  return {
    id: 'netease',
    name: '网易企业邮箱',
    provider: 'netease',
    domains: ['rhenext.com', 'rheem.com'],
    smtpHost: 'smtphz.qiye.163.com',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: 'mailer@rhenext.com',
    smtpPassEncrypted: 'encrypted',
    imapHost: 'imaphz.qiye.163.com',
    imapPort: 993,
    imapSecure: true,
    enabled: true,
    isDefault: true,
    tenantId: 'tenant-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function input(overrides: Partial<GlobalEmailConfigInput> = {}): GlobalEmailConfigInput {
  return {
    name: '网易企业邮箱',
    provider: 'netease',
    domains: ['rhenext.com', 'rheem.com'],
    smtpHost: 'smtphz.qiye.163.com',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: 'mailer@rhenext.com',
    smtpPass: 'secret',
    imapHost: 'imaphz.qiye.163.com',
    imapPort: 993,
    imapSecure: true,
    enabled: true,
    isDefault: false,
    ...overrides,
  };
}

describe('global email configuration selection', () => {
  const netease = config({});
  const qq = config({
    id: 'qq',
    name: 'QQ 邮箱',
    provider: 'qq',
    domains: ['qq.com'],
    smtpHost: 'smtp.qq.com',
    smtpUser: 'mailer@qq.com',
    isDefault: false,
  });

  it.each(['owner@rhenext.com', 'owner@rheem.com'])(
    'matches the NetEase configuration for %s',
    (email) => {
      expect(selectGlobalEmailConfig([qq, netease], email)?.id).toBe('netease');
    },
  );

  it('uses the default configuration when no domain matches', () => {
    expect(selectGlobalEmailConfig([qq, netease], 'owner@example.net')?.id).toBe('netease');
  });

  it('returns no global configuration when neither a domain nor default matches', () => {
    expect(selectGlobalEmailConfig([qq], 'owner@example.net')).toBeNull();
  });

  it('ignores disabled configurations', () => {
    expect(selectGlobalEmailConfig([config({ enabled: false })], 'owner@rhenext.com')).toBeNull();
  });

  it('prefers personal SMTP over matching global SMTP', () => {
    const resolved = selectResolvedEmailSmtp(
      { host: 'personal.smtp', port: 465, secure: true, user: 'owner@rhenext.com', pass: 'secret' },
      null,
      [netease],
      'owner@rhenext.com',
    );

    expect(resolved).toMatchObject({ mode: 'personal', smtp: { host: 'personal.smtp' } });
  });
});

describe('global email configuration CRUD', () => {
  beforeEach(() => setStore(createInMemoryStore()));

  it('hands the default role to another enabled configuration', async () => {
    const netease = await createGlobalEmailConfig('tenant-1', input());
    const qq = await createGlobalEmailConfig('tenant-1', input({
      name: 'QQ 邮箱',
      provider: 'qq',
      domains: ['qq.com'],
      smtpHost: 'smtp.qq.com',
      smtpUser: 'mailer@qq.com',
      imapHost: 'imap.qq.com',
    }));

    expect(netease.isDefault).toBe(true);
    expect(qq.isDefault).toBe(false);

    await updateGlobalEmailConfig(netease.id, 'tenant-1', input({
      enabled: false,
      isDefault: false,
      smtpPass: undefined,
    }));

    const configs = await listPublicGlobalEmailConfigs('tenant-1');
    expect(configs.find((item) => item.id === qq.id)?.isDefault).toBe(true);
    expect(configs[0]).not.toHaveProperty('smtpPassEncrypted');
    expect(configs[0]).not.toHaveProperty('smtpPass');
    expect(configs.every((item) => item.hasPassword)).toBe(true);
  });

  it('rejects an enabled domain assigned to another enabled configuration', async () => {
    await createGlobalEmailConfig('tenant-1', input());

    await expect(createGlobalEmailConfig('tenant-1', input({
      name: '重复域名',
      provider: 'custom',
      smtpHost: 'smtp.example.com',
      smtpUser: 'mailer@example.com',
      imapHost: 'imap.example.com',
      domains: ['@RHENEXT.COM'],
    }))).rejects.toThrow('email domain is already assigned');
  });

  it('serializes concurrent writes for the same tenant', async () => {
    const results = await Promise.allSettled([
      createGlobalEmailConfig('tenant-1', input({ name: '配置 A' })),
      createGlobalEmailConfig('tenant-1', input({ name: '配置 B' })),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await listPublicGlobalEmailConfigs('tenant-1')).toHaveLength(1);
  });

  it('rejects malformed input as a validation error', async () => {
    await expect(createGlobalEmailConfig(
      'tenant-1',
      null as unknown as GlobalEmailConfigInput,
    )).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });

    await expect(createGlobalEmailConfig(
      'tenant-1',
      input({ domains: [null as unknown as string] }),
    )).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  });
});
