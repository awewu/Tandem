/**
 * 邮件过滤规则引擎 (纯函数, 可测) — "来自 X → 归档/标记/打标签"
 *
 * 规则在收件箱加载时或手动"运行规则"时, 对邮件求值并执行动作 (标记已读/星标/移动/删除/打标签)。
 * 求值逻辑与副作用 (IMAP 操作) 分离: 本模块只负责"匹配 + 归并动作", 副作用由 API 层执行。
 */

export interface MailRuleConditions {
  fromContains?: string;
  toContains?: string;
  subjectContains?: string;
}

export interface MailRuleActions {
  markRead?: boolean;
  star?: boolean;
  /** 移动到指定文件夹 (如 Archive / Trash / 自定义) */
  moveTo?: string;
  /** 打标签 (标签 id) */
  addLabel?: string;
  /** 直接删除 (移入垃圾箱) — 与 moveTo 互斥, delete 优先 */
  delete?: boolean;
}

export interface MailRule {
  id: string;
  name: string;
  enabled: boolean;
  /** all: 所有条件都满足; any: 任一条件满足 */
  match: 'all' | 'any';
  conditions: MailRuleConditions;
  actions: MailRuleActions;
}

export interface RuleEvaluableEmail {
  uid: number;
  from: { name?: string; address: string }[];
  to: { name?: string; address: string }[];
  subject: string;
}

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function joinAddrs(list: { name?: string; address: string }[]): string {
  return list.map((a) => `${a.name ?? ''} ${a.address}`).join(' ');
}

/** 单条规则是否命中某封邮件 */
export function ruleMatches(rule: MailRule, email: RuleEvaluableEmail): boolean {
  if (!rule.enabled) return false;
  const checks: boolean[] = [];
  const c = rule.conditions;
  if (c.fromContains?.trim()) checks.push(contains(joinAddrs(email.from), c.fromContains.trim()));
  if (c.toContains?.trim()) checks.push(contains(joinAddrs(email.to), c.toContains.trim()));
  if (c.subjectContains?.trim()) checks.push(contains(email.subject ?? '', c.subjectContains.trim()));
  if (checks.length === 0) return false; // 无有效条件的规则不匹配任何邮件 (避免误伤)
  return rule.match === 'all' ? checks.every(Boolean) : checks.some(Boolean);
}

export interface AppliedAction {
  uid: number;
  ruleId: string;
  ruleName: string;
  actions: MailRuleActions;
}

/**
 * 对一批邮件求值一组规则。规则按顺序求值, 每封邮件命中第一条匹配规则即停止 (Gmail 风格短路),
 * 返回每封被命中邮件应执行的动作。
 */
export function evaluateRules(rules: MailRule[], emails: RuleEvaluableEmail[]): AppliedAction[] {
  const enabled = rules.filter((r) => r.enabled);
  const results: AppliedAction[] = [];
  for (const email of emails) {
    for (const rule of enabled) {
      if (ruleMatches(rule, email)) {
        results.push({ uid: email.uid, ruleId: rule.id, ruleName: rule.name, actions: rule.actions });
        break; // 短路: 一封邮件仅应用首条命中规则
      }
    }
  }
  return results;
}

/** 校验/规整用户提交的规则数组 (剔除非法项, 保证结构完整) */
export function sanitizeRules(input: unknown): MailRule[] {
  if (!Array.isArray(input)) return [];
  const out: MailRule[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === 'string' && r.id ? r.id : `rule_${Date.now()}_${out.length}`;
    const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : '未命名规则';
    const match = r.match === 'any' ? 'any' : 'all';
    const cond = (r.conditions ?? {}) as Record<string, unknown>;
    const act = (r.actions ?? {}) as Record<string, unknown>;
    const conditions: MailRuleConditions = {
      fromContains: typeof cond.fromContains === 'string' ? cond.fromContains : undefined,
      toContains: typeof cond.toContains === 'string' ? cond.toContains : undefined,
      subjectContains: typeof cond.subjectContains === 'string' ? cond.subjectContains : undefined,
    };
    const actions: MailRuleActions = {
      markRead: !!act.markRead,
      star: !!act.star,
      moveTo: typeof act.moveTo === 'string' && act.moveTo.trim() ? act.moveTo.trim() : undefined,
      addLabel: typeof act.addLabel === 'string' && act.addLabel.trim() ? act.addLabel.trim() : undefined,
      delete: !!act.delete,
    };
    out.push({ id, name, enabled: r.enabled !== false, match, conditions, actions });
  }
  return out;
}
