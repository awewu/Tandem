/**
 * Plan-Act Two-Step Confirm · Boss AI / Persona side-effect 操作的两步确认
 *
 * 借鉴 Claude Code Plan Mode (Shift+Tab) + Codex `--approval-mode suggest`:
 *   - 读操作 (search / summarize / query): 不需要 confirm, 直接 act
 *   - 写操作 (改 OKR / 发邮件 / 起草议事 / 升级 Memory): 必须先 Plan 再 Act
 *
 * 与 Tandem 4 件不变量协同:
 *   - 3+1 D humanOnly 是议事场景的 Plan-Act (员工原创)
 *   - 本模块是 Persona 日常对话场景的 Plan-Act (Boss AI 改 OKR 前先 reviewable)
 *
 * 设计哲学:
 *   1. **Plan 是 reviewable artifact**, 必须包含: 意图 / 副作用清单 / rollback hint
 *   2. **Plan 必须有显式过期时间** (默认 5 min), 避免用户隔天点确认踩雷
 *   3. **Confirm 必须用户主动点击**, 不能 auto-confirm (反 AI 欺诈)
 *   4. **审计链**: Plan 记一条 audit, Confirm 记一条 audit, 共享 planId 关联
 */

import { generateId } from '../storage/repository';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SideEffectKind =
  | 'okr.create'
  | 'okr.update'
  | 'okr.delete'
  | 'kr.checkin'
  | 'kr.calibration'
  | 'decision_card.create'
  | 'decision_card.commit'
  | 'memory.propose'
  | 'memory.sign'
  | 'email.send'
  | 'notification.send'
  | 'document.create'
  | 'document.update'
  | 'persona.proxy_action'
  | 'workflow.trigger'
  // 兜底: 任意未列出的写操作走 'other.write' (要求 Plan 显式声明)
  | 'other.write';

/** 行动计划. AI 提交 → 用户审批 → 执行. */
export interface ActionPlan {
  /** 唯一 planId, 关联 Plan + Confirm 两条 audit */
  planId: string;
  /** 谁发起 (Persona ID 或 'boss_ai') */
  initiatedBy: string;
  /** 真人决策者 userId */
  decisionMakerUserId: string;
  /** 1 行人读意图 (≤ 100 字) */
  intent: string;
  /** 副作用清单 (每个 kind 一条简述, e.g. "update Q3 KR 1.2 target 100→105") */
  sideEffects: Array<{
    kind: SideEffectKind;
    description: string;
    /** 可选 rollback hint (e.g. "若误改, 24h 内可在审计链 revert") */
    rollbackHint?: string;
  }>;
  /** Plan 创建时间 (ISO) */
  proposedAt: string;
  /** Plan 过期时间 (默认创建 + 5min), 过期需重新生成 */
  expiresAt: string;
  /** 状态 */
  status: 'pending' | 'confirmed' | 'rejected' | 'expired' | 'executed' | 'failed';
  confirmedAt?: string;
  confirmedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  /** 执行后的回执 (op result) */
  executionResult?: { ok: boolean; data?: unknown; error?: string };
}

/** Plan 默认 TTL (毫秒) */
export const DEFAULT_PLAN_TTL_MS = 5 * 60 * 1000;

/**
 * 判定一个 SideEffectKind 是否需要走 Plan-Act 两步.
 *
 * 当前所有写操作都需要 — 但未来可能某些低风险写 (e.g. notification.send 给本人)
 * 可以跳过. 此函数是单一决策点, 改一处影响全局.
 */
export function requiresTwoStepConfirm(kind: SideEffectKind): boolean {
  // 当前: 所有 write 都要 confirm
  // 例外可放在这里 (e.g. 'notification.send' 给本人时直接放行)
  return true;
}

// ---------------------------------------------------------------------------
// 创建 Plan
// ---------------------------------------------------------------------------

export interface CreatePlanInput {
  initiatedBy: string;
  decisionMakerUserId: string;
  intent: string;
  sideEffects: ActionPlan['sideEffects'];
  /** 自定义 TTL, 默认 5min */
  ttlMs?: number;
}

export function createActionPlan(input: CreatePlanInput): ActionPlan {
  if (!input.intent || input.intent.length === 0) throw new Error('intent 不能为空');
  if (input.intent.length > 100) throw new Error('intent 不能超过 100 字');
  if (input.sideEffects.length === 0) throw new Error('sideEffects 不能为空 (Plan 必须有至少一个副作用)');
  if (input.sideEffects.length > 20) throw new Error('sideEffects 不能超过 20 条 (Plan 复杂度上限)');

  const now = Date.now();
  const ttl = input.ttlMs ?? DEFAULT_PLAN_TTL_MS;
  const planId = `plan_${generateId('p')}`;

  return {
    planId,
    initiatedBy: input.initiatedBy,
    decisionMakerUserId: input.decisionMakerUserId,
    intent: input.intent,
    sideEffects: input.sideEffects.map((s) => ({ ...s })),
    proposedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
    status: 'pending',
  };
}

// ---------------------------------------------------------------------------
// 确认 / 拒绝 / 过期检查
// ---------------------------------------------------------------------------

export function isExpired(plan: ActionPlan, nowMs: number = Date.now()): boolean {
  return new Date(plan.expiresAt).getTime() < nowMs;
}

export function confirmPlan(plan: ActionPlan, confirmedBy: string, nowMs: number = Date.now()): ActionPlan {
  if (plan.status !== 'pending') {
    throw new Error(`Plan ${plan.planId} 当前状态 ${plan.status}, 不能确认`);
  }
  if (isExpired(plan, nowMs)) {
    return { ...plan, status: 'expired' };
  }
  if (confirmedBy !== plan.decisionMakerUserId) {
    throw new Error(
      `Plan ${plan.planId} 只允许 decisionMakerUserId=${plan.decisionMakerUserId} 确认, 不能由 ${confirmedBy} 代签`,
    );
  }
  return {
    ...plan,
    status: 'confirmed',
    confirmedAt: new Date(nowMs).toISOString(),
    confirmedBy,
  };
}

export function rejectPlan(
  plan: ActionPlan,
  rejectedBy: string,
  reason: string,
  nowMs: number = Date.now(),
): ActionPlan {
  if (plan.status !== 'pending') {
    throw new Error(`Plan ${plan.planId} 当前状态 ${plan.status}, 不能拒绝`);
  }
  if (rejectedBy !== plan.decisionMakerUserId) {
    throw new Error(`Plan ${plan.planId} 只允许 decisionMakerUserId 拒绝`);
  }
  if (!reason || reason.length === 0) throw new Error('rejection reason 不能为空');
  return {
    ...plan,
    status: 'rejected',
    rejectedAt: new Date(nowMs).toISOString(),
    rejectedBy,
    rejectionReason: reason,
  };
}

// ---------------------------------------------------------------------------
// 执行 (仅在 status='confirmed' 时调用)
// ---------------------------------------------------------------------------

export type PlanExecutor = (plan: ActionPlan) => Promise<{ ok: boolean; data?: unknown; error?: string }>;

export async function executePlan(plan: ActionPlan, executor: PlanExecutor): Promise<ActionPlan> {
  if (plan.status !== 'confirmed') {
    throw new Error(`Plan ${plan.planId} 必须是 confirmed 状态才能执行 (当前: ${plan.status})`);
  }
  try {
    const result = await executor(plan);
    return {
      ...plan,
      status: result.ok ? 'executed' : 'failed',
      executionResult: result,
    };
  } catch (err) {
    return {
      ...plan,
      status: 'failed',
      executionResult: { ok: false, error: (err as Error).message },
    };
  }
}

// ---------------------------------------------------------------------------
// 序列化 Plan 给 UI / chat (人读)
// ---------------------------------------------------------------------------

export function formatPlanForUser(plan: ActionPlan): string {
  const lines: string[] = [];
  lines.push(`📋 **行动计划** (${plan.planId})`);
  lines.push('');
  lines.push(`**意图**: ${plan.intent}`);
  lines.push('');
  lines.push(`**将执行以下副作用** (${plan.sideEffects.length} 项):`);
  for (let i = 0; i < plan.sideEffects.length; i++) {
    const se = plan.sideEffects[i];
    lines.push(`  ${i + 1}. \`${se.kind}\` — ${se.description}`);
    if (se.rollbackHint) lines.push(`     ↩ ${se.rollbackHint}`);
  }
  lines.push('');
  lines.push(`**过期时间**: ${plan.expiresAt} (默认 5 分钟)`);
  lines.push('');
  lines.push('请点击 [确认执行] 或 [拒绝] (回复拒绝理由).');
  return lines.join('\n');
}
