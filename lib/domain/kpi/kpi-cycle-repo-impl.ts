/**
 * KpiCycleRepository 默认实现
 *
 * 包装现有的 storage Repository<KpiCycle> + 业务校验 + audit log.
 * 这是 Onion Service 层应该看到的接口 (而不是 raw kvStore).
 */

import { getStore } from '@/lib/storage/repository';
import { audit } from '@/lib/audit/log';
import type { KpiCycle } from '@/lib/types/kpi';
import {
  type KpiCycleRepository,
  type DraftCycleCmd,
  type ActivateCycleCmd,
  type CloseCycleCmd,
  type CloseCycleResult,
  InvalidStateTransition,
} from './kpi-cycle-repo';

export const kpiCycleRepo: KpiCycleRepository = {
  async findById(id) {
    const store = getStore();
    return (await store.kpiCycles.get(id)) ?? null;
  },

  async findByTenant(tenantId) {
    const store = getStore();
    // §23: tenantId 等值过滤下推到存储层 (SQL WHERE), 避免全集合加载后 JS 过滤
    return store.kpiCycles.list({ tenantId });
  },

  async findActiveByTenant(tenantId) {
    const all = await this.findByTenant(tenantId);
    return all.filter((c) => c.status === 'active');
  },

  async draft(cmd: DraftCycleCmd) {
    const store = getStore();
    const now = new Date().toISOString();
    const created = await store.kpiCycles.create({
      fiscalYear: cmd.fiscalYear,
      name: cmd.name,
      startDate: cmd.startDate,
      endDate: cmd.endDate,
      status: 'draft',
      tenantId: cmd.tenantId,
      createdBy: cmd.actorId,
      createdAt: now,
      updatedAt: now,
    } as Omit<KpiCycle, 'id'>);

    await audit('kpi.cycle_created', cmd.actorId, {
      targetId: created.id,
      targetType: 'kpi_cycle',
      metadata: { fiscalYear: cmd.fiscalYear, name: cmd.name },
    });
    return created;
  },

  async activate(cmd: ActivateCycleCmd) {
    const store = getStore();
    const cycle = await store.kpiCycles.get(cmd.cycleId);
    if (!cycle) throw new Error(`KpiCycle ${cmd.cycleId} not found`);
    if (cycle.status !== 'draft') {
      throw new InvalidStateTransition(cycle.status, 'activate');
    }
    const now = cmd.lockTargetsAt ?? new Date().toISOString();
    const updated = await store.kpiCycles.update(cmd.cycleId, {
      status: 'active',
      targetsLockedAt: now,
      updatedAt: now,
    });
    await audit('kpi.cycle_activated', cmd.actorId, {
      targetId: cmd.cycleId,
      targetType: 'kpi_cycle',
      metadata: { lockedAt: now, fiscalYear: cycle.fiscalYear },
    });
    return updated;
  },

  async close(cmd: CloseCycleCmd): Promise<CloseCycleResult> {
    const store = getStore();
    const cycle = await store.kpiCycles.get(cmd.cycleId);
    if (!cycle) throw new Error(`KpiCycle ${cmd.cycleId} not found`);
    if (cycle.status !== 'active') {
      return { ok: false, reason: 'invalid_state', current: cycle.status };
    }

    if (!cmd.force) {
      const bonusKpis = await store.kpis.list({
        tenantId: cycle.tenantId,
        cycleId: cmd.cycleId,
        scope: 'bonus',
      });
      const expectedAssignees = new Set(bonusKpis.map((k) => k.assigneeId));
      const payouts = await store.kpiBonusPayouts.list({
        tenantId: cycle.tenantId,
        cycleId: cmd.cycleId,
        committed: true,
      });
      const committedAssignees = new Set(payouts.map((p) => p.assigneeId));
      const missing = Array.from(expectedAssignees).filter((a) => !committedAssignees.has(a));
      if (missing.length > 0) {
        return { ok: false, reason: 'precondition_failed', missingAssignees: missing };
      }
    }

    const now = new Date().toISOString();
    const updated = await store.kpiCycles.update(cmd.cycleId, {
      status: 'closed',
      closedAt: now,
      updatedAt: now,
    });
    await audit('kpi.year_end_close', cmd.actorId, {
      targetId: cmd.cycleId,
      targetType: 'kpi_cycle',
      metadata: { fiscalYear: cycle.fiscalYear, force: cmd.force ?? false },
    });
    return { ok: true, cycle: updated };
  },
};
