/**
 * FP&A 人力资源预决算数据抓取层 (前瞻预设)
 *
 * 对接 docs/HR-BUDGET-FPA-ARCHITECTURE.md 三环闭环:
 *   预算(planned) —— 编制×带宽 的固定薪资承诺 + budget_pool 部门基数
 *   决算(actual)  —— comp_monthly_settlement 实发
 *   差异(variance)—— FP&A 抓取分析的核心指标
 *
 * 设计原则: 这些函数是 FP&A 抓取薪酬域数据的"稳定契约"。即使某周期结算数据尚未生成,
 *          函数仍返回结构化零值行, 供 FP&A 侧稳定接入。所有查询在 SQL 层聚合。
 */

import { sql } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import {
  compEmployeeGrade,
  compGradeBand,
  compMonthlySettlement,
  compBudgetPool,
} from '../infra/drizzle-schema';

/** 预算行: 部门×周期 的人力成本预算 (来自 budget_pool 部门基数) */
export interface PlannedBudgetRow {
  departmentId: string;
  period: string;
  poolType: string;
  baseAmount: number;
  budgetCeiling: number | null;
  hardCliff: boolean;
}

/** 固定薪资承诺预测 (编制×带宽, 尚未含绩效浮动) */
export interface FixedPayrollForecast {
  headcount: number;
  baseWageTotal: number;
  skillWageTotal: number;
  taskWageTotal: number;
  fixedMonthlyTotal: number;
  fixedAnnualTotal: number;
}

/** 决算行: 周期实发汇总 */
export interface ActualPayrollRow {
  period: string;
  headcount: number;
  baseWage: number;
  skillWage: number;
  taskWage: number;
  performance: number;
  total: number;
}

/** 预决算对比 (FP&A 核心抓取指标) */
export interface BudgetVsActual {
  period: string;
  plannedFixedMonthly: number;
  plannedPoolBase: number;
  actualTotal: number;
  variance: number;
  varianceRate: number;
}

/** 抓取 · 部门人力预算池 */
export async function plannedBudgets(tenantId: string, period: string): Promise<PlannedBudgetRow[]> {
  const rows = await db.execute(sql`
    SELECT department_id, period, pool_type, base_amount, budget_ceiling, hard_cliff
    FROM ${compBudgetPool}
    WHERE tenant_id = ${tenantId} AND period = ${period}
    ORDER BY department_id
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    departmentId: String(r.department_id),
    period: String(r.period),
    poolType: String(r.pool_type),
    baseAmount: Number(r.base_amount),
    budgetCeiling: r.budget_ceiling == null ? null : Number(r.budget_ceiling),
    hardCliff: Boolean(r.hard_cliff),
  }));
}

/**
 * 抓取 · 固定薪资承诺预测 = Σ 在职员工定位(employee_grade) × 带宽(grade_band)。
 * 技能工资取带宽 skillWageCached (派生缓存, 改价后已刷新)。任务取员工当前档 A-G。
 */
export async function fixedPayrollForecast(tenantId: string): Promise<FixedPayrollForecast> {
  const rows = await db.execute(sql`
    SELECT
      count(*)::int AS headcount,
      COALESCE(SUM(g.base_wage_snapshot),0)::int AS base_total,
      COALESCE(SUM(b.skill_wage_cached),0)::int AS skill_total,
      COALESCE(SUM( COALESCE((b.task_gears ->> g.task_gear)::int, b.task_wage_std) ),0)::int AS task_total
    FROM ${compEmployeeGrade} g
    JOIN ${compGradeBand} b
      ON b.tenant_id = g.tenant_id AND b.family_id = g.family_id
     AND b.job_class = g.job_class AND b.level = g.current_level
    WHERE g.tenant_id = ${tenantId} AND g.effective_to IS NULL
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0] ?? {};
  const base = Number(r.base_total ?? 0);
  const skill = Number(r.skill_total ?? 0);
  const task = Number(r.task_total ?? 0);
  const fixedMonthly = base + skill + task;
  return {
    headcount: Number(r.headcount ?? 0),
    baseWageTotal: base,
    skillWageTotal: skill,
    taskWageTotal: task,
    fixedMonthlyTotal: fixedMonthly,
    fixedAnnualTotal: fixedMonthly * 12,
  };
}

/** 抓取 · 周期实发决算汇总 */
export async function actualPayroll(tenantId: string, period: string): Promise<ActualPayrollRow> {
  const rows = await db.execute(sql`
    SELECT
      count(*)::int AS headcount,
      COALESCE(SUM(base_wage),0)::int AS base_wage,
      COALESCE(SUM(skill_wage),0)::int AS skill_wage,
      COALESCE(SUM(task_wage),0)::int AS task_wage,
      COALESCE(SUM(performance),0)::int AS performance
    FROM ${compMonthlySettlement}
    WHERE tenant_id = ${tenantId} AND period = ${period}
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0] ?? {};
  const base = Number(r.base_wage ?? 0);
  const skill = Number(r.skill_wage ?? 0);
  const task = Number(r.task_wage ?? 0);
  const perf = Number(r.performance ?? 0);
  return {
    period,
    headcount: Number(r.headcount ?? 0),
    baseWage: base,
    skillWage: skill,
    taskWage: task,
    performance: perf,
    total: base + skill + task + perf,
  };
}

/** 抓取 · 预决算对比 (FP&A 核心指标) */
export async function budgetVsActual(tenantId: string, period: string): Promise<BudgetVsActual> {
  const [forecast, actual, pools] = await Promise.all([
    fixedPayrollForecast(tenantId),
    actualPayroll(tenantId, period),
    plannedBudgets(tenantId, period),
  ]);
  const plannedPoolBase = pools.reduce((a, p) => a + p.baseAmount, 0);
  const planned = forecast.fixedMonthlyTotal;
  const variance = actual.total - planned;
  return {
    period,
    plannedFixedMonthly: planned,
    plannedPoolBase,
    actualTotal: actual.total,
    variance,
    varianceRate: planned > 0 ? variance / planned : 0,
  };
}
