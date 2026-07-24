/**
 * PMS · 经销商档案 + 资质服务 (DMS)
 *
 * 业务: 经销商组织档案 (扩展 organizations) + 五类资质证照管理 (审批/到期).
 * 对齐 drizzle 表 pms_dealer_org_profiles (orgId 唯一) / pms_dealer_qualifications.
 * 隔离: profile 有 orgId; 资质经 dealerOrgId.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsDealerOrgProfiles, pmsDealerQualifications } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';

// --- 纯函数 (可测) ---

/** 资质是否在有效期内 (到期日 >= now) */
export function isQualificationValid(expiryDate: string | null | undefined, now: Date): boolean {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate + (expiryDate.length === 10 ? 'T23:59:59Z' : ''));
  if (isNaN(exp.getTime())) return false;
  return exp.getTime() >= now.getTime();
}

/** 仅 pending 资质可审批 */
export function canApproveQualification(status: string): boolean {
  return status === 'pending';
}

// --- DB ---

function mapProfile(row: typeof pmsDealerOrgProfiles.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgId: row.orgId,
    contactName: row.contactName || undefined,
    contactPhone: row.contactPhone || undefined,
    contactEmail: row.contactEmail || undefined,
    businessLicense: row.businessLicense || undefined,
    registeredCapital: row.registeredCapital != null ? parseFloat(row.registeredCapital) : undefined,
    establishedDate: row.establishedDate || undefined,
    coverageRegions: row.coverageRegions ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapQual(row: typeof pmsDealerQualifications.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    dealerOrgId: row.dealerOrgId,
    type: row.type,
    certificateNumber: row.certificateNumber || undefined,
    issuedBy: row.issuedBy || undefined,
    issuedDate: row.issuedDate || undefined,
    expiryDate: row.expiryDate || undefined,
    status: row.status,
    approvedBy: row.approvedBy || undefined,
    approvedAt: row.approvedAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** upsert 经销商档案 (按 orgId 唯一) */
export async function upsertDealerProfile(input: {
  tenantId: string;
  orgId: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  businessLicense?: string;
  registeredCapital?: number;
  establishedDate?: string;
  coverageRegions?: string[];
}) {
  const now = new Date();
  const existing = await db
    .select()
    .from(pmsDealerOrgProfiles)
    .where(and(eq(pmsDealerOrgProfiles.tenantId, input.tenantId), eq(pmsDealerOrgProfiles.orgId, input.orgId)))
    .limit(1);

  const fields = {
    contactName: input.contactName ?? null,
    contactPhone: input.contactPhone ?? null,
    contactEmail: input.contactEmail ?? null,
    businessLicense: input.businessLicense ?? null,
    registeredCapital: input.registeredCapital != null ? input.registeredCapital.toString() : null,
    establishedDate: input.establishedDate ?? null,
    coverageRegions: input.coverageRegions ?? [],
    updatedAt: now,
  };

  if (existing.length > 0) {
    await db
      .update(pmsDealerOrgProfiles)
      .set(fields)
      .where(eq(pmsDealerOrgProfiles.id, existing[0].id));
    return { ...mapProfile(existing[0]), ...input, updatedAt: now.toISOString() };
  }

  const id = nanoid();
  await db.insert(pmsDealerOrgProfiles).values({
    id,
    tenantId: input.tenantId,
    orgId: input.orgId,
    ...fields,
    createdAt: now,
  });
  return { id, ...input, createdAt: now.toISOString() };
}

/** 获取经销商档案 (按 orgId) */
export async function getDealerProfile(orgId: string, tenantId: string): Promise<ReturnType<typeof mapProfile> | null> {
  const rows = await db
    .select()
    .from(pmsDealerOrgProfiles)
    .where(and(eq(pmsDealerOrgProfiles.orgId, orgId), eq(pmsDealerOrgProfiles.tenantId, tenantId)))
    .limit(1);
  return rows.length ? mapProfile(rows[0]) : null;
}

/** 列出经销商档案 (可选 orgId 过滤集合) */
export async function listDealerProfiles(filters: {
  tenantId: string;
  limit?: number;
  offset?: number;
}): Promise<ReturnType<typeof mapProfile>[]> {
  const rows = await db
    .select()
    .from(pmsDealerOrgProfiles)
    .where(eq(pmsDealerOrgProfiles.tenantId, filters.tenantId))
    .orderBy(desc(pmsDealerOrgProfiles.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);
  return rows.map(mapProfile);
}

/** 新增资质 (pending) */
export async function addQualification(input: {
  tenantId: string;
  dealerOrgId: string;
  type: string;
  certificateNumber?: string;
  issuedBy?: string;
  issuedDate?: string;
  expiryDate?: string;
}) {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsDealerQualifications).values({
    id,
    tenantId: input.tenantId,
    dealerOrgId: input.dealerOrgId,
    type: input.type,
    certificateNumber: input.certificateNumber ?? null,
    issuedBy: input.issuedBy ?? null,
    issuedDate: input.issuedDate ?? null,
    expiryDate: input.expiryDate ?? null,
    status: 'pending',
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return { id, ...input, status: 'pending', createdAt: now.toISOString() };
}

/** 列出资质 (按 dealerOrgId) */
export async function listQualifications(filters: {
  tenantId: string;
  dealerOrgId?: string;
  type?: string;
  status?: string;
}): Promise<ReturnType<typeof mapQual>[]> {
  const conditions = [eq(pmsDealerQualifications.tenantId, filters.tenantId)];
  if (filters.dealerOrgId) conditions.push(eq(pmsDealerQualifications.dealerOrgId, filters.dealerOrgId));
  if (filters.type) conditions.push(eq(pmsDealerQualifications.type, filters.type));
  if (filters.status) conditions.push(eq(pmsDealerQualifications.status, filters.status));
  const rows = await db
    .select()
    .from(pmsDealerQualifications)
    .where(and(...conditions))
    .orderBy(desc(pmsDealerQualifications.createdAt));
  return rows.map(mapQual);
}

/** 审批/驳回资质 */
export async function decideQualification(input: {
  tenantId: string;
  qualificationId: string;
  approverId: string;
  decision: 'approved' | 'rejected';
}) {
  const now = new Date();
  const rows = await db
    .select()
    .from(pmsDealerQualifications)
    .where(and(eq(pmsDealerQualifications.id, input.qualificationId), eq(pmsDealerQualifications.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('qualification not found');
  if (!canApproveQualification(rows[0].status)) throw new Error('qualification not decidable');

  await db
    .update(pmsDealerQualifications)
    .set({ status: input.decision, approvedBy: input.approverId, approvedAt: now, updatedAt: now })
    .where(eq(pmsDealerQualifications.id, input.qualificationId));

  return { qualificationId: input.qualificationId, status: input.decision, approvedBy: input.approverId, approvedAt: now.toISOString() };
}
