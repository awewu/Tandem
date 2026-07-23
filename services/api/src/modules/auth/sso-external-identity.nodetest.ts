import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRepository, makeFakeDataSource } from '../common/testing/fake-datasource';
import { UserEntity } from './auth.entity';
import { ExternalIdentityBindingEntity } from './external-identity-binding.entity';
import { SsoExternalIdentityService } from './sso-external-identity.service';

const IDENTITY = {
  provider: 'rhautt-ai-oidc',
  issuer: 'https://ai.rhautt.com/',
  subject: 'employee-001',
};

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
    name: 'Local User',
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
    provider: IDENTITY.provider,
    issuer: 'https://ai.rhautt.com',
    subject: IDENTITY.subject,
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

function fixture(
  options: {
    users?: UserEntity[];
    bindings?: ExternalIdentityBindingEntity[];
  } = {},
) {
  const users = new InMemoryRepository<UserEntity>().seed(...(options.users ?? [user()]));
  const bindings = new InMemoryRepository<ExternalIdentityBindingEntity>().seed(
    ...(options.bindings ?? [binding()]),
  );
  const { ds } = makeFakeDataSource([
    [UserEntity, users],
    [ExternalIdentityBindingEntity, bindings],
  ]);
  const service = new SsoExternalIdentityService(ds as any, users as any, bindings as any);
  return { service, users, bindings };
}

test('active provider issuer subject binding resolves the local Nexus user', async () => {
  const f = fixture();

  const resolved = await f.service.resolveVerifiedIdentity({
    ...IDENTITY,
    profile: { email: 'employee@rhautt.com', roles: ['platform_admin'], org: 'hq' },
  });

  assert.equal(resolved.status, 'authenticated');
  assert.equal(resolved.user.id, 'user-001');
  assert.equal(resolved.user.tenantId, 'tenant-a');
  assert.equal(resolved.user.role, 'sales');
  assert.deepEqual(resolved.user.permissions, ['crm:read']);
  assert.deepEqual(resolved.binding.lastSeenProfile, {
    email: 'employee@rhautt.com',
    roles: ['platform_admin'],
    org: 'hq',
  });
  assert.ok(resolved.binding.lastLoginAt instanceof Date);
});

test('missing binding creates a pending authorization record without local user access', async () => {
  const f = fixture({ bindings: [] });

  const resolved = await f.service.resolveVerifiedIdentity({
    provider: 'RHAUTT-AI-OIDC',
    issuer: 'https://ai.rhautt.com/',
    subject: 'employee-new',
    profile: { email: 'new@rhautt.com', roles: ['hq_admin'] },
  });

  assert.equal(resolved.status, 'pending_authorization');
  assert.equal(resolved.user, null);
  assert.equal(resolved.binding.provider, 'rhautt-ai-oidc');
  assert.equal(resolved.binding.issuer, 'https://ai.rhautt.com');
  assert.equal(resolved.binding.subject, 'employee-new');
  assert.equal(resolved.binding.localUserId, null);
  assert.equal(resolved.binding.tenantId, null);
  assert.equal(resolved.binding.status, 'pending_authorization');
  assert.deepEqual(resolved.binding.lastSeenProfile, {
    email: 'new@rhautt.com',
    roles: ['hq_admin'],
  });
});

test('local dev auto-provision creates an active platform admin binding when explicitly enabled', async () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    OIDC_DEV_AUTO_PROVISION_PLATFORM_ADMIN: process.env.OIDC_DEV_AUTO_PROVISION_PLATFORM_ADMIN,
    OIDC_DEV_AUTO_PROVISION_TENANT_CODE: process.env.OIDC_DEV_AUTO_PROVISION_TENANT_CODE,
  };
  process.env.NODE_ENV = 'development';
  process.env.OIDC_DEV_AUTO_PROVISION_PLATFORM_ADMIN = 'true';
  process.env.OIDC_DEV_AUTO_PROVISION_TENANT_CODE = 'DEFAULT';

  try {
    const f = fixture({ users: [], bindings: [] });
    (f.service as any).ds.query = async () => [{ id: 'tenant-default' }];

    const resolved = await f.service.resolveVerifiedIdentity({
      provider: 'RHAUTT-AI-OIDC',
      issuer: 'https://ai.rhautt.com/',
      subject: 'employee-new',
      profile: { email: 'new@rhautt.com', name: 'New Employee', roles: ['sales'] },
    });

    assert.equal(resolved.status, 'authenticated');
    assert.equal(resolved.user.role, 'platform_admin');
    assert.equal(resolved.user.tenantId, 'tenant-default');
    assert.equal(resolved.binding.status, 'active');
    assert.equal(resolved.binding.localUserId, resolved.user.id);
    assert.equal(f.users.rows.length, 1);
    assert.equal(f.bindings.rows.length, 1);
  } finally {
    if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.NODE_ENV;
    if (previous.OIDC_DEV_AUTO_PROVISION_PLATFORM_ADMIN === undefined) {
      delete process.env.OIDC_DEV_AUTO_PROVISION_PLATFORM_ADMIN;
    } else {
      process.env.OIDC_DEV_AUTO_PROVISION_PLATFORM_ADMIN =
        previous.OIDC_DEV_AUTO_PROVISION_PLATFORM_ADMIN;
    }
    if (previous.OIDC_DEV_AUTO_PROVISION_TENANT_CODE === undefined) {
      delete process.env.OIDC_DEV_AUTO_PROVISION_TENANT_CODE;
    } else {
      process.env.OIDC_DEV_AUTO_PROVISION_TENANT_CODE = previous.OIDC_DEV_AUTO_PROVISION_TENANT_CODE;
    }
  }
});

test('production auto-provision creates an active user only for allowed email domains', async () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    OIDC_AUTO_PROVISION_ENABLED: process.env.OIDC_AUTO_PROVISION_ENABLED,
    OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS: process.env.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS,
    OIDC_AUTO_PROVISION_TENANT_CODE: process.env.OIDC_AUTO_PROVISION_TENANT_CODE,
    OIDC_AUTO_PROVISION_ROLE_MAP: process.env.OIDC_AUTO_PROVISION_ROLE_MAP,
    PII_ENCRYPTION_KEY: process.env.PII_ENCRYPTION_KEY,
  };
  process.env.NODE_ENV = 'production';
  process.env.OIDC_AUTO_PROVISION_ENABLED = 'true';
  process.env.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS = 'rhenext.com';
  process.env.OIDC_AUTO_PROVISION_TENANT_CODE = 'DEFAULT';
  process.env.OIDC_AUTO_PROVISION_ROLE_MAP = 'owner:platform_admin,admin:platform_admin,employee:hq_admin';
  process.env.PII_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  try {
    const f = fixture({ users: [], bindings: [] });
    (f.service as any).ds.query = async () => [{ id: 'tenant-default' }];

    const resolved = await f.service.resolveVerifiedIdentity({
      provider: 'RHAUTT-AI-OIDC',
      issuer: 'https://ai.rhautt.com/',
      subject: 'owner-new',
      profile: { email: 'owner@rhenext.com', name: 'Owner', roles: ['owner', 'admin'] },
    });

    assert.equal(resolved.status, 'authenticated');
    assert.equal(resolved.user.role, 'platform_admin');
    assert.equal(resolved.user.tenantId, 'tenant-default');
    assert.equal(resolved.binding.status, 'active');
    assert.equal(resolved.binding.localUserId, resolved.user.id);
    assert.equal(f.users.rows.length, 1);
    assert.equal(f.bindings.rows.length, 1);
  } finally {
    if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.NODE_ENV;
    if (previous.OIDC_AUTO_PROVISION_ENABLED === undefined) delete process.env.OIDC_AUTO_PROVISION_ENABLED;
    else process.env.OIDC_AUTO_PROVISION_ENABLED = previous.OIDC_AUTO_PROVISION_ENABLED;
    if (previous.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS === undefined) {
      delete process.env.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS;
    } else {
      process.env.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS =
        previous.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS;
    }
    if (previous.OIDC_AUTO_PROVISION_TENANT_CODE === undefined) {
      delete process.env.OIDC_AUTO_PROVISION_TENANT_CODE;
    } else {
      process.env.OIDC_AUTO_PROVISION_TENANT_CODE = previous.OIDC_AUTO_PROVISION_TENANT_CODE;
    }
    if (previous.OIDC_AUTO_PROVISION_ROLE_MAP === undefined) {
      delete process.env.OIDC_AUTO_PROVISION_ROLE_MAP;
    } else {
      process.env.OIDC_AUTO_PROVISION_ROLE_MAP = previous.OIDC_AUTO_PROVISION_ROLE_MAP;
    }
    if (previous.PII_ENCRYPTION_KEY === undefined) {
      delete process.env.PII_ENCRYPTION_KEY;
    } else {
      process.env.PII_ENCRYPTION_KEY = previous.PII_ENCRYPTION_KEY;
    }
  }
});

test('production auto-provision leaves untrusted email domains pending', async () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    OIDC_AUTO_PROVISION_ENABLED: process.env.OIDC_AUTO_PROVISION_ENABLED,
    OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS: process.env.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS,
    OIDC_AUTO_PROVISION_TENANT_CODE: process.env.OIDC_AUTO_PROVISION_TENANT_CODE,
  };
  process.env.NODE_ENV = 'production';
  process.env.OIDC_AUTO_PROVISION_ENABLED = 'true';
  process.env.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS = 'rhenext.com';
  process.env.OIDC_AUTO_PROVISION_TENANT_CODE = 'DEFAULT';

  try {
    const f = fixture({ users: [], bindings: [] });
    (f.service as any).ds.query = async () => [{ id: 'tenant-default' }];

    const resolved = await f.service.resolveVerifiedIdentity({
      provider: 'RHAUTT-AI-OIDC',
      issuer: 'https://ai.rhautt.com/',
      subject: 'external-new',
      profile: { email: 'external@example.com', name: 'External', roles: ['admin'] },
    });

    assert.equal(resolved.status, 'pending_authorization');
    assert.equal(resolved.user, null);
    assert.equal(resolved.binding.status, 'pending_authorization');
    assert.equal(f.users.rows.length, 0);
  } finally {
    if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.NODE_ENV;
    if (previous.OIDC_AUTO_PROVISION_ENABLED === undefined) delete process.env.OIDC_AUTO_PROVISION_ENABLED;
    else process.env.OIDC_AUTO_PROVISION_ENABLED = previous.OIDC_AUTO_PROVISION_ENABLED;
    if (previous.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS === undefined) {
      delete process.env.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS;
    } else {
      process.env.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS =
        previous.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS;
    }
    if (previous.OIDC_AUTO_PROVISION_TENANT_CODE === undefined) {
      delete process.env.OIDC_AUTO_PROVISION_TENANT_CODE;
    } else {
      process.env.OIDC_AUTO_PROVISION_TENANT_CODE = previous.OIDC_AUTO_PROVISION_TENANT_CODE;
    }
  }
});

test('production auto-provision activates an existing pending binding', async () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    OIDC_AUTO_PROVISION_ENABLED: process.env.OIDC_AUTO_PROVISION_ENABLED,
    OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS: process.env.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS,
    OIDC_AUTO_PROVISION_TENANT_CODE: process.env.OIDC_AUTO_PROVISION_TENANT_CODE,
    PII_ENCRYPTION_KEY: process.env.PII_ENCRYPTION_KEY,
  };
  process.env.NODE_ENV = 'production';
  process.env.OIDC_AUTO_PROVISION_ENABLED = 'true';
  process.env.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS = 'rhenext.com';
  process.env.OIDC_AUTO_PROVISION_TENANT_CODE = 'DEFAULT';
  process.env.PII_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  try {
    const f = fixture({
      users: [],
      bindings: [binding({ tenantId: null, localUserId: null, status: 'pending_authorization' })],
    });
    (f.service as any).ds.query = async () => [{ id: 'tenant-default' }];

    const resolved = await f.service.resolveVerifiedIdentity({
      ...IDENTITY,
      profile: { email: 'employee@rhenext.com', name: 'Employee', roles: ['employee'] },
    });

    assert.equal(resolved.status, 'authenticated');
    assert.equal(resolved.user.role, 'hq_admin');
    assert.equal(resolved.binding.id, 'binding-001');
    assert.equal(resolved.binding.status, 'active');
    assert.equal(resolved.binding.localUserId, resolved.user.id);
    assert.equal(f.bindings.rows.length, 1);
  } finally {
    if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.NODE_ENV;
    if (previous.OIDC_AUTO_PROVISION_ENABLED === undefined) delete process.env.OIDC_AUTO_PROVISION_ENABLED;
    else process.env.OIDC_AUTO_PROVISION_ENABLED = previous.OIDC_AUTO_PROVISION_ENABLED;
    if (previous.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS === undefined) {
      delete process.env.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS;
    } else {
      process.env.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS =
        previous.OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS;
    }
    if (previous.OIDC_AUTO_PROVISION_TENANT_CODE === undefined) {
      delete process.env.OIDC_AUTO_PROVISION_TENANT_CODE;
    } else {
      process.env.OIDC_AUTO_PROVISION_TENANT_CODE = previous.OIDC_AUTO_PROVISION_TENANT_CODE;
    }
    if (previous.PII_ENCRYPTION_KEY === undefined) {
      delete process.env.PII_ENCRYPTION_KEY;
    } else {
      process.env.PII_ENCRYPTION_KEY = previous.PII_ENCRYPTION_KEY;
    }
  }
});

test('inactive or disabled bindings fail closed', async () => {
  const inactive = fixture({ bindings: [binding({ status: 'inactive' })] });
  await assert.rejects(
    () => inactive.service.resolveVerifiedIdentity(IDENTITY),
    /SSO external identity binding is not active/,
  );

  const disabled = fixture({ bindings: [binding({ status: 'disabled' })] });
  await assert.rejects(
    () => disabled.service.resolveVerifiedIdentity(IDENTITY),
    /SSO external identity binding is not active/,
  );
});

test('upstream roles and org claims remain hints and never replace local RBAC scope', async () => {
  const f = fixture({
    users: [
      user({
        role: 'designer',
        permissions: ['design:read'],
        dealerId: 'dealer-local',
        storeId: 'store-local',
      }),
    ],
  });

  const resolved = await f.service.resolveVerifiedIdentity({
    ...IDENTITY,
    profile: {
      roles: ['platform_admin', 'hq_admin'],
      org: { tenantId: 'tenant-other', dealerId: 'dealer-other', storeId: 'store-other' },
    },
  });

  assert.equal(resolved.status, 'authenticated');
  assert.equal(resolved.user.tenantId, 'tenant-a');
  assert.equal(resolved.user.dealerId, 'dealer-local');
  assert.equal(resolved.user.storeId, 'store-local');
  assert.equal(resolved.user.role, 'designer');
  assert.deepEqual(resolved.user.permissions, ['design:read']);
  assert.deepEqual(resolved.binding.lastSeenProfile, {
    roles: ['platform_admin', 'hq_admin'],
    org: { tenantId: 'tenant-other', dealerId: 'dealer-other', storeId: 'store-other' },
  });
});
