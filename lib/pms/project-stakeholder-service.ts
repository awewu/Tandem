/**
 * PMS · 项目干系人服务 (决策链地图)
 *
 * 业务: 项目下的多层干系人 (甲方/设计院/设计工程师/总包/安装商/经销商) + 角色/影响力/内线标记.
 *       纯函数 decisionChainHealth 产出 MEDDICC 式决策链完整度诊断.
 * 对齐 drizzle 表 pms_project_stakeholders.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsProjectStakeholders } from '../infra/drizzle-schema';
import { and, eq, desc, isNull } from 'drizzle-orm';
import type {
  ProjectStakeholder,
  StakeholderRole,
  StakeholderInfluence,
  DecisionChainHealth,
} from '@/lib/types/pms';

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

/** 工程项目决策链的关键角色 (缺失即高风险) */
export const CRITICAL_ROLES: StakeholderRole[] = ['owner', 'design_engineer', 'installer'];

/**
 * 决策链完整度诊断 (MEDDICC 内核).
 * completeness = 关键角色覆盖(60%) + 有内线(20%) + 有经济决策人(20%).
 */
export function decisionChainHealth(
  stakeholders: Pick<ProjectStakeholder, 'role' | 'isChampion' | 'isEconomicBuyer'>[],
): DecisionChainHealth {
  const presentRoles = Array.from(new Set(stakeholders.map((s) => s.role)));
  const missingCriticalRoles = CRITICAL_ROLES.filter((r) => !presentRoles.includes(r));
  const hasChampion = stakeholders.some((s) => s.isChampion);
  const hasEconomicBuyer = stakeholders.some((s) => s.isEconomicBuyer);

  const roleCoverage = (CRITICAL_ROLES.length - missingCriticalRoles.length) / CRITICAL_ROLES.length; // 0-1
  const completeness = Math.round(
    (roleCoverage * 60 + (hasChampion ? 20 : 0) + (hasEconomicBuyer ? 20 : 0)) * 10,
  ) / 10;

  return {
    totalStakeholders: stakeholders.length,
    presentRoles,
    missingCriticalRoles,
    hasChampion,
    hasEconomicBuyer,
    completeness,
  };
}

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

function mapStakeholder(row: typeof pmsProjectStakeholders.$inferSelect): ProjectStakeholder {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    role: row.role as StakeholderRole,
    name: row.name,
    company: row.company || undefined,
    title: row.title || undefined,
    phone: row.phone || undefined,
    email: row.email || undefined,
    influence: (row.influence || 'medium') as StakeholderInfluence,
    isChampion: !!row.isChampion,
    isEconomicBuyer: !!row.isEconomicBuyer,
    notes: row.notes || undefined,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : undefined,
  };
}

export async function addStakeholder(input: {
  tenantId: string;
  projectId: string;
  role: StakeholderRole;
  name: string;
  company?: string;
  title?: string;
  phone?: string;
  email?: string;
  influence?: StakeholderInfluence;
  isChampion?: boolean;
  isEconomicBuyer?: boolean;
  notes?: string;
  createdBy: string;
}): Promise<ProjectStakeholder> {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsProjectStakeholders).values({
    id,
    tenantId: input.tenantId,
    projectId: input.projectId,
    role: input.role,
    name: input.name,
    company: input.company ?? null,
    title: input.title ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    influence: input.influence ?? 'medium',
    isChampion: input.isChampion ?? false,
    isEconomicBuyer: input.isEconomicBuyer ?? false,
    notes: input.notes ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(pmsProjectStakeholders).where(eq(pmsProjectStakeholders.id, id)).limit(1);
  return mapStakeholder(rows[0]);
}

export async function listStakeholders(tenantId: string, projectId: string): Promise<ProjectStakeholder[]> {
  const rows = await db
    .select()
    .from(pmsProjectStakeholders)
    .where(and(
      eq(pmsProjectStakeholders.tenantId, tenantId),
      eq(pmsProjectStakeholders.projectId, projectId),
      isNull(pmsProjectStakeholders.archivedAt),
    ))
    .orderBy(desc(pmsProjectStakeholders.createdAt));
  return rows.map(mapStakeholder);
}

export async function updateStakeholder(input: {
  tenantId: string;
  id: string;
  patch: Partial<Pick<ProjectStakeholder,
    'role' | 'name' | 'company' | 'title' | 'phone' | 'email' | 'influence' | 'isChampion' | 'isEconomicBuyer' | 'notes'
  >>;
}): Promise<ProjectStakeholder> {
  const rows = await db
    .select()
    .from(pmsProjectStakeholders)
    .where(and(eq(pmsProjectStakeholders.id, input.id), eq(pmsProjectStakeholders.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('stakeholder not found');
  const p = input.patch;
  const now = new Date();
  await db
    .update(pmsProjectStakeholders)
    .set({
      ...(p.role !== undefined ? { role: p.role } : {}),
      ...(p.name !== undefined ? { name: p.name } : {}),
      ...(p.company !== undefined ? { company: p.company } : {}),
      ...(p.title !== undefined ? { title: p.title } : {}),
      ...(p.phone !== undefined ? { phone: p.phone } : {}),
      ...(p.email !== undefined ? { email: p.email } : {}),
      ...(p.influence !== undefined ? { influence: p.influence } : {}),
      ...(p.isChampion !== undefined ? { isChampion: p.isChampion } : {}),
      ...(p.isEconomicBuyer !== undefined ? { isEconomicBuyer: p.isEconomicBuyer } : {}),
      ...(p.notes !== undefined ? { notes: p.notes } : {}),
      updatedAt: now,
    })
    .where(eq(pmsProjectStakeholders.id, input.id));
  const updated = await db.select().from(pmsProjectStakeholders).where(eq(pmsProjectStakeholders.id, input.id)).limit(1);
  return mapStakeholder(updated[0]);
}

export async function removeStakeholder(tenantId: string, id: string): Promise<void> {
  const now = new Date();
  await db
    .update(pmsProjectStakeholders)
    .set({ archivedAt: now, updatedAt: now })
    .where(and(eq(pmsProjectStakeholders.id, id), eq(pmsProjectStakeholders.tenantId, tenantId)));
}

/** 项目决策链健康度 (查询 + 诊断) */
export async function getDecisionChainHealth(tenantId: string, projectId: string): Promise<DecisionChainHealth> {
  const stakeholders = await listStakeholders(tenantId, projectId);
  return decisionChainHealth(stakeholders);
}
