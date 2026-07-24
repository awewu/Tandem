/**
 * PMS · 产品目录 + 客户体系服务 (导入驱动主数据)
 *
 * 业务: 产品目录 (系列/型号/价格/BOM) + 客户账户层级. 导入驱动, 不写死.
 * 对齐 drizzle 表 pms_product_catalog / pms_customer_accounts.
 * 主数据: 读=全员; 写=仅内部.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsProductCatalog, pmsCustomerAccounts } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';

// --- 纯函数 (可测) ---

/** 毛利率 (%) = (listPrice - costPrice) / listPrice, 保留一位; listPrice<=0 → 0 */
export function computeMargin(listPrice: number, costPrice: number): number {
  if (!(listPrice > 0)) return 0;
  const rate = ((listPrice - costPrice) / listPrice) * 100;
  return Math.round(rate * 10) / 10;
}

/** 报价是否不低于最低限价 (minPrice 未设 → 恒 true) */
export function isPriceAboveFloor(price: number, minPrice: number | null | undefined): boolean {
  if (minPrice == null) return true;
  return price >= minPrice;
}

// --- DB ---

function mapProduct(row: typeof pmsProductCatalog.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    series: row.series,
    seriesCode: row.seriesCode || undefined,
    model: row.model,
    modelCode: row.modelCode || undefined,
    category: row.category || undefined,
    specification: row.specification || undefined,
    unit: row.unit || undefined,
    listPrice: row.listPrice != null ? parseFloat(row.listPrice) : undefined,
    costPrice: row.costPrice != null ? parseFloat(row.costPrice) : undefined,
    minPrice: row.minPrice != null ? parseFloat(row.minPrice) : undefined,
    bomItems: row.bomItems ?? [],
    parentModel: row.parentModel || undefined,
    attributes: row.attributes ?? {},
    source: row.source || undefined,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCustomer(row: typeof pmsCustomerAccounts.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    externalCode: row.externalCode || undefined,
    type: row.type || undefined,
    parentAccountId: row.parentAccountId || undefined,
    level: row.level ?? 0,
    region: row.region || undefined,
    channel: row.channel || undefined,
    dealerOrgId: row.dealerOrgId || undefined,
    attributes: row.attributes ?? {},
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createProduct(tenantId: string, input: any): Promise<any> {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsProductCatalog).values({
    id,
    tenantId,
    series: input.series,
    seriesCode: input.seriesCode ?? null,
    model: input.model,
    modelCode: input.modelCode ?? null,
    category: input.category ?? null,
    specification: input.specification ?? null,
    unit: input.unit ?? null,
    listPrice: input.listPrice != null ? String(input.listPrice) : null,
    costPrice: input.costPrice != null ? String(input.costPrice) : null,
    minPrice: input.minPrice != null ? String(input.minPrice) : null,
    bomItems: input.bomItems ?? [],
    parentModel: input.parentModel ?? null,
    attributes: input.attributes ?? {},
    source: input.source ?? 'manual',
    sourceRefId: input.sourceRefId ?? null,
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  });
  return { id, tenantId, ...input, status: input.status ?? 'active', createdAt: now.toISOString() };
}

export async function listProducts(filters: {
  tenantId: string;
  series?: string;
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const conditions = [eq(pmsProductCatalog.tenantId, filters.tenantId)];
  if (filters.series) conditions.push(eq(pmsProductCatalog.series, filters.series));
  if (filters.category) conditions.push(eq(pmsProductCatalog.category, filters.category));
  if (filters.status) conditions.push(eq(pmsProductCatalog.status, filters.status));
  const rows = await db
    .select()
    .from(pmsProductCatalog)
    .where(and(...conditions))
    .orderBy(desc(pmsProductCatalog.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
  return rows.map(mapProduct);
}

export async function getProduct(id: string, tenantId: string): Promise<any | null> {
  const rows = await db
    .select()
    .from(pmsProductCatalog)
    .where(and(eq(pmsProductCatalog.id, id), eq(pmsProductCatalog.tenantId, tenantId)))
    .limit(1);
  return rows.length ? mapProduct(rows[0]) : null;
}

export async function updateProductStatus(input: {
  tenantId: string;
  id: string;
  status: string;
}): Promise<any> {
  const now = new Date();
  const rows = await db
    .select()
    .from(pmsProductCatalog)
    .where(and(eq(pmsProductCatalog.id, input.id), eq(pmsProductCatalog.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('product not found');
  await db
    .update(pmsProductCatalog)
    .set({ status: input.status, updatedAt: now })
    .where(eq(pmsProductCatalog.id, input.id));
  return { id: input.id, status: input.status, updatedAt: now.toISOString() };
}

export async function createCustomerAccount(tenantId: string, input: any): Promise<any> {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsCustomerAccounts).values({
    id,
    tenantId,
    name: input.name,
    externalCode: input.externalCode ?? null,
    type: input.type ?? null,
    parentAccountId: input.parentAccountId ?? null,
    level: input.level ?? 0,
    region: input.region ?? null,
    channel: input.channel ?? null,
    dealerOrgId: input.dealerOrgId ?? null,
    attributes: input.attributes ?? {},
    source: input.source ?? 'manual',
    sourceRefId: input.sourceRefId ?? null,
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  });
  return { id, tenantId, ...input, status: input.status ?? 'active', createdAt: now.toISOString() };
}

export async function listCustomerAccounts(filters: {
  tenantId: string;
  region?: string;
  dealerOrgId?: string;
  parentAccountId?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const conditions = [eq(pmsCustomerAccounts.tenantId, filters.tenantId)];
  if (filters.region) conditions.push(eq(pmsCustomerAccounts.region, filters.region));
  if (filters.dealerOrgId) conditions.push(eq(pmsCustomerAccounts.dealerOrgId, filters.dealerOrgId));
  if (filters.parentAccountId) conditions.push(eq(pmsCustomerAccounts.parentAccountId, filters.parentAccountId));
  const rows = await db
    .select()
    .from(pmsCustomerAccounts)
    .where(and(...conditions))
    .orderBy(desc(pmsCustomerAccounts.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
  return rows.map(mapCustomer);
}
