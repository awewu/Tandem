/**
 * KPI Cycle Domain Repository
 *
 * 按 CHARTER-TECH-v2 §T3 重构: 接口反映业务动作, 不是 CRUD.
 * 不可暴露 generic update() — 状态迁移必须走显式方法.
 *
 * 三态状态机:
 *   draft  ──activate──►  active  ──close──►  closed
 *                            ▲
 *                       (targets locked at activation)
 *
 * 不变量 (类型系统 + 实现层共同保证):
 *   1. activate(id) 时若 cycle 已 active 或 closed → 抛错
 *   2. close(id) 时若 cycle 仍 draft 或已 closed → 抛错
 *   3. close(id) 时如果有未 commit 的 bonus payout → 抛错 (除非 force=true)
 *   4. 任何 mutation 必须带上 actorId, 由实现层写 audit log
 */

import type { KpiCycle } from '@/lib/types/kpi';

export interface DraftCycleCmd {
  fiscalYear: number;
  name: string;
  startDate: string;
  endDate: string;
  tenantId: string;
  actorId: string;
}

export interface ActivateCycleCmd {
  cycleId: string;
  actorId: string;
  /** ISO 时刻; 默认 now() */
  lockTargetsAt?: string;
}

export interface CloseCycleCmd {
  cycleId: string;
  actorId: string;
  /** 跳过 "所有 bonus assignee 已下发" 校验 (admin escape hatch) */
  force?: boolean;
}

export type CloseCycleResult =
  | { ok: true; cycle: KpiCycle }
  | { ok: false; reason: 'precondition_failed'; missingAssignees: string[] }
  | { ok: false; reason: 'invalid_state'; current: KpiCycle['status'] };

export interface KpiCycleRepository {
  /** 单条查询 (跨 tenant 调用方需自校验) */
  findById(id: string): Promise<KpiCycle | null>;

  /** 按 tenant 查全部周期 (用于下拉) */
  findByTenant(tenantId: string): Promise<KpiCycle[]>;

  /** 按 tenant + 状态精确查 */
  findActiveByTenant(tenantId: string): Promise<KpiCycle[]>;

  /** 创建 draft (status 写死 draft, 不可由调用方传) */
  draft(cmd: DraftCycleCmd): Promise<KpiCycle>;

  /**
   * draft → active. 锁 targets.
   * 若已 active/closed: 抛 InvalidStateTransition.
   */
  activate(cmd: ActivateCycleCmd): Promise<KpiCycle>;

  /**
   * active → closed.
   * 校验所有 bonus KPI 的 assignee 都有 committed payout (除非 force).
   * 返回 sealed result, 调用方根据 ok 字段分支处理.
   */
  close(cmd: CloseCycleCmd): Promise<CloseCycleResult>;
}

export class InvalidStateTransition extends Error {
  constructor(
    public readonly current: KpiCycle['status'],
    public readonly attempted: 'activate' | 'close',
  ) {
    super(`KpiCycle in state "${current}" cannot ${attempted}`);
    this.name = 'InvalidStateTransition';
  }
}
