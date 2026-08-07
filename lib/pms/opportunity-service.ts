/**
 * PMS 路 鍟嗘満绠＄悊鏈嶅姟
 * 涓ユ牸瀵归綈 Drizzle Schema 瀛楁鍚?
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsOpportunities, pmsDuplicateChecks, pmsDuplicateAppeals } from '../infra/drizzle-schema';
import { eq, and, asc, desc, isNull, inArray, ilike, or, count, sql, type SQL } from 'drizzle-orm';
import { checkDuplicate } from './duplicate-check';

function mapOpportunity(row: typeof pmsOpportunities.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgId: row.orgId,
    dealerOrgId: row.dealerOrgId,
    projectId: row.projectId || undefined,
    reporterId: row.reporterId,
    customerName: row.customerName,
    customerPhone: row.customerPhone || undefined,
    customerAddress: row.customerAddress || undefined,
    contactName: row.contactName || undefined,
    contactTitle: row.contactTitle || undefined,
    leadSource: row.leadSource || undefined,
    competitors: (row.competitors as string[] | null) || undefined,
    customerIndustry: row.customerIndustry || undefined,
    projectName: row.projectName,
    stage: row.stage,
    status: row.status,
    estimatedAmount: row.estimatedAmount ? parseFloat(row.estimatedAmount) : undefined,
    estimatedClosingDate: row.estimatedClosingDate || undefined,
    productLine: row.productLine || undefined,
    productSeries: row.productSeries || undefined,
    productSeriesCode: row.productSeriesCode || undefined,
    productModel: row.productModel || undefined,
    productModelCode: row.productModelCode || undefined,
    productCatalogId: row.productCatalogId || undefined,
    productCategory: row.productCategory || undefined,
    productAttributes: (row.productAttributes as Record<string, string> | null) || undefined,
    region: row.region || undefined,
    channel: row.channel || undefined,
    dedupeKey: row.dedupeKey,
    duplicateStatus: row.duplicateStatus || undefined,
    duplicatePeerIds: [],
    duplicateGroupSize: row.duplicateStatus === 'questioned' ? 2 : 1,
    isDuplicateNow: row.duplicateStatus === 'questioned',
    reviewStatus: row.reviewStatus,
    reviewedBy: row.reviewedBy || undefined,
    reviewedAt: row.reviewedAt?.toISOString() || undefined,
    reviewNote: row.reviewNote || undefined,
    lastFollowUpAt: row.lastFollowUpAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() || undefined,
  };
}

/**
 * 鐢熸垚鏌ラ噸閿?
 */
export function generateDedupeKey(customerName: string, customerAddress: string, projectName: string): string {
  const combined = `${customerName}|${customerAddress}|${projectName}`.toLowerCase();
  return Buffer.from(combined).toString('base64').substring(0, 32);
}

const ACTIVE_DUPLICATE_CHECK_STATUSES: Array<'pending' | 'suspect' | 'warning' | 'duplicate'> = [
  'pending',
  'suspect',
  'warning',
  'duplicate',
];

async function getDuplicatePeerIds(opportunityId: string, tenantId: string): Promise<string[]> {
  const rows = await db
    .select({
      opportunityId: pmsDuplicateChecks.opportunityId,
      duplicateOpportunityId: pmsDuplicateChecks.duplicateOpportunityId,
    })
    .from(pmsDuplicateChecks)
    .where(and(
      eq(pmsDuplicateChecks.tenantId, tenantId),
      inArray(pmsDuplicateChecks.status, ACTIVE_DUPLICATE_CHECK_STATUSES),
      or(
        eq(pmsDuplicateChecks.opportunityId, opportunityId),
        eq(pmsDuplicateChecks.duplicateOpportunityId, opportunityId),
      )!,
    ));

  return Array.from(new Set(rows.flatMap((row) => {
    if (row.opportunityId === opportunityId && row.duplicateOpportunityId) return [row.duplicateOpportunityId];
    if (row.duplicateOpportunityId === opportunityId && row.opportunityId) return [row.opportunityId];
    return [];
  })));
}

async function refreshDuplicateStatus(opportunityId: string, tenantId: string): Promise<string[]> {
  const [opportunity] = await db
    .select({
      id: pmsOpportunities.id,
      duplicateStatus: pmsOpportunities.duplicateStatus,
      archivedAt: pmsOpportunities.archivedAt,
    })
    .from(pmsOpportunities)
    .where(and(
      eq(pmsOpportunities.id, opportunityId),
      eq(pmsOpportunities.tenantId, tenantId),
    ))
    .limit(1);

  if (!opportunity) return [];

  const checkRows = await db
    .select({
      opportunityId: pmsDuplicateChecks.opportunityId,
      duplicateOpportunityId: pmsDuplicateChecks.duplicateOpportunityId,
    })
    .from(pmsDuplicateChecks)
    .where(and(
      eq(pmsDuplicateChecks.tenantId, tenantId),
      inArray(pmsDuplicateChecks.status, ACTIVE_DUPLICATE_CHECK_STATUSES),
      or(
        eq(pmsDuplicateChecks.opportunityId, opportunityId),
        eq(pmsDuplicateChecks.duplicateOpportunityId, opportunityId),
      )!,
    ));

  const peerIds = Array.from(new Set(checkRows.flatMap((row) => {
    if (row.opportunityId === opportunityId && row.duplicateOpportunityId) return [row.duplicateOpportunityId];
    if (row.duplicateOpportunityId === opportunityId && row.opportunityId) return [row.opportunityId];
    return [];
  })));

  const activePeerRows = peerIds.length > 0
    ? await db
      .select({ id: pmsOpportunities.id })
      .from(pmsOpportunities)
      .where(and(
        eq(pmsOpportunities.tenantId, tenantId),
        inArray(pmsOpportunities.id, peerIds),
        isNull(pmsOpportunities.archivedAt),
      ))
    : [];
  const activePeerIds = new Set(activePeerRows.map((row) => row.id));

  const shouldQuestion = checkRows.some((row) => (
    (row.opportunityId === opportunityId && !!row.duplicateOpportunityId && activePeerIds.has(row.duplicateOpportunityId))
    || (row.duplicateOpportunityId === opportunityId && !!row.opportunityId && activePeerIds.has(row.opportunityId))
  ));

  const nextStatus = opportunity.duplicateStatus === 'resolved'
    ? 'resolved'
    : shouldQuestion
      ? 'questioned'
      : null;

  if (opportunity.duplicateStatus !== nextStatus) {
    await db
      .update(pmsOpportunities)
      .set({ duplicateStatus: nextStatus, updatedAt: new Date() })
      .where(and(
        eq(pmsOpportunities.id, opportunityId),
        eq(pmsOpportunities.tenantId, tenantId),
      ));
  }

  return peerIds;
}

async function refreshDuplicateNetwork(opportunityId: string, tenantId: string): Promise<void> {
  const peers = await refreshDuplicateStatus(opportunityId, tenantId);
  for (const peerId of peers) {
    await refreshDuplicateStatus(peerId, tenantId);
  }
}

function buildOpportunityConditions(filters: OpportunityListFilters, includeQuery = true): SQL[] {
  const conditions: SQL[] = [eq(pmsOpportunities.tenantId, filters.tenantId)];

  if (filters.orgId) conditions.push(eq(pmsOpportunities.orgId, filters.orgId));
  if (filters.dealerOrgId) conditions.push(eq(pmsOpportunities.dealerOrgId, filters.dealerOrgId));
  if (filters.projectId) conditions.push(eq(pmsOpportunities.projectId, filters.projectId));
  if (filters.unassigned) conditions.push(isNull(pmsOpportunities.projectId));
  if (includeQuery && filters.query?.trim()) {
    const pattern = `%${filters.query.trim().slice(0, 100)}%`;
    conditions.push(or(
      ilike(pmsOpportunities.customerName, pattern),
      ilike(pmsOpportunities.projectName, pattern),
      ilike(pmsOpportunities.contactName, pattern),
      ilike(pmsOpportunities.region, pattern),
      ilike(pmsOpportunities.leadSource, pattern),
    )!);
  }
  if (filters.stage) conditions.push(eq(pmsOpportunities.stage, filters.stage));
  if (filters.status) conditions.push(eq(pmsOpportunities.status, filters.status));
  if (filters.reviewStatus) conditions.push(eq(pmsOpportunities.reviewStatus, filters.reviewStatus));

  if (filters.visibleOrgIds && filters.visibleOrgIds.length > 0) {
    conditions.push(inArray(pmsOpportunities.orgId, filters.visibleOrgIds));
  }

  conditions.push(isNull(pmsOpportunities.archivedAt));
  return conditions;
}

/**
 * 鍒涘缓鍟嗘満锛堝惈鑷姩鏌ラ噸锛?
 */
export async function createOpportunity(input: {
  tenantId: string;
  orgId: string;
  dealerOrgId: string;
  reporterId: string;
  bypassDuplicateCheck?: boolean;
  projectId?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  contactName?: string;
  contactTitle?: string;
  leadSource?: string;
  competitors?: string[];
  customerIndustry?: string;
  projectName: string;
  stage?: string;
  status?: string;
  estimatedAmount?: number;
  estimatedClosingDate?: string;
  productLine?: string;
  productSeries?: string;
  productSeriesCode?: string;
  productModel?: string;
  productModelCode?: string;
  productCatalogId?: string;
  productCategory?: string;
  productAttributes?: Record<string, string>;
  region?: string;
  channel?: string;
  /** 鎶ュ瀹℃牳鍒濆鎬? 缂虹渷 'pending_review' (闇€缁忕悊瀹℃牳鍚庤鍏ユ紡鏂? */
  reviewStatus?: string;
}) {
  const now = new Date();
  const bypassDuplicateCheck = input.bypassDuplicateCheck === true;
  
  // 1. 生成查重键
  const dedupeKey = bypassDuplicateCheck
    ? `import_${nanoid()}`
    : generateDedupeKey(
      input.customerName,
      input.customerAddress || '',
      input.projectName
    );
  
  let duplicateResult:
    | Awaited<ReturnType<typeof checkDuplicate>>
    | undefined;
  let flaggedForReview = false;
  
  if (!bypassDuplicateCheck) {
    // 2. 智能查重
    duplicateResult = await checkDuplicate({
      tenantId: input.tenantId,
      customerName: input.customerName,
      customerAddress: input.customerAddress,
      customerPhone: input.customerPhone,
      projectName: input.projectName,
    });
  
    // 3. 如果查重失败（撞单），返回查重结果 (仅 duplicate 阻断; suspect/warning 放行但标记)
    if (duplicateResult.status === 'duplicate') {
      return {
        opportunity: undefined,
        duplicateCheck: duplicateResult,
      };
    }
    // suspect(疑似)/warning(提示) 均不阻断, 落库后标记 questioned 供人工复核
    flaggedForReview =
      duplicateResult.status === 'warning' || duplicateResult.status === 'suspect';
  }
  // 4. 鍒涘缓鍟嗘満 (dedupeKey 鍞竴绱㈠紩 pms_opp_dedupkey_idx 鍏滃簳骞跺彂绮剧‘鎾炲崟)
  const id = nanoid();
  
  try {
    await db.insert(pmsOpportunities).values({
      id,
      tenantId: input.tenantId,
      orgId: input.orgId,
      dealerOrgId: input.dealerOrgId,
      projectId: input.projectId ?? null,
      reporterId: input.reporterId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerAddress: input.customerAddress,
      contactName: input.contactName,
      contactTitle: input.contactTitle,
      leadSource: input.leadSource,
      competitors: input.competitors,
      customerIndustry: input.customerIndustry,
      projectName: input.projectName,
      stage: input.stage || 'initial_contact',
      status: input.status || 'active',
      estimatedAmount: input.estimatedAmount?.toString(),
      estimatedClosingDate: input.estimatedClosingDate,
      productLine: input.productLine,
      productSeries: input.productSeries,
      productSeriesCode: input.productSeriesCode,
      productModel: input.productModel,
      productModelCode: input.productModelCode,
      productCatalogId: input.productCatalogId,
      productCategory: input.productCategory,
      productAttributes: input.productAttributes,
      region: input.region,
      channel: input.channel,
      dedupeKey,
      duplicateStatus: flaggedForReview ? 'questioned' : null,
      reviewStatus: input.reviewStatus || 'pending_review',
      lastFollowUpAt: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });

    if (flaggedForReview && duplicateResult?.matchDetails?.[0]) {
      await db.insert(pmsDuplicateChecks).values({
        id: nanoid(),
        tenantId: input.tenantId,
        opportunityId: id,
        duplicateOpportunityId: duplicateResult.matchDetails[0].opportunityId,
        similarityScore: duplicateResult.matchDetails[0].similarity.toString(),
        dimensions: duplicateResult.matchDetails[0].dimensions,
        status: duplicateResult.status,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: now,
      });
      await refreshDuplicateNetwork(id, input.tenantId);
    }
  } catch (err) {
    // Postgres 鍞竴绾︽潫鍐茬獊 (23505) 鈫?骞跺彂绮剧‘鎾炲崟, 浜旂淮鏌ラ噸鏈強鎷︽埅.
    // Drizzle 鍖呰 postgres 閿欒: 鐮佸彲鑳藉湪 err.code 鎴?err.cause.code.
    const e = err as { code?: string; cause?: { code?: string } };
    if (e.code === '23505' || e.cause?.code === '23505') {
      return {
        opportunity: undefined,
        duplicateCheck: {
          status: 'duplicate' as const,
          matchedOpportunities: [],
          matchDetails: [],
          reason: 'concurrent_exact_duplicate',
        },
      };
    }
    throw err;
  }
  
  const opportunity = {
    id,
    ...input,
    dedupeKey,
    duplicateStatus: flaggedForReview ? 'questioned' : null,
    lastFollowUpAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  
  return {
    opportunity,
    duplicateCheck: flaggedForReview ? duplicateResult : undefined,
  };
}

/**
 * 鏇存柊鍟嗘満
 */
export async function updateOpportunity(
  opportunityId: string,
  input: {
    projectId?: string;
    customerName?: string;
    projectName?: string;
    stage?: string;
    status?: string;
    contactName?: string | null;
    contactTitle?: string | null;
    leadSource?: string | null;
    competitors?: string[] | null;
    customerIndustry?: string | null;
    customerPhone?: string | null;
    customerAddress?: string | null;
    estimatedAmount?: number | null;
    estimatedClosingDate?: string | null;
    productLine?: string | null;
    productSeries?: string | null;
    productSeriesCode?: string | null;
    productModel?: string | null;
    productModelCode?: string | null;
    productCatalogId?: string | null;
    productCategory?: string | null;
    productAttributes?: Record<string, string> | null;
    region?: string | null;
    channel?: string | null;
  },
  tenantId: string
) {
  const now = new Date();
  const rows = await db
    .select()
    .from(pmsOpportunities)
    .where(and(
      eq(pmsOpportunities.id, opportunityId),
      eq(pmsOpportunities.tenantId, tenantId)
    ))
    .limit(1);
  if (rows.length === 0) return null;

  const current = rows[0];
  const patch: Partial<typeof pmsOpportunities.$inferInsert> = {
    ...input,
    estimatedAmount:
      input.estimatedAmount === undefined
        ? undefined
        : input.estimatedAmount === null
          ? null
          : input.estimatedAmount.toString(),
    updatedAt: now,
  };

  if (
    input.customerName !== undefined ||
    input.customerAddress !== undefined ||
    input.projectName !== undefined
  ) {
    patch.dedupeKey = generateDedupeKey(
      input.customerName ?? current.customerName,
      input.customerAddress ?? current.customerAddress ?? '',
      input.projectName ?? current.projectName
    );
  }

  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<typeof pmsOpportunities.$inferInsert>;

  await db
    .update(pmsOpportunities)
    .set(cleanPatch)
    .where(and(
      eq(pmsOpportunities.id, opportunityId),
      eq(pmsOpportunities.tenantId, tenantId)
    ));

  const duplicateSensitiveChange =
    input.customerName !== undefined ||
    input.customerAddress !== undefined ||
    input.projectName !== undefined ||
    input.customerPhone !== undefined;

  if (duplicateSensitiveChange) {
    const [current] = await db
      .select()
      .from(pmsOpportunities)
      .where(and(
        eq(pmsOpportunities.id, opportunityId),
        eq(pmsOpportunities.tenantId, tenantId)
      ))
      .limit(1);

    if (current) {
      const oldPrimaryChecks = await db
        .select({
          id: pmsDuplicateChecks.id,
          duplicateOpportunityId: pmsDuplicateChecks.duplicateOpportunityId,
        })
        .from(pmsDuplicateChecks)
        .where(and(
          eq(pmsDuplicateChecks.tenantId, tenantId),
          eq(pmsDuplicateChecks.opportunityId, opportunityId),
          inArray(pmsDuplicateChecks.status, ACTIVE_DUPLICATE_CHECK_STATUSES),
        ));

      const oldPeerIds = Array.from(new Set(oldPrimaryChecks.flatMap((row) => (
        row.duplicateOpportunityId ? [row.duplicateOpportunityId] : []
      ))));

      if (oldPrimaryChecks.length > 0) {
        await db
          .delete(pmsDuplicateChecks)
          .where(inArray(pmsDuplicateChecks.id, oldPrimaryChecks.map((row) => row.id)));
      }

      const duplicateResult = await checkDuplicate({
        tenantId,
        customerName: current.customerName,
        customerAddress: current.customerAddress || undefined,
        customerPhone: current.customerPhone || undefined,
        projectName: current.projectName,
        excludeOpportunityId: opportunityId,
      });

      if (duplicateResult.status !== 'pass' && duplicateResult.matchDetails[0]) {
        await db.insert(pmsDuplicateChecks).values({
          id: nanoid(),
          tenantId,
          opportunityId,
          duplicateOpportunityId: duplicateResult.matchDetails[0].opportunityId,
          similarityScore: duplicateResult.matchDetails[0].similarity.toString(),
          dimensions: duplicateResult.matchDetails[0].dimensions,
          status: duplicateResult.status,
          resolvedBy: null,
          resolvedAt: null,
          createdAt: now,
        });
      }

      const refreshedPeers = await refreshDuplicateStatus(opportunityId, tenantId);
      const allPeers = Array.from(new Set([...oldPeerIds, ...refreshedPeers].filter((peerId) => peerId !== opportunityId)));
      for (const peerId of allPeers) {
        await refreshDuplicateStatus(peerId, tenantId);
      }
    }
  }

  return getOpportunity(opportunityId, tenantId);
}

/**
 * 鎶ュ瀹℃牳: 缁忕悊閫氳繃/椹冲洖鍟嗘満鎶ュ.
 *   approved 鈫?璁″叆婕忔枟涓庡垎鏋?
 *   rejected 鈫?閫€鍥? 涓嶈鍏ユ紡鏂?
 */
export async function reviewOpportunity(
  opportunityId: string,
  decision: 'approved' | 'rejected',
  reviewerId: string,
  tenantId: string,
  note?: string,
): Promise<{ id: string; reviewStatus: string }> {
  const now = new Date();
  await db
    .update(pmsOpportunities)
    .set({
      reviewStatus: decision,
      reviewedBy: reviewerId,
      reviewedAt: now,
      reviewNote: note ?? null,
      updatedAt: now,
    })
    .where(and(
      eq(pmsOpportunities.id, opportunityId),
      eq(pmsOpportunities.tenantId, tenantId),
    ));
  return { id: opportunityId, reviewStatus: decision };
}

/**
 * 鑾峰彇鍟嗘満璇︽儏
 */
export async function getOpportunity(
  opportunityId: string,
  tenantId: string,
  visibleOrgIds?: string[]
): Promise<ReturnType<typeof mapOpportunity> | null> {
  const rows = await db
    .select()
    .from(pmsOpportunities)
    .where(and(
      eq(pmsOpportunities.id, opportunityId),
      eq(pmsOpportunities.tenantId, tenantId)
    ))
    .limit(1);
  
  if (rows.length === 0) return null;
  
  const row = rows[0];
  // orgId 闅旂: 澶栭儴缁忛攢鍟嗕粎鍙鑷韩 org 闆嗗悎 (鍐呴儴浼?undefined = 鍏ㄩ€?
  if (visibleOrgIds && visibleOrgIds.length > 0 && !visibleOrgIds.includes(row.orgId)) {
    return null;
  }
  return mapOpportunity(row);
}

export interface OpportunityListFilters {
  tenantId: string;
  orgId?: string;
  dealerOrgId?: string;
  projectId?: string;
  /** true = 浠呰繑鍥炴湭褰掑睘浠讳綍宸ョ▼椤圭洰鐨勫晢鏈虹嚎绱?(projectId 涓虹┖). 涓?projectId 浜掓枼. */
  unassigned?: boolean;
  query?: string;
  stage?: string;
  status?: string;
  /** 瀹℃牳鎬佽繃婊? 'approved' | 'pending_review' | 'rejected' */
  reviewStatus?: string;
  limit?: number;
  offset?: number;
  /** 澶栭儴缁忛攢鍟嗗彲瑙?org 闆嗗悎. 浼犲叆涓旈潪绌?鈫?寮哄埗 orgId 鈭?闆嗗悎. 鍐呴儴瑙掕壊浼?undefined = 鍏ㄩ€? */
  visibleOrgIds?: string[];
}

export interface OpportunityListPage {
  opportunities: ReturnType<typeof mapOpportunity>[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  duplicateStats: {
    total: number;
    reviewed: number;
    pending: number;
  };
}

/**
 * 鍒楄〃鏌ヨ鍟嗘満
 */
export async function listOpportunities(filters: OpportunityListFilters): Promise<ReturnType<typeof mapOpportunity>[]> {
  const conditions = buildOpportunityConditions(filters);
  
  const rows = await db
    .select()
    .from(pmsOpportunities)
    .where(and(...conditions))
    .orderBy(desc(pmsOpportunities.createdAt))
    .limit(filters.limit || 50)
    .offset(filters.offset || 0);

  return rows.map((row) => mapOpportunity(row));
}

/**
 * 鍒嗛〉鏌ヨ鍟嗘満锛屽苟杩斿洖鎬绘暟
 */
export async function listOpportunitiesPage(filters: OpportunityListFilters): Promise<OpportunityListPage> {
  const limit = Math.max(1, Math.min(100, filters.limit || 20));
  const offset = Math.max(0, filters.offset || 0);
  const conditions = buildOpportunityConditions(filters);
  const where = and(...conditions);
  const sortDuplicateFirst = sql<number>`case when ${pmsOpportunities.duplicateStatus} = 'questioned' then 0 else 1 end`;

  const [rows, totalRows, duplicateStatRows] = await Promise.all([
    db
      .select()
      .from(pmsOpportunities)
      .where(where)
      .orderBy(sortDuplicateFirst, desc(pmsOpportunities.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(pmsOpportunities)
      .where(where),
    db
      .select({
        total: sql<number>`count(*) filter (where ${pmsOpportunities.duplicateStatus} in ('questioned', 'resolved'))`,
        reviewed: sql<number>`count(*) filter (where ${pmsOpportunities.duplicateStatus} = 'resolved')`,
        pending: sql<number>`count(*) filter (where ${pmsOpportunities.duplicateStatus} = 'questioned')`,
      })
      .from(pmsOpportunities)
      .where(where),
  ]);
  const total = Number(totalRows[0]?.total ?? 0);
  const duplicateStats = duplicateStatRows[0] || { total: 0, reviewed: 0, pending: 0 };

  return {
    opportunities: rows.map((row) => mapOpportunity(row)),
    total,
    limit,
    offset,
    hasMore: offset + rows.length < total,
    duplicateStats: {
      total: Number(duplicateStats.total ?? 0),
      reviewed: Number(duplicateStats.reviewed ?? 0),
      pending: Number(duplicateStats.pending ?? 0),
    },
  };
}

/**
 * 鍏宠仈/瑙ｇ粦鍟嗘満鍒板伐绋嬮」鐩?(椤圭洰鍨嬮攢鍞? 1 椤圭洰 : N 鎶ヤ环/绔炴爣)
 * projectId=null 瑙ｇ粦.
 */
export async function linkOpportunityToProject(
  opportunityId: string,
  projectId: string | null,
  tenantId: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(pmsOpportunities)
    .set({ projectId, updatedAt: now })
    .where(and(eq(pmsOpportunities.id, opportunityId), eq(pmsOpportunities.tenantId, tenantId)));
}

/**
 * 褰掓。鍟嗘満锛堣蒋鍒犻櫎锛?
 */
export async function archiveOpportunity(opportunityId: string, tenantId: string): Promise<void> {
  const now = new Date();

  const peerIds = await getDuplicatePeerIds(opportunityId, tenantId);
  await db
    .update(pmsOpportunities)
    .set({ archivedAt: now, duplicateStatus: null, updatedAt: now })
    .where(and(
      eq(pmsOpportunities.id, opportunityId),
      eq(pmsOpportunities.tenantId, tenantId)
    ));

  for (const peerId of peerIds) {
    await refreshDuplicateStatus(peerId, tenantId);
  }
}

export async function getOpportunityWithLiveDuplicateState(
  opportunityId: string,
  tenantId: string,
  visibleOrgIds?: string[],
): Promise<ReturnType<typeof mapOpportunity> | null> {
  const base = await getOpportunity(opportunityId, tenantId, visibleOrgIds);
  if (!base) return null;
  await refreshDuplicateNetwork(opportunityId, tenantId);
  return getOpportunity(opportunityId, tenantId, visibleOrgIds);
}

export async function submitOpportunityDuplicateReview(input: {
  tenantId: string;
  opportunityId: string;
  reviewerId: string;
  decision: 'duplicate' | 'not_duplicate';
  note?: string;
  visibleOrgIds?: string[];
}) {
  const now = new Date();
  const opportunityRows = await db
    .select()
    .from(pmsOpportunities)
    .where(and(
      eq(pmsOpportunities.id, input.opportunityId),
      eq(pmsOpportunities.tenantId, input.tenantId),
    ))
    .limit(1);
  if (opportunityRows.length === 0) {
    return null;
  }
  const opportunity = opportunityRows[0];
  if (input.visibleOrgIds && input.visibleOrgIds.length > 0 && !input.visibleOrgIds.includes(opportunity.orgId)) {
    return null;
  }

  const isDuplicateNow = opportunity.duplicateStatus === 'questioned';
  if (!isDuplicateNow && input.decision === 'duplicate') {
    throw new Error('当前商机未命中疑似重复，无法提交“重复”结果');
  }

  const peerIds = await getDuplicatePeerIds(input.opportunityId, input.tenantId);
  const duplicateCheckId = nanoid();
  const appealId = nanoid();
  const dimensions = isDuplicateNow ? ['customerName', 'projectName', 'customerAddress'] : [];

  await db.transaction(async (tx) => {
    await tx
      .update(pmsDuplicateChecks)
      .set({
        status: 'resolved',
        resolvedBy: input.reviewerId,
        resolvedAt: now,
      })
      .where(and(
        eq(pmsDuplicateChecks.tenantId, input.tenantId),
        or(
          eq(pmsDuplicateChecks.opportunityId, input.opportunityId),
          eq(pmsDuplicateChecks.duplicateOpportunityId, input.opportunityId),
        )!,
        inArray(pmsDuplicateChecks.status, ACTIVE_DUPLICATE_CHECK_STATUSES),
      ));

    await tx.insert(pmsDuplicateChecks).values({
      id: duplicateCheckId,
      tenantId: input.tenantId,
      opportunityId: input.opportunityId,
      duplicateOpportunityId: peerIds[0] || null,
      similarityScore: isDuplicateNow ? '1' : '0',
      dimensions,
      status: 'resolved',
      resolvedBy: input.reviewerId,
      resolvedAt: now,
      createdAt: now,
    });

    await tx.insert(pmsDuplicateAppeals).values({
      id: appealId,
      tenantId: input.tenantId,
      duplicateCheckId,
      appealerId: input.reviewerId,
      reason: input.note?.trim() || '人工核验结果上传',
      evidence: null,
      status: input.decision === 'duplicate' ? 'approved' : 'rejected',
      arbitratedBy: input.reviewerId,
      arbitrationResult: input.decision,
      arbitrationReason: input.note?.trim() || null,
      arbitratedAt: now,
      createdAt: now,
    });

    await tx
      .update(pmsOpportunities)
      .set({
        duplicateStatus: 'resolved',
        updatedAt: now,
      })
      .where(and(
        eq(pmsOpportunities.id, input.opportunityId),
        eq(pmsOpportunities.tenantId, input.tenantId),
      ));
  });

  for (const peerId of peerIds) {
    await refreshDuplicateStatus(peerId, input.tenantId);
  }

  return {
    duplicateCheckId,
    appealId,
    decision: input.decision,
    duplicateOpportunityId: peerIds[0] || null,
    duplicateGroupSize: isDuplicateNow ? 2 : 1,
  };
}

export async function rebuildOpportunityDuplicateStateBatch(input: {
  tenantId: string;
  limit: number;
  offset: number;
  visibleOrgIds?: string[];
}) {
  const limit = Math.max(1, Math.min(100, input.limit));
  const offset = Math.max(0, input.offset);
  const conditions: SQL[] = [
    eq(pmsOpportunities.tenantId, input.tenantId),
    isNull(pmsOpportunities.archivedAt),
  ];
  if (input.visibleOrgIds && input.visibleOrgIds.length > 0) {
    conditions.push(inArray(pmsOpportunities.orgId, input.visibleOrgIds));
  }

  const where = and(...conditions);
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: pmsOpportunities.id,
        customerName: pmsOpportunities.customerName,
        customerPhone: pmsOpportunities.customerPhone,
        customerAddress: pmsOpportunities.customerAddress,
        projectName: pmsOpportunities.projectName,
        duplicateStatus: pmsOpportunities.duplicateStatus,
      })
      .from(pmsOpportunities)
      .where(where)
      .orderBy(asc(pmsOpportunities.createdAt), asc(pmsOpportunities.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(pmsOpportunities)
      .where(where),
  ]);

  let flagged = 0;
  let cleared = 0;

  for (const row of rows) {
    if (row.duplicateStatus === 'resolved') continue;

    const duplicateResult = await checkDuplicate({
      tenantId: input.tenantId,
      customerName: row.customerName,
      customerAddress: row.customerAddress || undefined,
      customerPhone: row.customerPhone || undefined,
      projectName: row.projectName,
      excludeOpportunityId: row.id,
    });

    await db
      .delete(pmsDuplicateChecks)
      .where(and(
        eq(pmsDuplicateChecks.tenantId, input.tenantId),
        or(
          eq(pmsDuplicateChecks.opportunityId, row.id),
          eq(pmsDuplicateChecks.duplicateOpportunityId, row.id),
        )!,
        inArray(pmsDuplicateChecks.status, ACTIVE_DUPLICATE_CHECK_STATUSES),
      ));

    if (duplicateResult.status === 'pass' || duplicateResult.matchDetails.length === 0) {
      await db
        .update(pmsOpportunities)
        .set({ duplicateStatus: null, updatedAt: new Date() })
        .where(and(
          eq(pmsOpportunities.id, row.id),
          eq(pmsOpportunities.tenantId, input.tenantId),
        ));
      cleared++;
      continue;
    }

    await db.insert(pmsDuplicateChecks).values({
      id: nanoid(),
      tenantId: input.tenantId,
      opportunityId: row.id,
      duplicateOpportunityId: duplicateResult.matchDetails[0].opportunityId,
      similarityScore: duplicateResult.matchDetails[0].similarity.toString(),
      dimensions: duplicateResult.matchDetails[0].dimensions,
      status: duplicateResult.status,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: new Date(),
    });

    await db
      .update(pmsOpportunities)
      .set({ duplicateStatus: 'questioned', updatedAt: new Date() })
      .where(and(
        eq(pmsOpportunities.id, row.id),
        eq(pmsOpportunities.tenantId, input.tenantId),
      ));
    flagged++;
  }

  const total = Number(totalRows[0]?.total ?? 0);
  return {
    total,
    processed: rows.length,
    flagged,
    cleared,
    nextOffset: offset + rows.length,
    done: offset + rows.length >= total,
  };
}

