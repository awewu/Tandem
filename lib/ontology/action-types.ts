/**
 * lib/ontology/action-types.ts · 声明式 Action Type 引擎类型 + 注册中心 (ON-1 · 2026-06-09)
 *
 * ─────────────────────────────────────────────────────────
 * 学 Palantir Foundry Action 的**真实工程机制** (剥营销, 见 docs/ONTOLOGY-CENTRAL-BRAIN.md §8):
 *   Action = 参数 + submission criteria(前置业务校验) + edits(主写) + security rules(zone闸) +
 *            声明式副作用 (统一编排, 各自幂等 + fail-soft)。
 *
 * 与现有治理资产对齐 (不另起炉灶):
 *   - zone 判定复用 `lib/skill-gateway/derive-zone.ts deriveActionZone` (内容+委托级别, 组织主权)。
 *   - 审计走 `lib/audit/log.ts` (ontology.action_executed / action_blocked)。
 *
 * 铁律 (docs/ONTOLOGY §2): AI 写动作 fail-closed — 红区永不自动执行; proxy 黄区+ 暂拦 (ON-2 加 24h 否决窗)。
 */

import type { DeclaredActionScope } from '@/lib/skill-gateway/derive-zone';
import type { DelegationLevel } from '@/lib/types/persona';

export type ActionZone = 'green' | 'yellow' | 'red';

/** 动作执行上下文 (谁、是否 AI 代行、租户、委托级别) */
export interface ActionContext {
  /** 调用方 userId */
  actorUserId: string;
  /** 是否 AI 代行 (persona/autonomous 触发, 非用户直接点) */
  isProxy: boolean;
  tenantId?: string;
  /** demo 模式放行 (与 API requireAuth.demo 一致) */
  demo?: boolean;
  /** proxy 委托级别 (derive-zone 越权升红判定) */
  delegationLevel?: DelegationLevel;
  /**
   * ON-2: 该 (代行) 动作已经过审批 / 24h 否决窗 (人审通过或窗口静默通过)。
   * true 时执行闸跳过"AI 代行黄区+暂拦" (审批即授权); 红区仍永不放行。
   * 仅由 lib/ontology/propose-action.ts 的兑现路径设置, 业务代码不应直接传 true。
   */
  approved?: boolean;
}

/** 校验结果。code 供调用方映射 HTTP: not_found→404 / forbidden→403 / invalid→400 */
export interface ValidationResult {
  ok: boolean;
  errors: string[];
  code?: 'not_found' | 'forbidden' | 'invalid';
}

/** 单个副作用的执行结果 (审计 + lineage 数据载体) */
export interface SideEffectOutcome {
  name: string;
  ok: boolean;
  error?: string;
  /** 副作用产出 (如 rollup lineage), 供调用方读取 */
  data?: unknown;
}

/**
 * 声明式副作用: 主写成功后按声明顺序执行, 各自 fail-soft (不回滚主写, 记 warning)。
 * 幂等责任在 run 内部 (如 eventBus.emit 带幂等键)。
 */
export interface SideEffect<TResult = unknown> {
  name: string;
  run: (result: TResult, ctx: ActionContext) => Promise<unknown>;
}

/**
 * Action Type 定义 = 一类受治理写动作的统一声明。
 */
export interface ActionType<TInput = unknown, TResult = unknown> {
  /** 唯一 id, 形如 'kr.checkin' */
  id: string;
  /** 操作的对象类型 (锚到 ontology ObjectType) */
  objectType: string;
  label: string;
  /** derive-zone 声明动作范围 (写动作通常 'commit'); 内容+委托仍可升级 */
  declaredActionScope: DeclaredActionScope;
  /** 生成给 derive-zone 内容判定的意图文本 */
  describeIntent: (input: TInput) => string;
  /** 输入校验 + 业务前置 (submission criteria); 可异步读 store */
  validate: (input: TInput, ctx: ActionContext) => Promise<ValidationResult> | ValidationResult;
  /** 主写 (核心 edit) */
  execute: (input: TInput, ctx: ActionContext) => Promise<TResult>;
  /** 声明式副作用 (统一编排) */
  sideEffects: SideEffect<TResult>[];
}

// ---------------------------------------------------------------------------
// Action 注册中心 (单例挂 globalThis 防 HMR, 仿 skillRegistry / ontology registry)
// ---------------------------------------------------------------------------

class ActionRegistry {
  private actions = new Map<string, ActionType>();

  register<I, R>(action: ActionType<I, R>): void {
    this.actions.set(action.id, action as unknown as ActionType);
  }

  unregister(id: string): boolean {
    return this.actions.delete(id);
  }

  clear(): void {
    this.actions.clear();
  }

  has(id: string): boolean {
    return this.actions.has(id);
  }

  get(id: string): ActionType | undefined {
    return this.actions.get(id);
  }

  list(): ActionType[] {
    return Array.from(this.actions.values());
  }

  size(): number {
    return this.actions.size;
  }
}

const _g = globalThis as typeof globalThis & { __tandem_action_registry__?: ActionRegistry };
if (!_g.__tandem_action_registry__) {
  _g.__tandem_action_registry__ = new ActionRegistry();
}
export const actionRegistry: ActionRegistry = _g.__tandem_action_registry__;
export type { ActionRegistry };
