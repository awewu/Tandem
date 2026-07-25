/**
 * PMS · 工程项目服务 (项目型销售核心父对象)
 *
 * 业务: 以"项目"为核心组织销售 — 一个项目挂多干系人(决策链) + 规格指定矩阵 +
 *       多条报价/竞标商机. 生命周期 FSM: lead→design→tender→awarded→delivery→warranty→closed | lost.
 * 对齐 drizzle 表 pms_projects.
 * 隔离: 经销商仅见/改 orgId ∈ visibleOrgIds; 写仅内部或归属经销商.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsProjects } from '../infra/drizzle-schema';
import { and, eq, desc, inArray, isNull } from 'drizzle-orm';
import type { Project, ProjectStage, ProjectStatus, ProjectType } from '@/lib/types/pms';
import { listOpportunities } from './opportunity-service';

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

/** 项目阶段合法流转表 */
const PROJECT_TRANSITIONS: Record<ProjectStage, ProjectStage[]> = {
  lead: ['design', 'tender', 'lost'],
  design: ['tender', 'lost'],
  tender: ['awarded', 'lost'],
  awarded: ['delivery', 'lost'],
  delivery: ['warranty', 'closed'],
  warranty: ['closed'],
  closed: [],
  lost: [],
};

/** 项目阶段流转是否合法 */
export function canTransitionProject(from: string, to: string): boolean {
  const allowed = PROJECT_TRANSITIONS[from as ProjectStage];
  if (!allowed) return false;
  return allowed.includes(to as ProjectStage);
}

/** 阶段 → 派生状态 (awarded/delivery/warranty/closed 视为 won; lost → lost) */
export function deriveStatusFromStage(stage: ProjectStage): ProjectStatus {
  if (stage === 'lost') return 'lost';
  if (stage === 'closed' || stage === 'warranty' || stage === 'delivery' || stage === 'awarded') return 'won';
  return 'active';
}

/** 项目编号: PJ-YYYYMMDD-<suffix> */
export function formatProjectCode(date: Date, suffix: string): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `PJ-${y}${m}${d}-${suffix}`;
}

/** 商机阶段 → 赢单概率 (两阶段管道加权预测) */
export const OPPORTUNITY_STAGE_PROBABILITY: Record<string, number> = {
  initial_contact: 0.1,
  reported: 0.1,
  following: 0.2,
  visit: 0.2,
  proposal: 0.4,
  solution: 0.4,
  bidding: 0.6,
  quote: 0.7,
  quoted: 0.7,
  quotation: 0.7,
  negotiation: 0.8,
  contract: 0.95,
  contracted: 0.95,
  delivery: 1.0,
  delivered: 1.0,
  won: 1.0,
  closed: 1.0,
  lost: 0,
};

export interface ProjectPipeline {
  opportunityCount: number;
  totalValue: number; // active + won 的预估额合计
  weightedValue: number; // Σ 预估额 × 阶段概率 (四舍五入)
  wonValue: number; // status=won 的合计
}

/**
 * 项目管道加权预测 (纯函数).
 *   lost/cancelled → 权重 0; won → 权重 1; 其余按阶段概率.
 */
export function weightedPipelineValue(
  opps: { stage: string; status: string; estimatedAmount?: number }[],
): ProjectPipeline {
  let totalValue = 0;
  let weightedValue = 0;
  let wonValue = 0;
  for (const o of opps) {
    const amt = o.estimatedAmount ?? 0;
    if (o.status === 'lost' || o.status === 'cancelled') continue;
    if (o.status === 'won') {
      wonValue += amt;
      weightedValue += amt;
      totalValue += amt;
      continue;
    }
    totalValue += amt;
    const prob = OPPORTUNITY_STAGE_PROBABILITY[o.stage] ?? 0.1;
    weightedValue += amt * prob;
  }
  return {
    opportunityCount: opps.length,
    totalValue,
    weightedValue: Math.round(weightedValue),
    wonValue,
  };
}

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

function mapProject(row: typeof pmsProjects.$inferSelect): Project {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgId: row.orgId,
    projectCode: row.projectCode,
    projectName: row.projectName,
    projectType: (row.projectType || 'new_construction') as ProjectType,
    customerName: row.customerName || undefined,
    customerAccountId: row.customerAccountId || undefined,
    region: row.region || undefined,
    channel: row.channel || undefined,
    address: row.address || undefined,
    addressGeo: (row.addressGeo as { lat: number; lng: number } | null) || undefined,
    designInstitute: row.designInstitute || undefined,
    stage: (row.stage || 'lead') as ProjectStage,
    status: (row.status || 'active') as ProjectStatus,
    estimatedValue: row.estimatedValue != null ? parseFloat(row.estimatedValue) : undefined,
    ownerId: row.ownerId || undefined,
    expectedTenderDate: row.expectedTenderDate || undefined,
    expectedAwardDate: row.expectedAwardDate || undefined,
    detectedAt: row.detectedAt || undefined,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : undefined,
  };
}

export async function createProject(input: {
  tenantId: string;
  orgId: string;
  projectName: string;
  projectType?: ProjectType;
  projectCode?: string;
  customerName?: string;
  customerAccountId?: string;
  region?: string;
  channel?: string;
  address?: string;
  addressGeo?: { lat: number; lng: number };
  designInstitute?: string;
  stage?: ProjectStage;
  estimatedValue?: number;
  ownerId?: string;
  expectedTenderDate?: string;
  expectedAwardDate?: string;
  detectedAt?: string;
  createdBy: string;
}): Promise<Project> {
  const now = new Date();
  const id = nanoid();
  const projectCode = input.projectCode || formatProjectCode(now, id.slice(0, 6));
  const stage = input.stage ?? 'lead';
  await db.insert(pmsProjects).values({
    id,
    tenantId: input.tenantId,
    orgId: input.orgId,
    projectCode,
    projectName: input.projectName,
    projectType: input.projectType ?? 'new_construction',
    customerName: input.customerName ?? null,
    customerAccountId: input.customerAccountId ?? null,
    region: input.region ?? null,
    channel: input.channel ?? null,
    address: input.address ?? null,
    addressGeo: input.addressGeo ?? null,
    designInstitute: input.designInstitute ?? null,
    stage,
    status: deriveStatusFromStage(stage),
    estimatedValue: input.estimatedValue != null ? input.estimatedValue.toString() : null,
    ownerId: input.ownerId ?? null,
    expectedTenderDate: input.expectedTenderDate ?? null,
    expectedAwardDate: input.expectedAwardDate ?? null,
    detectedAt: input.detectedAt ?? now.toISOString().slice(0, 10),
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(pmsProjects).where(eq(pmsProjects.id, id)).limit(1);
  return mapProject(rows[0]);
}

export async function getProject(tenantId: string, id: string): Promise<Project | null> {
  const rows = await db
    .select()
    .from(pmsProjects)
    .where(and(eq(pmsProjects.id, id), eq(pmsProjects.tenantId, tenantId)))
    .limit(1);
  return rows.length ? mapProject(rows[0]) : null;
}

export async function listProjects(filters: {
  tenantId: string;
  visibleOrgIds?: string[]; // 空/undefined = 全通 (内部)
  stage?: ProjectStage;
  status?: ProjectStatus;
  region?: string;
  ownerId?: string;
  limit?: number;
  offset?: number;
}): Promise<Project[]> {
  const conditions = [eq(pmsProjects.tenantId, filters.tenantId), isNull(pmsProjects.archivedAt)];
  if (filters.visibleOrgIds && filters.visibleOrgIds.length > 0) {
    conditions.push(inArray(pmsProjects.orgId, filters.visibleOrgIds));
  }
  if (filters.stage) conditions.push(eq(pmsProjects.stage, filters.stage));
  if (filters.status) conditions.push(eq(pmsProjects.status, filters.status));
  if (filters.region) conditions.push(eq(pmsProjects.region, filters.region));
  if (filters.ownerId) conditions.push(eq(pmsProjects.ownerId, filters.ownerId));
  const rows = await db
    .select()
    .from(pmsProjects)
    .where(and(...conditions))
    .orderBy(desc(pmsProjects.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
  return rows.map(mapProject);
}

/** 阶段流转 (FSM 守卫 + 派生状态) */
export async function transitionProjectStage(input: {
  tenantId: string;
  id: string;
  toStage: ProjectStage;
}): Promise<Project> {
  const rows = await db
    .select()
    .from(pmsProjects)
    .where(and(eq(pmsProjects.id, input.id), eq(pmsProjects.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('project not found');
  const from = rows[0].stage as ProjectStage;
  if (from === input.toStage) return mapProject(rows[0]);
  if (!canTransitionProject(from, input.toStage)) {
    throw new Error(`invalid project stage transition: ${from} → ${input.toStage}`);
  }
  const now = new Date();
  await db
    .update(pmsProjects)
    .set({ stage: input.toStage, status: deriveStatusFromStage(input.toStage), updatedAt: now })
    .where(eq(pmsProjects.id, input.id));
  const updated = await db.select().from(pmsProjects).where(eq(pmsProjects.id, input.id)).limit(1);
  return mapProject(updated[0]);
}

/** 局部更新 (基本字段, 不含 stage — 阶段走 transitionProjectStage) */
export async function updateProject(input: {
  tenantId: string;
  id: string;
  patch: Partial<Pick<Project,
    'projectName' | 'projectType' | 'customerName' | 'customerAccountId' | 'region' | 'channel' |
    'address' | 'designInstitute' | 'estimatedValue' | 'ownerId' | 'expectedTenderDate' | 'expectedAwardDate'
  >>;
}): Promise<Project> {
  const rows = await db
    .select()
    .from(pmsProjects)
    .where(and(eq(pmsProjects.id, input.id), eq(pmsProjects.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('project not found');
  const p = input.patch;
  const now = new Date();
  await db
    .update(pmsProjects)
    .set({
      ...(p.projectName !== undefined ? { projectName: p.projectName } : {}),
      ...(p.projectType !== undefined ? { projectType: p.projectType } : {}),
      ...(p.customerName !== undefined ? { customerName: p.customerName } : {}),
      ...(p.customerAccountId !== undefined ? { customerAccountId: p.customerAccountId } : {}),
      ...(p.region !== undefined ? { region: p.region } : {}),
      ...(p.channel !== undefined ? { channel: p.channel } : {}),
      ...(p.address !== undefined ? { address: p.address } : {}),
      ...(p.designInstitute !== undefined ? { designInstitute: p.designInstitute } : {}),
      ...(p.estimatedValue !== undefined ? { estimatedValue: p.estimatedValue != null ? p.estimatedValue.toString() : null } : {}),
      ...(p.ownerId !== undefined ? { ownerId: p.ownerId } : {}),
      ...(p.expectedTenderDate !== undefined ? { expectedTenderDate: p.expectedTenderDate } : {}),
      ...(p.expectedAwardDate !== undefined ? { expectedAwardDate: p.expectedAwardDate } : {}),
      updatedAt: now,
    })
    .where(eq(pmsProjects.id, input.id));
  const updated = await db.select().from(pmsProjects).where(eq(pmsProjects.id, input.id)).limit(1);
  return mapProject(updated[0]);
}

/** 项目管道: 聚合归属商机的加权预测 */
export async function getProjectPipeline(tenantId: string, projectId: string): Promise<ProjectPipeline> {
  const opps = await listOpportunities({ tenantId, projectId, limit: 1000 });
  return weightedPipelineValue(opps.map((o) => ({ stage: o.stage, status: o.status, estimatedAmount: o.estimatedAmount })));
}

/** 软删除 */
export async function archiveProject(tenantId: string, id: string): Promise<void> {
  const now = new Date();
  await db
    .update(pmsProjects)
    .set({ archivedAt: now, updatedAt: now })
    .where(and(eq(pmsProjects.id, id), eq(pmsProjects.tenantId, tenantId)));
}
