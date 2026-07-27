import type { ProductEntity } from './product-catalog.entity';
import type { BrandProductCategoryEntity } from '../brand-product-category/brand-product-category.entity';

export type ProductCategoryBackfillReason =
  | 'matched'
  | 'unmatched'
  | 'already-bound'
  | 'existing-invalid-binding'
  | 'cross-brand';

export interface ProductCategoryBackfillAlias {
  brandCode: string;
  legacyValue: string;
  categoryId: string;
}

export interface ProductCategoryBackfillPlanItem {
  productId: string;
  sku: string;
  brandCode: string;
  reason: ProductCategoryBackfillReason;
  categoryLevel1Id: string | null;
  categoryLevel2Id: string | null;
  categoryLevel3Id: string | null;
  categoryPath: string | null;
  legacy: {
    category: string | null;
    websiteMenuCategory: string | null;
    system: string | null;
  };
  meta: Record<string, unknown> | null;
  message?: string;
}

export interface ProductCategoryBackfillReport {
  scanned: number;
  matched: ProductCategoryBackfillPlanItem[];
  unmatched: ProductCategoryBackfillPlanItem[];
  alreadyBound: ProductCategoryBackfillPlanItem[];
  invalidExistingBindings: ProductCategoryBackfillPlanItem[];
  crossBrand: ProductCategoryBackfillPlanItem[];
}

type CategoryNode = BrandProductCategoryEntity & { parent?: CategoryNode | null };

const CATEGORY_FIELDS = ['categoryLevel1Id', 'categoryLevel2Id', 'categoryLevel3Id'] as const;

export function planProductCategoryBackfill(
  products: readonly ProductEntity[],
  categories: readonly BrandProductCategoryEntity[],
  aliases: readonly ProductCategoryBackfillAlias[] = [],
): ProductCategoryBackfillReport {
  const activeCategories = categories.filter((category) => category.status === 'active' && !category.deletedAt);
  const byId = new Map(activeCategories.map((category) => [category.id, category as CategoryNode]));
  for (const category of byId.values()) category.parent = category.parentId ? byId.get(category.parentId) ?? null : null;
  const aliasByBrandAndValue = new Map<string, string>();
  for (const alias of aliases) {
    aliasByBrandAndValue.set(`${normalizeKey(alias.brandCode)}::${normalizeKey(alias.legacyValue)}`, alias.categoryId);
  }

  const report: ProductCategoryBackfillReport = {
    scanned: products.length,
    matched: [],
    unmatched: [],
    alreadyBound: [],
    invalidExistingBindings: [],
    crossBrand: [],
  };

  for (const product of products) {
    const item = planOneProduct(product, activeCategories, byId, aliasByBrandAndValue);
    if (item.reason === 'matched') report.matched.push(item);
    else if (item.reason === 'already-bound') report.alreadyBound.push(item);
    else if (item.reason === 'existing-invalid-binding') report.invalidExistingBindings.push(item);
    else if (item.reason === 'cross-brand') report.crossBrand.push(item);
    else report.unmatched.push(item);
  }

  return report;
}

function planOneProduct(
  product: ProductEntity,
  categories: readonly BrandProductCategoryEntity[],
  byId: Map<string, CategoryNode>,
  aliasByBrandAndValue: Map<string, string>,
): ProductCategoryBackfillPlanItem {
  const brandCode = normalizeKey(product.brand);
  const legacy = legacyFields(product, brandCode);
  const existing = existingBinding(product, brandCode);
  const validExisting = validateExistingBinding(existing, brandCode, byId);
  if (validExisting.valid) {
    return item(product, brandCode, 'already-bound', existing, legacy, null, 'Existing category binding is valid.');
  }
  if (existing.some(Boolean)) {
    return item(product, brandCode, 'existing-invalid-binding', existing, legacy, null, validExisting.message);
  }

  const signals = [legacy.category, legacy.websiteMenuCategory, legacy.system].filter(Boolean) as string[];
  const matchedIds = unique(signals.map((signal) => aliasByBrandAndValue.get(`${brandCode}::${normalizeKey(signal)}`)).filter(Boolean) as string[]);
  const exactMatches = unique([
    ...matchedIds,
    ...signals.flatMap((signal) => exactCategoryIds(categories, brandCode, signal)),
  ])
    .map((id) => byId.get(id))
    .filter(Boolean) as CategoryNode[];
  const foreignMatches = signals.flatMap((signal) =>
    exactCategoryIds(categories, '', signal).filter((id) => byId.get(id)?.brandCode !== brandCode),
  );

  const path = resolvePath(exactMatches, brandCode);
  if (!path) {
    const reason = foreignMatches.length ? 'cross-brand' : 'unmatched';
    const message = foreignMatches.length
      ? 'Legacy fields matched a category in another brand only.'
      : 'No exact or configured category match was found.';
    return item(product, brandCode, reason, [null, null, null], legacy, null, message);
  }

  const meta = applyBinding(product.meta, brandCode, path);
  return item(product, brandCode, 'matched', [path.level1.id, path.level2.id, path.level3?.id ?? null], legacy, meta);
}

function resolvePath(matches: readonly CategoryNode[], brandCode: string) {
  const paths = new Map<string, { level1: CategoryNode; level2: CategoryNode; level3: CategoryNode | null }>();
  for (const match of matches) {
    if (match.brandCode !== brandCode) continue;
    const path = pathFor(match);
    if (!path) continue;
    paths.set(`${path.level1.id}/${path.level2.id}/${path.level3?.id ?? ''}`, path);
  }
  if (paths.size !== 1) return null;
  return [...paths.values()][0];
}

function pathFor(category: CategoryNode) {
  if (category.level === 2 && category.parent?.level === 1) {
    return { level1: category.parent, level2: category, level3: null };
  }
  if (category.level === 3 && category.parent?.level === 2 && category.parent.parent?.level === 1) {
    return { level1: category.parent.parent, level2: category.parent, level3: category };
  }
  return null;
}

function exactCategoryIds(categories: readonly BrandProductCategoryEntity[], brandCode: string, value: string): string[] {
  const key = normalizeKey(value);
  return categories
    .filter((category) => (!brandCode || category.brandCode === brandCode) && categoryMatches(category, key))
    .map((category) => category.id);
}

function categoryMatches(category: BrandProductCategoryEntity, key: string): boolean {
  return [category.id, category.code, category.nameCn, category.nameEn, category.slug]
    .map(normalizeKey)
    .includes(key);
}

function validateExistingBinding(
  ids: readonly (string | null)[],
  brandCode: string,
  byId: Map<string, CategoryNode>,
): { valid: boolean; message?: string } {
  const [level1Id, level2Id, level3Id] = ids;
  if (!level1Id && !level2Id && !level3Id) return { valid: false };
  const level1 = level1Id ? byId.get(level1Id) : null;
  const level2 = level2Id ? byId.get(level2Id) : null;
  const level3 = level3Id ? byId.get(level3Id) : null;
  if (!level1 || !level2 || (level3Id && !level3)) return { valid: false, message: 'Existing category ID does not resolve.' };
  if ([level1, level2, level3].filter(Boolean).some((row) => row!.brandCode !== brandCode)) {
    return { valid: false, message: 'Existing category binding crosses brand scope.' };
  }
  if (level1.level !== 1 || level1.parentId !== null) return { valid: false, message: 'Existing level-1 category is invalid.' };
  if (level2.level !== 2 || level2.parentId !== level1.id) return { valid: false, message: 'Existing level-2 category is not under level 1.' };
  if (level3 && (level3.level !== 3 || level3.parentId !== level2.id)) {
    return { valid: false, message: 'Existing level-3 category is not under level 2.' };
  }
  return { valid: true };
}

function applyBinding(productMeta: unknown, brandCode: string, path: { level1: CategoryNode; level2: CategoryNode; level3: CategoryNode | null }) {
  const meta = metaObject(productMeta);
  const brandMeta = metaObject(meta[brandCode]);
  brandMeta.categoryLevel1Id = path.level1.id;
  brandMeta.categoryLevel2Id = path.level2.id;
  if (path.level3) brandMeta.categoryLevel3Id = path.level3.id;
  else delete brandMeta.categoryLevel3Id;
  brandMeta.categoryPath = [path.level1.nameCn, path.level2.nameCn, path.level3?.nameCn].filter(Boolean).join(' / ');
  meta[brandCode] = brandMeta;
  return meta;
}

function item(
  product: ProductEntity,
  brandCode: string,
  reason: ProductCategoryBackfillReason,
  ids: readonly (string | null)[],
  legacy: ProductCategoryBackfillPlanItem['legacy'],
  meta: Record<string, unknown> | null,
  message?: string,
): ProductCategoryBackfillPlanItem {
  return {
    productId: product.id,
    sku: product.sku,
    brandCode,
    reason,
    categoryLevel1Id: ids[0] ?? null,
    categoryLevel2Id: ids[1] ?? null,
    categoryLevel3Id: ids[2] ?? null,
    categoryPath: metaObject(meta?.[brandCode]).categoryPath ?? null,
    legacy,
    meta,
    message,
  };
}

function existingBinding(product: ProductEntity, brandCode: string): [string | null, string | null, string | null] {
  const meta = metaObject(product.meta);
  const brandMeta = metaObject(meta[brandCode]);
  return CATEGORY_FIELDS.map((field) => nullableText(brandMeta[field] ?? meta[field])) as [string | null, string | null, string | null];
}

function legacyFields(product: ProductEntity, brandCode: string): ProductCategoryBackfillPlanItem['legacy'] {
  const meta = metaObject(product.meta);
  const brandMeta = metaObject(meta[brandCode]);
  const spec = metaObject(product.spec);
  return {
    category: nullableText(product.category ?? brandMeta.category ?? meta.category),
    websiteMenuCategory: nullableText(brandMeta.websiteMenuCategory ?? brandMeta.websiteCategory ?? brandMeta.cat ?? meta.websiteMenuCategory),
    system: nullableText(brandMeta.system ?? brandMeta.sys ?? spec.system ?? meta.system),
  };
}

function metaObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {};
}

function nullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_/]+/g, '-');
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}
