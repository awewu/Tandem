import { BadRequestException } from '@nestjs/common';

/**
 * B1 · 产品事实基座写入边界的显式类型校验（零依赖，不引入 class-validator / 全局 ValidationPipe）。
 *
 * 定位：受控词表软约束（sanitize*）负责「未知取值静默剔除」，本层负责「错误类型硬失败」——
 * 二者互补。凡明确类型错误（如 seo 传成数组、sortOrder 传成非数字串、locale 传成对象）
 * 在此以 400 BadRequest 明确拒绝，避免脏数据经 `as any` 静默落库。
 *
 * 仅约束产品模块自身写入端点，不改动其他模块的 body 约定（无平台级外溢）。
 */

/** 断言为纯对象（排除 null / 数组）。 */
export function assertPlainObject(v: unknown, field: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new BadRequestException(`${field} 必须是对象`);
  }
  return v as Record<string, unknown>;
}

/** 可选字符串：缺省放行；提供则必须是 string。 */
export function assertOptionalString(v: unknown, field: string): void {
  if (v === undefined || v === null) return;
  if (typeof v !== 'string') throw new BadRequestException(`${field} 必须是字符串`);
}

/** 必填非空字符串。 */
export function assertRequiredString(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new BadRequestException(`${field} 必填且必须是非空字符串`);
  return v.trim();
}

/** 可选对象（缺省放行；提供则必须是纯对象）。 */
export function assertOptionalObject(v: unknown, field: string): void {
  if (v === undefined || v === null) return;
  assertPlainObject(v, field);
}

/** 可选数组（缺省放行；提供则必须是数组）。 */
export function assertOptionalArray(v: unknown, field: string): void {
  if (v === undefined || v === null) return;
  if (!Array.isArray(v)) throw new BadRequestException(`${field} 必须是数组`);
}

/** 可选数字：缺省放行；提供则必须可无歧义转成有限数（拒绝 "abc" / {} / [] 等）。 */
function assertOptionalStringArray(v: unknown, field: string): void {
  if (v === undefined || v === null) return;
  if (!Array.isArray(v)) throw new BadRequestException(`${field} must be an array`);
  for (const item of v) {
    if (typeof item !== 'string') throw new BadRequestException(`${field} items must be strings`);
  }
}

function assertOptionalObjectArray(v: unknown, field: string, keys: string[]): void {
  if (v === undefined || v === null) return;
  if (!Array.isArray(v)) throw new BadRequestException(`${field} must be an array`);
  for (const item of v) {
    const row = assertPlainObject(item, `${field} item`);
    for (const key of keys) assertOptionalString(row[key], `${field}.${key}`);
  }
}

function validateEverhotStructuredLists(meta: unknown): void {
  if (meta === undefined || meta === null) return;
  const m = assertPlainObject(meta, 'meta');
  const everhot = m.everhot;
  if (everhot === undefined || everhot === null) return;
  const e = assertPlainObject(everhot, 'meta.everhot');
  assertOptionalObjectArray(e.specs, 'meta.everhot.specs', ['k', 'v']);
  assertOptionalStringArray(e.badges, 'meta.everhot.badges');
  assertOptionalObjectArray(e.features, 'meta.everhot.features', ['title', 'desc']);
  assertOptionalObjectArray(e.highlights, 'meta.everhot.highlights', ['label', 'value']);
}

export function assertOptionalFiniteNumber(v: unknown, field: string): void {
  if (v === undefined || v === null || v === '') return;
  const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : NaN);
  if (!Number.isFinite(n)) throw new BadRequestException(`${field} 必须是数字`);
}

/**
 * L7 内容 upsert 输入校验：只校验类型，不做词表归一（归一仍由 sanitize* 负责）。
 * 保持对合法输入完全透明——仅拦截错误类型。
 */
export function validateContentInput(dto: unknown): Record<string, unknown> {
  const body = assertPlainObject(dto, 'content body');
  assertOptionalString(body.tenantId, 'tenantId');
  assertOptionalString(body.locale, 'locale');
  assertOptionalString(body.name, 'name');
  assertOptionalString(body.displayCurrency, 'displayCurrency');
  assertOptionalString(body.status, 'status');
  assertOptionalString(body.gtin, 'gtin');
  assertOptionalString(body.mpn, 'mpn');
  assertOptionalString(body.officialDetailHtml, 'officialDetailHtml');
  assertOptionalObject(body.seo, 'seo');
  assertOptionalObject(body.marketing, 'marketing');
  return body;
}

/** 工作流流转输入校验：action 必填字符串；scheduledAt（若提供）必须是字符串。 */
export function validateTransitionInput(body: unknown): { action: string } {
  const b = assertPlainObject(body, 'transition body');
  const action = assertRequiredString(b.action, 'action');
  assertOptionalString(b.tenantId, 'tenantId');
  assertOptionalString(b.scheduledAt, 'scheduledAt');
  assertOptionalString(b.note, 'note');
  assertOptionalString(b.actor, 'actor');
  return { action };
}

/** 产品关系 upsert 输入校验：relatedProductId / relationType 必填字符串；sortOrder（若提供）为数字。 */
export function validateRelationInput(dto: unknown): Record<string, unknown> {
  const body = assertPlainObject(dto, 'relation body');
  assertOptionalString(body.tenantId, 'tenantId');
  assertRequiredString(body.relatedProductId, 'relatedProductId');
  assertRequiredString(body.relationType, 'relationType');
  assertOptionalFiniteNumber(body.sortOrder, 'sortOrder');
  return body;
}

/** 产品 upsert 输入校验：类型级（sku/name 字符串，listPrice 数字，positioning/assetRefs 结构）。 */
export function validateProductUpsertInput(dto: unknown): Record<string, unknown> {
  const body = assertPlainObject(dto, 'product body');
  assertOptionalString(body.tenantId, 'tenantId');
  assertOptionalString(body.sku, 'sku');
  assertOptionalString(body.name, 'name');
  assertOptionalString(body.brand, 'brand');
  assertOptionalString(body.category, 'category');
  assertOptionalString(body.categoryLevel1Id, 'categoryLevel1Id');
  assertOptionalString(body.categoryLevel2Id, 'categoryLevel2Id');
  assertOptionalString(body.categoryLevel3Id, 'categoryLevel3Id');
  assertOptionalString(body.primaryCategoryId, 'primaryCategoryId');
  assertOptionalString(body.categoryId, 'categoryId');
  assertOptionalArray(body.categoryBindings, 'categoryBindings');
  assertOptionalString(body.currency, 'currency');
  assertOptionalString(body.status, 'status');
  assertOptionalFiniteNumber(body.listPrice, 'listPrice');
  assertOptionalFiniteNumber(body.costPrice, 'costPrice');
  assertOptionalObject(body.spec, 'spec');
  assertOptionalObject(body.meta, 'meta');
  validateEverhotStructuredLists(body.meta);
  assertOptionalObject(body.positioning, 'positioning');
  assertOptionalArray(body.assetRefs, 'assetRefs');
  if (body.status !== undefined && !['active', 'inactive', 'archived'].includes(String(body.status))) {
    throw new BadRequestException('status 仅支持 active、inactive 或 archived');
  }
  for (const field of ['listPrice', 'costPrice']) {
    if (body[field] !== undefined && Number(body[field]) < 0) {
      throw new BadRequestException(`${field} 不能小于 0`);
    }
  }
  return body;
}
