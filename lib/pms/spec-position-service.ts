/**
 * PMS · 规格指定矩阵服务 (spec-in tracking · 暖通工程命脉)
 *
 * 业务: 项目 × 设备族 追踪我方品牌指定状态 vs 竞品. 设计选型阶段"把品牌写进图纸"决定胜负.
 *       纯函数 specCoverage 汇总战况; specRiskLevel 评估被替换风险.
 * 对齐 drizzle 表 pms_spec_positions.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsSpecPositions } from '../infra/drizzle-schema';
import { and, eq, desc, isNull } from 'drizzle-orm';
import type { SpecPosition, SpecBrandStatus, SpecStage, SpecCoverage } from '@/lib/types/pms';

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

/** 已拿下 (计入 wonValue) 的指定状态 */
const WON_STATUSES: SpecBrandStatus[] = ['basis_of_design', 'specified'];
/** 有风险 (计入 atRiskValue) */
const AT_RISK_STATUSES: SpecBrandStatus[] = ['alternate'];
/** 已丢失 (计入 lostValue) */
const LOST_STATUSES: SpecBrandStatus[] = ['substituted', 'lost'];

/** 规格指定盘面汇总 (spec-in 战况) */
export function specCoverage(
  positions: Pick<SpecPosition, 'ourBrandStatus' | 'estimatedValue'>[],
): SpecCoverage {
  let wonValue = 0;
  let atRiskValue = 0;
  let lostValue = 0;
  let totalValue = 0;
  let atRiskCount = 0;

  for (const p of positions) {
    const v = p.estimatedValue ?? 0;
    totalValue += v;
    if (WON_STATUSES.includes(p.ourBrandStatus)) wonValue += v;
    else if (AT_RISK_STATUSES.includes(p.ourBrandStatus)) {
      atRiskValue += v;
      atRiskCount += 1;
    } else if (LOST_STATUSES.includes(p.ourBrandStatus)) lostValue += v;
  }

  const specWinRate = totalValue > 0 ? Math.round((wonValue / totalValue) * 1000) / 10 : 0;

  return {
    totalPositions: positions.length,
    wonValue,
    atRiskValue,
    lostValue,
    totalValue,
    specWinRate,
    atRiskCount,
  };
}

/**
 * 单个指定位的被替换风险 (纯函数, 供 Phase 3 AI 增强前的规则基线):
 *   basis_of_design → low; specified(design 阶段) → low; specified(tender 阶段) → medium;
 *   alternate → high; not_specified → high; substituted/lost → lost.
 */
export function specRiskLevel(
  position: Pick<SpecPosition, 'ourBrandStatus' | 'specStage' | 'competitorBrand'>,
): 'low' | 'medium' | 'high' | 'lost' {
  const { ourBrandStatus, specStage, competitorBrand } = position;
  if (LOST_STATUSES.includes(ourBrandStatus)) return 'lost';
  if (ourBrandStatus === 'basis_of_design') return competitorBrand ? 'medium' : 'low';
  if (ourBrandStatus === 'specified') return specStage === 'tender' ? 'medium' : 'low';
  if (ourBrandStatus === 'alternate') return 'high';
  return 'high'; // not_specified
}

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

function mapSpec(row: typeof pmsSpecPositions.$inferSelect): SpecPosition {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    equipmentFamily: row.equipmentFamily,
    ourBrandStatus: (row.ourBrandStatus || 'not_specified') as SpecBrandStatus,
    ourProductSeriesCode: row.ourProductSeriesCode || undefined,
    ourProductModel: row.ourProductModel || undefined,
    competitorBrand: row.competitorBrand || undefined,
    competitorModel: row.competitorModel || undefined,
    estimatedValue: row.estimatedValue != null ? parseFloat(row.estimatedValue) : undefined,
    specStage: (row.specStage || 'design') as SpecStage,
    notes: row.notes || undefined,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : undefined,
  };
}

export async function createSpecPosition(input: {
  tenantId: string;
  projectId: string;
  equipmentFamily: string;
  ourBrandStatus?: SpecBrandStatus;
  ourProductSeriesCode?: string;
  ourProductModel?: string;
  competitorBrand?: string;
  competitorModel?: string;
  estimatedValue?: number;
  specStage?: SpecStage;
  notes?: string;
  createdBy: string;
}): Promise<SpecPosition> {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsSpecPositions).values({
    id,
    tenantId: input.tenantId,
    projectId: input.projectId,
    equipmentFamily: input.equipmentFamily,
    ourBrandStatus: input.ourBrandStatus ?? 'not_specified',
    ourProductSeriesCode: input.ourProductSeriesCode ?? null,
    ourProductModel: input.ourProductModel ?? null,
    competitorBrand: input.competitorBrand ?? null,
    competitorModel: input.competitorModel ?? null,
    estimatedValue: input.estimatedValue != null ? input.estimatedValue.toString() : null,
    specStage: input.specStage ?? 'design',
    notes: input.notes ?? null,
    createdBy: input.createdBy,
    updatedBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(pmsSpecPositions).where(eq(pmsSpecPositions.id, id)).limit(1);
  return mapSpec(rows[0]);
}

export async function listSpecPositions(tenantId: string, projectId: string): Promise<SpecPosition[]> {
  const rows = await db
    .select()
    .from(pmsSpecPositions)
    .where(and(
      eq(pmsSpecPositions.tenantId, tenantId),
      eq(pmsSpecPositions.projectId, projectId),
      isNull(pmsSpecPositions.archivedAt),
    ))
    .orderBy(desc(pmsSpecPositions.createdAt));
  return rows.map(mapSpec);
}

export async function updateSpecPosition(input: {
  tenantId: string;
  id: string;
  updatedBy: string;
  patch: Partial<Pick<SpecPosition,
    'equipmentFamily' | 'ourBrandStatus' | 'ourProductSeriesCode' | 'ourProductModel' |
    'competitorBrand' | 'competitorModel' | 'estimatedValue' | 'specStage' | 'notes'
  >>;
}): Promise<SpecPosition> {
  const rows = await db
    .select()
    .from(pmsSpecPositions)
    .where(and(eq(pmsSpecPositions.id, input.id), eq(pmsSpecPositions.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('spec position not found');
  const p = input.patch;
  const now = new Date();
  await db
    .update(pmsSpecPositions)
    .set({
      ...(p.equipmentFamily !== undefined ? { equipmentFamily: p.equipmentFamily } : {}),
      ...(p.ourBrandStatus !== undefined ? { ourBrandStatus: p.ourBrandStatus } : {}),
      ...(p.ourProductSeriesCode !== undefined ? { ourProductSeriesCode: p.ourProductSeriesCode } : {}),
      ...(p.ourProductModel !== undefined ? { ourProductModel: p.ourProductModel } : {}),
      ...(p.competitorBrand !== undefined ? { competitorBrand: p.competitorBrand } : {}),
      ...(p.competitorModel !== undefined ? { competitorModel: p.competitorModel } : {}),
      ...(p.estimatedValue !== undefined ? { estimatedValue: p.estimatedValue != null ? p.estimatedValue.toString() : null } : {}),
      ...(p.specStage !== undefined ? { specStage: p.specStage } : {}),
      ...(p.notes !== undefined ? { notes: p.notes } : {}),
      updatedBy: input.updatedBy,
      updatedAt: now,
    })
    .where(eq(pmsSpecPositions.id, input.id));
  const updated = await db.select().from(pmsSpecPositions).where(eq(pmsSpecPositions.id, input.id)).limit(1);
  return mapSpec(updated[0]);
}

export async function removeSpecPosition(tenantId: string, id: string): Promise<void> {
  const now = new Date();
  await db
    .update(pmsSpecPositions)
    .set({ archivedAt: now, updatedAt: now })
    .where(and(eq(pmsSpecPositions.id, id), eq(pmsSpecPositions.tenantId, tenantId)));
}

/** 项目规格战况 (查询 + 汇总) */
export async function getSpecCoverage(tenantId: string, projectId: string): Promise<SpecCoverage> {
  const positions = await listSpecPositions(tenantId, projectId);
  return specCoverage(positions);
}
