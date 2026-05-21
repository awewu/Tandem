/**
 * Audit Log · 审计日志
 *
 * 用途: 不可篡改记录所有关键事件 (议事室决议 / Persona 升级 / Memory 签批 / 数据导出 / etc)
 *
 * 等保二级 + GDPR / PIPL 合规所需.
 */

import { createHash } from 'crypto';

export type AuditAction =
  // 议事室
  | 'convergence.start'
  | 'convergence.option_picked'
  | 'convergence.commit'
  | 'convergence.escalate'
  | 'convergence.veto'
  // Persona
  | 'persona.create'
  | 'persona.upgrade'
  | 'persona.downgrade'
  | 'persona.proxy_action'
  // Memory
  | 'memory.promotion_proposed'
  | 'memory.promotion_signed'
  | 'memory.promotion_approved'
  | 'memory.promotion_rejected'
  | 'memory.promotion_escalated'
  | 'memory.promotion_overdue_lv3'
  | 'memory.downgrade_proposed'
  | 'memory.downgrade_decided'
  | 'memory.entry_revised'
  | 'memory.entry_archived'
  // Data ownership
  | 'data.export_origin'
  | 'data.delete_personal'
  | 'data.anonymize_persona'
  // 决议事件
  | 'decision_card.create'
  | 'decision_card.update'
  | 'decision_card.veto'
  // 系统
  | 'system.provider_health_failed'
  | 'system.provider_switch'
  // Skill / Agent (CircleBot 对齐)
  | 'skill.executed'
  | 'skill.blocked_red_zone'
  | 'skill.blocked_governance'
  | 'agent.spawned'
  | 'agent.completed'
  | 'budget.exceeded'
  // KPI 体系 (CHARTER-KPI-TTI §2)
  | 'kpi.cycle_created'
  | 'kpi.cycle_activated'        // targetValue 锁死时刻
  | 'kpi.cycle_closed'           // 年终关闭
  | 'kpi.subject_changed'        // 科目主数据 CRUD
  | 'kpi.target_set'             // 通道 A: target/weight 设置
  | 'kpi.target_locked'          // 周期 active 后 target 不可改
  | 'kpi.actuals_imported_erp'   // 通道 B: ERP 自动采集
  | 'kpi.actuals_manual_entry'   // 通道 C: 财务/HR/内勤人工补录
  | 'kpi.scope_locked'           // bonus/monitor frozen
  | 'kpi.excel_imported'         // Excel 批量导入
  | 'kpi.excel_exported'         // Excel 导出
  | 'kpi.year_end_close';        // 绩效奖金年终关闭

export interface AuditEntry {
  id: string;
  action: AuditAction;
  /** 触发用户 (可能是 system) */
  actorId: string;
  /** 受影响实体 ID */
  targetId?: string;
  /** 类型 (如 'decision_card', 'persona', ...) */
  targetType?: string;
  /** 自由 metadata */
  metadata?: Record<string, unknown>;
  /** 不可篡改时间戳 */
  timestamp: string;
  /** 链式哈希 (前一条 hash + 本条 payload) */
  hash: string;
  prevHash?: string;
}

/**
 * SHA-256 链式哈希. 任何条目被改动 → 该条 hash 与其后所有 prevHash 链不上.
 * 与等保二级 / GDPR / PIPL 的"不可篡改证据"要求对齐.
 */
function hashEntry(entry: Omit<AuditEntry, 'hash'>): string {
  // Use stable JSON serialization (key order is deterministic for plain objects
  // built from a fixed shape, which is our case in append()).
  const text = JSON.stringify(entry);
  return createHash('sha256').update(text).digest('hex');
}

class AuditLog {
  private entries: AuditEntry[] = [];

  async append(
    action: AuditAction,
    actorId: string,
    options: {
      targetId?: string;
      targetType?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<AuditEntry> {
    const prev = this.entries[this.entries.length - 1];
    const skeleton = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action,
      actorId,
      targetId: options.targetId,
      targetType: options.targetType,
      metadata: options.metadata,
      timestamp: new Date().toISOString(),
      prevHash: prev?.hash,
    };
    const entry: AuditEntry = { ...skeleton, hash: hashEntry(skeleton) };
    this.entries.push(entry);
    return entry;
  }

  async list(filter?: { actorId?: string; action?: AuditAction; targetId?: string }): Promise<AuditEntry[]> {
    let result = this.entries;
    if (filter?.actorId) result = result.filter((e) => e.actorId === filter.actorId);
    if (filter?.action) result = result.filter((e) => e.action === filter.action);
    if (filter?.targetId) result = result.filter((e) => e.targetId === filter.targetId);
    return result;
  }

  /** 验证完整性 (任何篡改会让 hash 链断裂) */
  async verify(): Promise<{ ok: boolean; brokenAt?: number }> {
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      const expectedPrev = i === 0 ? undefined : this.entries[i - 1].hash;
      if (e.prevHash !== expectedPrev) {
        return { ok: false, brokenAt: i };
      }
      const { hash: _omit, ...rest } = e;
      void _omit;
      const recomputed = hashEntry(rest);
      if (recomputed !== e.hash) {
        return { ok: false, brokenAt: i };
      }
    }
    return { ok: true };
  }
}

// 单例挂 globalThis 防 Next.js dev HMR 重置 (与 lib/storage/repository.ts 同一模式)
const _g = globalThis as typeof globalThis & { __tandem_audit_log__?: AuditLog };

export function getAuditLog(): AuditLog {
  if (!_g.__tandem_audit_log__) _g.__tandem_audit_log__ = new AuditLog();
  return _g.__tandem_audit_log__;
}

export async function audit(
  action: AuditAction,
  actorId: string,
  options?: { targetId?: string; targetType?: string; metadata?: Record<string, unknown> }
): Promise<AuditEntry> {
  return getAuditLog().append(action, actorId, options ?? {});
}
