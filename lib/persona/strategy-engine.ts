/**
 * B-025 · 战略引擎 — realignPersonaToOkr
 *
 * 职责: OKR 周期切换后, 遍历全员 Persona, 将 enabledSkills 重对齐到
 *   1. 当前 stage 对应的默认技能集 (STAGE_TO_DEFAULT_SKILLS)
 *   2. 新周期 OKR 上下文赋予的额外技能 (基于 Objective 关键词匹配)
 *
 * 触发入口:
 *   - POST /api/okr/cycles/[id]/activate → emit okr.cycle-activated
 *   - subscribers.ts 订阅 okr.cycle-activated → 调本函数 (fail-soft)
 *
 * 设计原则:
 *   - fail-soft: 任何单个 Persona 更新失败不影响其他人
 *   - 幂等: 重复运行结果一致 (enabledSkills 去重后写入)
 *   - 轻量: 只读一次 OKR snapshot, 不跑 LLM (B-025 v1)
 *   - v2 扩展点: 接 LLM 推理每个人的个性化 skill 调整
 */

import { getStore } from '../storage/repository';
import { STAGE_TO_DEFAULT_SKILLS } from '../types/persona';
import { logger } from '../infra/logger';
import type { Persona } from '../types/persona';
import type { Objective } from '../types/okr-tti';

// ---------------------------------------------------------------------------
// Skill 关键词映射 (OKR Objective 标题包含关键词 → 额外解锁对应 skill)
// ---------------------------------------------------------------------------

const OBJECTIVE_KEYWORD_SKILL_MAP: Array<{ keywords: string[]; skillId: string }> = [
  { keywords: ['销售', '营收', '增长', 'revenue', 'sales'], skillId: 'sales-coaching' },
  { keywords: ['人才', '招聘', '培训', '团队建设'], skillId: 'talent-growth' },
  { keywords: ['合规', '风控', '审计', '安全'], skillId: 'audit-verify' },
  { keywords: ['KPI', '绩效', '考核', '奖金'], skillId: 'kpi-bonus' },
  { keywords: ['客户', '满意度', 'NPS', '服务'], skillId: 'customer-insight' },
];

/**
 * 根据当前 active 周期的 Objectives 推导出应额外解锁的 skill 列表.
 * 仅当 Persona.stage 允许时才解锁 (stage 门槛: assistant 及以上).
 */
function deriveOkrContextSkills(
  objectives: Objective[],
  persona: Persona,
): string[] {
  const stageTier: Record<Persona['stage'], number> = {
    newborn: 0, apprentice: 1, assistant: 2, deputy: 3, partner: 4,
  };
  const tier = stageTier[persona.stage] ?? 0;
  if (tier < 2) return []; // newborn / apprentice 不扩展

  const titles = objectives.map((o) => o.title ?? '').join(' ');
  const unlocked: string[] = [];
  for (const { keywords, skillId } of OBJECTIVE_KEYWORD_SKILL_MAP) {
    if (keywords.some((kw) => titles.includes(kw))) {
      unlocked.push(skillId);
    }
  }
  return unlocked;
}

// ---------------------------------------------------------------------------
// 主函数
// ---------------------------------------------------------------------------

export interface RealignResult {
  processed: number;
  updated: number;
  errors: number;
}

/**
 * 重对齐全员 Persona 的 enabledSkills 到新周期 OKR 上下文.
 * fail-soft: 单个 Persona 失败不抛出.
 */
export async function realignPersonaToOkr(tenantId = 'default'): Promise<RealignResult> {
  const result: RealignResult = { processed: 0, updated: 0, errors: 0 };

  try {
    const store = getStore();

    // 1. 拉取当前 active 周期的 Objectives
    const [cycles, objectives, personas] = await Promise.all([
      store.cycles.list(),
      store.objectives.list(),
      store.personas.list(),
    ]);

    const activeCycle = cycles
      .filter((c) => c.isActive)
      .sort((a, b) => new Date(b.startDate ?? 0).getTime() - new Date(a.startDate ?? 0).getTime())[0];

    const activeObjectives = activeCycle
      ? objectives.filter((o) => o.cycleId === activeCycle.id)
      : [];

    const tenantPersonas = personas.filter((p) => {
      const tId = (p as { tenantId?: string }).tenantId;
      return !tId || tId === tenantId;
    });

    logger.info(
      { cycleId: activeCycle?.id, objectiveCount: activeObjectives.length, personaCount: tenantPersonas.length },
      '[B-025] realignPersonaToOkr start',
    );

    // 2. 逐个重对齐
    for (const persona of tenantPersonas) {
      result.processed++;
      try {
        const stageDefaults = STAGE_TO_DEFAULT_SKILLS[persona.stage] ?? [];
        const okrExtras = deriveOkrContextSkills(activeObjectives as Objective[], persona);

        // 合并去重
        const newSkills = Array.from(new Set([...stageDefaults, ...okrExtras]));

        // enabledSkills 未初始化，或与新计算值不同时写入
        const current = persona.enabledSkills;
        const changed =
          current === undefined ||
          current === null ||
          newSkills.length !== current.length ||
          newSkills.some((s) => !current.includes(s));

        if (changed) {
          await store.personas.update(persona.id, { enabledSkills: newSkills });
          result.updated++;
          logger.debug(
            { personaId: persona.id, userId: persona.userId, from: current, to: newSkills },
            '[B-025] persona skills realigned',
          );
        }
      } catch (err) {
        result.errors++;
        logger.warn(
          { personaId: persona.id, error: (err as Error).message },
          '[B-025] realign failed for persona',
        );
      }
    }

    logger.info(result, '[B-025] realignPersonaToOkr done');
    return result;
  } catch (err) {
    logger.error({ error: (err as Error).message }, '[B-025] realignPersonaToOkr fatal');
    return result;
  }
}
