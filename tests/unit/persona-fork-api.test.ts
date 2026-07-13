/**
 * 分身编队 (B-037) · M4 · API 层单测
 *
 * 覆盖:
 *   - GET  /api/agent-templates : 只返回本租户 published 模板 (跨租户/草稿不泄露)
 *   - POST /api/persona/fork     : fork 成功 / 跨租户 403 / 缺参 400 / 超上限 400 / 模板不存在 404
 *   - GET  /api/me/personas      : 主分身 + 技能分身 + cap/remaining
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { MAX_SKILL_PERSONAS_PER_USER } from '@/lib/types/persona';
import type { AuthContext } from '@/lib/auth/require-auth';
import type { AgentTemplate } from '@/lib/types/agent-template';

let currentAuth: AuthContext;

vi.mock('@/lib/boot', async () => {
  const repo = await import('@/lib/storage/repository');
  return {
    boot: vi.fn(async () => {}),
    getRouter: vi.fn(() => ({})),
    getStore: repo.getStore,
  };
});

vi.mock('@/lib/auth/require-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/require-auth')>();
  return { ...actual, requireAuth: vi.fn(() => currentAuth) };
});

import { GET as templatesGET } from '@/app/api/agent-templates/route';
import { POST as forkPOST } from '@/app/api/persona/fork/route';
import { GET as personasGET } from '@/app/api/me/personas/route';

function ctx(userId = 'u_alice', tenantId = 'default'): AuthContext {
  return { userId, email: 'x@t.local', tenantId, roles: ['employee'], mfaVerified: true, demo: false };
}

function getReq(url: string): NextRequest {
  return new NextRequest(new Request(url, { method: 'GET' }));
}
function postReq(url: string, body: unknown): NextRequest {
  return new NextRequest(
    new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  );
}

async function seedTemplate(overrides: Partial<Omit<AgentTemplate, 'id'>> = {}): Promise<AgentTemplate> {
  const now = new Date().toISOString();
  return getStore().agentTemplates.create({
    tenantId: 'default',
    name: overrides.name ?? '资深财务分析师',
    specialty: overrides.specialty ?? 'finance',
    origin: 'internal',
    basePrompt: '你是一名资深财务分析师...',
    defaultSkills: [],
    defaultKnowledgeTags: ['finance'],
    status: 'published',
    createdBy: 'admin@tandem.local',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Omit<AgentTemplate, 'id'>);
}

beforeEach(() => {
  setStore(createInMemoryStore());
  currentAuth = ctx();
});

describe('GET /api/agent-templates', () => {
  it('只返回本租户 published 模板 (跨租户 / 草稿不泄露)', async () => {
    await seedTemplate({ name: '财务', specialty: 'finance' });
    await seedTemplate({ name: '草稿', specialty: 'tech', status: 'draft' });
    await seedTemplate({ name: '他租户', specialty: 'legal', tenantId: 'other' });

    const res = await templatesGET(getReq('http://x/api/agent-templates'));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.templates).toHaveLength(1);
    expect(json.templates[0].name).toBe('财务');
  });

  it('specialty 过滤', async () => {
    await seedTemplate({ name: '财务', specialty: 'finance' });
    await seedTemplate({ name: '技术', specialty: 'tech' });
    const res = await templatesGET(getReq('http://x/api/agent-templates?specialty=tech'));
    const json = await res.json();
    expect(json.templates).toHaveLength(1);
    expect(json.templates[0].specialty).toBe('tech');
  });
});

describe('POST /api/persona/fork', () => {
  it('fork 成功 → 返回技能分身', async () => {
    const tpl = await seedTemplate();
    const res = await forkPOST(postReq('http://x/api/persona/fork', { templateId: tpl.id }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.persona.kind).toBe('skill');
    expect(json.persona.templateId).toBe(tpl.id);
  });

  it('缺 templateId → 400', async () => {
    const res = await forkPOST(postReq('http://x/api/persona/fork', {}));
    expect(res.status).toBe(400);
  });

  it('模板不存在 → 404', async () => {
    const res = await forkPOST(postReq('http://x/api/persona/fork', { templateId: 'ghost' }));
    expect(res.status).toBe(404);
  });

  it('跨租户模板 → 403', async () => {
    const tpl = await seedTemplate({ tenantId: 'other' });
    const res = await forkPOST(postReq('http://x/api/persona/fork', { templateId: tpl.id }));
    expect(res.status).toBe(403);
  });

  it('超 ≤5 上限 → 400', async () => {
    const tpl = await seedTemplate();
    for (let i = 0; i < MAX_SKILL_PERSONAS_PER_USER; i++) {
      const ok = await forkPOST(postReq('http://x/api/persona/fork', { templateId: tpl.id }));
      expect(ok.status).toBe(200);
    }
    const over = await forkPOST(postReq('http://x/api/persona/fork', { templateId: tpl.id }));
    expect(over.status).toBe(400);
    const json = await over.json();
    expect(json.error).toContain('上限');
  });
});

describe('GET /api/me/personas', () => {
  it('返回主分身 + 技能分身 + cap/remaining', async () => {
    const tpl = await seedTemplate();
    await forkPOST(postReq('http://x/api/persona/fork', { templateId: tpl.id }));
    await forkPOST(postReq('http://x/api/persona/fork', { templateId: tpl.id }));

    const res = await personasGET(getReq('http://x/api/me/personas'));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.primary).not.toBeNull();
    expect(json.primary.kind).toBe('primary');
    expect(json.skills).toHaveLength(2);
    expect(json.skills.every((s: { kind: string }) => s.kind === 'skill')).toBe(true);
    expect(json.cap).toBe(MAX_SKILL_PERSONAS_PER_USER);
    expect(json.remaining).toBe(MAX_SKILL_PERSONAS_PER_USER - 2);
  });
});
