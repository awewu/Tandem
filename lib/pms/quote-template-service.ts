/**
 * PMS · 报价方案模板库服务
 *
 * 常用系统方案(系统+明细+条款)存为模板, 建报价时一键套用 → 经销商提效。
 * 归属: tenantId + orgId (创建组织); isShared=true → 租户内跨组织共享。
 * 数据层: drizzle pms_quote_templates (systems/terms 存 jsonb)。软删 archivedAt。
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsQuoteTemplates } from '../infra/drizzle-schema';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { recomputeQuote } from './quote-calc';
import type { QuoteAuthCtx } from './quote-service';
import type { QuoteSystem, QuoteTerms, QuoteTemplate } from '@/lib/types/pms';

function mapTemplate(row: typeof pmsQuoteTemplates.$inferSelect): QuoteTemplate {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgId: row.orgId,
    name: row.name,
    category: row.category || undefined,
    scenario: row.scenario || undefined,
    description: row.description || undefined,
    systems: (row.systems as QuoteSystem[] | null) ?? [],
    terms: (row.terms as QuoteTerms | null) || undefined,
    isShared: row.isShared,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString(),
  };
}

/** 可见性: 内部全可见; 外部仅本组织 或 共享模板 */
function canSee(row: { orgId: string; isShared: boolean }, auth: QuoteAuthCtx): boolean {
  if (auth.isInternal) return true;
  if (row.isShared) return true;
  return auth.visibleOrgIds.includes(row.orgId);
}

/** 写权限: 内部全可写; 外部仅本组织 */
function assertCanWriteOrg(orgId: string, auth: QuoteAuthCtx): void {
  if (auth.isInternal) return;
  if (!auth.visibleOrgIds.includes(orgId)) {
    throw new Response('无权在该组织下维护模板', { status: 403 });
  }
}

export async function listTemplates(
  filters: { category?: string; limit?: number },
  auth: QuoteAuthCtx,
): Promise<QuoteTemplate[]> {
  const conds = [eq(pmsQuoteTemplates.tenantId, auth.tenantId), isNull(pmsQuoteTemplates.archivedAt)];
  if (filters.category) conds.push(eq(pmsQuoteTemplates.category, filters.category));
  const rows = await db
    .select()
    .from(pmsQuoteTemplates)
    .where(and(...conds))
    .orderBy(desc(pmsQuoteTemplates.updatedAt))
    .limit(filters.limit ?? 100);
  return rows.filter((r) => canSee(r, auth)).map(mapTemplate);
}

export async function getTemplate(id: string, auth: QuoteAuthCtx): Promise<QuoteTemplate | null> {
  const rows = await db
    .select()
    .from(pmsQuoteTemplates)
    .where(and(eq(pmsQuoteTemplates.id, id), eq(pmsQuoteTemplates.tenantId, auth.tenantId)))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (row.archivedAt || !canSee(row, auth)) return null;
  return mapTemplate(row);
}

export async function createTemplate(
  input: {
    orgId: string;
    name: string;
    category?: string;
    scenario?: string;
    description?: string;
    systems?: QuoteSystem[];
    terms?: QuoteTerms;
    isShared?: boolean;
  },
  auth: QuoteAuthCtx,
): Promise<QuoteTemplate> {
  if (!input.name?.trim()) throw new Response('模板名称必填', { status: 400 });
  if (!input.orgId?.trim()) throw new Response('归属组织必填', { status: 400 });
  assertCanWriteOrg(input.orgId, auth);

  const { systems } = recomputeQuote(input.systems ?? []);
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsQuoteTemplates).values({
    id,
    tenantId: auth.tenantId,
    orgId: input.orgId,
    name: input.name.trim(),
    category: input.category ?? null,
    scenario: input.scenario ?? null,
    description: input.description ?? null,
    systems,
    terms: input.terms ?? null,
    isShared: input.isShared ?? false,
    createdBy: auth.userId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });
  return (await getTemplate(id, auth))!;
}

export async function updateTemplate(
  id: string,
  patch: {
    name?: string;
    category?: string;
    scenario?: string;
    description?: string;
    systems?: QuoteSystem[];
    terms?: QuoteTerms;
    isShared?: boolean;
  },
  auth: QuoteAuthCtx,
): Promise<QuoteTemplate> {
  const existing = await getTemplate(id, auth);
  if (!existing) throw new Response('模板不存在或无权限', { status: 404 });
  assertCanWriteOrg(existing.orgId, auth);

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.category !== undefined) set.category = patch.category ?? null;
  if (patch.scenario !== undefined) set.scenario = patch.scenario ?? null;
  if (patch.description !== undefined) set.description = patch.description ?? null;
  if (patch.terms !== undefined) set.terms = patch.terms ?? null;
  if (patch.isShared !== undefined) set.isShared = patch.isShared;
  if (patch.systems !== undefined) {
    const { systems } = recomputeQuote(patch.systems);
    set.systems = systems;
  }
  await db.update(pmsQuoteTemplates).set(set).where(eq(pmsQuoteTemplates.id, id));
  return (await getTemplate(id, auth))!;
}

/** 软删 (archivedAt) */
export async function deleteTemplate(id: string, auth: QuoteAuthCtx): Promise<void> {
  const existing = await getTemplate(id, auth);
  if (!existing) throw new Response('模板不存在或无权限', { status: 404 });
  assertCanWriteOrg(existing.orgId, auth);
  await db
    .update(pmsQuoteTemplates)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(pmsQuoteTemplates.id, id));
}
