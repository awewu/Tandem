// =============================================================
// Objective 生命周期 / 审批漏斗 (对标 Tita "目标审批")
// -------------------------------------------------------------
// 纯逻辑, 无副作用, 无 store/网络依赖 — 便于单测锁定契约.
//
// 状态机:
//   draft(草稿) ──submit──▶ submitted(待审批)
//   submitted ──approve──▶ active(进行中)
//   submitted ──reject──▶ draft(打回)
//   draft / active / paused ──▶ archived(放弃)      [owner 可直接弃置草稿/在途]
//   active ⇄ paused
//   active / paused ──▶ completed(完成)
//
// 注意: 这里的 ObjectiveStatus 取客户端枚举 (archived, 非服务端 abandoned).
// =============================================================

import type { ObjectiveStatus } from '@/lib/store/okr';

/** 审批漏斗动作 */
export type LifecycleAction = 'submit' | 'approve' | 'reject' | 'pause' | 'resume' | 'complete' | 'archive';

/** 谁有资格执行某动作 (与具体用户解耦, 调用方据角色判定) */
export type LifecycleActor = 'owner' | 'approver';

interface TransitionRule {
  from: ObjectiveStatus;
  to: ObjectiveStatus;
  /** 哪些角色可触发. owner=目标负责人; approver=其上级/审批人 */
  actors: LifecycleActor[];
  label: string;
}

/** 单一真值: 全部合法迁移. UI 与校验都从这里派生, 防漂移. */
export const TRANSITIONS: Record<LifecycleAction, TransitionRule> = {
  submit:   { from: 'draft',     to: 'submitted', actors: ['owner'],            label: '提交审批' },
  approve:  { from: 'submitted', to: 'active',    actors: ['approver'],         label: '通过' },
  reject:   { from: 'submitted', to: 'draft',     actors: ['approver'],         label: '打回' },
  pause:    { from: 'active',    to: 'paused',    actors: ['owner', 'approver'], label: '暂停' },
  resume:   { from: 'paused',    to: 'active',    actors: ['owner', 'approver'], label: '恢复' },
  complete: { from: 'active',    to: 'completed', actors: ['owner', 'approver'], label: '完成' },
  archive:  { from: 'draft',     to: 'archived',  actors: ['owner'],            label: '放弃' },
};

// archive 实际可从多个状态触发 (draft/active/paused); TRANSITIONS 表里只放主入口,
// 完整来源在这里声明, 由 canTransition 校验.
const ARCHIVE_SOURCES: ObjectiveStatus[] = ['draft', 'active', 'paused'];
const COMPLETE_SOURCES: ObjectiveStatus[] = ['active', 'paused'];

/** 该动作允许的全部来源状态 (含上面的多来源扩展) */
function sourcesFor(action: LifecycleAction): ObjectiveStatus[] {
  if (action === 'archive') return ARCHIVE_SOURCES;
  if (action === 'complete') return COMPLETE_SOURCES;
  return [TRANSITIONS[action].from];
}

/** 给定动作 + 当前状态 + 执行者角色, 是否允许. */
export function canTransition(
  action: LifecycleAction,
  current: ObjectiveStatus,
  actor: LifecycleActor,
): boolean {
  const rule = TRANSITIONS[action];
  if (!rule) return false;
  if (!sourcesFor(action).includes(current)) return false;
  return rule.actors.includes(actor);
}

/** 执行动作后的目标状态 (不做校验; 校验请先调 canTransition). */
export function applyTransition(action: LifecycleAction): ObjectiveStatus {
  return TRANSITIONS[action].to;
}

/**
 * 反查: 给定 (来源状态 → 目标状态), 返回对应的合法动作, 无匹配返回 null.
 * (from,to) 组合在 TRANSITIONS + 多来源扩展下唯一, 故可无歧义反查.
 * 供服务端据"目标状态变更"推断动作再做角色校验 (客户端只发 status, 不发 action).
 */
export function findLifecycleAction(
  from: ObjectiveStatus,
  to: ObjectiveStatus,
): LifecycleAction | null {
  for (const action of Object.keys(TRANSITIONS) as LifecycleAction[]) {
    if (TRANSITIONS[action].to === to && sourcesFor(action).includes(from)) {
      return action;
    }
  }
  return null;
}

/**
 * 服务端权威校验: 给定状态变更 (from→to) 与执行者持有的角色集, 判定是否放行.
 *   - invalid_transition: (from,to) 不是任何合法生命周期迁移.
 *   - forbidden: 是合法迁移, 但执行者角色无权触发 (例: owner 试图自己 approve).
 * 单一真值, 与前端 ApprovalActions 走同一状态机, 杜绝"闸只在前端"。
 */
export function authorizeStatusChange(
  from: ObjectiveStatus,
  to: ObjectiveStatus,
  actors: LifecycleActor[],
): { ok: true; action: LifecycleAction } | { ok: false; reason: 'invalid_transition' | 'forbidden' } {
  const action = findLifecycleAction(from, to);
  if (!action) return { ok: false, reason: 'invalid_transition' };
  const allowed = actors.some((a) => canTransition(action, from, a));
  return allowed ? { ok: true, action } : { ok: false, reason: 'forbidden' };
}

/** 当前状态 + 角色下可执行的全部动作 (供 UI 渲染按钮). */
export function availableActions(
  current: ObjectiveStatus,
  actor: LifecycleActor,
): LifecycleAction[] {
  return (Object.keys(TRANSITIONS) as LifecycleAction[]).filter((a) =>
    canTransition(a, current, actor),
  );
}

/** 是否处于审批漏斗中 (草稿/待审批) — 这类目标尚未正式生效, 不计入执行口径. */
export function isPreActive(status: ObjectiveStatus): boolean {
  return status === 'draft' || status === 'submitted';
}

/** 状态中文标签 (UI 徽标统一来源). */
export const STATUS_LABEL: Record<ObjectiveStatus, string> = {
  draft: '草稿',
  submitted: '待审批',
  active: '进行中',
  paused: '已暂停',
  completed: '已完成',
  archived: '已放弃',
};
