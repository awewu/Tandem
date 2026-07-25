/**
 * PMS · 招投标 + 提交物服务 (项目型销售投标阶段)
 *
 * 业务:
 *   - 招投标记录 FSM: preparing→submitted→opened→won | lost
 *   - 提交物/图纸版本管理: 新版本 supersedes 旧版本, version 自增, 审批留痕
 * 对齐 drizzle 表 pms_tenders / pms_submittals.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsTenders, pmsSubmittals } from '../infra/drizzle-schema';
import { and, eq, desc, isNull } from 'drizzle-orm';
import type {
  Tender,
  TenderType,
  TenderStatus,
  Submittal,
  SubmittalDocType,
  SubmittalStatus,
} from '@/lib/types/pms';

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

const TENDER_TRANSITIONS: Record<TenderStatus, TenderStatus[]> = {
  preparing: ['submitted', 'lost'],
  submitted: ['opened', 'lost'],
  opened: ['won', 'lost'],
  won: [],
  lost: [],
};

/** 招投标状态流转是否合法 */
export function canTransitionTender(from: string, to: string): boolean {
  const allowed = TENDER_TRANSITIONS[from as TenderStatus];
  if (!allowed) return false;
  return allowed.includes(to as TenderStatus);
}

/** 报价相对控制价的下浮率 (%). budget<=0 → null; bid>=budget → 0 (无下浮). */
export function bidDiscountRate(budgetAmount?: number, bidAmount?: number): number | null {
  if (budgetAmount == null || bidAmount == null || !(budgetAmount > 0)) return null;
  const rate = (1 - bidAmount / budgetAmount) * 100;
  if (rate <= 0) return 0;
  return Math.round(rate * 100) / 100;
}

// ---------------------------------------------------------------------------
// DB · 招投标
// ---------------------------------------------------------------------------

function mapTender(row: typeof pmsTenders.$inferSelect): Tender {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    tenderNo: row.tenderNo || undefined,
    tenderName: row.tenderName,
    tenderType: (row.tenderType || 'open') as TenderType,
    status: (row.status || 'preparing') as TenderStatus,
    bidAmount: row.bidAmount != null ? parseFloat(row.bidAmount) : undefined,
    budgetAmount: row.budgetAmount != null ? parseFloat(row.budgetAmount) : undefined,
    publishedAt: row.publishedAt || undefined,
    submitDeadline: row.submitDeadline || undefined,
    submittedAt: row.submittedAt || undefined,
    openedAt: row.openedAt || undefined,
    winnerName: row.winnerName || undefined,
    ourRank: row.ourRank != null ? row.ourRank : undefined,
    result: row.result || undefined,
    notes: row.notes || undefined,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : undefined,
  };
}

export async function createTender(input: {
  tenantId: string;
  projectId: string;
  tenderName: string;
  tenderNo?: string;
  tenderType?: TenderType;
  bidAmount?: number;
  budgetAmount?: number;
  publishedAt?: string;
  submitDeadline?: string;
  notes?: string;
  createdBy: string;
}): Promise<Tender> {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsTenders).values({
    id,
    tenantId: input.tenantId,
    projectId: input.projectId,
    tenderNo: input.tenderNo ?? null,
    tenderName: input.tenderName,
    tenderType: input.tenderType ?? 'open',
    status: 'preparing',
    bidAmount: input.bidAmount != null ? input.bidAmount.toString() : null,
    budgetAmount: input.budgetAmount != null ? input.budgetAmount.toString() : null,
    publishedAt: input.publishedAt ?? null,
    submitDeadline: input.submitDeadline ?? null,
    notes: input.notes ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(pmsTenders).where(eq(pmsTenders.id, id)).limit(1);
  return mapTender(rows[0]);
}

export async function listTenders(tenantId: string, projectId: string): Promise<Tender[]> {
  const rows = await db
    .select()
    .from(pmsTenders)
    .where(and(eq(pmsTenders.tenantId, tenantId), eq(pmsTenders.projectId, projectId), isNull(pmsTenders.archivedAt)))
    .orderBy(desc(pmsTenders.createdAt));
  return rows.map(mapTender);
}

/** 招投标状态流转 (FSM 守卫; submitted/opened 自动打时间戳) */
export async function transitionTender(input: {
  tenantId: string;
  id: string;
  toStatus: TenderStatus;
  winnerName?: string;
  ourRank?: number;
  result?: string;
}): Promise<Tender> {
  const rows = await db
    .select()
    .from(pmsTenders)
    .where(and(eq(pmsTenders.id, input.id), eq(pmsTenders.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('tender not found');
  const from = rows[0].status as TenderStatus;
  if (!canTransitionTender(from, input.toStatus)) {
    throw new Error(`invalid tender status transition: ${from} → ${input.toStatus}`);
  }
  const now = new Date();
  const nowIso = now.toISOString();
  await db
    .update(pmsTenders)
    .set({
      status: input.toStatus,
      ...(input.toStatus === 'submitted' ? { submittedAt: nowIso } : {}),
      ...(input.toStatus === 'opened' ? { openedAt: nowIso } : {}),
      ...(input.winnerName !== undefined ? { winnerName: input.winnerName } : {}),
      ...(input.ourRank !== undefined ? { ourRank: input.ourRank } : {}),
      ...(input.result !== undefined ? { result: input.result } : {}),
      updatedAt: now,
    })
    .where(eq(pmsTenders.id, input.id));
  const updated = await db.select().from(pmsTenders).where(eq(pmsTenders.id, input.id)).limit(1);
  return mapTender(updated[0]);
}

export async function archiveTender(tenantId: string, id: string): Promise<void> {
  const now = new Date();
  await db
    .update(pmsTenders)
    .set({ archivedAt: now, updatedAt: now })
    .where(and(eq(pmsTenders.id, id), eq(pmsTenders.tenantId, tenantId)));
}

// ---------------------------------------------------------------------------
// DB · 提交物 (版本管理)
// ---------------------------------------------------------------------------

function mapSubmittal(row: typeof pmsSubmittals.$inferSelect): Submittal {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    tenderId: row.tenderId || undefined,
    docType: (row.docType || 'drawing') as SubmittalDocType,
    title: row.title,
    version: row.version ?? 1,
    fileUrl: row.fileUrl || undefined,
    status: (row.status || 'draft') as SubmittalStatus,
    submittedTo: row.submittedTo || undefined,
    submittedAt: row.submittedAt || undefined,
    reviewedBy: row.reviewedBy || undefined,
    reviewedAt: row.reviewedAt || undefined,
    reviewNotes: row.reviewNotes || undefined,
    supersedesId: row.supersedesId || undefined,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : undefined,
  };
}

export async function createSubmittal(input: {
  tenantId: string;
  projectId: string;
  tenderId?: string;
  docType?: SubmittalDocType;
  title: string;
  fileUrl?: string;
  submittedTo?: string;
  createdBy: string;
}): Promise<Submittal> {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsSubmittals).values({
    id,
    tenantId: input.tenantId,
    projectId: input.projectId,
    tenderId: input.tenderId ?? null,
    docType: input.docType ?? 'drawing',
    title: input.title,
    version: 1,
    fileUrl: input.fileUrl ?? null,
    status: 'draft',
    submittedTo: input.submittedTo ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(pmsSubmittals).where(eq(pmsSubmittals.id, id)).limit(1);
  return mapSubmittal(rows[0]);
}

/**
 * 新版本: 基于旧提交物创建 version+1 的新记录, supersedesId 指向旧版本.
 * 旧版本保留 (历史), 新版本 status 回到 draft.
 */
export async function reviseSubmittal(input: {
  tenantId: string;
  id: string; // 被取代的旧版本
  fileUrl?: string;
  title?: string;
  createdBy: string;
}): Promise<Submittal> {
  const rows = await db
    .select()
    .from(pmsSubmittals)
    .where(and(eq(pmsSubmittals.id, input.id), eq(pmsSubmittals.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('submittal not found');
  const prev = rows[0];
  const now = new Date();
  const newId = nanoid();
  await db.insert(pmsSubmittals).values({
    id: newId,
    tenantId: prev.tenantId,
    projectId: prev.projectId,
    tenderId: prev.tenderId,
    docType: prev.docType,
    title: input.title ?? prev.title,
    version: (prev.version ?? 1) + 1,
    fileUrl: input.fileUrl ?? prev.fileUrl,
    status: 'draft',
    submittedTo: prev.submittedTo,
    supersedesId: prev.id,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  const created = await db.select().from(pmsSubmittals).where(eq(pmsSubmittals.id, newId)).limit(1);
  return mapSubmittal(created[0]);
}

/** 提交/评审留痕 (submitted/approved/rejected/revision_required) */
export async function reviewSubmittal(input: {
  tenantId: string;
  id: string;
  status: SubmittalStatus;
  reviewedBy?: string;
  reviewNotes?: string;
  submittedTo?: string;
}): Promise<Submittal> {
  const rows = await db
    .select()
    .from(pmsSubmittals)
    .where(and(eq(pmsSubmittals.id, input.id), eq(pmsSubmittals.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('submittal not found');
  const now = new Date();
  const nowIso = now.toISOString();
  const isReviewDecision = ['approved', 'rejected', 'revision_required'].includes(input.status);
  await db
    .update(pmsSubmittals)
    .set({
      status: input.status,
      ...(input.status === 'submitted' ? { submittedAt: nowIso } : {}),
      ...(input.submittedTo !== undefined ? { submittedTo: input.submittedTo } : {}),
      ...(isReviewDecision ? { reviewedBy: input.reviewedBy ?? null, reviewedAt: nowIso } : {}),
      ...(input.reviewNotes !== undefined ? { reviewNotes: input.reviewNotes } : {}),
      updatedAt: now,
    })
    .where(eq(pmsSubmittals.id, input.id));
  const updated = await db.select().from(pmsSubmittals).where(eq(pmsSubmittals.id, input.id)).limit(1);
  return mapSubmittal(updated[0]);
}

export async function listSubmittals(tenantId: string, projectId: string): Promise<Submittal[]> {
  const rows = await db
    .select()
    .from(pmsSubmittals)
    .where(and(eq(pmsSubmittals.tenantId, tenantId), eq(pmsSubmittals.projectId, projectId), isNull(pmsSubmittals.archivedAt)))
    .orderBy(desc(pmsSubmittals.createdAt));
  return rows.map(mapSubmittal);
}
