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
import type { BomItem } from '@/lib/types/pms';

export interface CreateProductInput {
  series: string;
  seriesCode?: string;
  model: string;
  modelCode?: string;
  category?: string;
  specification?: string;
  unit?: string;
  listPrice?: number;
  costPrice?: number;
  minPrice?: number;
  bomItems?: BomItem[];
  parentModel?: string;
  attributes?: Record<string, string>;
  source?: 'ys' | 'import' | 'manual';
  sourceRefId?: string;
  status?: string;
}

export interface CreateCustomerAccountInput {
  name: string;
  externalCode?: string;
  type?: 'hotel' | 'factory' | 'school' | 'apartment' | 'hospital' | 'government' | 'other';
  parentAccountId?: string;
  level?: number;
  region?: string;
  channel?: string;
  dealerOrgId?: string;
  attributes?: Record<string, string>;
  source?: 'ys' | 'import' | 'manual';
  sourceRefId?: string;
  status?: string;
}

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

export async function createProduct(
  tenantId: string,
  input: CreateProductInput,
): Promise<CreateProductInput & { id: string; tenantId: string; status: string; createdAt: string }> {
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

/** 批量导入行 (来自 Excel/CSV 或产品模块) */
export interface ImportProductRow {
  series: string;
  model: string;
  seriesCode?: string;
  modelCode?: string;
  category?: string;
  specification?: string;
  unit?: string;
  listPrice?: number;
  costPrice?: number;
  minPrice?: number;
  attributes?: Record<string, string>;
}

export interface ImportProductsResult {
  total: number;
  created: number;
  updated: number;
  failed: { row: number; reason: string }[];
}

/** 稳定 id: 同 tenant + modelCode(或 model) → 同 id, 保证重复导入幂等 (upsert) */
function stableProductId(tenantId: string, key: string): string {
  const slug = Buffer.from(`${tenantId}|${key}`.toLowerCase()).toString('base64url').slice(0, 40);
  return `pms_prod_imp_${slug}`;
}

/**
 * 批量导入/更新产品主数据 (幂等 upsert)。
 * 以 modelCode 优先、否则 model 作为稳定键 → 重复导入更新而非重复插入。
 * source 默认 'import'。返回创建/更新/失败计数。
 */
export async function importProducts(
  tenantId: string,
  rows: ImportProductRow[],
  source: 'ys' | 'import' | 'manual' = 'import',
): Promise<ImportProductsResult> {
  const result: ImportProductsResult = { total: rows.length, created: 0, updated: 0, failed: [] };
  const now = new Date();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 2; // 1-based + 表头
    if (!row.series?.trim() || !row.model?.trim()) {
      result.failed.push({ row: rowNo, reason: '系列与型号必填' });
      continue;
    }
    const key = (row.modelCode?.trim() || row.model.trim());
    const id = stableProductId(tenantId, key);
    try {
      const existing = await db
        .select({ id: pmsProductCatalog.id })
        .from(pmsProductCatalog)
        .where(and(eq(pmsProductCatalog.id, id), eq(pmsProductCatalog.tenantId, tenantId)))
        .limit(1);

      const values = {
        series: row.series.trim(),
        seriesCode: row.seriesCode ?? null,
        model: row.model.trim(),
        modelCode: row.modelCode ?? null,
        category: row.category ?? null,
        specification: row.specification ?? null,
        unit: row.unit ?? null,
        listPrice: row.listPrice != null ? String(row.listPrice) : null,
        costPrice: row.costPrice != null ? String(row.costPrice) : null,
        minPrice: row.minPrice != null ? String(row.minPrice) : null,
        attributes: row.attributes ?? {},
        source,
        status: 'active',
        updatedAt: now,
      };

      if (existing.length > 0) {
        await db.update(pmsProductCatalog).set(values).where(eq(pmsProductCatalog.id, id));
        result.updated += 1;
      } else {
        await db.insert(pmsProductCatalog).values({
          id,
          tenantId,
          bomItems: [],
          createdAt: now,
          ...values,
        });
        result.created += 1;
      }
    } catch (e) {
      result.failed.push({ row: rowNo, reason: (e as Error).message || '写入失败' });
    }
  }
  return result;
}

export async function listProducts(filters: {
  tenantId: string;
  series?: string;
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ReturnType<typeof mapProduct>[]> {
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

export async function getProduct(id: string, tenantId: string): Promise<ReturnType<typeof mapProduct> | null> {
  const rows = await db
    .select()
    .from(pmsProductCatalog)
    .where(and(eq(pmsProductCatalog.id, id), eq(pmsProductCatalog.tenantId, tenantId)))
    .limit(1);
  return rows.length ? mapProduct(rows[0]) : null;
}

export interface UpdateProductInput {
  series?: string;
  seriesCode?: string | null;
  model?: string;
  modelCode?: string | null;
  category?: string | null;
  specification?: string | null;
  unit?: string | null;
  listPrice?: number | null;
  costPrice?: number | null;
  minPrice?: number | null;
  bomItems?: BomItem[];
  parentModel?: string | null;
  attributes?: Record<string, string>;
  status?: string;
}

/** 全字段局部更新营销产品库条目 (仅覆盖传入字段)。 */
export async function updateProduct(
  tenantId: string,
  id: string,
  patch: UpdateProductInput,
): Promise<ReturnType<typeof mapProduct>> {
  const rows = await db
    .select()
    .from(pmsProductCatalog)
    .where(and(eq(pmsProductCatalog.id, id), eq(pmsProductCatalog.tenantId, tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('product not found');

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.series !== undefined) values.series = patch.series;
  if (patch.seriesCode !== undefined) values.seriesCode = patch.seriesCode ?? null;
  if (patch.model !== undefined) values.model = patch.model;
  if (patch.modelCode !== undefined) values.modelCode = patch.modelCode ?? null;
  if (patch.category !== undefined) values.category = patch.category ?? null;
  if (patch.specification !== undefined) values.specification = patch.specification ?? null;
  if (patch.unit !== undefined) values.unit = patch.unit ?? null;
  if (patch.listPrice !== undefined) values.listPrice = patch.listPrice != null ? String(patch.listPrice) : null;
  if (patch.costPrice !== undefined) values.costPrice = patch.costPrice != null ? String(patch.costPrice) : null;
  if (patch.minPrice !== undefined) values.minPrice = patch.minPrice != null ? String(patch.minPrice) : null;
  if (patch.bomItems !== undefined) values.bomItems = patch.bomItems ?? [];
  if (patch.parentModel !== undefined) values.parentModel = patch.parentModel ?? null;
  if (patch.attributes !== undefined) values.attributes = patch.attributes ?? {};
  if (patch.status !== undefined) values.status = patch.status;

  await db.update(pmsProductCatalog).set(values).where(eq(pmsProductCatalog.id, id));
  const updated = await db
    .select()
    .from(pmsProductCatalog)
    .where(eq(pmsProductCatalog.id, id))
    .limit(1);
  return mapProduct(updated[0]);
}

export async function updateProductStatus(input: {
  tenantId: string;
  id: string;
  status: string;
}): Promise<{ id: string; status: string; updatedAt: string }> {
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

export async function createCustomerAccount(
  tenantId: string,
  input: CreateCustomerAccountInput,
): Promise<CreateCustomerAccountInput & { id: string; tenantId: string; status: string; createdAt: string }> {
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
}): Promise<ReturnType<typeof mapCustomer>[]> {
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
