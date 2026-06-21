/**
 * Anti-regression tests — Learning module access control
 *
 * P1-L-1: GET /api/learning/lessons — draft/archive enumeration gated to steward/champion
 * P1-L-2: POST /api/learning/generate — requires auth (steward/champion)
 * P1-L-3: GET /api/learning/certifications — uses tenant scope (no cross-tenant leak)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoist mock store so vi.mock factories can reference it ──────────────────
const { mockStore } = vi.hoisted(() => {
  const store = {
    lessons: {
      list: vi.fn().mockResolvedValue([
        { id: 'l1', title: 'Draft', tenantId: 'default', publishedAt: null, archivedAt: null, category: 'onboarding', requirement: 'mandatory_once', durationMin: 10, summary: '', sourceRefs: [] },
        { id: 'l2', title: 'Published', tenantId: 'default', publishedAt: '2024-01-01T00:00:00Z', archivedAt: null, category: 'onboarding', requirement: 'mandatory_once', durationMin: 10, summary: '', sourceRefs: [] },
        { id: 'l3', title: 'Archived', tenantId: 'default', publishedAt: '2024-01-01T00:00:00Z', archivedAt: '2024-06-01T00:00:00Z', category: 'onboarding', requirement: 'mandatory_once', durationMin: 10, summary: '', sourceRefs: [] },
      ]),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    learningCertifications: {
      list: vi.fn().mockResolvedValue([
        { id: 'cert1', userId: 'user-a', lessonId: 'l2', earnedAt: '2024-01-01T00:00:00Z', tenantId: 'default' },
        { id: 'cert2', userId: 'user-b', lessonId: 'l2', earnedAt: '2024-01-01T00:00:00Z', tenantId: 'default' },
      ]),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { mockStore: store };
});

vi.mock('@/lib/boot', () => ({
  boot: vi.fn().mockResolvedValue(undefined),
  getStore: vi.fn().mockReturnValue(mockStore),
}));

vi.mock('@/lib/storage/repository', () => ({
  getStore: vi.fn().mockReturnValue(mockStore),
}));

vi.mock('@/lib/multi-tenant/with-tenant-scope', () => ({
  withTenantScope: vi.fn().mockImplementation((repo) => repo),
}));

function makeAuth(role: string, userId = 'user-a', tenantId = 'default') {
  return { userId, tenantId, role, stage: 'employee' };
}

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn().mockImplementation((auth, roles) => {
    if (roles.includes(auth.role)) return null;
    const { NextResponse } = require('next/server');
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }),
}));

import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { GET as lessonsGET } from '@/app/api/learning/lessons/route';
import { POST as generatePOST } from '@/app/api/learning/generate/route';
import { GET as certsGET } from '@/app/api/learning/certifications/route';

function makeRequest(url: string, opts?: { method?: string; body?: string }) {
  const r = new Request(url, {
    method: opts?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts?.body,
  });
  return new NextRequest(r);
}

// ── P1-L-1: draft / archive enumeration ─────────────────────────────────────

describe('P1-L-1 — lessons list draft/archive gate', () => {
  beforeEach(() => {
    vi.mocked(requireAuth).mockReturnValue(makeAuth('employee') as never);
  });

  it('employee gets only published non-archived lessons even with ?includeDrafts=1&includeArchived=1', async () => {
    const req = makeRequest('http://localhost/api/learning/lessons?includeDrafts=1&includeArchived=1');
    const res = await lessonsGET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    const ids = json.lessons.map((l: { id: string }) => l.id);
    expect(ids).not.toContain('l1');
    expect(ids).not.toContain('l3');
    expect(ids).toContain('l2');
  });

  it('employee gets only published non-archived lessons even with ?includeArchived=1', async () => {
    const req = makeRequest('http://localhost/api/learning/lessons?includeArchived=1');
    const res = await lessonsGET(req);
    const json = await res.json();
    const ids = json.lessons.map((l: { id: string }) => l.id);
    expect(ids).not.toContain('l3');
  });

  it('steward with ?includeDrafts=1 receives draft lessons', async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuth('steward') as never);
    vi.mocked(requireRole).mockReturnValue(null);
    const req = makeRequest('http://localhost/api/learning/lessons?includeDrafts=1');
    const res = await lessonsGET(req);
    const json = await res.json();
    const ids = json.lessons.map((l: { id: string }) => l.id);
    expect(ids).toContain('l1');
  });

  it('champion with ?includeArchived=1 receives archived lessons', async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuth('champion') as never);
    vi.mocked(requireRole).mockReturnValue(null);
    const req = makeRequest('http://localhost/api/learning/lessons?includeArchived=1');
    const res = await lessonsGET(req);
    const json = await res.json();
    const ids = json.lessons.map((l: { id: string }) => l.id);
    expect(ids).toContain('l3');
  });
});

// ── P1-L-2: generate endpoint auth ──────────────────────────────────────────

describe('P1-L-2 — generate endpoint requires steward/champion auth', () => {
  it('unauthenticated request returns 401', async () => {
    const { NextResponse } = await import('next/server');
    vi.mocked(requireAuth).mockReturnValue(
      NextResponse.json({ error: 'unauthorized' }, { status: 401 }) as never,
    );
    const req = makeRequest('http://localhost/api/learning/generate', {
      method: 'POST',
      body: JSON.stringify({ sourceId: 'mem1', sourceType: 'memory', userId: 'u1', category: 'onboarding' }),
    });
    const res = await generatePOST(req);
    expect(res.status).toBe(401);
  });

  it('employee role returns 403', async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuth('employee') as never);
    vi.mocked(requireRole).mockReturnValue(
      (await import('next/server')).NextResponse.json({ error: 'forbidden' }, { status: 403 }) as never,
    );
    const req = makeRequest('http://localhost/api/learning/generate', {
      method: 'POST',
      body: JSON.stringify({ sourceId: 'mem1', sourceType: 'memory', userId: 'u1', category: 'onboarding' }),
    });
    const res = await generatePOST(req);
    expect(res.status).toBe(403);
  });

  it('steward gets stub response', async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuth('steward') as never);
    vi.mocked(requireRole).mockReturnValue(null);
    const req = makeRequest('http://localhost/api/learning/generate', {
      method: 'POST',
      body: JSON.stringify({ sourceId: 'mem1', sourceType: 'memory', userId: 'u1', category: 'onboarding' }),
    });
    const res = await generatePOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.isStub).toBe(true);
    expect(json.generated).toBeDefined();
  });
});

// ── P1-L-3: certifications tenant scope ─────────────────────────────────────

describe('P1-L-3 — certifications only returns current user certs', () => {
  it('returns only certs for auth.userId, not other users', async () => {
    vi.mocked(requireAuth).mockReturnValue(makeAuth('employee', 'user-a') as never);
    const req = makeRequest('http://localhost/api/learning/certifications');
    const res = await certsGET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.certifications.every((c: { userId: string }) => c.userId === 'user-a')).toBe(true);
    const ids = json.certifications.map((c: { id: string }) => c.id);
    expect(ids).not.toContain('cert2');
  });

  it('unauthenticated request returns 401', async () => {
    const { NextResponse } = await import('next/server');
    vi.mocked(requireAuth).mockReturnValue(
      NextResponse.json({ error: 'unauthorized' }, { status: 401 }) as never,
    );
    const req = makeRequest('http://localhost/api/learning/certifications');
    const res = await certsGET(req);
    expect(res.status).toBe(401);
  });
});
