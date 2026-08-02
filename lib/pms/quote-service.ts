/**
 * PMS · 报价单服务 (三层文档模型)
 *
 * 业务链: draft 草稿 → issue 签发(生成验真码) → 客户验真。改价=revise 出新版本(version+1, 旧版 superseded)。
 * 报备保护绑定: 只有持该报备(active + orgId 归属)的经销商能对该项目签发报价 → 授予唯一官方背书报价权。
 * 验真: 公开零登录, 只回真伪 + 授权经销商 (不露价)。经销商自由报价, 不走审批。
 * 数据层: drizzle pms_quotes (systems/terms 存 jsonb), tenantId + orgId 双层隔离。
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsQuotes } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';
import { getStore } from '../storage/repository';
import { getOpportunity } from './opportunity-service';
import { recomputeQuote, genVerifyCode } from './quote-calc';
import { audit } from '../audit/log';
import type {
  Quote,
  QuoteSystem,
  QuoteTerms,
  QuoteStatus,
  QuoteVerifyView,
} from '@/lib/types/pms';

// --- 授权上下文 (来自 requirePmsAuth) ---
export interface QuoteAuthCtx {
  tenantId: string;
  userId: string;
  visibleOrgIds: string[];
  isInternal: boolean;
  /** 角色列表 (细分写权限用, 如选型规则集维护); 报价主流程不依赖此字段 */
  roles?: string[];
}

function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

function mapQuote(row: typeof pmsQuotes.$inferSelect): Quote {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgId: row.orgId,
    dealerOrgId: row.dealerOrgId,
    opportunityId: row.opportunityId,
    projectId: row.projectId || undefined,
    issuerId: row.issuerId,
    title: row.title,
    customerName: row.customerName,
    customerContact: row.customerContact || undefined,
    scenario: row.scenario || undefined,
    systems: (row.systems as QuoteSystem[] | null) ?? [],
    totals: {
      equipment: num(row.equipmentTotal),
      material: num(row.materialTotal),
      installation: num(row.installTotal),
      freight: num(row.freightTotal),
      tax: num(row.taxTotal),
      service: num(row.serviceTotal),
      other: num(row.otherTotal),
      total: num(row.totalAmount),
    },
    currency: row.currency,
    terms: (row.terms as QuoteTerms | null) || undefined,
    validUntil: row.validUntil?.toISOString(),
    version: row.version,
    status: row.status as QuoteStatus,
    verifyCode: row.verifyCode || undefined,
    supersededById: row.supersededById || undefined,
    issuedAt: row.issuedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 报备保护绑定校验: 该报备存在、可见(orgId 归属)、且处于 active(持保护期)。
 * 返回归属的 opportunity (含 orgId/dealerOrgId), 供报价单继承归属。
 */
type OpportunityRecord = NonNullable<Awaited<ReturnType<typeof getOpportunity>>>;

async function assertQuoteAuthorization(
  opportunityId: string,
  auth: QuoteAuthCtx,
): Promise<OpportunityRecord> {
  const opp = await getOpportunity(
    opportunityId,
    auth.tenantId,
    auth.isInternal ? undefined : auth.visibleOrgIds,
  );
  if (!opp) {
    throw new Response('报备不存在或无权限', { status: 403 });
  }
  if (opp.status !== 'active') {
    throw new Response('该报备未处于保护期, 无法签发报价', { status: 409 });
  }
  return opp;
}

function totalsToColumns(totals: Quote['totals']) {
  return {
    equipmentTotal: String(totals.equipment),
    materialTotal: String(totals.material),
    installTotal: String(totals.installation),
    freightTotal: String(totals.freight),
    taxTotal: String(totals.tax),
    serviceTotal: String(totals.service),
    otherTotal: String(totals.other),
    totalAmount: String(totals.total),
  };
}

// ============================================================================
// CRUD
// ============================================================================

export async function createQuote(
  input: {
    opportunityId: string;
    title: string;
    customerName: string;
    customerContact?: string;
    scenario?: string;
    systems?: QuoteSystem[];
    terms?: QuoteTerms;
    validUntil?: string;
  },
  auth: QuoteAuthCtx,
): Promise<Quote> {
  const opp = await assertQuoteAuthorization(input.opportunityId, auth);
  const { systems, totals } = recomputeQuote(input.systems ?? []);
  const now = new Date();
  const id = nanoid();

  await db.insert(pmsQuotes).values({
    id,
    tenantId: auth.tenantId,
    orgId: opp!.orgId,
    dealerOrgId: opp!.dealerOrgId,
    opportunityId: input.opportunityId,
    projectId: opp!.projectId ?? null,
    issuerId: auth.userId,
    title: input.title,
    customerName: input.customerName || opp!.customerName,
    customerContact: input.customerContact ?? null,
    scenario: input.scenario ?? null,
    systems,
    currency: 'CNY',
    ...totalsToColumns(totals),
    terms: input.terms ?? null,
    validUntil: input.validUntil ? new Date(input.validUntil) : null,
    version: 1,
    status: 'draft',
    verifyCode: null,
    supersededById: null,
    issuedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  await audit('pms.quote.created', auth.userId, {
    targetId: id,
    targetType: 'pms_quote',
    tenantId: auth.tenantId,
    metadata: {
      opportunityId: input.opportunityId,
      orgId: opp!.orgId,
      dealerOrgId: opp!.dealerOrgId,
      totalAmount: totals.total,
    },
  });

  return (await getQuote(id, auth))!;
}

export async function getQuote(id: string, auth: QuoteAuthCtx): Promise<Quote | null> {
  const rows = await db
    .select()
    .from(pmsQuotes)
    .where(and(eq(pmsQuotes.id, id), eq(pmsQuotes.tenantId, auth.tenantId)))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (!auth.isInternal && auth.visibleOrgIds.length > 0 && !auth.visibleOrgIds.includes(row.orgId)) {
    return null;
  }
  return mapQuote(row);
}

export async function listQuotes(
  filters: { opportunityId?: string; dealerOrgId?: string; status?: QuoteStatus; limit?: number },
  auth: QuoteAuthCtx,
): Promise<Quote[]> {
  const conds = [eq(pmsQuotes.tenantId, auth.tenantId)];
  if (filters.opportunityId) conds.push(eq(pmsQuotes.opportunityId, filters.opportunityId));
  if (filters.dealerOrgId) conds.push(eq(pmsQuotes.dealerOrgId, filters.dealerOrgId));
  if (filters.status) conds.push(eq(pmsQuotes.status, filters.status));
  const rows = await db
    .select()
    .from(pmsQuotes)
    .where(and(...conds))
    .orderBy(desc(pmsQuotes.createdAt))
    .limit(filters.limit ?? 100);
  return rows
    .filter((r) => auth.isInternal || auth.visibleOrgIds.length === 0 || auth.visibleOrgIds.includes(r.orgId))
    .map(mapQuote);
}

/** 编辑草稿 (仅 draft 可改; 已签发需 reviseQuote 出新版本) */
export async function updateQuoteDraft(
  id: string,
  patch: {
    title?: string;
    customerName?: string;
    customerContact?: string;
    scenario?: string;
    systems?: QuoteSystem[];
    terms?: QuoteTerms;
    validUntil?: string | null;
  },
  auth: QuoteAuthCtx,
): Promise<Quote> {
  const existing = await getQuote(id, auth);
  if (!existing) throw new Response('报价不存在或无权限', { status: 404 });
  if (existing.status !== 'draft') {
    throw new Response('已签发报价不可直接编辑, 请出新版本 (revise)', { status: 409 });
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.customerName !== undefined) set.customerName = patch.customerName;
  if (patch.customerContact !== undefined) set.customerContact = patch.customerContact ?? null;
  if (patch.scenario !== undefined) set.scenario = patch.scenario ?? null;
  if (patch.terms !== undefined) set.terms = patch.terms ?? null;
  if (patch.validUntil !== undefined) set.validUntil = patch.validUntil ? new Date(patch.validUntil) : null;
  if (patch.systems !== undefined) {
    const { systems, totals } = recomputeQuote(patch.systems);
    set.systems = systems;
    Object.assign(set, totalsToColumns(totals));
  }

  await db.update(pmsQuotes).set(set).where(eq(pmsQuotes.id, id));
  return (await getQuote(id, auth))!;
}

// ============================================================================
// 签发 / 出新版本 / 作废
// ============================================================================

async function genUniqueVerifyCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = genVerifyCode();
    const hit = await db.select({ id: pmsQuotes.id }).from(pmsQuotes).where(eq(pmsQuotes.verifyCode, code)).limit(1);
    if (hit.length === 0) return code;
  }
  // 极低概率连续碰撞, 追加随机后缀兜底
  return `${genVerifyCode()}`;
}

const ISSUE_DEFAULT_VALID_DAYS = 30;

/**
 * 签发: draft → issued, 生成唯一验真码。
 * 同一报备+经销商的旧 issued 报价自动置为 superseded (指向本单)。
 */
export async function issueQuote(id: string, auth: QuoteAuthCtx): Promise<Quote> {
  const q = await getQuote(id, auth);
  if (!q) throw new Response('报价不存在或无权限', { status: 404 });
  if (q.status !== 'draft') throw new Response('仅草稿可签发', { status: 409 });
  // 复核报备仍在保护期
  await assertQuoteAuthorization(q.opportunityId, auth);

  const now = new Date();
  const verifyCode = await genUniqueVerifyCode();
  const validUntil = q.validUntil
    ? new Date(q.validUntil)
    : new Date(now.getTime() + ISSUE_DEFAULT_VALID_DAYS * 24 * 3600 * 1000);

  // 旧 issued 版本置为被替代
  await db
    .update(pmsQuotes)
    .set({ status: 'superseded', supersededById: id, updatedAt: now })
    .where(
      and(
        eq(pmsQuotes.tenantId, auth.tenantId),
        eq(pmsQuotes.opportunityId, q.opportunityId),
        eq(pmsQuotes.dealerOrgId, q.dealerOrgId),
        eq(pmsQuotes.status, 'issued'),
      ),
    );

  await db
    .update(pmsQuotes)
    .set({ status: 'issued', verifyCode, issuedAt: now, validUntil, updatedAt: now })
    .where(eq(pmsQuotes.id, id));

  await audit('pms.quote.issued', auth.userId, {
    targetId: id,
    targetType: 'pms_quote',
    tenantId: auth.tenantId,
    metadata: {
      opportunityId: q.opportunityId,
      dealerOrgId: q.dealerOrgId,
      version: q.version,
      verifyCode,
      totalAmount: q.totals.total,
      validUntil: validUntil.toISOString(),
    },
  });

  return (await getQuote(id, auth))!;
}

/** 出新版本: 从任一版本克隆为新 draft (version+1), 供改价后重新签发 */
export async function reviseQuote(id: string, auth: QuoteAuthCtx): Promise<Quote> {
  const src = await getQuote(id, auth);
  if (!src) throw new Response('报价不存在或无权限', { status: 404 });
  await assertQuoteAuthorization(src.opportunityId, auth);

  const now = new Date();
  const newId = nanoid();
  const { systems, totals } = recomputeQuote(src.systems);

  await db.insert(pmsQuotes).values({
    id: newId,
    tenantId: auth.tenantId,
    orgId: src.orgId,
    dealerOrgId: src.dealerOrgId,
    opportunityId: src.opportunityId,
    projectId: src.projectId ?? null,
    issuerId: auth.userId,
    title: src.title,
    customerName: src.customerName,
    customerContact: src.customerContact ?? null,
    scenario: src.scenario ?? null,
    systems,
    currency: src.currency,
    ...totalsToColumns(totals),
    terms: src.terms ?? null,
    validUntil: null,
    version: src.version + 1,
    status: 'draft',
    verifyCode: null,
    supersededById: null,
    issuedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  await audit('pms.quote.revised', auth.userId, {
    targetId: newId,
    targetType: 'pms_quote',
    tenantId: auth.tenantId,
    metadata: {
      fromQuoteId: id,
      opportunityId: src.opportunityId,
      dealerOrgId: src.dealerOrgId,
      newVersion: src.version + 1,
      totalAmount: totals.total,
    },
  });

  return (await getQuote(newId, auth))!;
}

/** 作废 (草稿或已签发均可) */
export async function revokeQuote(id: string, auth: QuoteAuthCtx): Promise<Quote> {
  const q = await getQuote(id, auth);
  if (!q) throw new Response('报价不存在或无权限', { status: 404 });
  await db
    .update(pmsQuotes)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(pmsQuotes.id, id));

  await audit('pms.quote.revoked', auth.userId, {
    targetId: id,
    targetType: 'pms_quote',
    tenantId: auth.tenantId,
    metadata: {
      opportunityId: q.opportunityId,
      dealerOrgId: q.dealerOrgId,
      prevStatus: q.status,
      version: q.version,
    },
  });

  return (await getQuote(id, auth))!;
}

// ============================================================================
// 公开验真 (零登录, 不露价)
// ============================================================================

export async function verifyQuote(code: string): Promise<QuoteVerifyView> {
  const rows = await db.select().from(pmsQuotes).where(eq(pmsQuotes.verifyCode, code)).limit(1);
  if (rows.length === 0) {
    return { valid: false, status: 'draft', verifyCode: code, message: '查无此报价, 请核实来源' };
  }
  const row = rows[0];

  // 解析授权经销商名 (背书核心)
  let authorizedDealerName: string | undefined;
  try {
    const org = await getStore().organizations.get(row.dealerOrgId);
    authorizedDealerName = org?.name;
  } catch {
    /* 组织读取失败不阻断验真 */
  }

  const base = {
    quoteTitle: row.title,
    customerName: row.customerName,
    authorizedDealerName,
    issuedAt: row.issuedAt?.toISOString(),
    validUntil: row.validUntil?.toISOString(),
    verifyCode: code,
  };

  if (row.status === 'revoked') {
    return { ...base, valid: false, status: 'revoked', message: '此报价已作废' };
  }
  if (row.status === 'superseded') {
    return { ...base, valid: false, status: 'superseded', message: '此报价已有更新版本, 请以最新报价为准' };
  }
  if (row.status !== 'issued') {
    return { ...base, valid: false, status: row.status as QuoteStatus, message: '此报价尚未正式签发' };
  }
  if (row.validUntil && row.validUntil.getTime() < Date.now()) {
    return { ...base, valid: false, status: 'expired', message: '此报价已过有效期' };
  }
  return { ...base, valid: true, status: 'issued' };
}
