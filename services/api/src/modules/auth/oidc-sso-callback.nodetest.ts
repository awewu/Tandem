import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync } from 'crypto';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtService } from '@nestjs/jwt';
import * as jwt from 'jsonwebtoken';
import { InMemoryRepository, makeFakeDataSource } from '../common/testing/fake-datasource';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import { AuthController } from './auth.controller';
import { UserEntity } from './auth.entity';
import { AuthService } from './auth.service';
import { ExternalIdentityBindingEntity } from './external-identity-binding.entity';
import { OidcSsoCallbackService } from './oidc-sso-callback.service';
import {
  OidcSsoLoginService,
  SSO_REDIRECT_COOKIE,
  SSO_STATE_COOKIE,
} from './oidc-sso-login.service';
import { OtpChallengeEntity } from './otp-challenge.entity';
import { SsoAuditLogService, SsoFailureReason } from './sso-audit-log.service';
import { SsoExternalIdentityService } from './sso-external-identity.service';

const ISSUER = 'https://ai.rhautt.com';
const CLIENT_ID = 'client-local';
const REDIRECT_URI = 'http://localhost:5000/api/v2/auth/sso/callback';
const JWT_SECRET = 'local-test-jwt-secret';
const CLIENT_SECRET_PLACEHOLDER = 'replace-with-runtime-secret';
const STATE = 'state-123';
const CODE = 'code-abc';
const TOKEN_ENDPOINT = `${ISSUER}/oauth2/token`;
const USERINFO_ENDPOINT = `${ISSUER}/oauth2/userinfo`;
const JWKS_URI = `${ISSUER}/oauth2/jwks`;

const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = keyPair.publicKey.export({ format: 'jwk' }) as JsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
};
publicJwk.kid = 'kid-1';
publicJwk.alg = 'RS256';
publicJwk.use = 'sig';

function config(overrides: Record<string, string | undefined> = {}) {
  const values = {
    OIDC_ISSUER: ISSUER,
    OIDC_CLIENT_ID: CLIENT_ID,
    OIDC_CLIENT_SECRET: CLIENT_SECRET_PLACEHOLDER,
    OIDC_REDIRECT_URI: REDIRECT_URI,
    OIDC_SCOPES: 'openid profile email roles org',
    OIDC_POST_LOGIN_REDIRECT: '/brand',
    OIDC_USERINFO_ENABLED: 'true',
    ...overrides,
  };
  return { get: (key: string) => values[key] } as any;
}

function signIdToken(claims: Record<string, unknown> = {}, options: jwt.SignOptions = {}) {
  return jwt.sign(
    {
      sub: 'employee-001',
      name: 'Employee One',
      ...claims,
    },
    keyPair.privateKey,
    {
      algorithm: 'RS256',
      keyid: 'kid-1',
      issuer: ISSUER,
      audience: CLIENT_ID,
      expiresIn: '5m',
      ...options,
    }
  );
}

function user(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-001',
    tenantId: 'tenant-a',
    dealerId: 'dealer-a',
    storeId: 'store-a',
    customerId: null,
    phoneHash: 'hash',
    phoneEncrypted: 'encrypted',
    passwordHash: 'hash',
    name: 'Local Sales',
    role: 'sales',
    permissions: ['crm:read'],
    status: 'active',
    loginAttempts: 0,
    lockUntil: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    get isLocked() {
      return false;
    },
    ...overrides,
  } as UserEntity;
}

function binding(overrides: Partial<ExternalIdentityBindingEntity> = {}): ExternalIdentityBindingEntity {
  return {
    id: 'binding-001',
    provider: 'rhautt-ai-oidc',
    issuer: ISSUER,
    subject: 'employee-001',
    tenantId: 'tenant-a',
    localUserId: 'user-001',
    status: 'active',
    firstLoginAt: new Date('2026-01-01T00:00:00.000Z'),
    lastLoginAt: null,
    lastSeenProfile: {},
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as ExternalIdentityBindingEntity;
}

function cookieHeader(state = STATE, redirect = '/brand') {
  return `${SSO_STATE_COOKIE}=${encodeURIComponent(state)}; ${SSO_REDIRECT_COOKIE}=${encodeURIComponent(redirect)}`;
}

function withFetch(
  handler: (input: string, init?: RequestInit) => Promise<Partial<Response> & { json?: () => Promise<unknown> }>
) {
  const original = globalThis.fetch;
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ input: url, init });
    return handler(url, init) as Promise<Response>;
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function fixture(options: {
  users?: UserEntity[];
  bindings?: ExternalIdentityBindingEntity[];
  tokenStatus?: number;
  idToken?: string;
  userinfo?: Record<string, unknown>;
  jwks?: JsonWebKey[];
  config?: Record<string, string | undefined>;
  auditEvents?: any[];
} = {}) {
  const users = new InMemoryRepository<UserEntity>().seed(...(options.users ?? [user()]));
  const bindings = new InMemoryRepository<ExternalIdentityBindingEntity>().seed(
    ...(options.bindings ?? [binding()])
  );
  const otpChallenges = new InMemoryRepository<OtpChallengeEntity>();
  const { ds } = makeFakeDataSource([
    [UserEntity, users],
    [ExternalIdentityBindingEntity, bindings],
    [OtpChallengeEntity, otpChallenges],
  ]);
  const jwtService = new JwtService({ secret: JWT_SECRET });
  const rbac = {
    resolveUserAccess: async (u: UserEntity) => ({
      role: u.role,
      roles: [u.role],
      permissions: u.permissions ?? [],
    }),
  };
  const auth = new AuthService(
    ds as any,
    users as any,
    jwtService,
    { activeModuleIds: async () => new Set(['crm']) } as any,
    {} as any,
    rbac as any
  );
  let issuedSessions = 0;
  const issueLoginForResolvedUser = auth.issueLoginForResolvedUser.bind(auth);
  auth.issueLoginForResolvedUser = async (...args: Parameters<AuthService['issueLoginForResolvedUser']>) => {
    issuedSessions += 1;
    return issueLoginForResolvedUser(...args);
  };
  const login = new OidcSsoLoginService(config(options.config));
  const identities = new SsoExternalIdentityService(ds as any, users as any, bindings as any);
  const auditEvents = options.auditEvents ?? [];
  const audit = new SsoAuditLogService({ write: (event) => auditEvents.push(event) });
  const service = new OidcSsoCallbackService(config(options.config), login, identities, auth, audit);

  const fetchMock = withFetch(async (url, init) => {
    if (url.endsWith('/.well-known/openid-configuration')) {
      return {
        ok: true,
        json: async () => ({
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/oauth2/authorize`,
          token_endpoint: TOKEN_ENDPOINT,
          userinfo_endpoint: USERINFO_ENDPOINT,
          jwks_uri: JWKS_URI,
        }),
      };
    }
    if (url === TOKEN_ENDPOINT) {
      return {
        ok: (options.tokenStatus ?? 200) < 400,
        status: options.tokenStatus ?? 200,
        json: async () => ({
          id_token: options.idToken ?? signIdToken(),
          access_token: 'access-token-a',
        }),
      };
    }
    if (url === JWKS_URI) {
      return {
        ok: true,
        json: async () => ({ keys: options.jwks ?? [publicJwk] }),
      };
    }
    if (url === USERINFO_ENDPOINT) {
      return {
        ok: true,
        json: async () =>
          options.userinfo ?? {
            sub: 'employee-001',
            email: 'employee@rhautt.com',
            roles: ['platform_admin'],
            org: { tenantId: 'tenant-other' },
          },
      };
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  return {
    service,
    auth,
    jwtService,
    users,
    bindings,
    fetchMock,
    auditEvents,
    get issuedSessions() {
      return issuedSessions;
    },
  };
}

async function expectCallbackFailure(
  options: Parameters<typeof fixture>[0],
  expectedReason: SsoFailureReason,
  callbackInput: Parameters<OidcSsoCallbackService['handleCallback']>[0] = {
    code: CODE,
    state: STATE,
    cookieHeader: cookieHeader(),
    requestId: 'req-issue-05',
    traceId: 'trace-issue-05',
  },
) {
  const f = fixture(options);
  try {
    await assert.rejects(() => f.service.handleCallback(callbackInput));
    assert.equal(f.issuedSessions, 0);
    const event = f.auditEvents.at(-1);
    assert.equal(event?.eventType, 'sso.callback.failed');
    assert.equal(event?.outcome, 'failure');
    assert.equal(event?.failureReason, expectedReason);
    assert.equal(event?.requestId, callbackInput.requestId);
    assert.equal(event?.traceId, callbackInput.traceId);

    const logged = JSON.stringify(event);
    assert.equal(logged.includes(CLIENT_SECRET_PLACEHOLDER), false);
    assert.equal(logged.includes(CODE), false);
    assert.equal(logged.includes('access-token-a'), false);
    if (options?.idToken) assert.equal(logged.includes(options.idToken), false);
    return { f, event };
  } finally {
    f.fetchMock.restore();
  }
}

test('OIDC callback exchanges code, validates id_token, binds user, and issues Nexus session', async () => {
  const f = fixture();
  try {
    const result = await f.service.handleCallback({
      code: CODE,
      state: STATE,
      cookieHeader: cookieHeader(STATE, '/hub?from=sso'),
    });

    assert.equal(result.location, '/hub?from=sso');
    assert.ok(result.cookies.some((entry) => entry.startsWith('nx_sso_state=;')));
    assert.ok(result.cookies.some((entry) => entry.startsWith('nx_sso_redirect=;')));
    const tokenCookie = result.cookies.find((entry) => entry.startsWith('nx_token='));
    assert.ok(tokenCookie);
    assert.match(tokenCookie, /HttpOnly/);
    assert.doesNotMatch(result.cookies.join('\n'), /access-token-a|client_secret|id_token/);

    const token = decodeURIComponent(tokenCookie.split(';')[0].split('=')[1]);
    const payload = f.jwtService.verify(token);
    assert.equal(payload.userId, 'user-001');
    assert.equal(payload.tenantId, 'tenant-a');
    assert.equal(payload.role, 'sales');
    assert.deepEqual(payload.permissions, ['crm:read']);
    assert.deepEqual(payload.modules, ['crm']);
    const me = await f.auth.getMe(payload);
    assert.equal(me.id, 'user-001');
    assert.equal(me.name, 'Local Sales');
    assert.equal(me.role, 'sales');
    assert.deepEqual(me.permissions, ['crm:read']);

    const tokenCall = f.fetchMock.calls.find((call) => call.input === TOKEN_ENDPOINT);
    assert.ok(tokenCall);
    const body = tokenCall.init?.body as URLSearchParams;
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.get('code'), CODE);
    assert.equal(body.get('client_id'), CLIENT_ID);
    assert.equal(body.get('client_secret'), CLIENT_SECRET_PLACEHOLDER);
    assert.equal(body.get('redirect_uri'), REDIRECT_URI);

    assert.deepEqual(f.bindings.rows[0].lastSeenProfile, {
      sub: 'employee-001',
      name: 'Employee One',
      email: 'employee@rhautt.com',
      roles: ['platform_admin'],
      org: { tenantId: 'tenant-other' },
    });
  } finally {
    f.fetchMock.restore();
  }
});

test('OIDC callback rejects missing code or state before token exchange', async () => {
  const f = fixture();
  try {
    await assert.rejects(
      () => f.service.handleCallback({ code: CODE, cookieHeader: cookieHeader() }),
      /missing (code or state|state)/
    );
    await assert.rejects(
      () => f.service.handleCallback({ state: STATE, cookieHeader: cookieHeader() }),
      /missing (code or state|code)/
    );
    assert.equal(f.fetchMock.calls.length, 0);
  } finally {
    f.fetchMock.restore();
  }
});

test('OIDC callback rejects mismatched state before token exchange', async () => {
  const f = fixture();
  try {
    await assert.rejects(
      () => f.service.handleCallback({ code: CODE, state: 'other-state', cookieHeader: cookieHeader() }),
      /state mismatch/
    );
    assert.equal(f.fetchMock.calls.length, 0);
  } finally {
    f.fetchMock.restore();
  }
});

test('OIDC callback rejects token endpoint failure', async () => {
  const f = fixture({ tokenStatus: 503 });
  try {
    await assert.rejects(
      () => f.service.handleCallback({ code: CODE, state: STATE, cookieHeader: cookieHeader() }),
      /token exchange failed/
    );
  } finally {
    f.fetchMock.restore();
  }
});

test('OIDC callback rejects invalid issuer, audience, expiry, and signature', async () => {
  const cases = [
    { name: 'issuer', idToken: signIdToken({}, { issuer: 'https://evil.example' }) },
    { name: 'audience', idToken: signIdToken({}, { audience: 'other-client' }) },
    { name: 'expired', idToken: signIdToken({}, { expiresIn: -120 }) },
    {
      name: 'signature',
      idToken: (() => {
        const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
        return jwt.sign({ sub: 'employee-001' }, other.privateKey, {
          algorithm: 'RS256',
          keyid: 'kid-1',
          issuer: ISSUER,
          audience: CLIENT_ID,
          expiresIn: '5m',
        });
      })(),
    },
  ];

  for (const item of cases) {
    const f = fixture({ idToken: item.idToken });
    try {
      await assert.rejects(
        () => f.service.handleCallback({ code: CODE, state: STATE, cookieHeader: cookieHeader() }),
        /id_token validation failed/,
        item.name
      );
    } finally {
      f.fetchMock.restore();
    }
  }
});

test('Issue 05 callback failures emit reason codes, redact secrets, and never issue sessions', async () => {
  await expectCallbackFailure(
    {},
    'missing_code',
    { state: STATE, cookieHeader: cookieHeader(), requestId: 'req-issue-05', traceId: 'trace-issue-05' },
  );
  await expectCallbackFailure(
    {},
    'missing_state',
    { code: CODE, cookieHeader: cookieHeader(), requestId: 'req-issue-05', traceId: 'trace-issue-05' },
  );
  await expectCallbackFailure(
    {},
    'state_mismatch',
    { code: CODE, state: 'wrong-state', cookieHeader: cookieHeader(), requestId: 'req-issue-05', traceId: 'trace-issue-05' },
  );
  await expectCallbackFailure({ tokenStatus: 503 }, 'token_endpoint_error');
  await expectCallbackFailure(
    { idToken: signIdToken({}, { issuer: 'https://evil.example' }) },
    'invalid_issuer',
  );
  await expectCallbackFailure(
    { idToken: signIdToken({}, { audience: 'other-client' }) },
    'invalid_audience',
  );
  await expectCallbackFailure({ idToken: signIdToken({}, { expiresIn: -120 }) }, 'expired_token');
  await expectCallbackFailure(
    {
      idToken: (() => {
        const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
        return jwt.sign({ sub: 'employee-001' }, other.privateKey, {
          algorithm: 'RS256',
          keyid: 'kid-1',
          issuer: ISSUER,
          audience: CLIENT_ID,
          expiresIn: '5m',
        });
      })(),
    },
    'bad_signature',
  );
  await expectCallbackFailure(
    {
      idToken: signIdToken({ sub: undefined }),
      config: { OIDC_USERINFO_ENABLED: 'false' },
    },
    'missing_subject',
  );
  await expectCallbackFailure({ users: [user({ status: 'inactive' })] }, 'local_user_inactive');
  await expectCallbackFailure({ bindings: [binding({ status: 'disabled' })] }, 'binding_inactive');
  await expectCallbackFailure({ bindings: [] }, 'pending_authorization');
});

test('Issue 05 unsafe callback redirect is normalized to /brand without trusting external URL', async () => {
  const f = fixture();
  try {
    const result = await f.service.handleCallback({
      code: CODE,
      state: STATE,
      cookieHeader: cookieHeader(STATE, 'https://example.com/steal'),
      requestId: 'req-safe-redirect',
    });

    assert.equal(result.location, '/brand');
    assert.equal(f.issuedSessions, 1);
    assert.equal(f.auditEvents.at(-1)?.eventType, 'sso.callback.succeeded');
    assert.equal(f.auditEvents.at(-1)?.subjectHash.startsWith('sha256:'), true);
    assert.equal(JSON.stringify(f.auditEvents.at(-1)).includes('employee-001'), false);
  } finally {
    f.fetchMock.restore();
  }
});

test('OIDC callback applies pending first-login policy without creating a Nexus session', async () => {
  const f = fixture({ bindings: [] });
  try {
    await assert.rejects(
      () => f.service.handleCallback({ code: CODE, state: STATE, cookieHeader: cookieHeader() }),
      /pending authorization/
    );
    assert.equal(f.bindings.rows.length, 1);
    assert.equal(f.bindings.rows[0].status, 'pending_authorization');
    assert.equal(f.bindings.rows[0].localUserId, null);
  } finally {
    f.fetchMock.restore();
  }
});

test('AuthController exposes public GET SSO callback and redirects terminal failures to diagnostic brand fallback', async () => {
  const callback = {
    async handleCallback() {
      throw Object.assign(new Error('bad state'), { status: 401 });
    },
    clearTransientCookies() {
      return ['nx_sso_state=; Path=/api/v2/auth/sso; Max-Age=0; HttpOnly; SameSite=Lax'];
    },
    failureReason() {
      return 'state_mismatch';
    },
  };
  const controller = new AuthController({} as any, {} as any, callback as any);
  const headers: Record<string, unknown> = {};
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    header(name: string, value: unknown) {
      headers[name] = value;
      return this;
    },
    send(body?: unknown) {
      this.body = body;
      return { statusCode: this.statusCode, headers, body };
    },
  };

  const result = await controller.ssoCallback(CODE, 'bad', { headers: { cookie: '' } }, response);
  const handler = AuthController.prototype.ssoCallback;

  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, handler), true);
  assert.equal(Reflect.getMetadata(PATH_METADATA, handler), 'sso/callback');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, handler), RequestMethod.GET);
  assert.equal(result.statusCode, 302);
  assert.deepEqual(headers['Set-Cookie'], [
    'nx_sso_state=; Path=/api/v2/auth/sso; Max-Age=0; HttpOnly; SameSite=Lax',
  ]);
  assert.equal(headers.Location, '/?returnUrl=%2Fbrand&ssoError=sso_callback_failed');
  assert.equal(result.body, undefined);
});

test('AuthController maps pending authorization to a support-diagnostic unauthorized landing', async () => {
  const callback = {
    async handleCallback() {
      throw Object.assign(new Error('pending'), { status: 403 });
    },
    clearTransientCookies() {
      return ['nx_sso_state=; Path=/api/v2/auth/sso; Max-Age=0; HttpOnly; SameSite=Lax'];
    },
    failureReason() {
      return 'pending_authorization';
    },
  };
  const controller = new AuthController({} as any, {} as any, callback as any);
  const headers: Record<string, unknown> = {};
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    header(name: string, value: unknown) {
      headers[name] = value;
      return this;
    },
    send(body?: unknown) {
      this.body = body;
      return { statusCode: this.statusCode, headers, body };
    },
  };

  const result = await controller.ssoCallback(CODE, STATE, { headers: { cookie: '' } }, response);

  assert.equal(result.statusCode, 302);
  assert.equal(headers.Location, '/?returnUrl=%2Fbrand&ssoError=unauthorized');
});
