import { isValidScope } from '../../services/api/src/modules/auth/auth.guard';

describe('Tenant scope validation (isValidScope)', () => {
  const valid = {
    userId: 'user-001',
    tenantId: 'tenant-001',
    dealerId: 'dealer-001',
    storeId: null,
    customerId: null,
  };

  it('accepts a well-formed JWT payload with all required fields', () => {
    expect(isValidScope(valid)).toBe(true);
  });

  it('accepts UUID-format ids', () => {
    expect(isValidScope({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      dealerId: null,
      storeId: null,
      customerId: null,
    })).toBe(true);
  });

  it('accepts Mongo ObjectId-format ids', () => {
    expect(isValidScope({
      userId: '507f1f77bcf86cd799439011',
      tenantId: '507f1f77bcf86cd799439012',
      dealerId: null,
      storeId: null,
      customerId: null,
    })).toBe(true);
  });

  it('rejects missing tenantId', () => {
    expect(isValidScope({ ...valid, tenantId: undefined })).toBe(false);
  });

  it('rejects empty-string tenantId', () => {
    expect(isValidScope({ ...valid, tenantId: '' })).toBe(false);
  });

  it('rejects whitespace-only tenantId', () => {
    expect(isValidScope({ ...valid, tenantId: '   ' })).toBe(false);
  });

  it('rejects missing userId', () => {
    expect(isValidScope({ ...valid, userId: undefined })).toBe(false);
  });

  it('rejects null user object', () => {
    expect(isValidScope(null)).toBe(false);
  });

  it('rejects non-object user', () => {
    expect(isValidScope('tenant-001')).toBe(false);
  });

  it('accepts null for optional scope fields (dealerId, storeId, customerId)', () => {
    expect(isValidScope({
      userId: 'user-001',
      tenantId: 'tenant-001',
      dealerId: null,
      storeId: null,
      customerId: null,
    })).toBe(true);
  });

  it('accepts undefined for optional scope fields', () => {
    expect(isValidScope({
      userId: 'user-001',
      tenantId: 'tenant-001',
    })).toBe(true);
  });

  it('rejects empty-string for optional dealerId', () => {
    expect(isValidScope({ ...valid, dealerId: '' })).toBe(false);
  });

  it('rejects whitespace-only dealerId', () => {
    expect(isValidScope({ ...valid, dealerId: '  ' })).toBe(false);
  });

  it('rejects tenantId with special characters that could bypass isolation', () => {
    expect(isValidScope({ ...valid, tenantId: '$gt' })).toBe(false);
  });

  it('rejects tenantId starting with hyphen', () => {
    expect(isValidScope({ ...valid, tenantId: '-tenant' })).toBe(false);
  });

  it('accepts tenantId with underscores and hyphens in middle', () => {
    expect(isValidScope({ ...valid, tenantId: 'tenant_001-test' })).toBe(true);
  });

  it('rejects tenantId exceeding 64 characters', () => {
    expect(isValidScope({ ...valid, tenantId: 'a'.repeat(65) })).toBe(false);
  });

  it('accepts tenantId of exactly 63 characters', () => {
    expect(isValidScope({ ...valid, tenantId: 'a'.repeat(63) })).toBe(true);
  });
});

describe('Tenant scope parity: Express requireTenantScope vs NestJS AuthGuard', () => {
  // These tests verify that the NestJS AuthGuard.isValidScope function
  // enforces the same tenant isolation guarantees as the Express
  // requireTenantScope middleware (server/middleware/tenantScope.js).

  it('NestJS rejects missing tenantId (parity: Express returns 403 "缺少租户上下文")', () => {
    const payload = { userId: 'user-001', tenantId: undefined };
    expect(isValidScope(payload)).toBe(false);
  });

  it('NestJS accepts valid tenantId and optional dealerId (parity: Express sets req.scope)', () => {
    const payload = {
      userId: 'user-001',
      tenantId: 'tenant-001',
      dealerId: 'dealer-001',
      storeId: null,
      customerId: null,
    };
    expect(isValidScope(payload)).toBe(true);
  });

  it('NestJS does not allow header fallback for tenantId (parity: Express only trusts JWT user)', () => {
    // isValidScope only inspects the user object — there is no header path.
    // This is by design: AuthGuard extracts JWT payload, not headers.
    const payload = { userId: 'user-001', tenantId: 'tenant-001' };
    expect(isValidScope(payload)).toBe(true);
    // Invalid tenant in payload is rejected regardless of any header
    expect(isValidScope({ ...payload, tenantId: '' })).toBe(false);
  });
});

describe('Route ownership: all /api/v2/* routes point to NestJS', () => {
  const { ROUTE_OWNERSHIP } = require('../../server/modules/routeOwnership');

  const v2Routes = ROUTE_OWNERSHIP.filter((r: any) => r.prefix.startsWith('/api/v2/'));

  it('every /api/v2/* route is owned by services/api (NestJS)', () => {
    const nonNestjs = v2Routes.filter((r: any) => !r.owner.startsWith('services/api'));
    expect(nonNestjs).toEqual([]);
  });

  it('no /api/v2/* route has status "legacy-compat"', () => {
    const legacy = v2Routes.filter((r: any) => r.status === 'legacy-compat');
    expect(legacy).toEqual([]);
  });

  it('migrated route files have status "migrated-to-nestjs"', () => {
    const { ROUTE_FILE_OWNERSHIP } = require('../../server/modules/routeOwnership');
    const migrated = ROUTE_FILE_OWNERSHIP.filter((r: any) => r.status === 'migrated-to-nestjs');
    expect(migrated.length).toBeGreaterThanOrEqual(7);
    migrated.forEach((r: any) => {
      expect(r.owner.startsWith('services/api')).toBe(true);
    });
  });
});
