/**
 * Persona Constitution · 价值观锚 (B-027)
 *
 * MANIFESTO §19 + 五引擎模型 · 引擎 ⑤ 反思 / 防漂移层.
 *
 * "不可妥协原则" — 老板 / 员工显式声明的硬规则, 在每次 system prompt
 * 拼装时硬前置, 防 persona 在长对话中漂走核心立场.
 *
 * 跟 OKR Drift 平级, 但管"性格红线"而不是"目标偏离".
 *
 * 数据落 KvStore collection='persona_constitutions', id=userId.
 */

export interface ConstitutionRule {
  /** 规则唯一 id (短随机串) */
  id: string;
  /** 规则文本 (≤ 200 字, 越短越好, 越具体越好) */
  text: string;
  /** 添加时间 ISO */
  addedAt: string;
  /** 添加人 userId (多数情况 = 员工本人, 少数 admin/steward 代加) */
  addedBy: string;
  /** 归档时间 ISO (软删除) */
  archivedAt?: string;
  /** 归档原因 */
  archivedReason?: string;
}

export interface PersonaConstitution {
  /** id = userId (一对一) */
  id: string;
  /** 现行规则 (active = archivedAt 为空) */
  rules: ConstitutionRule[];
  createdAt: string;
  updatedAt: string;
}

/** 单个 persona 最多 N 条 active 规则 (强制极简) */
export const MAX_ACTIVE_RULES = 10;

/** 单条规则最大长度 */
export const MAX_RULE_TEXT_LENGTH = 200;

/** 取 active rules (未归档) */
export function activeRules(c: PersonaConstitution | null | undefined): ConstitutionRule[] {
  if (!c) return [];
  return c.rules.filter((r) => !r.archivedAt);
}

/** 校验文本 — 抛错 / 返回错误信息 */
export function validateRuleText(text: string): { ok: boolean; reason?: string } {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, reason: '规则文本不能为空' };
  if (trimmed.length > MAX_RULE_TEXT_LENGTH) {
    return { ok: false, reason: `规则文本超长 (${trimmed.length} > ${MAX_RULE_TEXT_LENGTH})` };
  }
  return { ok: true };
}
