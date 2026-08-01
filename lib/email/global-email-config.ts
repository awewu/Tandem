import { NotFoundError, ValidationError } from '@/lib/domain/errors';
import { decrypt, encrypt } from '@/lib/infra/crypto';
import type { EmailImapTransport, EmailSmtpTransport } from '@/lib/infra/email';
import { getStore, type Repository } from '@/lib/storage/repository';

export type EmailProvider = 'netease' | 'qq' | 'custom';

export interface GlobalEmailConfig {
  id: string;
  name: string;
  provider: EmailProvider;
  domains: string[];
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassEncrypted: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  enabled: boolean;
  isDefault: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicGlobalEmailConfig extends Omit<GlobalEmailConfig, 'smtpPassEncrypted'> {
  hasPassword: boolean;
}

export interface GlobalEmailConfigInput {
  name: string;
  provider: EmailProvider;
  domains: string[];
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass?: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  enabled: boolean;
  isDefault: boolean;
}

export interface ResolvedEmailSmtp {
  mode: 'personal' | 'global';
  smtp: EmailSmtpTransport;
  imap?: EmailImapTransport;
  globalConfig?: PublicGlobalEmailConfig;
}

export interface PersonalEmailCredentials {
  id: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassEncrypted: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  imapUser?: string;
  imapPassEncrypted?: string;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, '');
}

function normalizeInput(input: GlobalEmailConfigInput, passwordRequired: boolean): GlobalEmailConfigInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('email configuration must be an object');
  }
  if (!Array.isArray(input.domains) || input.domains.some((domain) => typeof domain !== 'string')) {
    throw new ValidationError('email domains must be a string array');
  }
  const normalized: GlobalEmailConfigInput = {
    ...input,
    name: String(input.name ?? '').trim(),
    provider: input.provider,
    domains: Array.from(new Set((Array.isArray(input.domains) ? input.domains : []).map(normalizeDomain).filter(Boolean))),
    smtpHost: String(input.smtpHost ?? '').trim(),
    smtpPort: Number(input.smtpPort),
    smtpSecure: input.smtpSecure !== false,
    smtpUser: String(input.smtpUser ?? '').trim(),
    smtpPass: typeof input.smtpPass === 'string' ? input.smtpPass : undefined,
    imapHost: String(input.imapHost ?? '').trim(),
    imapPort: Number(input.imapPort),
    imapSecure: input.imapSecure !== false,
    enabled: input.enabled !== false,
    isDefault: input.isDefault === true,
  };
  if (!normalized.name) throw new ValidationError('configuration name is required');
  if (!['netease', 'qq', 'custom'].includes(normalized.provider)) throw new ValidationError('invalid email provider');
  if (!normalized.smtpHost || !normalized.smtpUser) throw new ValidationError('SMTP host and user are required');
  if (!normalized.imapHost) throw new ValidationError('IMAP host is required');
  if (!Number.isInteger(normalized.smtpPort) || normalized.smtpPort < 1 || normalized.smtpPort > 65535) {
    throw new ValidationError('invalid SMTP port');
  }
  if (!Number.isInteger(normalized.imapPort) || normalized.imapPort < 1 || normalized.imapPort > 65535) {
    throw new ValidationError('invalid IMAP port');
  }
  if (passwordRequired && !normalized.smtpPass) throw new ValidationError('SMTP password is required');
  if (normalized.isDefault && !normalized.enabled) throw new ValidationError('default configuration must be enabled');
  return normalized;
}

function publicConfig(config: GlobalEmailConfig): PublicGlobalEmailConfig {
  const {
    smtpPassEncrypted,
    smtpPass: _legacyPlaintext,
    ...visible
  } = config as GlobalEmailConfig & { smtpPass?: string };
  return { ...visible, hasPassword: smtpPassEncrypted.length > 0 };
}

async function ensureDomainUniqueness(
  repo: Repository<GlobalEmailConfig>,
  tenantId: string,
  domains: string[],
  enabled: boolean,
  excludedId?: string,
): Promise<void> {
  if (!enabled || domains.length === 0) return;
  const conflict = (await listGlobalEmailConfigsFrom(repo, tenantId)).find((config) => (
    config.id !== excludedId && config.enabled && config.domains.some((domain) => domains.includes(domain))
  ));
  if (conflict) throw new ValidationError(`email domain is already assigned to ${conflict.name}`);
}

async function clearOtherDefaults(
  repo: Repository<GlobalEmailConfig>,
  tenantId: string,
  defaultId: string,
): Promise<void> {
  const configs = await listGlobalEmailConfigsFrom(repo, tenantId);
  await Promise.all(configs
    .filter((config) => config.id !== defaultId && config.isDefault)
    .map((config) => repo.update(config.id, { isDefault: false, updatedAt: new Date().toISOString() })));
}

async function ensureEnabledDefault(
  repo: Repository<GlobalEmailConfig>,
  tenantId: string,
): Promise<void> {
  const configs = await listGlobalEmailConfigsFrom(repo, tenantId);
  if (configs.some((config) => config.enabled && config.isDefault)) return;
  const replacement = configs.find((config) => config.enabled);
  if (replacement) {
    await repo.update(replacement.id, {
      isDefault: true,
      updatedAt: new Date().toISOString(),
    });
  }
}

export function selectGlobalEmailConfig(configs: GlobalEmailConfig[], senderEmail: string): GlobalEmailConfig | null {
  const enabled = configs.filter((config) => config.enabled);
  if (enabled.length === 0) return null;
  const domain = normalizeDomain(senderEmail.split('@').at(-1) ?? '');
  return enabled.find((config) => config.domains.includes(domain))
    ?? enabled.find((config) => config.isDefault)
    ?? null;
}

export function selectResolvedEmailSmtp(
  personal: EmailSmtpTransport | null,
  personalImap: EmailImapTransport | null,
  configs: GlobalEmailConfig[],
  senderEmail: string,
): ResolvedEmailSmtp | null {
  if (personal) return { mode: 'personal', smtp: personal, imap: personalImap ?? undefined };
  const selected = selectGlobalEmailConfig(configs, senderEmail);
  if (!selected) return null;
  const pass = decrypt(selected.smtpPassEncrypted);
  return {
    mode: 'global',
    smtp: {
      host: selected.smtpHost,
      port: selected.smtpPort,
      secure: selected.smtpSecure,
      user: selected.smtpUser,
      pass,
    },
    imap: {
      host: selected.imapHost,
      port: selected.imapPort,
      secure: selected.imapSecure,
      user: selected.smtpUser,
      pass,
    },
    globalConfig: publicConfig(selected),
  };
}

export async function listGlobalEmailConfigs(tenantId: string): Promise<GlobalEmailConfig[]> {
  return listGlobalEmailConfigsFrom(getStore().globalEmailConfigs, tenantId);
}

async function listGlobalEmailConfigsFrom(
  repo: Repository<GlobalEmailConfig>,
  tenantId: string,
): Promise<GlobalEmailConfig[]> {
  const configs = await repo.list({ tenantId });
  return configs.sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name));
}

export async function listPublicGlobalEmailConfigs(tenantId: string): Promise<PublicGlobalEmailConfig[]> {
  return (await listGlobalEmailConfigs(tenantId)).map(publicConfig);
}

export async function createGlobalEmailConfig(
  tenantId: string,
  input: GlobalEmailConfigInput,
): Promise<PublicGlobalEmailConfig> {
  return getStore().globalEmailConfigs.withTenantMutation(tenantId, async (repo) => {
    const normalized = normalizeInput(input, true);
    await ensureDomainUniqueness(repo, tenantId, normalized.domains, normalized.enabled);
    const now = new Date().toISOString();
    const { smtpPass, ...persisted } = normalized;
    const config: GlobalEmailConfig = {
      ...persisted,
      id: crypto.randomUUID(),
      smtpPassEncrypted: encrypt(smtpPass!),
      tenantId,
      createdAt: now,
      updatedAt: now,
    };
    const existing = await listGlobalEmailConfigsFrom(repo, tenantId);
    if (config.enabled && !existing.some((item) => item.enabled && item.isDefault)) config.isDefault = true;
    await repo.create(config);
    if (config.isDefault) await clearOtherDefaults(repo, tenantId, config.id);
    return publicConfig(config);
  });
}

export async function updateGlobalEmailConfig(
  id: string,
  tenantId: string,
  input: GlobalEmailConfigInput,
): Promise<PublicGlobalEmailConfig> {
  return getStore().globalEmailConfigs.withTenantMutation(tenantId, async (repo) => {
    const existing = await repo.get(id);
    if (!existing || existing.tenantId !== tenantId) throw new NotFoundError('GlobalEmailConfig', id);
    const normalized = normalizeInput(input, false);
    await ensureDomainUniqueness(repo, tenantId, normalized.domains, normalized.enabled, id);
    const { smtpPass, ...persisted } = normalized;
    const updated = await repo.update(id, {
      ...persisted,
      smtpPassEncrypted: smtpPass ? encrypt(smtpPass) : existing.smtpPassEncrypted,
      updatedAt: new Date().toISOString(),
    });
    if (updated.isDefault) await clearOtherDefaults(repo, tenantId, updated.id);
    else await ensureEnabledDefault(repo, tenantId);
    return publicConfig(updated);
  });
}

export async function deleteGlobalEmailConfig(id: string, tenantId: string): Promise<void> {
  await getStore().globalEmailConfigs.withTenantMutation(tenantId, async (repo) => {
    const existing = await repo.get(id);
    if (!existing || existing.tenantId !== tenantId) throw new NotFoundError('GlobalEmailConfig', id);
    await repo.delete(id);
    if (existing.isDefault) await ensureEnabledDefault(repo, tenantId);
  });
}

export async function resolveUserEmailSmtp(
  userId: string,
  senderEmail: string,
  tenantId: string,
): Promise<ResolvedEmailSmtp | null> {
  let personal: EmailSmtpTransport | null = null;
  let personalImap: EmailImapTransport | null = null;
  try {
    const credentials = await getStore().userEmailCredentials.get(userId);
    if (credentials?.smtpPassEncrypted) {
      const smtpPass = decrypt(credentials.smtpPassEncrypted);
      personal = {
        host: credentials.smtpHost,
        port: credentials.smtpPort,
        secure: credentials.smtpSecure,
        user: credentials.smtpUser,
        pass: smtpPass,
      };
      personalImap = {
        host: credentials.imapHost || inferImapHost(credentials.smtpHost),
        port: credentials.imapPort || 993,
        secure: credentials.imapSecure ?? true,
        user: credentials.imapUser || credentials.smtpUser,
        pass: credentials.imapPassEncrypted ? decrypt(credentials.imapPassEncrypted) : smtpPass,
      };
    }
  } catch {
    personal = null;
    personalImap = null;
  }
  return selectResolvedEmailSmtp(personal, personalImap, await listGlobalEmailConfigs(tenantId), senderEmail);
}

function inferImapHost(smtpHost: string): string {
  const map: Record<string, string> = {
    'smtp.qq.com': 'imap.qq.com',
    'smtp.163.com': 'imap.163.com',
    'smtp.126.com': 'imap.126.com',
    'smtp.gmail.com': 'imap.gmail.com',
    'smtp.exmail.qq.com': 'imap.exmail.qq.com',
    'smtphz.qiye.163.com': 'imaphz.qiye.163.com',
  };
  return map[smtpHost] || smtpHost.replace('smtp', 'imap');
}
