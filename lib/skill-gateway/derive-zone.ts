/**
 * deriveActionZone · 闸④ Action Scope 的内容判定 (C1 · 组织主权)
 *
 * 修复架构债 (内存 6323a46d / 4881c05e):
 *   旧 `checkActionScope_` 只读 caller 声明的 `actionScope` 字符串 → 退化成
 *   Cowork 式"个人主权"(调用方说是绿区就是绿区, 零内容校验)。
 *   Tandem 是组织主权: zone 必须由**内容 + 委托级别**判定, 不只信声明。
 *
 * 判定 = max(声明 zone, 内容 zone)，再按委托级别二次升级:
 *   - 委托级别不允许 commit/send 的 persona, 做 yellow/red 动作 → 升 red (阻断)
 *
 * 永不抛错: 纯函数, 无 IO。
 */

import type { DelegationLevel } from '../types/persona';

export type ActionZone = 'green' | 'yellow' | 'red';
export type DeclaredActionScope = 'read_only' | 'create_draft' | 'commit' | 'send_external';

export interface DeriveZoneInput {
  /** 调用意图 / 待执行内容 (内容判定的依据) */
  intent: string;
  /** 调用方声明的动作范围 (仍参考, 但不独断) */
  declaredActionScope?: DeclaredActionScope;
  /** persona 的委托级别 (若为 persona 调用), 用于"超出授权即升红"判定 */
  delegationLevel?: DelegationLevel;
}

export interface DeriveZoneResult {
  zone: ActionZone;
  /** 是否因委托级别不足而升级 (persona 越权) */
  exceedsDelegation: boolean;
  /** 人类可读判定原因 (审计 + 调试) */
  reasons: string[];
  /** 内容命中的高敏类别 (red/yellow 触发词归类) */
  matchedCategories: string[];
}

const ZONE_RANK: Record<ActionZone, number> = { green: 0, yellow: 1, red: 2 };

function maxZone(a: ActionZone, b: ActionZone): ActionZone {
  return ZONE_RANK[a] >= ZONE_RANK[b] ? a : b;
}

/**
 * 红区内容 (MANIFESTO §9.2 永久红线 + 对外发送):
 * 命中即红区, 无论声明如何。
 */
const RED_PATTERNS: Array<{ category: string; re: RegExp }> = [
  { category: '对外发送', re: /(发送|发给|发送给|抄送|寄给)\s*(外部|客户|供应商|对方|对外)|对外(发送|发布|公告|声明)|向(客户|外部|供应商)(发送|发出)|external\s+(email|send|recipient)|send\s+(to\s+)?(client|customer|external)/i },
  { category: '薪资', re: /薪资|工资|薪酬|调薪|涨薪|降薪|奖金(下发|发放|核定)|salary|compensation|payroll/i },
  { category: '裁员离职', re: /裁员|解雇|辞退|开除|劝退|离职(辅导|面谈|处理)|裁撤|layoff|terminate|fire\s+employee/i },
  { category: '法律合规', re: /法律(意见|文书|诉讼)|诉讼|起诉|仲裁|合规处罚|违法|legal\s+(advice|action)|lawsuit/i },
  { category: '资金合同', re: /打款|付款|转账|汇款|签署合同|合同(盖章|生效)|放款|wire\s+transfer|sign\s+contract/i },
  { category: '投诉处理', re: /(客户|重大)投诉(处理|回复|定性)|投诉升级|complaint\s+resolution/i },
];

/**
 * 黄区内容 (改企业数据 / 对外承诺): 命中至少升黄。
 */
const YELLOW_PATTERNS: Array<{ category: string; re: RegExp }> = [
  { category: '对外承诺', re: /承诺|保证(交付|赔付)|报价|引用价格|折扣|降价|让利|quote|discount|commitment/i },
  { category: '数据变更', re: /修改|更新|删除|下单|采购|审批(通过|驳回)|调整(预算|计划)|update|delete|create\s+order|approve/i },
];

/** persona 委托级别是否允许 commit (改企业数据) 及以上 */
function delegationAllowsCommit(level?: DelegationLevel): boolean {
  // commit_short / cross_company 允许短承诺/跨企业; observe_only/report_only/soft_opinion 不允许
  return level === 'commit_short' || level === 'cross_company';
}

/**
 * 根据内容 + 声明 + 委托级别, 判定动作 zone。
 */
export function deriveActionZone(input: DeriveZoneInput): DeriveZoneResult {
  const reasons: string[] = [];
  const matchedCategories: string[] = [];

  // 1. 声明 zone (仍作为下限参考)
  const declared = input.declaredActionScope ?? 'read_only';
  let zone: ActionZone =
    declared === 'send_external' ? 'red' : declared === 'commit' ? 'yellow' : 'green';
  reasons.push(`声明动作=${declared} → 基线 zone=${zone}`);

  // 2. 内容判定 (组织主权: 内容说了算, 不只信声明)
  const text = input.intent ?? '';
  let contentZone: ActionZone = 'green';
  for (const { category, re } of RED_PATTERNS) {
    if (re.test(text)) {
      contentZone = 'red';
      matchedCategories.push(`red:${category}`);
    }
  }
  if (contentZone !== 'red') {
    for (const { category, re } of YELLOW_PATTERNS) {
      if (re.test(text)) {
        contentZone = maxZone(contentZone, 'yellow');
        matchedCategories.push(`yellow:${category}`);
      }
    }
  }
  if (matchedCategories.length > 0) {
    reasons.push(`内容命中 [${matchedCategories.join(', ')}] → 内容 zone=${contentZone}`);
  }

  // 3. 取较严者
  zone = maxZone(zone, contentZone);

  // 4. 委托级别二次升级: persona 做了超出授权的 commit/send → 升红 (越权阻断)
  let exceedsDelegation = false;
  if (input.delegationLevel && ZONE_RANK[zone] >= ZONE_RANK['yellow'] && !delegationAllowsCommit(input.delegationLevel)) {
    exceedsDelegation = true;
    zone = 'red';
    reasons.push(
      `委托级别=${input.delegationLevel} 不允许 commit/send, 但动作 zone≥yellow → 越权升 red`,
    );
  }

  return { zone, exceedsDelegation, reasons, matchedCategories };
}
