/**
 * ERP 适配器 · KPI 通道 B (CHARTER-KPI-TTI §2.1)
 *
 * 设计原则:
 *   1. 接口稳定, 不同租户接不同 ERP (SAP/用友/金蝶/自研) 各实现一个 ErpAdapter.
 *   2. Pull 模式 (我们去 ERP 抓), 不是 Push (避免暴露 webhook 给外网).
 *   3. 抓取以 KPI.subject.code 为映射键 — ERP 那边维护一张
 *      (subject_code → erp_query) 配置表, 由 finance/IT 共同维护.
 *   4. 抓回的数据以"覆盖写"方式更新 KPI.currentValue, 并打 dataSource='erp'.
 *   5. 每次抓取写一条 audit log + 可选保存 KpiSnapshot 以备趋势.
 *
 * 调用方式 (后续 cron / 手动触发):
 *   - 定时任务 (lib/scheduler) 每日凌晨调 pullAndSync()
 *   - 高管 / finance 可手动 POST /api/kpi/erp/sync 触发
 *
 * 这里只交付 **骨架 + 默认 noop adapter**. 真实 ERP 实现按租户在
 * 部署期注入 (DI via env or registry).
 */

import { getStore } from '@/lib/boot';
import { audit } from '@/lib/audit/log';
import type { Kpi } from '@/lib/types/kpi';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ErpFetchResult {
  /** subjectCode (来自 KpiSubject.code) */
  subjectCode: string;
  /** 数据所属 assigneeId (公司级= 'company', 部门级= deptId, 个人级= userId) */
  assigneeId: string;
  /** 累计值 (与 KPI.currentValue 同口径) */
  value: number;
  /** ERP 端记录时间, 用于 staleness 判断 */
  asOf: string;
  /** 任意元数据 (单据号 / 报表名 / 抓取参数), 落 audit log */
  metadata?: Record<string, unknown>;
}

export interface ErpAdapter {
  /** 适配器名 (用于审计) */
  readonly name: string;
  /**
   * 抓取一批 KPI 的 actuals.
   * @param subjectCodes 要抓的科目码 (subject.code 维度), 适配器内部映射到 ERP query
   * @returns 抓取结果, 失败的 subject 可静默丢弃或抛 Error
   */
  fetch(subjectCodes: string[]): Promise<ErpFetchResult[]>;
}

// ---------------------------------------------------------------------------
// 默认 noop adapter (用于尚未对接 ERP 的租户)
// ---------------------------------------------------------------------------

class NoopErpAdapter implements ErpAdapter {
  readonly name = 'noop';
  async fetch(_subjectCodes: string[]): Promise<ErpFetchResult[]> {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Registry (按租户注册不同 adapter)
// ---------------------------------------------------------------------------

const REGISTRY = new Map<string, ErpAdapter>();
const DEFAULT_ADAPTER: ErpAdapter = new NoopErpAdapter();

/** 注册某租户的 ERP 适配器 (启动期调用) */
export function registerErpAdapter(tenantId: string, adapter: ErpAdapter): void {
  REGISTRY.set(tenantId, adapter);
}

export function getErpAdapter(tenantId: string): ErpAdapter {
  return REGISTRY.get(tenantId) ?? DEFAULT_ADAPTER;
}

// ---------------------------------------------------------------------------
// 同步入口 · 抓 + 写 + 审计
// ---------------------------------------------------------------------------

export interface SyncResult {
  tenantId: string;
  adapter: string;
  fetched: number;
  applied: number;
  skipped: number;
  errors: Array<{ subjectCode: string; assigneeId: string; reason: string }>;
}

/**
 * 对某租户 + 周期, 全量同步 ERP actuals.
 *
 * 仅对 dataSource != 'manual' 的 KPI 应用 (人工补录优先级最高, ERP 不能覆盖).
 * 这是为了贯彻 CHARTER §2.1 通道 C 的不可篡改性: 一旦 finance 手动补录,
 * 后续 ERP 抓数不再自动覆盖, 由 finance 决定何时切回 ERP.
 */
export async function syncErpActuals(
  tenantId: string,
  cycleId: string,
  triggeredBy: string,
): Promise<SyncResult> {
  const adapter = getErpAdapter(tenantId);
  const store = getStore();

  const cycle = await store.kpiCycles.get(cycleId);
  if (!cycle || cycle.tenantId !== tenantId) {
    throw new Error(`cycle_not_found: ${cycleId}`);
  }
  if (cycle.status !== 'active') {
    // draft 还没锁 target / closed 已封档 — 都不应被自动同步
    return {
      tenantId,
      adapter: adapter.name,
      fetched: 0,
      applied: 0,
      skipped: 0,
      errors: [{ subjectCode: '*', assigneeId: '*', reason: `cycle_${cycle.status}_skipped` }],
    };
  }

  // §23: tenantId + cycleId 等值过滤下推到存储层
  const kpis = await store.kpis.list({ tenantId, cycleId });
  const subjects = await store.kpiSubjects.list({ tenantId });
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const subjectCodes = Array.from(
    new Set(
      kpis
        .map((k) => subjectById.get(k.subjectId)?.code)
        .filter((c): c is string => !!c),
    ),
  );
  const results = await adapter.fetch(subjectCodes);

  const out: SyncResult = {
    tenantId,
    adapter: adapter.name,
    fetched: results.length,
    applied: 0,
    skipped: 0,
    errors: [],
  };

  for (const r of results) {
    // 匹配 KPI: subjectCode + assigneeId
    const subject = subjects.find((s) => s.code === r.subjectCode);
    if (!subject) {
      out.errors.push({
        subjectCode: r.subjectCode,
        assigneeId: r.assigneeId,
        reason: 'subject_not_found',
      });
      continue;
    }
    const kpi = kpis.find(
      (k) => k.subjectId === subject.id && k.assigneeId === r.assigneeId,
    );
    if (!kpi) {
      out.errors.push({
        subjectCode: r.subjectCode,
        assigneeId: r.assigneeId,
        reason: 'kpi_not_found',
      });
      continue;
    }
    // 通道优先级: manual > erp. 已被人工锁定的 KPI 不被 ERP 覆盖
    if (kpi.dataSource === 'manual') {
      out.skipped++;
      continue;
    }

    const fromValue = kpi.currentValue;
    const now = new Date().toISOString();
    await store.kpis.update(kpi.id, {
      currentValue: r.value,
      dataSource: 'erp',
      updatedAt: now,
    });
    await audit('kpi.actuals_imported_erp', triggeredBy, {
      targetId: kpi.id,
      targetType: 'kpi',
      metadata: {
        adapter: adapter.name,
        subjectCode: r.subjectCode,
        fromValue,
        toValue: r.value,
        delta: r.value - fromValue,
        asOf: r.asOf,
        ...r.metadata,
      },
    });
    out.applied++;
  }

  return out;
}
