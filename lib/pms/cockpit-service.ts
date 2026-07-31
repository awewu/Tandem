/**
 * PMS · 老板驾驶舱服务 (销售 + 财务视角 · 异常即时暴露)
 *
 * 定位: management-by-exception — 不做被动描述看板, 而是主动把"正在出问题/流血"的点顶到最前.
 *   销售面: 停滞项目 / 招标临近截止 / 高价值 spec-in 被替换风险 / 决策链缺口 / 近期丢标.
 *   财务面: 业绩目标缺口 / 合同审批积压 / 赢单率 / 加权管道.
 *
 * 纪律: 纯只读聚合, 不写库; orgId 隔离 (内部全量, 经销商仅可见项目范围).
 *   检测阈值以纯函数暴露 (可测), 数据装配走下推 SQL group by.
 */

import { db } from '../infra/drizzle-client';
import {
  pmsOpportunities,
  pmsSpecPositions,
  pmsProjectStakeholders,
  pmsTenders,
  pmsContracts,
  pmsPerformanceTargets,
} from '../infra/drizzle-schema';
import type { SQL, AnyColumn } from 'drizzle-orm';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { listProjects } from './project-service';
import { getOpportunityAnalytics, winRate } from './analytics-service';
import { CRITICAL_ROLES } from './project-stakeholder-service';
import { PMS_COMPANY_VIEW_ROLES } from '@/lib/auth/roles';
import type { Project, ProjectStage } from '@/lib/types/pms';

// ---------------------------------------------------------------------------
// 阈值 (集中, 便于调参)
// ---------------------------------------------------------------------------

export const COCKPIT_THRESHOLDS = {
  stalledDays: 30, // 活跃项目超过 N 天无更新 = 停滞
  tenderSoonDays: 7, // 招标距截止 ≤ N 天 = 紧急
  specRiskMinValue: 500_000, // 被替换风险金额门槛 (超过才顶到驾驶舱)
  highValueProject: 1_000_000, // 高价值项目 (决策链缺口才告警)
  targetGapRate: 60, // 当期业绩达成率 < N% = 缺口
  targetCriticalRate: 40, // < N% = 严重
};

export type ExceptionSeverity = 'critical' | 'warning' | 'info';
export type ExceptionCategory = 'sales' | 'finance';

export interface CockpitException {
  id: string;
  severity: ExceptionSeverity;
  category: ExceptionCategory;
  type: string;
  title: string;
  detail: string;
  amount?: number;
  href?: string;
}

const ACTIVE_STAGES: ProjectStage[] = ['lead', 'design', 'tender', 'awarded', 'delivery', 'warranty'];
const STAGE_ORDER: ProjectStage[] = ['lead', 'design', 'tender', 'awarded', 'delivery', 'warranty', 'closed'];
const STAGE_LABEL: Record<string, string> = {
  lead: '立项', design: '设计选型', tender: '招投标', awarded: '中标',
  delivery: '交付', warranty: '质保', closed: '结案', lost: '丢标',
};
const ROLE_LABEL: Record<string, string> = {
  owner: '甲方', architect: '设计院', design_engineer: '设计工程师',
  general_contractor: '总包', installer: '安装商', distributor: '经销商', consultant: '顾问', other: '其他',
};

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<ExceptionSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** 异常排序: 严重度优先, 其次金额降序 */
export function sortExceptions(list: CockpitException[]): CockpitException[] {
  return [...list].sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    return (b.amount ?? 0) - (a.amount ?? 0);
  });
}

/** 两个 ISO/Date 相差天数 (向下取整, a 晚于 b 为正) */
export function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

export interface StageFunnelRow {
  stage: ProjectStage;
  label: string;
  count: number;
  value: number;
}

/** 项目阶段漏斗 (立项→…→结案 顺序; lost 不入漏斗主轴, 单列流失) */
export function buildProjectStageFunnel(
  projects: Pick<Project, 'stage' | 'estimatedValue'>[],
): { funnel: StageFunnelRow[]; lostCount: number; lostValue: number } {
  const byStage = new Map<string, { count: number; value: number }>();
  let lostCount = 0;
  let lostValue = 0;
  for (const p of projects) {
    const v = p.estimatedValue ?? 0;
    if (p.stage === 'lost') {
      lostCount += 1;
      lostValue += v;
      continue;
    }
    const cur = byStage.get(p.stage) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += v;
    byStage.set(p.stage, cur);
  }
  const funnel = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABEL[stage],
    count: byStage.get(stage)?.count ?? 0,
    value: Math.round(byStage.get(stage)?.value ?? 0),
  }));
  return { funnel, lostCount, lostValue: Math.round(lostValue) };
}

/** 停滞项目检测: 活跃阶段 + 超过阈值天数无更新 */
export function detectStalledProjects(
  projects: Pick<Project, 'id' | 'projectName' | 'stage' | 'estimatedValue' | 'updatedAt'>[],
  now: Date,
  thresholdDays = COCKPIT_THRESHOLDS.stalledDays,
): CockpitException[] {
  const out: CockpitException[] = [];
  for (const p of projects) {
    if (!ACTIVE_STAGES.includes(p.stage)) continue;
    const idle = daysBetween(now, new Date(p.updatedAt));
    if (idle < thresholdDays) continue;
    out.push({
      id: `stalled:${p.id}`,
      severity: idle >= thresholdDays * 2 ? 'critical' : 'warning',
      category: 'sales',
      type: 'stalled_project',
      title: `项目停滞 ${idle} 天 — ${p.projectName}`,
      detail: `停留在「${STAGE_LABEL[p.stage] || p.stage}」阶段 ${idle} 天无推进`,
      amount: p.estimatedValue,
      href: `/pms/projects/${p.id}`,
    });
  }
  return out;
}

/** 招标截止检测: preparing 且有 submitDeadline, 距今 ≤ withinDays (或已逾期) */
export function detectTenderDeadlines(
  tenders: { id: string; projectId: string; tenderName: string; submitDeadline: string | null; budgetAmount?: number }[],
  now: Date,
  withinDays = COCKPIT_THRESHOLDS.tenderSoonDays,
): CockpitException[] {
  const out: CockpitException[] = [];
  for (const t of tenders) {
    if (!t.submitDeadline) continue;
    const dl = new Date(t.submitDeadline);
    if (isNaN(dl.getTime())) continue;
    const daysLeft = daysBetween(dl, now);
    if (daysLeft > withinDays) continue;
    const overdue = daysLeft < 0;
    out.push({
      id: `tender:${t.id}`,
      severity: overdue || daysLeft <= 2 ? 'critical' : 'warning',
      category: 'sales',
      type: 'tender_deadline',
      title: overdue
        ? `投标已逾期 ${Math.abs(daysLeft)} 天未提交 — ${t.tenderName}`
        : `投标 ${daysLeft} 天后截止 — ${t.tenderName}`,
      detail: `标段仍处「编制中」, 截止 ${t.submitDeadline}`,
      amount: t.budgetAmount,
      href: `/pms/projects/${t.projectId}`,
    });
  }
  return out;
}

/** spec-in 被替换风险检测: 项目层 at-risk 金额超门槛 */
export function detectSpecAtRisk(
  rows: { projectId: string; projectName: string; atRiskValue: number }[],
  minValue = COCKPIT_THRESHOLDS.specRiskMinValue,
): CockpitException[] {
  const out: CockpitException[] = [];
  for (const r of rows) {
    if (r.atRiskValue < minValue) continue;
    out.push({
      id: `spec:${r.projectId}`,
      severity: r.atRiskValue >= minValue * 4 ? 'critical' : 'warning',
      category: 'sales',
      type: 'spec_at_risk',
      title: `spec-in 被替换风险 ¥${Math.round(r.atRiskValue).toLocaleString('zh-CN')} — ${r.projectName}`,
      detail: '存在备选/被替换/丢失的高价值指定位',
      amount: r.atRiskValue,
      href: `/pms/projects/${r.projectId}`,
    });
  }
  return out;
}

/** 决策链缺口检测: 高价值活跃项目缺失关键角色/内线/决策人 */
export function detectChainGaps(
  projects: Pick<Project, 'id' | 'projectName' | 'stage' | 'estimatedValue'>[],
  chainByProject: Map<string, { roles: string[]; hasChampion: boolean; hasEconomicBuyer: boolean }>,
  minValue = COCKPIT_THRESHOLDS.highValueProject,
): CockpitException[] {
  const out: CockpitException[] = [];
  for (const p of projects) {
    if (!ACTIVE_STAGES.includes(p.stage)) continue;
    if ((p.estimatedValue ?? 0) < minValue) continue;
    const chain = chainByProject.get(p.id) ?? { roles: [], hasChampion: false, hasEconomicBuyer: false };
    const missing = CRITICAL_ROLES.filter((r) => !chain.roles.includes(r));
    const gaps: string[] = [];
    if (missing.length) gaps.push(`缺${missing.map((r) => ROLE_LABEL[r] || r).join('/')}`);
    if (!chain.hasChampion) gaps.push('无内线');
    if (!chain.hasEconomicBuyer) gaps.push('无决策人');
    if (gaps.length === 0) continue;
    out.push({
      id: `chain:${p.id}`,
      severity: missing.length >= 2 || !chain.hasEconomicBuyer ? 'warning' : 'info',
      category: 'sales',
      type: 'chain_gap',
      title: `决策链缺口 — ${p.projectName}`,
      detail: gaps.join(' · '),
      amount: p.estimatedValue,
      href: `/pms/projects/${p.id}`,
    });
  }
  return out;
}

/** 业绩目标缺口检测: 当期达成率低于门槛 */
export function detectTargetGaps(
  targets: { id: string; dimension: string; dimensionValue: string | null; period: string; targetValue: number; actualValue: number; achievementRate: number }[],
  now: Date,
): CockpitException[] {
  const out: CockpitException[] = [];
  for (const t of targets) {
    if (t.achievementRate >= COCKPIT_THRESHOLDS.targetGapRate) continue;
    const gap = Math.max(0, t.targetValue - t.actualValue);
    out.push({
      id: `target:${t.id}`,
      severity: t.achievementRate < COCKPIT_THRESHOLDS.targetCriticalRate ? 'critical' : 'warning',
      category: 'finance',
      type: 'target_gap',
      title: `业绩缺口 ${t.achievementRate}% — ${t.dimensionValue || t.dimension} (${t.period})`,
      detail: `目标 ¥${Math.round(t.targetValue).toLocaleString('zh-CN')} / 已达 ¥${Math.round(t.actualValue).toLocaleString('zh-CN')}, 差 ¥${Math.round(gap).toLocaleString('zh-CN')}`,
      amount: gap,
      href: '/pms/performance-targets',
    });
  }
  return out;
}

/** 合同审批积压检测 */
export function detectContractBacklog(pending: { count: number; amount: number }): CockpitException[] {
  if (pending.count <= 0) return [];
  return [{
    id: 'contract:backlog',
    severity: pending.count >= 5 ? 'critical' : 'warning',
    category: 'finance',
    type: 'contract_pending',
    title: `${pending.count} 份合同待审批`,
    detail: `涉及金额 ¥${Math.round(pending.amount).toLocaleString('zh-CN')} 卡在审批环节`,
    amount: pending.amount,
    href: '/pms/contracts',
  }];
}

// ---------------------------------------------------------------------------
// 多维分析 (产品线/客户/销售/区域/渠道 — 深化预警)
// ---------------------------------------------------------------------------

/** 客户集中度风险阈值: 单一客户管道占比超此值 → 告警 */
export const CONCENTRATION_RISK_SHARE = 0.4;
/** 零赢单维度告警: 丢单数 ≥ 此值且赢单=0 → 告警 */
export const ZERO_WIN_MIN_LOST = 2;

export interface DimensionRow {
  key: string;
  count: number;
  pipeline: number; // status=active 预估额合计
  won: number; // status=won 预估额合计
  wonCount: number;
  lostCount: number;
  winRate: number;
}

export interface DimensionAnalysis {
  dimension: string;
  label: string;
  rows: DimensionRow[];
}

/** 单一维度值的最高管道占比 (客户集中度用) */
export function topShare(rows: Pick<DimensionRow, 'key' | 'pipeline'>[]): { key: string; share: number } | null {
  const total = rows.reduce((s, r) => s + r.pipeline, 0);
  if (total <= 0) return null;
  let top = rows[0];
  for (const r of rows) if (r.pipeline > (top?.pipeline ?? 0)) top = r;
  if (!top) return null;
  return { key: top.key, share: top.pipeline / total };
}

/** 客户集中度风险检测 (纯函数) */
export function detectConcentrationRisk(customerRows: DimensionRow[]): CockpitException[] {
  const top = topShare(customerRows);
  if (!top || top.share < CONCENTRATION_RISK_SHARE) return [];
  const pct = Math.round(top.share * 100);
  return [{
    id: `dim_concentration:${top.key}`,
    severity: top.share >= 0.6 ? 'critical' : 'warning',
    category: 'sales',
    type: 'dim_concentration',
    title: `客户集中度风险 — ${top.key} 占管道 ${pct}%`,
    detail: `单一客户管道占比 ${pct}%, 依赖过高, 建议分散客户结构`,
    amount: customerRows.find((r) => r.key === top.key)?.pipeline,
    href: '/pms/analytics',
  }];
}

/** 零赢单维度检测: 某维度值持续丢单且零赢单 (纯函数) */
export function detectZeroWinDimensions(analyses: DimensionAnalysis[]): CockpitException[] {
  const out: CockpitException[] = [];
  for (const a of analyses) {
    // 客户维度不做零赢单告警 (客户天然离散), 只对 区域/渠道/产品线/销售 做
    if (a.dimension === 'customer') continue;
    for (const r of a.rows) {
      if (r.wonCount === 0 && r.lostCount >= ZERO_WIN_MIN_LOST) {
        out.push({
          id: `dim_winrate:${a.dimension}:${r.key}`,
          severity: r.lostCount >= ZERO_WIN_MIN_LOST * 2 ? 'warning' : 'info',
          category: 'sales',
          type: 'dim_winrate',
          title: `${a.label}「${r.key}」零赢单 (丢 ${r.lostCount})`,
          detail: `该${a.label}维度赢单率 0%, 累计丢单 ${r.lostCount} 单, 需复盘打法`,
          href: '/pms/analytics',
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// DB 装配
// ---------------------------------------------------------------------------

export type CockpitScope = 'company' | 'mine' | 'org';

/**
 * 驾驶舱视角解析 (纯函数, 可测).
 *   - 外部(经销商): 恒 'org' (本经销商范围)
 *   - 内部 & 属于 PMS_COMPANY_VIEW_ROLES (管理层/exec/finance): 'company' 全公司只读全景
 *   - 其余内部员工 (employee/champion/internal_staff...): 'mine' 仅"我负责", 隐藏公司财务
 * 用于修复"CMO/职能高管看不到全景""finance 看不到公司财务"的角色缺口.
 */
export function resolvePmsCockpitScope(roles: readonly string[], isInternal: boolean): CockpitScope {
  if (!isInternal) return 'org';
  return roles.some((r) => (PMS_COMPANY_VIEW_ROLES as readonly string[]).includes(r)) ? 'company' : 'mine';
}

export interface CockpitData {
  generatedAt: string;
  scope: CockpitScope;
  exceptions: CockpitException[];
  counts: { critical: number; warning: number; info: number };
  sales: {
    activeProjects: number;
    totalPipeline: number;
    wonAmount: number;
    winRate: number;
    lostCount: number;
    lostValue: number;
  };
  finance: {
    pendingContracts: number;
    pendingContractAmount: number;
    targetGaps: number;
  };
  projectFunnel: StageFunnelRow[];
  /** 多维分析: 区域/渠道/产品线/销售/客户 (mine 视角为空) */
  dimensions: DimensionAnalysis[];
}

/** 某维度列的下推 group-by 聚合 (count/pipeline/won/winRate), 取管道 Top N */
async function dimensionAgg(
  col: SQL | AnyColumn,
  dimension: string,
  label: string,
  baseConds: (SQL | undefined)[],
  topN = 8,
): Promise<DimensionAnalysis> {
  const keyExpr = sql<string>`coalesce(${col}, '未分类')`;
  const rows = await db
    .select({
      key: keyExpr,
      count: sql<number>`count(*)::int`,
      pipeline: sql<number>`coalesce(sum(case when ${pmsOpportunities.status} = 'active' then cast(${pmsOpportunities.estimatedAmount} as double precision) else 0 end), 0)::float8`,
      won: sql<number>`coalesce(sum(case when ${pmsOpportunities.status} = 'won' then cast(${pmsOpportunities.estimatedAmount} as double precision) else 0 end), 0)::float8`,
      wonCount: sql<number>`sum(case when ${pmsOpportunities.status} = 'won' then 1 else 0 end)::int`,
      lostCount: sql<number>`sum(case when ${pmsOpportunities.status} = 'lost' then 1 else 0 end)::int`,
    })
    .from(pmsOpportunities)
    .where(and(...baseConds))
    .groupBy(keyExpr);

  const mapped: DimensionRow[] = rows.map((r) => {
    const wonCount = Number(r.wonCount);
    const lostCount = Number(r.lostCount);
    return {
      key: r.key || '未分类',
      count: Number(r.count),
      pipeline: Math.round(Number(r.pipeline)),
      won: Math.round(Number(r.won)),
      wonCount,
      lostCount,
      winRate: winRate(wonCount, lostCount),
    };
  });
  mapped.sort((a, b) => b.pipeline - a.pipeline || b.count - a.count);
  return { dimension, label, rows: mapped.slice(0, topN) };
}

/** 多维分析装配 (区域/渠道/产品线/销售/客户), orgId 隔离 */
async function dimensionalBreakdown(tenantId: string, visibleOrgIds?: string[]): Promise<DimensionAnalysis[]> {
  const baseConds: (SQL | undefined)[] = [
    eq(pmsOpportunities.tenantId, tenantId),
    isNull(pmsOpportunities.archivedAt),
    // 报备审核关卡: 仅已通过审核的商机计入多维分析
    eq(pmsOpportunities.reviewStatus, 'approved'),
  ];
  if (visibleOrgIds && visibleOrgIds.length > 0) {
    baseConds.push(inArray(pmsOpportunities.orgId, visibleOrgIds));
  }
  return Promise.all([
    dimensionAgg(pmsOpportunities.region, 'region', '区域', baseConds),
    dimensionAgg(pmsOpportunities.channel, 'channel', '渠道', baseConds),
    dimensionAgg(pmsOpportunities.productLine, 'productLine', '产品线', baseConds),
    dimensionAgg(pmsOpportunities.reporterId, 'salesperson', '销售', baseConds),
    dimensionAgg(pmsOpportunities.customerName, 'customer', '客户', baseConds),
  ]);
}

export async function assembleCockpit(input: {
  tenantId: string;
  visibleOrgIds?: string[];
  /** 仅看某人负责的项目 (员工"我的预警"视角). 设置后隐藏公司级财务异常. */
  ownerId?: string;
  /** 视角: company=全公司(管理层) / mine=我负责 / org=本经销商. 默认 company. */
  scope?: CockpitScope;
  now?: Date;
}): Promise<CockpitData> {
  const now = input.now ?? new Date();
  const { tenantId, visibleOrgIds, ownerId } = input;
  const scope: CockpitScope = input.scope ?? (ownerId ? 'mine' : visibleOrgIds && visibleOrgIds.length > 0 ? 'org' : 'company');
  // 公司级财务异常 (合同审批积压 / 业绩目标缺口) 仅对管理层/经销商老板可见, 个人"我的"视角不背公司财务
  const includeFinance = scope !== 'mine';

  // 1) 项目 (orgId 隔离通过 listProjects; ownerId 进一步收窄到"我负责")
  const projects = await listProjects({ tenantId, visibleOrgIds, ownerId, limit: 500 });
  const projectIds = projects.map((p) => p.id);
  const nameById = new Map(projects.map((p) => [p.id, p.projectName]));
  const scoped = projectIds.length > 0;

  // 2) spec at-risk 金额 (group by projectId)
  let specRows: { projectId: string; projectName: string; atRiskValue: number }[] = [];
  if (scoped) {
    const rows = await db
      .select({
        projectId: pmsSpecPositions.projectId,
        atRiskValue: sql<number>`coalesce(sum(cast(${pmsSpecPositions.estimatedValue} as double precision)), 0)::float8`,
      })
      .from(pmsSpecPositions)
      .where(and(
        eq(pmsSpecPositions.tenantId, tenantId),
        inArray(pmsSpecPositions.projectId, projectIds),
        isNull(pmsSpecPositions.archivedAt),
        inArray(pmsSpecPositions.ourBrandStatus, ['alternate', 'substituted', 'lost']),
      ))
      .groupBy(pmsSpecPositions.projectId);
    specRows = rows.map((r) => ({ projectId: r.projectId, projectName: nameById.get(r.projectId) || r.projectId, atRiskValue: Number(r.atRiskValue) }));
  }

  // 3) 决策链角色覆盖 (group by projectId)
  const chainByProject = new Map<string, { roles: string[]; hasChampion: boolean; hasEconomicBuyer: boolean }>();
  if (scoped) {
    const rows = await db
      .select({
        projectId: pmsProjectStakeholders.projectId,
        roles: sql<string[]>`array_agg(distinct ${pmsProjectStakeholders.role})`,
        hasChampion: sql<boolean>`bool_or(${pmsProjectStakeholders.isChampion})`,
        hasEconomicBuyer: sql<boolean>`bool_or(${pmsProjectStakeholders.isEconomicBuyer})`,
      })
      .from(pmsProjectStakeholders)
      .where(and(
        eq(pmsProjectStakeholders.tenantId, tenantId),
        inArray(pmsProjectStakeholders.projectId, projectIds),
        isNull(pmsProjectStakeholders.archivedAt),
      ))
      .groupBy(pmsProjectStakeholders.projectId);
    for (const r of rows) {
      chainByProject.set(r.projectId, {
        roles: (r.roles || []).filter(Boolean),
        hasChampion: !!r.hasChampion,
        hasEconomicBuyer: !!r.hasEconomicBuyer,
      });
    }
  }

  // 4) 招标 (preparing + 有截止日)
  let tenderRows: { id: string; projectId: string; tenderName: string; submitDeadline: string | null; budgetAmount?: number }[] = [];
  if (scoped) {
    const rows = await db
      .select({
        id: pmsTenders.id,
        projectId: pmsTenders.projectId,
        tenderName: pmsTenders.tenderName,
        submitDeadline: pmsTenders.submitDeadline,
        budgetAmount: pmsTenders.budgetAmount,
      })
      .from(pmsTenders)
      .where(and(
        eq(pmsTenders.tenantId, tenantId),
        inArray(pmsTenders.projectId, projectIds),
        eq(pmsTenders.status, 'preparing'),
        isNull(pmsTenders.archivedAt),
      ));
    tenderRows = rows.map((r) => ({
      id: r.id, projectId: r.projectId, tenderName: r.tenderName, submitDeadline: r.submitDeadline,
      budgetAmount: r.budgetAmount != null ? Number(r.budgetAmount) : undefined,
    }));
  }

  // 5) 合同审批积压 (draft/pending) — 财务视角, 租户级 (个人"我的"视角不纳入)
  let pendingContracts = { count: 0, amount: 0 };
  if (includeFinance) {
    const contractAgg = await db
      .select({
        n: sql<number>`count(*)::int`,
        amt: sql<number>`coalesce(sum(cast(${pmsContracts.totalAmount} as double precision)), 0)::float8`,
      })
      .from(pmsContracts)
      .where(and(
        eq(pmsContracts.tenantId, tenantId),
        inArray(pmsContracts.status, ['draft', 'pending']),
      ));
    pendingContracts = { count: Number(contractAgg[0]?.n ?? 0), amount: Number(contractAgg[0]?.amt ?? 0) };
  }

  // 6) 业绩目标 (存活周期缺口) — 取达成率 < 门槛的当期目标 (个人"我的"视角不纳入)
  const targetRows = includeFinance
    ? await db
        .select({
          id: pmsPerformanceTargets.id,
          dimension: pmsPerformanceTargets.dimension,
          dimensionValue: pmsPerformanceTargets.dimensionValue,
          period: pmsPerformanceTargets.period,
          targetValue: pmsPerformanceTargets.targetValue,
          actualValue: pmsPerformanceTargets.actualValue,
          achievementRate: pmsPerformanceTargets.achievementRate,
        })
        .from(pmsPerformanceTargets)
        .where(eq(pmsPerformanceTargets.tenantId, tenantId))
    : [];
  const targets = targetRows.map((t) => ({
    id: t.id,
    dimension: t.dimension,
    dimensionValue: t.dimensionValue,
    period: t.period,
    targetValue: Number(t.targetValue ?? 0),
    actualValue: Number(t.actualValue ?? 0),
    achievementRate: Number(t.achievementRate ?? 0),
  }));

  // 7) 销售 KPI:
  //    company/org 视角 → 复用商机层分析 (管道/赢单率);
  //    mine 视角 → 从"我负责的项目"派生 (商机表无 ownerId, 不能按人切).
  let salesPipeline: number;
  let salesWonAmount: number;
  let salesWinRate: number;
  if (scope === 'mine') {
    const activeValue = projects
      .filter((p) => ACTIVE_STAGES.includes(p.stage))
      .reduce((s, p) => s + (p.estimatedValue ?? 0), 0);
    const wonValue = projects.filter((p) => p.status === 'won').reduce((s, p) => s + (p.estimatedValue ?? 0), 0);
    const wonN = projects.filter((p) => p.status === 'won').length;
    const lostN = projects.filter((p) => p.status === 'lost').length;
    salesPipeline = Math.round(activeValue);
    salesWonAmount = Math.round(wonValue);
    salesWinRate = winRate(wonN, lostN);
  } else {
    const oppAnalytics = await getOpportunityAnalytics({ tenantId, visibleOrgIds });
    salesPipeline = oppAnalytics.totalPipeline;
    salesWonAmount = oppAnalytics.wonAmount;
    salesWinRate = oppAnalytics.winRate;
  }

  // 8) 多维分析 (区域/渠道/产品线/销售/客户) — mine 视角不做 (商机无 ownerId 无法按人切)
  const dimensions: DimensionAnalysis[] = includeFinance ? await dimensionalBreakdown(tenantId, visibleOrgIds) : [];
  const customerRows = dimensions.find((d) => d.dimension === 'customer')?.rows ?? [];

  // --- 汇编异常 (含多维预警: 客户集中度 / 零赢单维度) ---
  const exceptions = sortExceptions([
    ...detectStalledProjects(projects, now),
    ...detectTenderDeadlines(tenderRows, now),
    ...detectSpecAtRisk(specRows),
    ...detectChainGaps(projects, chainByProject),
    ...detectTargetGaps(targets, now),
    ...detectContractBacklog(pendingContracts),
    ...detectConcentrationRisk(customerRows),
    ...detectZeroWinDimensions(dimensions),
  ]);

  const counts = { critical: 0, warning: 0, info: 0 };
  for (const e of exceptions) counts[e.severity] += 1;

  const { funnel, lostCount, lostValue } = buildProjectStageFunnel(projects);
  const activeProjects = projects.filter((p) => ACTIVE_STAGES.includes(p.stage)).length;
  const targetGaps = targets.filter((t) => t.achievementRate < COCKPIT_THRESHOLDS.targetGapRate).length;

  return {
    dimensions,
    generatedAt: now.toISOString(),
    scope,
    exceptions,
    counts,
    sales: {
      activeProjects,
      totalPipeline: salesPipeline,
      wonAmount: salesWonAmount,
      winRate: salesWinRate,
      lostCount,
      lostValue,
    },
    finance: {
      pendingContracts: pendingContracts.count,
      pendingContractAmount: Math.round(pendingContracts.amount),
      targetGaps,
    },
    projectFunnel: funnel,
  };
}
