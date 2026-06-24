/**
 * lib/oidc/clients.ts · 接入方应用 (OAuth client) 注册表
 *
 * 存 KvStore (collection=oidc_clients), 多租户隔离, 与 lib/org/departments.ts 同款.
 * client_secret 仅以 sha256 入库, 明文只在创建/重置时一次性返回.
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/infra/drizzle-client';
import { kvStore } from '@/lib/infra/drizzle-schema';
import { generateId } from '@/lib/storage/repository';
import {
  type OAuthClient,
  type OAuthClientType,
  type OAuthGrantType,
  DEFAULT_CLIENT_SCOPES,
  SUPPORTED_SCOPES,
} from './types';

const COLL = 'oidc_clients';

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function verifySecret(secret: string, hash: string): boolean {
  const a = Buffer.from(hashSecret(secret));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

function row2client(r: { data: unknown }): OAuthClient {
  return r.data as OAuthClient;
}

export async function listClients(tenantId: string): Promise<OAuthClient[]> {
  const rows = await db
    .select()
    .from(kvStore)
    .where(and(eq(kvStore.collection, COLL), eq(kvStore.tenantId, tenantId)));
  return rows.map(row2client).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getClient(clientId: string, tenantId?: string): Promise<OAuthClient | null> {
  const cond = tenantId
    ? and(eq(kvStore.collection, COLL), eq(kvStore.id, clientId), eq(kvStore.tenantId, tenantId))
    : and(eq(kvStore.collection, COLL), eq(kvStore.id, clientId));
  const rows = await db.select().from(kvStore).where(cond).limit(1);
  return rows[0] ? row2client(rows[0]) : null;
}

export interface CreateClientInput {
  name: string;
  description?: string;
  type?: OAuthClientType;
  redirectUris: string[];
  postLogoutRedirectUris?: string[];
  allowedScopes?: string[];
  grantTypes?: OAuthGrantType[];
  skipConsent?: boolean;
  tenantId: string;
  createdBy?: string;
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  const allowed = new Set<string>(SUPPORTED_SCOPES as readonly string[]);
  const out = (scopes && scopes.length ? scopes : DEFAULT_CLIENT_SCOPES).filter((s) => allowed.has(s));
  if (!out.includes('openid')) out.unshift('openid');
  return Array.from(new Set(out));
}

function validateRedirectUris(uris: string[]): void {
  if (!uris || uris.length === 0) throw new Error('至少需要一个 redirect_uri');
  for (const u of uris) {
    let parsed: URL;
    try {
      parsed = new URL(u);
    } catch {
      throw new Error(`非法 redirect_uri: ${u}`);
    }
    // 禁止 fragment (OAuth2 §3.1.2)
    if (parsed.hash) throw new Error(`redirect_uri 不可含 fragment: ${u}`);
    // 生产环境强制 https (localhost 例外)
    const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:' && !isLocal) {
      throw new Error(`生产环境 redirect_uri 必须为 https: ${u}`);
    }
  }
}

/** 创建 client. 返回 { client, secret? }, secret 仅 confidential 一次性明文. */
export async function createClient(
  input: CreateClientInput,
): Promise<{ client: OAuthClient; secret: string | null }> {
  validateRedirectUris(input.redirectUris);
  const type: OAuthClientType = input.type ?? 'confidential';
  let secret: string | null = null;
  let secretHash: string | null = null;
  if (type === 'confidential') {
    secret = randomBytes(32).toString('base64url');
    secretHash = hashSecret(secret);
  }
  if (input.postLogoutRedirectUris && input.postLogoutRedirectUris.length) {
    validateRedirectUris(input.postLogoutRedirectUris);
  }
  const now = new Date().toISOString();
  const id = generateId('cli');
  const grantTypes: OAuthGrantType[] = input.grantTypes ?? ['authorization_code', 'refresh_token'];
  const client: OAuthClient = {
    id,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    type,
    secretHash,
    redirectUris: input.redirectUris,
    postLogoutRedirectUris: input.postLogoutRedirectUris ?? [],
    allowedScopes: normalizeScopes(input.allowedScopes),
    grantTypes,
    skipConsent: input.skipConsent ?? true,
    tenantId: input.tenantId,
    disabled: false,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };
  await db
    .insert(kvStore)
    .values({ collection: COLL, id, data: client as object, tenantId: input.tenantId })
    .onConflictDoUpdate({
      target: [kvStore.collection, kvStore.id],
      set: { data: client as object, updatedAt: new Date() },
    });
  return { client, secret };
}

export async function updateClient(
  clientId: string,
  tenantId: string,
  patch: Partial<Omit<OAuthClient, 'id' | 'tenantId' | 'createdAt' | 'secretHash'>>,
): Promise<OAuthClient> {
  const existing = await getClient(clientId, tenantId);
  if (!existing) throw new Error('client not found');
  if (patch.redirectUris) validateRedirectUris(patch.redirectUris);
  if (patch.postLogoutRedirectUris && patch.postLogoutRedirectUris.length) {
    validateRedirectUris(patch.postLogoutRedirectUris);
  }
  const updated: OAuthClient = {
    ...existing,
    ...patch,
    allowedScopes: patch.allowedScopes ? normalizeScopes(patch.allowedScopes) : existing.allowedScopes,
    id: clientId,
    tenantId,
    createdAt: existing.createdAt,
    secretHash: existing.secretHash,
    updatedAt: new Date().toISOString(),
  };
  await db
    .update(kvStore)
    .set({ data: updated as object, updatedAt: new Date() })
    .where(and(eq(kvStore.collection, COLL), eq(kvStore.id, clientId), eq(kvStore.tenantId, tenantId)));
  return updated;
}

/** 重置 secret (仅 confidential). 返回新明文. */
export async function rotateSecret(clientId: string, tenantId: string): Promise<string> {
  const existing = await getClient(clientId, tenantId);
  if (!existing) throw new Error('client not found');
  if (existing.type !== 'confidential') throw new Error('public client 无 secret');
  const secret = randomBytes(32).toString('base64url');
  const updated: OAuthClient = {
    ...existing,
    secretHash: hashSecret(secret),
    updatedAt: new Date().toISOString(),
  };
  await db
    .update(kvStore)
    .set({ data: updated as object, updatedAt: new Date() })
    .where(and(eq(kvStore.collection, COLL), eq(kvStore.id, clientId), eq(kvStore.tenantId, tenantId)));
  return secret;
}

export async function deleteClient(clientId: string, tenantId: string): Promise<void> {
  await db
    .delete(kvStore)
    .where(and(eq(kvStore.collection, COLL), eq(kvStore.id, clientId), eq(kvStore.tenantId, tenantId)));
}

/** redirect_uri 精确匹配校验 (防开放重定向) */
export function isRedirectUriAllowed(client: OAuthClient, redirectUri: string): boolean {
  return client.redirectUris.includes(redirectUri);
}

export function isPostLogoutRedirectAllowed(client: OAuthClient, uri: string): boolean {
  return client.postLogoutRedirectUris.includes(uri);
}

/** 去敏感字段, 供 API 返回 */
export function publicClientView(c: OAuthClient): Omit<OAuthClient, 'secretHash'> & { hasSecret: boolean } {
  const { secretHash, ...rest } = c;
  return { ...rest, hasSecret: !!secretHash };
}
