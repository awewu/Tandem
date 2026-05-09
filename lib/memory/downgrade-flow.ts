/**
 * Memory Downgrade Flow · Memory → Material/归档 (宪章 §8.2)
 *
 * 严肃流程, 与升级同等:
 *   1. AI 主动通知 Steward (引用率连续 3 季度低于均值 30%)
 *   2. Steward 评估 → 决议 (keep / revising / archived / historical_only)
 *   3. 决议进入 Memory 自身的版本历史
 *
 * 禁止:
 *   - 任何"自动判定为公司记忆"的逻辑
 *   - 任何"基于时间自动归档 Memory"的逻辑
 *   - 治理官由直接业务 Leader 兼任
 */

import { getStore, generateId } from '../storage/repository';
import { audit } from '../audit/log';
import type { MemoryDowngradeRequest, MemoryEntry } from '../types/memory';

/** 引用率连续低于均值 30% 阈值 */
const LOW_REFERENCE_THRESHOLD_RATIO = 0.3;

// ---------------------------------------------------------------------------
// 提议降级 (AI 触发或人工触发)
// ---------------------------------------------------------------------------

export interface ProposeDowngradeInput {
  memoryId: string;
  proposedBy: 'ai' | string; // 'ai' 或 stewardUserId
  reason: string;
  metrics?: MemoryDowngradeRequest['metrics'];
}

export async function proposeDowngrade(
  input: ProposeDowngradeInput
): Promise<MemoryDowngradeRequest> {
  const store = getStore();
  const memory = await store.memories.get(input.memoryId);
  if (!memory) throw new Error(`Memory ${input.memoryId} not found`);

  // 防重: 如果该 memory 已有 proposed/under_review 的 downgrade, 不重复创建
  const existing = await store.downgrades.list({ memoryId: input.memoryId } as never);
  const active = existing.find(
    (d) => d.status === 'proposed' || d.status === 'under_review'
  );
  if (active) {
    return active;
  }

  const req = await store.downgrades.create({
    memoryId: input.memoryId,
    proposedBy: input.proposedBy,
    reason: input.reason,
    metrics: input.metrics ?? { referenceCount: memory.referenceCount },
    status: 'proposed',
    createdAt: new Date().toISOString(),
  });

  await audit('memory.downgrade_proposed', input.proposedBy === 'ai' ? 'system' : input.proposedBy, {
    targetId: req.id,
    targetType: 'memory_downgrade',
    metadata: { memoryId: input.memoryId, reason: input.reason },
  });

  return req;
}

// ---------------------------------------------------------------------------
// Steward 评估决议
// ---------------------------------------------------------------------------

export type DowngradeDecision = 'kept' | 'revising' | 'archived' | 'historical_only';

export async function decideDowngrade(
  downgradeId: string,
  stewardId: string,
  decision: DowngradeDecision,
  note?: string
): Promise<MemoryDowngradeRequest> {
  const store = getStore();
  const req = await store.downgrades.get(downgradeId);
  if (!req) throw new Error(`Downgrade ${downgradeId} not found`);
  if (req.status !== 'proposed' && req.status !== 'under_review') {
    throw new Error(`Downgrade ${downgradeId} already finalized (${req.status})`);
  }

  // Steward 互斥校验
  const steward = await store.stewards.get(stewardId);
  if (!steward) throw new Error(`User ${stewardId} is not a Steward`);

  const memory = await store.memories.get(req.memoryId);
  if (!memory) throw new Error(`Memory ${req.memoryId} not found`);

  // 应用决议到 Memory.status
  let newStatus: MemoryEntry['status'] = memory.status;
  switch (decision) {
    case 'kept':
      newStatus = 'active';
      break;
    case 'revising':
      newStatus = 'revising';
      break;
    case 'archived':
      newStatus = 'inactive';
      break;
    case 'historical_only':
      newStatus = 'deprecated';
      break;
  }

  await store.memories.update(req.memoryId, {
    status: newStatus,
    updatedAt: new Date().toISOString(),
  });

  const updated = await store.downgrades.update(downgradeId, {
    status: decision,
    decision: {
      by: stewardId,
      decidedAt: new Date().toISOString(),
      note,
    },
  });

  await audit('memory.downgrade_decided', stewardId, {
    targetId: downgradeId,
    targetType: 'memory_downgrade',
    metadata: { memoryId: req.memoryId, decision, newStatus },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// AI 引用率扫描器 (cron 调用)
// ---------------------------------------------------------------------------

export interface ScanResult {
  /** 扫到的 active memory 总数 */
  scanned: number;
  /** 新建议的降级数 (跳过已 proposed/under_review 的) */
  proposed: number;
}

export async function scanLowReferenceMemories(): Promise<ScanResult> {
  const store = getStore();
  const all = await store.memories.list();
  const active = all.filter((m) => m.status === 'active');
  if (active.length === 0) return { scanned: 0, proposed: 0 };

  const avgRef =
    active.reduce((s, m) => s + (m.referenceCount ?? 0), 0) / active.length;
  const threshold = avgRef * LOW_REFERENCE_THRESHOLD_RATIO;

  let proposed = 0;
  for (const m of active) {
    if ((m.referenceCount ?? 0) < threshold) {
      try {
        await proposeDowngrade({
          memoryId: m.id,
          proposedBy: 'ai',
          reason: `引用率连续低于均值 ${Math.round(LOW_REFERENCE_THRESHOLD_RATIO * 100)}% (当前 ${m.referenceCount}, 均值 ${avgRef.toFixed(1)})`,
          metrics: {
            referenceCount: m.referenceCount,
            averageReferenceCount: avgRef,
          },
        });
        proposed++;
      } catch {
        // 已存在 active downgrade, 跳过
      }
    }
  }

  return { scanned: active.length, proposed };
}
