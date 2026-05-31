/**
 * Persona Constitution Service · 价值观锚 (B-027)
 *
 * 进化五引擎之"防漂移层" — 在 system prompt 拼装时硬前置 persona 的不可妥协原则.
 *
 * MVP 范围:
 *   - load / set / archive / unarchive 规则
 *   - getPromptSegment(rules) 拼成 system prompt 段
 *   - audit 所有写操作 (Steward 月度可审)
 *   - MAX_ACTIVE_RULES 上限强制
 *
 * 不在 MVP (后续 sprint):
 *   - LLM 输出后 baseline-guard 二次扫描 (违反则重生成)
 *   - 季度自动 review 任务
 *   - UI Tab (跟 B-021 Persona Builder 一起做)
 */

import { getStore, generateId } from '../storage/repository';
import { audit } from '../audit/log';
import {
  activeRules,
  MAX_ACTIVE_RULES,
  validateRuleText,
  type ConstitutionRule,
  type PersonaConstitution,
} from '../types/persona-constitution';

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * 加载某 userId 的 constitution. 不存在返回 null (不自动创建空对象).
 */
export async function loadConstitution(userId: string): Promise<PersonaConstitution | null> {
  const store = getStore();
  const cur = await store.personaConstitutions.get(userId);
  return cur ?? null;
}

/**
 * 获取 active 规则数组 (常用便捷方法).
 */
export async function loadActiveRules(userId: string): Promise<ConstitutionRule[]> {
  const c = await loadConstitution(userId);
  return activeRules(c);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * 添加一条规则. 超过 MAX_ACTIVE_RULES 抛错.
 */
export async function addRule(opts: {
  userId: string;
  text: string;
  addedBy: string;
}): Promise<PersonaConstitution> {
  const validation = validateRuleText(opts.text);
  if (!validation.ok) {
    throw new Error(validation.reason ?? '规则文本无效');
  }

  const store = getStore();
  const now = new Date().toISOString();
  const cur = await store.personaConstitutions.get(opts.userId);

  const existingActive = activeRules(cur).length;
  if (existingActive >= MAX_ACTIVE_RULES) {
    throw new Error(
      `已达 active 规则上限 (${MAX_ACTIVE_RULES} 条). 请先归档不再适用的规则.`,
    );
  }

  const rule: ConstitutionRule = {
    id: generateId('crule'),
    text: opts.text.trim(),
    addedAt: now,
    addedBy: opts.addedBy,
  };

  let updated: PersonaConstitution;
  if (!cur) {
    updated = await store.personaConstitutions.create({
      id: opts.userId,
      rules: [rule],
      createdAt: now,
      updatedAt: now,
    });
  } else {
    updated = await store.personaConstitutions.update(opts.userId, {
      rules: [...cur.rules, rule],
      updatedAt: now,
    });
  }

  try {
    await audit('persona.constitution.rule_added', opts.addedBy, {
      targetId: opts.userId,
      targetType: 'persona_constitution',
      metadata: { ruleId: rule.id, text: rule.text },
    });
  } catch {
    /* audit fail-soft */
  }

  return updated;
}

/**
 * 归档一条规则 (软删除, 保留历史).
 */
export async function archiveRule(opts: {
  userId: string;
  ruleId: string;
  archivedBy: string;
  reason?: string;
}): Promise<PersonaConstitution> {
  const store = getStore();
  const cur = await store.personaConstitutions.get(opts.userId);
  if (!cur) {
    throw new Error('constitution 不存在');
  }
  const target = cur.rules.find((r: ConstitutionRule) => r.id === opts.ruleId);
  if (!target) {
    throw new Error(`规则 ${opts.ruleId} 不存在`);
  }
  if (target.archivedAt) {
    return cur; // 已归档, 幂等
  }

  const now = new Date().toISOString();
  const newRules = cur.rules.map((r: ConstitutionRule) =>
    r.id === opts.ruleId
      ? { ...r, archivedAt: now, archivedReason: opts.reason }
      : r,
  );

  const updated = await store.personaConstitutions.update(opts.userId, {
    rules: newRules,
    updatedAt: now,
  });

  try {
    await audit('persona.constitution.rule_archived', opts.archivedBy, {
      targetId: opts.userId,
      targetType: 'persona_constitution',
      metadata: { ruleId: opts.ruleId, reason: opts.reason },
    });
  } catch {
    /* fail-soft */
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Prompt segment
// ---------------------------------------------------------------------------

/**
 * 把 rules 拼成 system prompt 段.
 * 空数组返回空字符串 (调用方判断是否拼接).
 *
 * 输出格式 (硬前置, 标语强):
 *
 *   ## 不可妥协原则 (违反 = 立即重答, 不解释, 不妥协)
 *   1. <text>
 *   2. <text>
 *   ...
 */
export function getConstitutionPromptSegment(rules: ConstitutionRule[]): string {
  const active = rules.filter((r) => !r.archivedAt);
  if (active.length === 0) return '';
  const lines = [
    '## 不可妥协原则 (违反 = 立即重答, 不解释, 不妥协)',
    '',
    '员工已声明以下硬规则. 任何输出违反其中任一条 = 必须重答, 不要争辩, 不要"权衡建议".',
    '',
  ];
  active.forEach((r, idx) => {
    lines.push(`${idx + 1}. ${r.text}`);
  });
  return lines.join('\n');
}
