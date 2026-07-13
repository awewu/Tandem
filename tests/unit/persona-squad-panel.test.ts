/**
 * 分身编队 (B-037) · M3 · 战斗小组编排 单测
 *
 * 覆盖:
 *   1. runSquadPanel: dispatch 到真实技能分身实体, 每个分身一份草稿 (fail-soft)
 *   2. 无技能分身 → 空 drafts
 *   3. personaIds 过滤 → 只用指定分身
 *   4. consolidateSquadDrafts: 主分身合稿 + contributingPersonaIds
 *   5. 无可用草稿 → 合稿 error
 *   6. recordSquadAdoption: 参与分身独立进化 (totalDecisions++)
 *   7. router 抛错 → 单分身 fail-soft (ok:false), 不影响其它
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getStore, setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { forkSkillPersona } from '@/lib/persona/fork';
import { createPersona, recordSquadAdoption } from '@/lib/persona/evolution';
import { runSquadPanel, consolidateSquadDrafts } from '@/lib/persona/expert-panel';
import type { AgentTemplate } from '@/lib/types/agent-template';

const USER = 'u_alice';
const G = globalThis as unknown as { __tandem_router__?: unknown };

function installFakeRouter() {
  G.__tandem_router__ = {
    chat: async (req: { metadata?: { requestId?: string } }) => {
      const rid = req?.metadata?.requestId ?? '';
      const content = rid.startsWith('squad-consolidate')
        ? '合稿: 综合各专业域要点。'
        : `草稿 for ${rid}`;
      return { id: 'fake', message: { role: 'assistant', content }, finishReason: 'stop' };
    },
    listProviders: () => ['fake'],
    healthCheckAll: async () => ({}),
  };
}

function installThrowingRouter() {
  G.__tandem_router__ = {
    chat: async () => {
      throw new Error('llm down');
    },
    listProviders: () => [],
    healthCheckAll: async () => ({}),
  };
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
    defaultKnowledgeTags: [],
    status: 'published',
    createdBy: 'u_admin',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

beforeEach(() => {
  setStore(createInMemoryStore());
  installFakeRouter();
});

afterEach(() => {
  delete G.__tandem_router__;
});

describe('runSquadPanel (B-037 M3)', () => {
  it('dispatch 到真实技能分身 → 每分身一份草稿', async () => {
    await createPersona(USER);
    const finance = await forkSkillPersona(USER, (await seedTemplate({ specialty: 'finance', name: '财务' })).id);
    const tech = await forkSkillPersona(USER, (await seedTemplate({ specialty: 'tech', name: '技术' })).id);

    const result = await runSquadPanel(USER, '要不要上这个新项目?');

    expect(result.drafts).toHaveLength(2);
    expect(result.drafts.every((d) => d.ok)).toBe(true);
    const ids = result.drafts.map((d) => d.personaId).sort();
    expect(ids).toEqual([finance.id, tech.id].sort());
    // 草稿内容按 personaId 路由 (证明 dispatch 到各自实体)
    const financeDraft = result.drafts.find((d) => d.personaId === finance.id)!;
    expect(financeDraft.draft).toContain(finance.id);
    expect(financeDraft.specialty).toBe('finance');
  });

  it('无技能分身 → 空 drafts', async () => {
    await createPersona(USER);
    const result = await runSquadPanel(USER, '议题');
    expect(result.drafts).toHaveLength(0);
    expect(result.primaryPersonaId).not.toBeNull();
  });

  it('personaIds 过滤 → 只用指定分身', async () => {
    await createPersona(USER);
    const finance = await forkSkillPersona(USER, (await seedTemplate({ specialty: 'finance', name: '财务' })).id);
    await forkSkillPersona(USER, (await seedTemplate({ specialty: 'tech', name: '技术' })).id);

    const result = await runSquadPanel(USER, '议题', { personaIds: [finance.id] });
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].personaId).toBe(finance.id);
  });

  it('单分身 router 抛错 → fail-soft (ok:false)', async () => {
    await createPersona(USER);
    await forkSkillPersona(USER, (await seedTemplate()).id);
    installThrowingRouter();

    const result = await runSquadPanel(USER, '议题');
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].ok).toBe(false);
    expect(result.drafts[0].error).toContain('llm down');
  });
});

describe('consolidateSquadDrafts (B-037 M3)', () => {
  it('主分身合稿 → ok + contributingPersonaIds', async () => {
    await createPersona(USER);
    await forkSkillPersona(USER, (await seedTemplate({ specialty: 'finance', name: '财务' })).id);
    await forkSkillPersona(USER, (await seedTemplate({ specialty: 'tech', name: '技术' })).id);

    const panel = await runSquadPanel(USER, '议题');
    const merged = await consolidateSquadDrafts(USER, '议题', panel.drafts);

    expect(merged.ok).toBe(true);
    expect(merged.consolidated).toContain('合稿');
    expect(merged.contributingPersonaIds).toHaveLength(2);
  });

  it('无可用草稿 → error', async () => {
    const merged = await consolidateSquadDrafts(USER, '议题', [
      { personaId: 'p1', specialty: 'finance', stage: 'newborn', ok: false, draft: '', error: 'x' },
    ]);
    expect(merged.ok).toBe(false);
    expect(merged.contributingPersonaIds).toHaveLength(0);
  });
});

describe('recordSquadAdoption (B-037 M3)', () => {
  it('采纳 → 参与技能分身独立进化 (totalDecisions++)', async () => {
    await createPersona(USER);
    const finance = await forkSkillPersona(USER, (await seedTemplate({ specialty: 'finance', name: '财务' })).id);
    const tech = await forkSkillPersona(USER, (await seedTemplate({ specialty: 'tech', name: '技术' })).id);

    await recordSquadAdoption([finance.id, tech.id]);

    const store = getStore();
    const f = await store.personas.get(finance.id);
    const t = await store.personas.get(tech.id);
    expect(f!.decisionHistory.totalDecisions).toBe(1);
    expect(f!.decisionHistory.aiAssisted).toBe(1);
    expect(t!.decisionHistory.totalDecisions).toBe(1);
  });

  it('含不存在的 personaId → fail-soft 不抛', async () => {
    await createPersona(USER);
    const finance = await forkSkillPersona(USER, (await seedTemplate()).id);
    await expect(recordSquadAdoption([finance.id, 'ghost'])).resolves.toBeUndefined();
    const f = await getStore().personas.get(finance.id);
    expect(f!.decisionHistory.totalDecisions).toBe(1);
  });
});
