import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { ProductEntity } from '../product-catalog/product-catalog.entity';
import {
  BrandProductCategoryEntity, BrandProductCategoryStatus,
} from './brand-product-category.entity';

const CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALID_STATUSES = new Set<BrandProductCategoryStatus>(['active', 'inactive']);

export interface BrandProductCategoryInput {
  brandCode?: string;
  parentId?: string | null;
  level?: number;
  code?: string;
  nameCn?: string;
  nameEn?: string | null;
  slug?: string | null;
  sortOrder?: number;
  status?: BrandProductCategoryStatus;
  description?: string | null;
}

export interface BrandProductCategoryNode extends BrandProductCategoryEntity {
  children: BrandProductCategoryNode[];
}

export interface PublicBrandProductCategoryNode {
  id: string;
  brandCode: string;
  parentId: string | null;
  level: number;
  code: string;
  slug: string | null;
  nameCn: string;
  nameEn: string | null;
  sortOrder: number;
  status: BrandProductCategoryStatus;
  ancestry: PublicBrandProductCategoryNode[];
  path: string;
  children: PublicBrandProductCategoryNode[];
}

@Injectable()
export class BrandProductCategoryService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(BrandProductCategoryEntity)
    private readonly categories: Repository<BrandProductCategoryEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
  ) {}

  async list(brandCodeInput: unknown, parentIdInput?: unknown, metricsInput?: unknown) {
    const brandCode = normalizeCode(brandCodeInput, 'brandCode');
    const wantsLazy = parentIdInput !== undefined;
    const wantsMetrics = String(metricsInput ?? 'true').trim().toLowerCase() !== 'false';
    const parentId = normalizeListParentId(parentIdInput);
    const rows = await this.categories.find({
      where: { brandCode, deletedAt: IsNull() } as any,
      order: { level: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' } as any,
    });
    const items = rows.sort(compareCategories);
    if (wantsLazy) {
      if (parentId) {
        const parent = rows.find((row) => row.id === parentId);
        if (!parent) throw new NotFoundException('Parent category does not exist or has been deleted.');
      }
      const visible = items.filter((row) => (parentId ? row.parentId === parentId : !row.parentId));
      const projected = wantsMetrics ? await this.withTreeTableMetrics(visible, items, this.products) : visible;
      return {
        success: true,
        data: {
          brandCode,
          parentId,
          items: projected,
          total: projected.length,
        },
      };
    }
    return {
      success: true,
      data: {
        brandCode,
        items: withAncestry(items),
        tree: buildTree(items),
        total: items.length,
      },
    };
  }

  async get(id: string) {
    const row = await this.findActiveCategoryByRepo(this.categories, id);
    const rows = await this.categories.find({
      where: { brandCode: row.brandCode, deletedAt: IsNull() } as any,
    });
    const projected = withAncestry(rows).find((item) => item.id === row.id);
    return { success: true, data: projected ?? row };
  }

  async publicList(brandCodeInput: unknown) {
    const brandCode = normalizeCode(brandCodeInput, 'brandCode');
    const rows = await this.categories.find({
      where: { brandCode, status: 'active', deletedAt: IsNull() } as any,
      order: { level: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' } as any,
    });
    const items = rows.sort(compareCategories);
    const publicItems = withPublicAncestry(items);
    return {
      success: true,
      data: {
        brandCode,
        items: publicItems,
        tree: buildPublicTree(publicItems),
        total: publicItems.length,
      },
    };
  }

  async create(input: BrandProductCategoryInput) {
    const brandCode = normalizeCode(input.brandCode, 'brandCode');
    const parentId = normalizeNullableText(input.parentId);
    const code = normalizeCode(input.code, 'code');
    const patch = this.inputPatch(input, true);

    return this.ds.transaction(async (em) => {
      const resolvedLevel = await this.resolveLevel(em, brandCode, parentId, input.level);
      await this.assertCodeUnique(em, brandCode, parentId, code);
      const saved = await em.getRepository(BrandProductCategoryEntity).save(
        em.getRepository(BrandProductCategoryEntity).create({
          brandCode,
          parentId,
          level: resolvedLevel,
          ...patch,
          code,
        }),
      );
      return { success: true, data: saved };
    });
  }

  update(id: string, input: BrandProductCategoryInput) {
    const patch = this.inputPatch(input, false);
    if (!Object.keys(patch).length && input.parentId === undefined) throw new BadRequestException('No category fields to update.');

    return this.ds.transaction(async (em) => {
      const repo = em.getRepository(BrandProductCategoryEntity);
      const row = await this.findActiveCategory(em, id);
      if (input.parentId !== undefined) {
        const nextParentId = normalizeNullableText(input.parentId);
        await this.assertMoveAllowed(em, row, nextParentId);
        row.parentId = nextParentId;
        row.level = await this.resolveLevel(em, row.brandCode, nextParentId, undefined);
      }
      if (patch.code && patch.code !== row.code) {
        await this.assertCodeUnique(em, row.brandCode, input.parentId !== undefined ? row.parentId : row.parentId, patch.code, row.id);
      }
      Object.assign(row, patch);
      const saved = await repo.save(row);
      return { success: true, data: saved };
    });
  }

  async usage(id: string) {
    const row = await this.findActiveCategoryByRepo(this.categories, id);
    const boundProductCount = await this.countFrontendVisibleProducts(row, this.products);
    const exactBoundProductCount = await this.countExactBoundProducts(row, this.products);
    const childCategoryCount = await this.countChildCategories(row, this.categories);
    const descendantCategoryCount = await this.countDescendantCategories(row, this.categories);
    const descendantBoundProductCount = await this.countDescendantBoundProducts(row, this.categories, this.products);
    const canDelete = childCategoryCount === 0 && exactBoundProductCount === 0 && descendantBoundProductCount === 0;
    return {
      success: true,
      data: {
        categoryId: row.id,
        brandCode: row.brandCode,
        boundProductCount,
        currentProductCount: boundProductCount,
        frontendVisibleProductCount: boundProductCount,
        directProductCount: exactBoundProductCount,
        exactBoundProductCount,
        childCategoryCount,
        descendantCategoryCount,
        descendantProductCount: descendantBoundProductCount,
        descendantBoundProductCount,
        canDelete,
        blockingReason: canDelete
          ? null
          : childCategoryCount > 0
            ? 'category_has_children'
            : descendantBoundProductCount > 0
              ? 'category_or_descendants_have_products'
              : 'category_has_products',
      },
    };
  }

  delete(id: string) {
    return this.ds.transaction(async (em) => {
      const repo = em.getRepository(BrandProductCategoryEntity);
      const row = await this.findActiveCategory(em, id);
      const childCategoryCount = await this.countChildCategories(row, repo);
      if (childCategoryCount > 0) {
        throw new ConflictException(
          `Cannot delete category ${row.code}: ${childCategoryCount} child category/categories exist. Delete child categories first.`,
        );
      }
      const descendantBoundProductCount = await this.countDescendantBoundProducts(row, repo, em.getRepository(ProductEntity));
      if (descendantBoundProductCount > 0) {
        throw new ConflictException(
          `Cannot delete category ${row.code}: ${descendantBoundProductCount} product(s) are bound to it or its descendants. Move or clear product category bindings first.`,
        );
      }
      row.deletedAt = new Date();
      await repo.save(row);
      return { success: true, data: { deleted: true, id: row.id } };
    });
  }

  private inputPatch(input: BrandProductCategoryInput, creating: boolean): Partial<BrandProductCategoryEntity> {
    const patch: Partial<BrandProductCategoryEntity> = {};
    if (creating || input.code !== undefined) patch.code = normalizeCode(input.code, 'code');
    if (creating || input.nameCn !== undefined) patch.nameCn = normalizeRequiredText(input.nameCn, 'nameCn');
    if (input.nameEn !== undefined) patch.nameEn = normalizeNullableText(input.nameEn);
    if (input.slug !== undefined) patch.slug = normalizeNullableText(input.slug);
    if (creating || input.sortOrder !== undefined) patch.sortOrder = normalizeSortOrder(input.sortOrder);
    if (creating || input.status !== undefined) patch.status = normalizeStatus(input.status);
    if (input.description !== undefined) patch.description = normalizeNullableText(input.description);
    return patch;
  }

  private async resolveLevel(
    em: EntityManager,
    brandCode: string,
    parentId: string | null,
    levelInput: unknown,
  ): Promise<number> {
    if (!parentId) {
      const level = levelInput === undefined ? 1 : normalizeLevel(levelInput);
      if (level !== 1) throw new BadRequestException('Root categories must use level 1.');
      return level;
    }
    const parent = await em.getRepository(BrandProductCategoryEntity).findOne({
      where: { id: parentId, brandCode, deletedAt: IsNull() } as any,
    });
    if (!parent) throw new BadRequestException('Parent category does not exist under the selected brand.');
    const expected = parent.level + 1;
    if (levelInput !== undefined && normalizeLevel(levelInput) !== expected) {
      throw new BadRequestException(`Category level must be ${expected} for the selected parent.`);
    }
    return expected;
  }

  private async assertMoveAllowed(
    em: EntityManager,
    row: BrandProductCategoryEntity,
    parentId: string | null,
  ) {
    if (parentId === row.id) throw new BadRequestException('Category cannot be moved under itself.');
    if (!parentId) return;
    const all = await em.getRepository(BrandProductCategoryEntity).find({
      where: { brandCode: row.brandCode, deletedAt: IsNull() } as any,
    });
    const byId = new Map(all.map((item) => [item.id, item]));
    const parent = byId.get(parentId);
    if (!parent) throw new BadRequestException('Parent category does not exist under the selected brand.');
    for (let cursor: BrandProductCategoryEntity | undefined = parent; cursor; cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined) {
      if (cursor.id === row.id) throw new BadRequestException('Category move would create a cycle.');
    }
  }

  private async assertCodeUnique(
    em: EntityManager,
    brandCode: string,
    parentId: string | null,
    code: string,
    ignoreId?: string,
  ) {
    const existing = await em.getRepository(BrandProductCategoryEntity).findOne({
      where: { brandCode, parentId, code, deletedAt: IsNull() } as any,
    });
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException('Category code already exists under the same brand and parent.');
    }
  }

  private async findActiveCategory(em: EntityManager, id: string) {
    return this.findActiveCategoryByRepo(em.getRepository(BrandProductCategoryEntity), id);
  }

  private async findActiveCategoryByRepo(repo: Repository<BrandProductCategoryEntity>, id: string) {
    const row = await repo.findOne({ where: { id, deletedAt: IsNull() } as any });
    if (!row) throw new NotFoundException('Category does not exist or has been deleted.');
    return row;
  }

  private async countFrontendVisibleProducts(
    category: BrandProductCategoryEntity,
    repo: Repository<ProductEntity>,
  ) {
    const rows = await repo.find({ where: { brand: category.brandCode } as any });
    return rows.filter((product) =>
      isProductCountedForFrontendCategory(product as unknown as Record<string, unknown>, category),
    ).length;
  }

  private async countExactBoundProducts(
    category: BrandProductCategoryEntity,
    repo: Repository<ProductEntity>,
  ) {
    const rows = await repo.find({ where: { brand: category.brandCode } as any });
    return rows.filter((product) =>
      isProductExactlyBoundToCategory(product as unknown as Record<string, unknown>, category.id),
    ).length;
  }

  private async countChildCategories(
    category: BrandProductCategoryEntity,
    repo: Repository<BrandProductCategoryEntity>,
  ) {
    const rows = await repo.find({
      where: { brandCode: category.brandCode, parentId: category.id, deletedAt: IsNull() } as any,
    });
    return rows.length;
  }

  private async countDescendantCategories(
    category: BrandProductCategoryEntity,
    repo: Repository<BrandProductCategoryEntity>,
  ) {
    const rows = await repo.find({
      where: { brandCode: category.brandCode, deletedAt: IsNull() } as any,
    });
    return descendantIds(rows, category.id).length;
  }

  private async countDescendantBoundProducts(
    category: BrandProductCategoryEntity,
    categoryRepo: Repository<BrandProductCategoryEntity>,
    productRepo: Repository<ProductEntity>,
  ) {
    const rows = await categoryRepo.find({
      where: { brandCode: category.brandCode, deletedAt: IsNull() } as any,
    });
    const ids = new Set([category.id, ...descendantIds(rows, category.id)]);
    const categoriesById = new Map(rows.map((row) => [row.id, row]));
    const products = await productRepo.find({ where: { brand: category.brandCode } as any });
    return products.filter((product) =>
      [...ids].some((categoryId) => {
        const row = categoriesById.get(categoryId);
        return row ? isProductBoundToCategory(product as unknown as Record<string, unknown>, row) : false;
      }),
    ).length;
  }

  private async withTreeTableMetrics(
    rows: BrandProductCategoryEntity[],
    allCategories: BrandProductCategoryEntity[],
    productRepo: Repository<ProductEntity>,
  ) {
    const productsByBrand = new Map<string, ProductEntity[]>();
    for (const brandCode of new Set(rows.map((row) => row.brandCode))) {
      productsByBrand.set(brandCode, await productRepo.find({ where: { brand: brandCode } as any }));
    }
    return rows.sort(compareCategories).map((row) => {
      const descendants = descendantIds(allCategories, row.id);
      const descendantSet = new Set(descendants);
      const products = productsByBrand.get(row.brandCode) || [];
      const directProductCount = products.filter((product) =>
        isProductBoundToCategory(product as unknown as Record<string, unknown>, row),
      ).length;
      const descendantProductCount = products.filter((product) =>
        [...descendantSet].some((categoryId) => {
          const category = allCategories.find((item) => item.id === categoryId);
          return category ? isProductBoundToCategory(product as unknown as Record<string, unknown>, category) : false;
        }),
      ).length;
      const childCategoryCount = allCategories.filter((category) => category.parentId === row.id).length;
      return {
        ...row,
        hasChildren: childCategoryCount > 0,
        childCategoryCount,
        directProductCount,
        descendantProductCount,
        descendantCategoryCount: descendants.length,
        canDelete: childCategoryCount === 0 && directProductCount === 0 && descendantProductCount === 0,
      };
    });
  }
}

function normalizeCode(value: unknown, field: string): string {
  const code = String(value || '').trim().toLowerCase();
  if (!CODE_RE.test(code)) throw new BadRequestException(`${field} must use lowercase letters, numbers, and hyphens.`);
  return code;
}

function normalizeLevel(value: unknown): number {
  const level = Number(value);
  if (!Number.isInteger(level) || level < 1) {
    throw new BadRequestException('Brand product category level must be a positive integer.');
  }
  return level;
}

function normalizeRequiredText(value: unknown, field: string): string {
  const text = String(value || '').trim();
  if (!text) throw new BadRequestException(`${field} is required.`);
  return text;
}

function normalizeNullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeListParentId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text || text === 'root' || text === 'null') return null;
  return text;
}

function normalizeSortOrder(value: unknown): number {
  const order = value === undefined ? 0 : Number(value);
  if (!Number.isInteger(order) || order < 0 || order > 999999) {
    throw new BadRequestException('sortOrder must be an integer from 0 to 999999.');
  }
  return order;
}

function normalizeStatus(value: unknown): BrandProductCategoryStatus {
  const status = (value === undefined ? 'active' : String(value).trim().toLowerCase()) as BrandProductCategoryStatus;
  if (!VALID_STATUSES.has(status)) throw new BadRequestException('status must be active or inactive.');
  return status;
}

function compareCategories(a: BrandProductCategoryEntity, b: BrandProductCategoryEntity): number {
  return a.level - b.level
    || (a.parentId || '').localeCompare(b.parentId || '')
    || a.sortOrder - b.sortOrder
    || a.createdAt.getTime() - b.createdAt.getTime();
}

function categoryPath(row: BrandProductCategoryEntity, byId: Map<string, BrandProductCategoryEntity>): BrandProductCategoryEntity[] {
  const ancestry: BrandProductCategoryEntity[] = [];
  const seen = new Set<string>();
  for (let cursor: BrandProductCategoryEntity | undefined = row; cursor; cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined) {
    if (seen.has(cursor.id)) break;
    seen.add(cursor.id);
    ancestry.unshift(cursor);
  }
  return ancestry;
}

function withAncestry(rows: BrandProductCategoryEntity[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return rows.sort(compareCategories).map((row) => {
    const ancestry = categoryPath(row, byId);
    return {
      ...row,
      ancestry,
      path: ancestry.map((item) => item.nameCn).join(' / '),
    };
  });
}

function buildTree(rows: BrandProductCategoryEntity[]): BrandProductCategoryNode[] {
  const nodes = new Map<string, BrandProductCategoryNode>();
  for (const row of rows) nodes.set(row.id, { ...row, children: [] });
  const roots: BrandProductCategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortNodes = (items: BrandProductCategoryNode[]) => {
    items.sort(compareCategories);
    for (const item of items) sortNodes(item.children);
  };
  sortNodes(roots);
  return roots;
}

function publicCategoryProjection(
  row: BrandProductCategoryEntity,
  ancestry: BrandProductCategoryEntity[],
): Omit<PublicBrandProductCategoryNode, 'children'> {
  return {
    id: row.id,
    brandCode: row.brandCode,
    parentId: row.parentId,
    level: row.level,
    code: row.code,
    slug: row.slug,
    nameCn: row.nameCn,
    nameEn: row.nameEn,
    sortOrder: row.sortOrder,
    status: row.status,
    ancestry: ancestry.map((item) => ({
      id: item.id,
      brandCode: item.brandCode,
      parentId: item.parentId,
      level: item.level,
      code: item.code,
      slug: item.slug,
      nameCn: item.nameCn,
      nameEn: item.nameEn,
      sortOrder: item.sortOrder,
      status: item.status,
      ancestry: [],
      path: '',
      children: [],
    })),
    path: ancestry.map((item) => item.nameCn).join(' / '),
  };
}

function withPublicAncestry(rows: BrandProductCategoryEntity[]): Array<Omit<PublicBrandProductCategoryNode, 'children'>> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return rows.sort(compareCategories).map((row) => publicCategoryProjection(row, categoryPath(row, byId)));
}

function buildPublicTree(rows: Array<Omit<PublicBrandProductCategoryNode, 'children'>>): PublicBrandProductCategoryNode[] {
  const nodes = new Map<string, PublicBrandProductCategoryNode>();
  for (const row of rows) nodes.set(row.id, { ...row, children: [] });
  const roots: PublicBrandProductCategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortNodes = (items: PublicBrandProductCategoryNode[]) => {
    items.sort((a, b) => a.level - b.level
      || (a.parentId || '').localeCompare(b.parentId || '')
      || a.sortOrder - b.sortOrder
      || a.code.localeCompare(b.code));
    for (const item of items) sortNodes(item.children);
  };
  sortNodes(roots);
  return roots;
}

function isProductCountedForFrontendCategory(
  product: Record<string, unknown>,
  category: Pick<BrandProductCategoryEntity, 'id' | 'level' | 'code' | 'nameCn' | 'nameEn' | 'slug'>,
): boolean {
  if (product.status === 'archived') return false;
  if (category.level >= 1 && category.level <= 3) {
    return isLegacyCategoryLevelBound(product, category.id, category.level)
      || isProductExactlyBoundToCategory(product, category.id);
  }
  return isProductExactlyBoundToCategory(product, category.id);
}

function isProductBoundToCategory(
  product: Record<string, unknown>,
  category: Pick<BrandProductCategoryEntity, 'id' | 'code' | 'nameCn' | 'nameEn' | 'slug'>,
): boolean {
  return isProductExactlyBoundToCategory(product, category.id)
    || isLegacyCategoryFieldBound(product, category.id)
    || isLegacyProductKnowledgeMatchedToCategory(product, category);
}

function isProductExactlyBoundToCategory(product: Record<string, unknown>, categoryId: string): boolean {
  if (product.status === 'archived') return false;
  const meta = product.meta && typeof product.meta === 'object' && !Array.isArray(product.meta)
    ? product.meta as Record<string, unknown>
    : {};
  const brand = String(product.brand || '').trim().toLowerCase();
  const brandMeta = brand && meta[brand] && typeof meta[brand] === 'object' && !Array.isArray(meta[brand])
    ? meta[brand] as Record<string, unknown>
    : {};
  const bindings = [
    ...(Array.isArray(meta.categoryBindings) ? meta.categoryBindings : []),
    ...(Array.isArray(brandMeta.categoryBindings) ? brandMeta.categoryBindings : []),
  ];
  if (meta.primaryCategoryId === categoryId || brandMeta.primaryCategoryId === categoryId) return true;
  if (bindings.some((binding) =>
    binding && typeof binding === 'object' && (binding as Record<string, unknown>).categoryId === categoryId,
  )) return true;
  return false;
}

function isLegacyCategoryFieldBound(product: Record<string, unknown>, categoryId: string): boolean {
  if (product.status === 'archived') return false;
  const meta = product.meta && typeof product.meta === 'object' && !Array.isArray(product.meta)
    ? product.meta as Record<string, unknown>
    : {};
  const brand = String(product.brand || '').trim().toLowerCase();
  const brandMeta = brand && meta[brand] && typeof meta[brand] === 'object' && !Array.isArray(meta[brand])
    ? meta[brand] as Record<string, unknown>
    : {};
  return [
    product.categoryLevel1Id,
    product.categoryLevel2Id,
    product.categoryLevel3Id,
    meta.categoryLevel1Id,
    meta.categoryLevel2Id,
    meta.categoryLevel3Id,
    brandMeta.categoryLevel1Id,
    brandMeta.categoryLevel2Id,
    brandMeta.categoryLevel3Id,
  ].some((value) => value === categoryId);
}

function isLegacyProductKnowledgeMatchedToCategory(
  product: Record<string, unknown>,
  category: Pick<BrandProductCategoryEntity, 'id' | 'code' | 'nameCn' | 'nameEn' | 'slug'>,
): boolean {
  if (product.status === 'archived') return false;
  const signals = legacyProductCategorySignals(product);
  if (!signals.length) return false;
  const categoryKeys = [category.id, category.code, category.nameCn, category.nameEn, category.slug]
    .map(normalizeMatchKey)
    .filter(Boolean);
  return signals.some((signal) => categoryKeys.includes(signal));
}

function legacyProductCategorySignals(product: Record<string, unknown>): string[] {
  const meta = product.meta && typeof product.meta === 'object' && !Array.isArray(product.meta)
    ? product.meta as Record<string, unknown>
    : {};
  const spec = product.spec && typeof product.spec === 'object' && !Array.isArray(product.spec)
    ? product.spec as Record<string, unknown>
    : {};
  const brand = String(product.brand || '').trim().toLowerCase();
  const brandMeta = brand && meta[brand] && typeof meta[brand] === 'object' && !Array.isArray(meta[brand])
    ? meta[brand] as Record<string, unknown>
    : {};
  return [
    product.category,
    meta.category,
    meta.websiteMenuCategory,
    brandMeta.category,
    brandMeta.websiteMenuCategory,
    brandMeta.websiteCategory,
    brandMeta.cat,
    brandMeta.system,
    brandMeta.sys,
    spec.system,
    meta.system,
  ]
    .map(normalizeMatchKey)
    .filter(Boolean);
}

function normalizeMatchKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_/]+/g, '-');
}

function isLegacyCategoryLevelBound(product: Record<string, unknown>, categoryId: string, level: number): boolean {
  const field = `categoryLevel${level}Id`;
  const meta = product.meta && typeof product.meta === 'object' && !Array.isArray(product.meta)
    ? product.meta as Record<string, unknown>
    : {};
  const brand = String(product.brand || '').trim().toLowerCase();
  const brandMeta = brand && meta[brand] && typeof meta[brand] === 'object' && !Array.isArray(meta[brand])
    ? meta[brand] as Record<string, unknown>
    : {};
  return product[field] === categoryId || meta[field] === categoryId || brandMeta[field] === categoryId;
}

function descendantIds(rows: BrandProductCategoryEntity[], parentId: string): string[] {
  const out: string[] = [];
  const childrenByParent = new Map<string, BrandProductCategoryEntity[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    if (!childrenByParent.has(row.parentId)) childrenByParent.set(row.parentId, []);
    childrenByParent.get(row.parentId)!.push(row);
  }
  const visit = (id: string) => {
    for (const child of childrenByParent.get(id) ?? []) {
      out.push(child.id);
      visit(child.id);
    }
  };
  visit(parentId);
  return out;
}
