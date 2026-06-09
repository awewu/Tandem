/**
 * lib/okr/execution-rollup.ts · OKR 执行联动 (P0·B3 · 2026-06-02)
 *
 * ─────────────────────────────────────────────────────────
 * 解决的断裂 (OKR-EVOLUTION-PLAN §2 "OKRs-E 执行联动 🔴 断裂"):
 *   旧状态: KR 只有 linkedTaskId 字段, Initiative 完成与 KR 进度毫无关系,
 *           执行层 (干活) 与目标层 (KR) 脱节 — 干完活 KR 不动, 还得人手 check-in.
 *
 *   本引擎: Initiative 状态变化 (done/创建/删除) → 重算所属 KR.currentValue
 *           (按完成率) → 复用 B2 propagateRollupFromKr 向上传播到 Objective 链.
 *           执行→目标→顶层 一条龙自动驱动.
 *
 * 安全设计 (防腐蚀人工测量):
 *   - 仅当 KR.autoProgressFromInitiatives === true 或 measureType==='milestone' 才自动驱动.
 *   - 数值型/百分比型 KR 默认不被自动覆盖 (它们由真实业务指标测量, 不该被"任务完成数"篡改).
 *   - fail-soft: 任何异常不阻断 Initiative 本身的增删改.
 */

import {
  type KeyResult,
  type Initiative,
  type Objective,
} from '@/lib/types/okr-tti';
import { eventBus } from '@/lib/events/bus';
import { propagateRollupFromKr, type ObjectiveRollupResult } from '@/lib/okr/rollup';

// ---------------------------------------------------------------------------
// Store 接口 (满足 B2 OkrRollupStore + KR 写 + Initiative 读)
// ---------------------------------------------------------------------------

export interface ExecutionRollupStore {
  objectives: {
    get(id: string): Promise<Objective | null>;
    list(): Promise<Objective[]>;
    update(id: string, patch: Partial<Objective>): Promise<unknown>;
  };
  keyResults: {
    get(id: string): Promise<KeyResult | null>;
    list(): Promise<KeyResult[]>;
    update(id: string, patch: Partial<KeyResult>): Promise<unknown>;
  };
  initiatives: {
    list(): Promise<Initiative[]>;
  };
}

export interface ExecutionRollupResult {
  keyResultId: string;
  /** 旧 currentValue */
  from: number;
  /** 新 currentValue */
  to: number;
  /** done / total 完成率 (0-1) */
  completionRatio: number;
  /** 是否真的改了 KR (变化超 epsilon) */
  changed: boolean;
  /** 连带向上 rollup 的 Objective 链 */
  rolledUp: ObjectiveRollupResult[];
}

const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// §A · 纯计算
// ---------------------------------------------------------------------------

/** KR 是否启用"执行联动自动驱动". */
export function isInitiativeDriven(kr: Pick<KeyResult, 'autoProgressFromInitiatives' | 'measureType'>): boolean {
  return kr.autoProgressFromInitiatives === true || kr.measureType === 'milestone';
}

/**
 * 由 Initiative 完成率算 KR 的目标 currentValue.
 *   completionRatio = done / total (排除 cancelled — 服务端无此态, 故 total = 全部).
 *   currentValue = startValue + ratio * (targetValue - startValue).
 * 返回 null 表示"不应自动驱动" (未开启 或 该 KR 没有任何 Initiative).
 */
export function computeKrCurrentValueFromInitiatives(
  kr: KeyResult,
  initiatives: Initiative[],
): { currentValue: number; completionRatio: number } | null {
  if (!isInitiativeDriven(kr)) return null;
  const relevant = initiatives.filter((i) => i.keyResultId === kr.id);
  if (relevant.length === 0) return null;
  const done = relevant.filter((i) => i.status === 'done').length;
  const ratio = done / relevant.length;
  const currentValue = kr.startValue + ratio * (kr.targetValue - kr.startValue);
  return { currentValue, completionRatio: ratio };
}

// ---------------------------------------------------------------------------
// §B · 联动 (Initiative → KR → 向上 rollup)
// ---------------------------------------------------------------------------

/**
 * 重算单个 KR 的 currentValue (依据其 Initiative 完成率), 若变化则:
 *   1. 写 KR.currentValue
 *   2. 发 okr.kr-progressed (source='initiative')
 *   3. 复用 B2 propagateRollupFromKr 向上传播, 每个被重算 Objective 发 okr.objective-rolled-up
 *
 * @returns null = 该 KR 不参与执行联动; 否则返回结果 (含 changed 标志).
 */
export async function syncKrFromInitiatives(
  keyResultId: string,
  store: ExecutionRollupStore,
  opts?: { actorId?: string; eventIdSuffix?: string },
): Promise<ExecutionRollupResult | null> {
  const kr = await store.keyResults.get(keyResultId);
  if (!kr) return null;

  const allInitiatives = await store.initiatives.list();
  const computed = computeKrCurrentValueFromInitiatives(kr, allInitiatives);
  if (!computed) return null;

  const from = kr.currentValue;
  const to = computed.currentValue;
  const changed = Math.abs(from - to) > EPSILON;

  if (!changed) {
    return { keyResultId, from, to, completionRatio: computed.completionRatio, changed: false, rolledUp: [] };
  }

  await store.keyResults.update(keyResultId, {
    currentValue: to,
    updatedAt: new Date().toISOString(),
  });

  const suffix = opts?.eventIdSuffix ?? `${Date.now()}`;

  void eventBus.emit(
    'okr.kr-progressed',
    {
      krId: keyResultId,
      from,
      to,
      by: opts?.actorId ?? 'system',
      source: 'initiative',
      timestamp: Date.now(),
    },
    `kr-progressed:initiative:${keyResultId}:${suffix}`,
  );

  // 复用 B2: KR→Objective→父O 向上传播 (KR 已写新值, rollup 会读到).
  const rolledUp = await propagateRollupFromKr(keyResultId, store);
  rolledUp.forEach((r, depth) => {
    if (!r.changed) return;
    void eventBus.emit(
      'okr.objective-rolled-up',
      {
        objectiveId: r.objectiveId,
        from: r.from,
        to: r.to,
        triggeredByKrId: keyResultId,
        depth,
        timestamp: Date.now(),
      },
      `objective-rolled-up:initiative:${keyResultId}:${r.objectiveId}:${suffix}`,
    );
  });

  return { keyResultId, from, to, completionRatio: computed.completionRatio, changed: true, rolledUp };
}
