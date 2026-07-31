/**
 * lib/ontology/marking.ts · 本体安全维度: 数据密级标记 (marking) + 基于目的的访问 (purpose)
 * ─────────────────────────────────────────────────────────
 * 借 Palantir Foundry「安全成一等本体维度」的工程洞见 (剥营销):
 *   - **Marking (密级标记)**: 挂在数据/对象上的分类标签 (敏感度 + 类别)。
 *   - **Purpose (访问目的)**: 访问的理由; 某些类别数据只允许为特定目的读取。
 *   访问放行 = 敏感度 ≤ 主体许可 且 数据类别未被该 purpose 禁止 且 (外部主体不得触碰机密+)。
 *
 * 本片 = 纯原语 + 纯门控函数, **零副作用、零行为变更** (无消费方调用前不改变任何流程),
 * 镜像 ontology object-types 的加法上线方式。Phase 2 起才把 canAccess 接进感知/写动作层。
 *
 * 为什么现在做: 中央 AI 已能一次感知 OKR+KPI+人才+奖金+销售 五维真值 + 提议写动作,
 *   却无数据密级维度 —— 「决策防火墙」(个人成长上下文不得流入 OKR/议事) 此前是散落约束,
 *   这里升级成可复用的**数据级策略** (personal_growth 类别对治理类 purpose 恒禁)。
 *
 * 不变量: 纯函数, 无 IO, 永不抛错。
 */

// ── 敏感度 (有序等级; 数字越大越敏感) ────────────────────────────────
export type Sensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

export const SENSITIVITY_RANK: Record<Sensitivity, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

// ── 数据类别 (与敏感度正交的语义标签; 供 purpose 策略精确门控) ──────────
export type MarkingCategory =
  | 'pii' // 个人身份信息
  | 'financial' // 财务/经营金额
  | 'compensation' // 薪酬/奖金 (MANIFESTO §9.2 永久红线)
  | 'external_scoped' // 外部可见域受限 (经销商/客户数据, 按 org 隔离)
  | 'personal_growth'; // 个人成长上下文 (手抄/拿捏/记事本 — 决策防火墙密封)

/** 一个 marking = 敏感度 + 若干类别标签。 */
export interface Marking {
  sensitivity: Sensitivity;
  categories?: MarkingCategory[];
}

// ── 访问目的 ──────────────────────────────────────────────────────────
export type Purpose =
  | 'okr_perception' // 中央 AI 感知 OKR/经营真值
  | 'governance' // 治理/议事/决策
  | 'reporting' // 报表/分析看板
  | 'ai_advice' // AI 建议 (驾驶舱下一步等)
  | 'personal_assistant'; // 员工个人分身助理

/**
 * Purpose → 禁止类别策略 (数据级「防火墙」)。
 *   命中禁止类别即拒 (无论敏感度是否够), 把散落的语义约束固化成不变量:
 *   - 决策防火墙: personal_growth 恒不得为 治理/OKR感知/报表 目的读取。
 *   - 薪酬红线: compensation 不得进 OKR感知/报表/个人助理 (仅 governance 走人审流程)。
 */
const PURPOSE_FORBIDDEN_CATEGORIES: Record<Purpose, MarkingCategory[]> = {
  okr_perception: ['personal_growth', 'compensation'],
  governance: ['personal_growth'],
  reporting: ['personal_growth', 'compensation'],
  ai_advice: ['personal_growth', 'compensation'],
  personal_assistant: ['compensation', 'financial'],
};

/** 访问主体上下文。 */
export interface AccessContext {
  /** 主体许可等级 (可读到的最高敏感度) */
  clearance: Sensitivity;
  /** 访问目的 */
  purpose: Purpose;
  /** 是否外部主体 (guest/partner/contractor/经销商) */
  isExternal?: boolean;
}

export interface AccessDecision {
  allow: boolean;
  reason: string;
}

/**
 * 核心门控: 给定数据 marking + 主体上下文, 判定是否可读。fail-closed 语义由调用方决定
 * (本函数只给判定; 但设计上倾向拒绝: 未知从严)。
 */
export function canAccess(marking: Marking | undefined, ctx: AccessContext): AccessDecision {
  // 无 marking = 未分类 → 视为 internal 保守处理 (不当作 public)
  const sensitivity = marking?.sensitivity ?? 'internal';
  const categories = marking?.categories ?? [];

  // ① 外部主体不得触碰 confidential 及以上
  if (ctx.isExternal && SENSITIVITY_RANK[sensitivity] >= SENSITIVITY_RANK.confidential) {
    return { allow: false, reason: `外部主体不可访问 ${sensitivity} 数据` };
  }

  // ② 敏感度必须 ≤ 主体许可
  if (SENSITIVITY_RANK[sensitivity] > SENSITIVITY_RANK[ctx.clearance]) {
    return { allow: false, reason: `敏感度 ${sensitivity} 超出主体许可 ${ctx.clearance}` };
  }

  // ③ 目的禁止类别 (数据防火墙; 无论敏感度)
  const forbidden = PURPOSE_FORBIDDEN_CATEGORIES[ctx.purpose] ?? [];
  const hit = categories.find((c) => forbidden.includes(c));
  if (hit) {
    return { allow: false, reason: `类别 ${hit} 不得为目的 ${ctx.purpose} 读取 (数据防火墙)` };
  }

  return { allow: true, reason: 'ok' };
}

/**
 * 结果集脱敏辅助: 按 marking 过滤掉主体不可读的条目 (Phase 2 感知层用)。
 * getMarking 从每个条目取其 marking (可返回 undefined = 未分类)。
 */
export function redactByMarking<T>(
  items: T[],
  getMarking: (item: T) => Marking | undefined,
  ctx: AccessContext,
): { allowed: T[]; redactedCount: number } {
  const allowed: T[] = [];
  let redactedCount = 0;
  for (const item of items) {
    if (canAccess(getMarking(item), ctx).allow) allowed.push(item);
    else redactedCount += 1;
  }
  return { allowed, redactedCount };
}
