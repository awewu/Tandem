/**
 * tests/unit/oidc-core.test.ts
 *
 * 锁定 OIDC IdP 核心纯逻辑 (无 DB 依赖):
 *   1. PKCE S256 / plain 校验 (lib/oidc/store.ts verifyPkce)
 *   2. client_secret hash/verify 时序安全比较 (lib/oidc/clients.ts)
 *   3. redirect_uri 精确匹配 (防开放重定向)
 *   4. JWT RS256 签发 / 验签 / 防篡改 (lib/oidc/tokens.ts, 通过 env 私钥)
 *   5. 按 scope 构造 claims + 组织结构映射 (lib/oidc/claims.ts)
 *   6. Discovery 文档结构
 */

import { describe, expect, it, beforeAll, afterEach } from 'vitest';
import { createHash, generateKeyPairSync } from 'crypto';

import { verifyPkce } from '@/lib/oidc/store';
import { hashSecret, verifySecret, isRedirectUriAllowed } from '@/lib/oidc/clients';
import { buildDiscoveryDocument, resolveIssuer } from '@/lib/oidc/discovery';
import { _resetSigningKeyCache } from '@/lib/oidc/keys';
import type { OAuthClient } from '@/lib/oidc/types';

// 注入确定性 RSA 私钥, 让 tokens 测试无需 DB
beforeAll(() => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.OIDC_PRIVATE_KEY = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  _resetSigningKeyCache();
});

describe('PKCE verifyPkce', () => {
  it('S256 verifier 匹配 challenge', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    expect(verifyPkce(verifier, challenge, 'S256')).toBe(true);
    expect(verifyPkce('wrong-verifier', challenge, 'S256')).toBe(false);
  });

  it('plain method 直接比较', () => {
    expect(verifyPkce('abc', 'abc', 'plain')).toBe(true);
    expect(verifyPkce('abc', 'abd', 'plain')).toBe(false);
  });
});

describe('client secret hash/verify', () => {
  it('正确 secret 通过, 错误 secret 失败', () => {
    const secret = 'super-secret-value';
    const h = hashSecret(secret);
    expect(verifySecret(secret, h)).toBe(true);
    expect(verifySecret('nope', h)).toBe(false);
  });
});

describe('redirect_uri 精确匹配', () => {
  const client = {
    redirectUris: ['https://app.example.com/callback', 'http://localhost:3001/cb'],
  } as OAuthClient;
  it('白名单内放行', () => {
    expect(isRedirectUriAllowed(client, 'https://app.example.com/callback')).toBe(true);
  });
  it('未登记 / 多余参数 / 子路径 拒绝', () => {
    expect(isRedirectUriAllowed(client, 'https://app.example.com/callback?x=1')).toBe(false);
    expect(isRedirectUriAllowed(client, 'https://evil.example.com/callback')).toBe(false);
    expect(isRedirectUriAllowed(client, 'https://app.example.com/callback/sub')).toBe(false);
  });
});

describe('JWT RS256 (id_token / access_token)', () => {
  it('签发的 access token 可验签且 token_use=access', async () => {
    const { signAccessToken, verifyAccessToken } = await import('@/lib/oidc/tokens');
    const tok = await signAccessToken({
      issuer: 'https://idp.test',
      clientId: 'cli_1',
      userId: 'user_1',
      scope: 'openid profile org',
      tenantId: 'default',
    });
    const payload = await verifyAccessToken(tok);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('user_1');
    expect(payload?.client_id).toBe('cli_1');
    expect(payload?.token_use).toBe('access');
    expect(payload?.iss).toBe('https://idp.test');
  });

  it('id_token 含标准 claims + nonce', async () => {
    const { signIdToken, verifyRs256 } = await import('@/lib/oidc/tokens');
    const tok = await signIdToken({
      issuer: 'https://idp.test',
      clientId: 'cli_1',
      claims: { sub: 'user_1', name: '何恒', roles: ['owner'] },
      nonce: 'n-123',
      authTime: 1700000000,
    });
    const payload = await verifyRs256(tok);
    expect(payload?.sub).toBe('user_1');
    expect(payload?.aud).toBe('cli_1');
    expect(payload?.nonce).toBe('n-123');
    expect((payload as Record<string, unknown>).name).toBe('何恒');
  });

  it('篡改 payload 验签失败', async () => {
    const { signAccessToken, verifyRs256 } = await import('@/lib/oidc/tokens');
    const tok = await signAccessToken({
      issuer: 'https://idp.test', clientId: 'c', userId: 'u', scope: 'openid', tenantId: 'default',
    });
    const [h, , s] = tok.split('.');
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: 'attacker', exp: 9999999999 })).toString('base64url')}.${s}`;
    expect(await verifyRs256(forged)).toBeNull();
  });
});

describe('claims 按 scope 构造 + 组织结构映射', () => {
  it('scope 决定 claims 集; org 映射部门路径', async () => {
    const { buildClaimsForUser } = await import('@/lib/oidc/claims');
    const user = {
      id: 'u1', email: 'lihe@rrr.com', name: '李恒', roles: ['manager'],
      tenantId: 'default', emailVerifiedAt: '2026-01-01', departmentId: 'd2',
      jobTitle: '销售经理', employeeId: 'E1001',
    } as never;
    const depts = [
      { id: 'd1', name: '销售大区', parentId: null },
      { id: 'd2', name: '华东区', parentId: 'd1' },
    ] as never;

    const onlyOpenid = await buildClaimsForUser(user, ['openid'], depts);
    expect(onlyOpenid).toEqual({ sub: 'u1' });

    const full = await buildClaimsForUser(user, ['openid', 'profile', 'email', 'roles', 'org'], depts);
    expect(full.sub).toBe('u1');
    expect(full.name).toBe('李恒');
    expect(full.email).toBe('lihe@rrr.com');
    expect(full.email_verified).toBe(true);
    expect(full.roles).toEqual(['manager']);
    expect(full.tenant).toBe('default');
    expect(full.department).toBe('华东区');
    expect(full.department_path).toBe('销售大区 / 华东区');
    expect(full.employee_id).toBe('E1001');
  });
});

describe('resolveIssuer 对外基址 (反代场景, 防 0.0.0.0:3000 跳转 bug)', () => {
  const savedIssuer = process.env.OIDC_ISSUER;
  const savedAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  afterEach(() => {
    if (savedIssuer === undefined) delete process.env.OIDC_ISSUER;
    else process.env.OIDC_ISSUER = savedIssuer;
    if (savedAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = savedAppUrl;
  });

  it('无 env 时按 X-Forwarded-Proto/Host 推导 (而非内部 host)', () => {
    delete process.env.OIDC_ISSUER;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const h = new Headers({
      host: '0.0.0.0:3000',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'ai.rhautt.com',
    });
    expect(resolveIssuer(h)).toBe('https://ai.rhautt.com');
  });

  it('OIDC_ISSUER 优先于请求头, 且去除末尾斜杠', () => {
    process.env.OIDC_ISSUER = 'https://ai.rhautt.com/';
    const h = new Headers({ host: '0.0.0.0:3000', 'x-forwarded-host': 'evil.example.com' });
    expect(resolveIssuer(h)).toBe('https://ai.rhautt.com');
  });

  it('无 forwarded 头时回退 host (本地直连)', () => {
    delete process.env.OIDC_ISSUER;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const h = new Headers({ host: 'localhost:3000' });
    expect(resolveIssuer(h)).toBe('http://localhost:3000');
  });
});

describe('Discovery 文档', () => {
  it('包含必备端点与 RS256', () => {
    const doc = buildDiscoveryDocument('https://idp.test') as Record<string, unknown>;
    expect(doc.issuer).toBe('https://idp.test');
    expect(doc.authorization_endpoint).toBe('https://idp.test/api/oidc/authorize');
    expect(doc.token_endpoint).toBe('https://idp.test/api/oidc/token');
    expect(doc.userinfo_endpoint).toBe('https://idp.test/api/oidc/userinfo');
    expect(doc.jwks_uri).toBe('https://idp.test/.well-known/jwks.json');
    expect(doc.id_token_signing_alg_values_supported).toContain('RS256');
    expect(doc.code_challenge_methods_supported).toContain('S256');
  });
});
