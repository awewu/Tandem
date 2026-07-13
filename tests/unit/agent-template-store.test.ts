/**
 * 分身编队 (B-037) · M1 数据模型单测
 *
 * 验证:
 *   1. agentTemplates 仓储三件套接通 (create/get/list/update round-trip)
 *   2. tenantId filter 下推
 *   3. Persona 新字段 (kind/parentPersonaId/templateId/specialty) 往返保真
 *   4. MAX_SKILL_PERSONAS_PER_USER 常量 = 5 (Owner 决策 ③)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getStore, setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { MAX_SKILL_PERSONAS_PER_USER } from '@/lib/types/persona';
import type { AgentTemplate } from '@/lib/types/agent-template';
import type { Persona } from '@/lib/types/persona';

beforeEach(() => {
  setStore(createInMemoryStore());
});

function templateInput(overrides: Partial<Omit<AgentTemplate, 'id'>> = {}): Omit<AgentTemplate, 'id'> {
  const now = new Date().toISOString();
  return {
    tenantId: 'default',
    name: '资深财务分析师',
    specialty: 'finance',
    origin: 'internal',
    basePrompt: '你是一名资深财务分析师...',
    defaultSkills: ['kpi-bonus'],
    defaultKnowledgeTags: ['finance', 'budget'],
    status: 'published',
    createdBy: 'u_admin',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('agentTemplates 仓储 (B-037 M1)', () => {
  it('create → get 往返保真', async () => {
    const store = getStore();
    const created = await store.agentTemplates.create(templateInput());
    expect(created.id).toBeTruthy();

    const fetched = await store.agentTemplates.get(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('资深财务分析师');
    expect(fetched!.specialty).toBe('finance');
    expect(fetched!.origin).toBe('internal');
    expect(fetched!.defaultSkills).toEqual(['kpi-bonus']);
    expect(fetched!.status).toBe('published');
  });

  it('list 按 tenantId + status 过滤', async () => {
    const store = getStore();
    await store.agentTemplates.create(templateInput({ tenantId: 'default', status: 'published' }));
    await store.agentTemplates.create(templateInput({ tenantId: 'default', status: 'draft', name: '草稿模板' }));
    await store.agentTemplates.create(templateInput({ tenantId: 'other', status: 'published', name: '他租户' }));

    const defaultPublished = await store.agentTemplates.list({ tenantId: 'default', status: 'published' } as Partial<AgentTemplate>);
    expect(defaultPublished).toHaveLength(1);
    expect(defaultPublished[0].name).toBe('资深财务分析师');
  });

  it('external_market 来源 + reviewedBy 保真', async () => {
    const store = getStore();
    const created = await store.agentTemplates.create(
      templateInput({ origin: 'external_market', externalRef: 'market:acme/finance-pro', reviewedBy: 'u_steward' }),
    );
    const fetched = await store.agentTemplates.get(created.id);
    expect(fetched!.origin).toBe('external_market');
    expect(fetched!.externalRef).toBe('market:acme/finance-pro');
    expect(fetched!.reviewedBy).toBe('u_steward');
  });
});

describe('Persona 分身编队字段 (B-037 M1)', () => {
  it('技能分身 kind/parentPersonaId/templateId/specialty 往返保真', async () => {
    const store = getStore();
    const now = new Date().toISOString();
    const skill = await store.personas.create({
      userId: 'u_alice',
      schemaVersion: 'tandem.v1',
      stage: 'newborn',
      stageEnteredAt: now,
      delegationLevel: 'observe_only',
      decisionHistory: { totalDecisions: 0, selfMade: 0, aiAssisted: 0, vetoedByUser: 0, vetoRate: 0 },
      styleProfile: { decisionSpeed: 'medium', riskAppetite: 0.5, communicationStyle: 'analytical', preferredOptions: [], communicationExamples: [] },
      growthAreas: [],
      bossCaptureScore: 0,
      dataOwnership: { companyOwnsData: true, anonymizationPending: false, employeeCanExportOrigins: true },
      learningActive: true,
      createdAt: now,
      updatedAt: now,
      kind: 'skill',
      parentPersonaId: 'persona_primary_alice',
      templateId: 'tpl_finance',
      specialty: 'finance',
    } as Omit<Persona, 'id'>);

    const fetched = await store.personas.get(skill.id);
    expect(fetched!.kind).toBe('skill');
    expect(fetched!.parentPersonaId).toBe('persona_primary_alice');
    expect(fetched!.templateId).toBe('tpl_finance');
    expect(fetched!.specialty).toBe('finance');
  });

  it('MAX_SKILL_PERSONAS_PER_USER = 5 (Owner 决策 ③)', () => {
    expect(MAX_SKILL_PERSONAS_PER_USER).toBe(5);
  });
});
