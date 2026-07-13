/**
 * Persona Fork · 从 AgentTemplate fork 技能分身 (分身编队 B-037 · M2)
 *
 * 员工从公司/市场的基础 Agent 模板 fork 出自己的技能分身:
 *   - 挂靠主分身 (parentPersonaId), 主分身不存在则自动建档
 *   - 硬上限 ≤5 (Owner 决策 ③, MAX_SKILL_PERSONAS_PER_USER)
 *   - 继承模板的 basePrompt/skills/specialty; 但 stage 从 newborn 起, 独立进化
 *   - 能力(enabledSkills)来自模板, 权限(delegationLevel)由 stage 门控 — 两者解耦
 *
 * 治理: 全程 audit('persona.fork') + 事件广播; 数据归公司/尊严归员工同主分身。
 * 详见 docs/PERSONA-SQUAD-ARCHITECTURE.md §3 + §六。
 */

import { getStore } from '../storage/repository';
import { getPrimaryPersona, listSkillPersonas } from './persona-lookup';
import { createPersona } from './evolution';
import { MAX_SKILL_PERSONAS_PER_USER, STAGE_TO_DEFAULT_DELEGATION } from '../types/persona';
import { audit } from '../audit/log';
import { eventBus } from '../events/bus';
import type { Persona } from '../types/persona';

export interface ForkSkillPersonaOptions {
  /** 技能分身所属租户 (默认取模板 tenantId) */
  tenantId?: string;
}

/**
 * 从已发布的 AgentTemplate fork 一个技能分身。
 * @throws 模板不存在 / 未发布 / 已达上限
 */
export async function forkSkillPersona(
  userId: string,
  templateId: string,
  opts: ForkSkillPersonaOptions = {},
): Promise<Persona> {
  const store = getStore();

  const template = await store.agentTemplates.get(templateId);
  if (!template) {
    throw new Error(`AgentTemplate ${templateId} not found`);
  }
  if (template.status !== 'published') {
    throw new Error(`模板「${template.name}」未发布 (status=${template.status}), 不可 fork`);
  }

  // 主分身必须存在 (技能分身挂靠主分身); 不存在则自动建档
  let primary = await getPrimaryPersona(userId);
  if (!primary) {
    primary = await createPersona(userId);
  }

  // 硬上限校验 (Owner 决策 ③: 每人 ≤5 技能分身)
  const existing = await listSkillPersonas(userId);
  if (existing.length >= MAX_SKILL_PERSONAS_PER_USER) {
    throw new Error(
      `技能分身已达上限 (${existing.length}/${MAX_SKILL_PERSONAS_PER_USER}), 请先归档不用的分身再 fork`,
    );
  }

  const now = new Date().toISOString();
  const tenantId =
    opts.tenantId ?? (template as { tenantId?: string }).tenantId ?? 'default';

  const skill = await store.personas.create({
    userId,
    schemaVersion: 'tandem.v1',
    kind: 'skill',
    parentPersonaId: primary.id,
    templateId: template.id,
    specialty: template.specialty,
    stage: 'newborn',
    stageEnteredAt: now,
    delegationLevel: STAGE_TO_DEFAULT_DELEGATION.newborn,
    decisionHistory: { totalDecisions: 0, selfMade: 0, aiAssisted: 0, vetoedByUser: 0, vetoRate: 0 },
    styleProfile: {
      decisionSpeed: 'medium',
      riskAppetite: 0.5,
      communicationStyle: 'analytical',
      preferredOptions: [],
      communicationExamples: [],
    },
    growthAreas: [],
    bossCaptureScore: 0,
    dataOwnership: {
      companyOwnsData: true,
      anonymizationPending: false,
      employeeCanExportOrigins: true,
    },
    learningActive: true,
    // 能力来自模板 (权限仍由 stage 门控: newborn=observe_only)
    enabledSkills: [...template.defaultSkills],
    tenantId,
    createdAt: now,
    updatedAt: now,
  } as Omit<Persona, 'id'>);

  await audit('persona.fork', userId, {
    targetId: skill.id,
    targetType: 'persona',
    metadata: {
      templateId: template.id,
      templateName: template.name,
      specialty: template.specialty,
      parentPersonaId: primary.id,
      origin: template.origin,
    },
  });

  try {
    await eventBus.emit(
      'persona.skill-forked',
      {
        userId,
        skillPersonaId: skill.id,
        parentPersonaId: primary.id,
        templateId: template.id,
        specialty: template.specialty,
        timestamp: Date.now(),
      },
      `persona-fork:${skill.id}`,
    );
  } catch {
    /* 事件广播失败不阻断 fork (bus 已隔离) */
  }

  return skill;
}
