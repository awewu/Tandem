/**
 * 月度结算引擎 (PRD §8) — 直连 typed 表
 *
 * 按周期批量生成 comp_monthly_settlement 行:
 *   固定月薪 = 基本(employeeGrade.baseWageSnapshot) + 技能(已认证Σ) + 任务(带宽档位)
 *   应发 = 固定月薪 × 考勤系数 × 绩效系数
 *   gateFlags: 安全一票否决 / 出勤异常等标记
 *
 * 幂等: 同一 tenant+employee+period 已存在则跳过 (upsert on conflict do nothing)。
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import {
  compEmployeeGrade,
  compGradeBand,
  compSkillDef,
  compGradeCertification,
  compMonthlySettlement,
} from '../infra/drizzle-schema';
import type { CompLevel, TaskGear } from '../types/comp';
import { employeeSkillWage as calcEmployeeSkillWage } from './skill-service';
import { getStore } from '../storage/repository';
import { computeKpiCompletion } from '../types/kpi';
import type { Kpi } from '../types/kpi';
import { aggregateKpiToCoefficient } from './kpi-coefficient';

export interface SettlementInput {
  tenantId: string;
  period: string;
  /** 考勤系数 (0~1, 默认 1) */
  attendance?: number;
  /** 绩效系数 (0~2, 默认 1; >1 = 超额奖金) */
  coefficient?: number;
  /** 绩效奖金绝对值 (若传入则不用 coefficient × fixed) */
  performanceOverride?: number;
  /** 门控标记 { safety_veto?: boolean; attendance_alert?: string } */
  gateFlags?: Record<string, unknown>;
  /** 自动从 KPI 达成率派生系数 (忽略 coefficient 参数) */
  autoCoefficient?: boolean;
  /** KPI 周期 ID (autoCoefficient=true 时用, 默认取最新 active) */
  kpiCycleId?: string;
}

export interface SettlementRow {
  employeeId: string;
  period: string;
  baseWage: number;
  skillWage: number;
  taskWage: number;
  fixedMonthly: number;
  performance: number;
  attendance: number;
  coefficient: number;
  total: number;
  status: string;
  skipped: boolean;
}

export interface SettlementResult {
  period: string;
  generated: number;
  skipped: number;
  rows: SettlementRow[];
}

export async function runMonthlySettlement(input: SettlementInput): Promise<SettlementResult> {
  const {
    tenantId,
    period,
    attendance = 1,
    coefficient = 1,
    performanceOverride,
    gateFlags = {},
    autoCoefficient = false,
    kpiCycleId,
  } = input;

  // autoCoefficient: 预加载 KPI 数据
  let kpiCycleIdResolved = kpiCycleId;
  let allKpis: Kpi[] = [];
  if (autoCoefficient) {
    const store = getStore();
    if (!kpiCycleIdResolved) {
      const cycles = (await store.kpiCycles.list()).filter((c) => c.status === 'active');
      cycles.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
      kpiCycleIdResolved = cycles[0]?.id;
    }
    if (kpiCycleIdResolved) {
      allKpis = (await store.kpis.list({ tenantId, cycleId: kpiCycleIdResolved }))
        .filter((k) => k.scope === 'bonus');
    }
  }

  // 查所有在职员工定位
  const grades = await db
    .select()
    .from(compEmployeeGrade)
    .where(
      and(
        eq(compEmployeeGrade.tenantId, tenantId),
        isNull(compEmployeeGrade.effectiveTo),
      ),
    );

  const rows: SettlementRow[] = [];
  let generated = 0;
  let skipped = 0;

  for (const g of grades) {
    const level = g.currentLevel as CompLevel;
    const gear = g.taskGear as TaskGear;

    // 查带宽
    const [band] = await db
      .select()
      .from(compGradeBand)
      .where(
        and(
          eq(compGradeBand.tenantId, tenantId),
          eq(compGradeBand.jobClass, g.jobClass),
          eq(compGradeBand.level, level),
        ),
      )
      .limit(1);

    const base = g.baseWageSnapshot;
    const gears = (band?.taskGears as Record<string, number> | undefined) ?? {};
    const task = band ? Number(gears[gear] ?? band.taskWageStd) : 0;

    // 已认证技能工资 (SQL 聚合)
    const skillWage = await calcEmployeeSkillWage(tenantId, g.employeeId, g.familyId, level);

    const fixedMonthly = base + skillWage + task;

    // 绩效系数: autoCoefficient 时从 KPI 达成率派生, 否则用手动 coefficient
    let empCoefficient = coefficient;
    if (autoCoefficient) {
      const empKpis = allKpis.filter((k) => k.assigneeId === g.employeeId);
      if (empKpis.length > 0) {
        const result = aggregateKpiToCoefficient({
          items: empKpis.map((k) => ({
            currentValue: k.currentValue,
            targetValue: k.targetValue,
            startValue: k.startValue,
          })),
          weights: empKpis.map((k) => k.weight),
        });
        empCoefficient = result.coefficient;
      }
    }

    // PRD §8 硬闸门: (1) 个人系数上界 1.3 (P1 有界上浮); (2) 安全一票否决 → 绩效归零。
    const safeCoefficient = Math.min(1.3, Math.max(0, empCoefficient));
    const safetyVeto = !!((gateFlags as Record<string, unknown>).safety_veto ?? (gateFlags as Record<string, unknown>).safetyVeto);
    const performance = safetyVeto
      ? 0
      : (performanceOverride ?? Math.round(fixedMonthly * (safeCoefficient - 1)));
    const total = Math.round(fixedMonthly * attendance + performance);

    // 幂等: 检查是否已存在
    const existing = await db
      .select({ id: compMonthlySettlement.id })
      .from(compMonthlySettlement)
      .where(
        and(
          eq(compMonthlySettlement.tenantId, tenantId),
          eq(compMonthlySettlement.employeeId, g.employeeId),
          eq(compMonthlySettlement.period, period),
        ),
      )
      .limit(1);

    if (existing[0]) {
      skipped++;
      rows.push({
        employeeId: g.employeeId,
        period,
        baseWage: base,
        skillWage,
        taskWage: task,
        fixedMonthly,
        performance,
        attendance,
        coefficient: empCoefficient,
        total,
        status: 'exists',
        skipped: true,
      });
      continue;
    }

    const id = `settle_${tenantId}_${g.employeeId}_${period}`;
    await db.insert(compMonthlySettlement).values({
      id,
      tenantId,
      employeeId: g.employeeId,
      period,
      baseWage: base,
      skillWage,
      taskWage: task,
      performance,
      attendance: String(attendance),
      coefficient: String(empCoefficient),
      gateFlags,
      basisSnapshot: {
        familyId: g.familyId,
        jobClass: g.jobClass,
        level,
        taskGear: gear,
        bandId: band?.id ?? null,
        certifiedAgainstVersion: g.certifiedAgainstVersion,
      },
      status: 'draft',
    });

    generated++;
    rows.push({
      employeeId: g.employeeId,
      period,
      baseWage: base,
      skillWage,
      taskWage: task,
      fixedMonthly,
      performance,
      attendance,
      coefficient: empCoefficient,
      total,
      status: 'draft',
      skipped: false,
    });
  }

  return { period, generated, skipped, rows };
}

/** 查询某周期已生成的结算行 */
export async function listSettlements(
  tenantId: string,
  period: string,
): Promise<typeof compMonthlySettlement.$inferSelect[]> {
  return db
    .select()
    .from(compMonthlySettlement)
    .where(
      and(
        eq(compMonthlySettlement.tenantId, tenantId),
        eq(compMonthlySettlement.period, period),
      ),
    );
}

/** 更新结算行状态 (draft → reviewed → paid) */
export async function updateSettlementStatus(
  tenantId: string,
  settlementId: string,
  status: 'draft' | 'reviewed' | 'paid',
): Promise<void> {
  await db
    .update(compMonthlySettlement)
    .set({ status })
    .where(
      and(
        eq(compMonthlySettlement.tenantId, tenantId),
        eq(compMonthlySettlement.id, settlementId),
      ),
    );
}
