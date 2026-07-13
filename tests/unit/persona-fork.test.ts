/**
 * 分身编队 (B-037) · M2 · fork + 独立进化 单测
 *
 * 覆盖:
 *   1. forkSkillPersona: 从已发布模板 fork, 字段保真 (kind/parent/template/specialty/skills)
 *   2. 主分身不存在时自动建档
 *   3. 硬上限 ≤5 (第 6 次 fork 抛错)
 *   4. 未发布模板不可 fork
 *   5. getPrimaryPersona 始终返回主分身 (即使技能分身更晚更新)
 *   6. listSkillPersonas 只返回技能分身
 *   7. recordSkillPersonaAdoption: 技能分身独立进化, 不影响主分身
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getStore, setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { forkSkillPersona } from '@/lib/persona/fork';
import { createPersona, recordSkillPersonaAdoption, recordDecision } from '@/lib/persona/evolution';
import { getPrimaryPersona, listSkillPersonas } from '@/lib/persona/persona-lookup';
import { MAX_SKILL_PERSONAS_PER_USER } from '@/lib/types/persona';
import type { AgentTemplate } from '@/lib/types/agent-template';

const USER = 'u_alice';

beforeEach(() => {
  setStore(createInMemoryStore());
});

async function seedTemplate(overrides: Partial<Omit<AgentTemplate, 'id'>> = {}): Promise<AgentTemplate> {
  const now = new Date().toISOString();
  return getStore().agentTemplates.create({
    tenantId: 'default',
    name: overrides.name ?? '资深财务分析师',
    specialty: 'finance',
    origin: 'internal',
    basePrompt: '你是一名资深财务分析师...',
    defaultSkills: ['kpi-bonus'],
    defaultKnowledgeTags: ['finance'],
    status: 'published',
    createdBy: 'u_admin',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe('forkSkillPersona (B-037 M2)', () => {
  it('从已发布模板 fork → 技能分身字段保真', async () => {
    const tpl = await seedTemplate();
    const primary = await createPersona(USER);

    const skill = await forkSkillPersona(USER, tpl.id);

    expect(skill.kind).toBe('skill');
    expect(skill.parentPersonaId).toBe(primary.id);
    expect(skill.templateId).toBe(tpl.id);
    expect(skill.specialty).toBe('finance');
    expect(skill.stage).toBe('newborn');
    expect(skill.delegationLevel).toBe('observe_only');
    expect(skill.enabledSkills).toEqual(['kpi-bonus']); // 能力来自模板
  });

  it('主分身不存在时自动建档', async () => {
    const tpl = await seedTemplate();
    const skill = await forkSkillPersona(USER, tpl.id);
    const primary = await getPrimaryPersona(USER);
    expect(primary).not.toBeNull();
    expect(primary!.kind).toBe('primary');
    expect(skill.parentPersonaId).toBe(primary!.id);
  });

  it('硬上限 ≤5: 第 6 次 fork 抛错', async () => {
    const tpl = await seedTemplate();
    for (let i = 0; i < MAX_SKILL_PERSONAS_PER_USER; i++) {
      await forkSkillPersona(USER, tpl.id);
    }
    expect(await listSkillPersonas(USER)).toHaveLength(MAX_SKILL_PERSONAS_PER_USER);
    await expect(forkSkillPersona(USER, tpl.id)).rejects.toThrow(/上限/);
  });

  it('未发布模板不可 fork', async () => {
    const draft = await seedTemplate({ status: 'draft', name: '草稿模板' });
    await expect(forkSkillPersona(USER, draft.id)).rejects.toThrow(/未发布/);
  });

  it('模板不存在 → 抛错', async () => {
    await expect(forkSkillPersona(USER, 'tpl_nonexistent')).rejects.toThrow(/not found/);
  });
});

describe('主分身解析 (getPrimaryPersona / listSkillPersonas)', () => {
  it('fork 后 getPrimaryPersona 仍返回主分身 (不误取技能分身)', async () => {
    const tpl = await seedTemplate();
    const primary = await createPersona(USER);
    const skill = await forkSkillPersona(USER, tpl.id);
    // 技能分身更晚创建/更新; getPrimaryPersona 必须仍返回主分身
    const resolved = await getPrimaryPersona(USER);
    expect(resolved!.id).toBe(primary.id);
    expect(resolved!.id).not.toBe(skill.id);
  });

  it('listSkillPersonas 只返回技能分身', async () => {
    const tpl = await seedTemplate();
    await createPersona(USER);
    await forkSkillPersona(USER, tpl.id);
    await forkSkillPersona(USER, tpl.id);
    const skills = await listSkillPersonas(USER);
    expect(skills).toHaveLength(2);
    expect(skills.every((p) => p.kind === 'skill')).toBe(true);
  });
});

describe('独立进化 (recordSkillPersonaAdoption)', () => {
  it('采纳合稿 → 技能分身 totalDecisions/aiAssisted++, vetoRate 归零, 主分身不受影响', async () => {
    const tpl = await seedTemplate();
    const primary = await createPersona(USER);
    const skill = await forkSkillPersona(USER, tpl.id);

    await recordSkillPersonaAdoption(skill.id);
    await recordSkillPersonaAdoption(skill.id);

    const store = getStore();
    const skillAfter = await store.personas.get(skill.id);
    expect(skillAfter!.decisionHistory.totalDecisions).toBe(2);
    expect(skillAfter!.decisionHistory.aiAssisted).toBe(2);
    expect(skillAfter!.decisionHistory.vetoedByUser).toBe(0);
    expect(skillAfter!.decisionHistory.vetoRate).toBe(0);

    // 主分身独立: 未被这次采纳影响
    const primaryAfter = await store.personas.get(primary.id);
    expect(primaryAfter!.decisionHistory.totalDecisions).toBe(0);
  });

  it('主分身 recordDecision 不影响技能分身 (双向独立)', async () => {
    const tpl = await seedTemplate();
    await createPersona(USER);
    const skill = await forkSkillPersona(USER, tpl.id);

    await recordDecision(USER, { selectedByAi: false, vetoed: false });

    const store = getStore();
    const skillAfter = await store.personas.get(skill.id);
    expect(skillAfter!.decisionHistory.totalDecisions).toBe(0);
    const primary = await getPrimaryPersona(USER);
    expect(primary!.decisionHistory.totalDecisions).toBe(1);
  });
});
