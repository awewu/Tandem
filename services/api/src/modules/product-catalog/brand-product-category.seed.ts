export type BrandProductCategoryLevel = number;
export type BrandProductCategoryStatus = 'active' | 'inactive';

export interface BrandProductCategorySeedNode {
  code: string;
  nameCn: string;
  nameEn?: string;
  slug?: string;
  sortOrder: number;
  children?: readonly BrandProductCategorySeedNode[];
}

export interface BrandProductCategorySeedRow {
  brandCode: string;
  parentCode: string | null;
  level: BrandProductCategoryLevel;
  code: string;
  nameCn: string;
  nameEn: string | null;
  slug: string | null;
  sortOrder: number;
  status: BrandProductCategoryStatus;
  description: string | null;
}

export const DEFAULT_BRAND_PRODUCT_CATEGORY_SEEDS: Readonly<Record<string, readonly BrandProductCategorySeedNode[]>> = {
  everhot: [
    {
      code: 'home',
      nameCn: '家用',
      nameEn: 'Residential',
      slug: 'home',
      sortOrder: 10,
      children: [
        { code: 'central-air-conditioning', nameCn: '家用中央空调', slug: 'central-air-conditioning', sortOrder: 10 },
        { code: 'floor-heating', nameCn: '地暖系统', slug: 'floor-heating', sortOrder: 20 },
        { code: 'total-heat-fresh-air', nameCn: '全热新风', slug: 'total-heat-fresh-air', sortOrder: 30 },
      ],
    },
    {
      code: 'commercial',
      nameCn: '商用',
      nameEn: 'Commercial',
      slug: 'commercial',
      sortOrder: 20,
      children: [
        { code: 'hot-water-system', nameCn: '热水系统', slug: 'hot-water-system', sortOrder: 10 },
        { code: 'gas-condensing-wall-hung-boiler', nameCn: '燃气冷凝壁挂炉', slug: 'gas-condensing-wall-hung-boiler', sortOrder: 20 },
        { code: 'zero-cold-water-gas-water-heater', nameCn: '零冷水燃气热水器', slug: 'zero-cold-water-gas-water-heater', sortOrder: 30 },
        { code: 'air-source-water-heater', nameCn: '空气能热水器', slug: 'air-source-water-heater', sortOrder: 40 },
        { code: 'storage-gas-water-heater', nameCn: '容积式燃气热水器', slug: 'storage-gas-water-heater', sortOrder: 50 },
        { code: 'electric-water-heater', nameCn: '电热水器', slug: 'electric-water-heater', sortOrder: 60 },
        { code: 'heating-hot-water-combi', nameCn: '采暖热水两联供', slug: 'heating-hot-water-combi', sortOrder: 70 },
      ],
    },
  ],
  rheem: [
    {
      code: 'home',
      nameCn: '家用',
      nameEn: 'Residential',
      slug: 'home',
      sortOrder: 10,
      children: [
        { code: 'central-hot-water', nameCn: '中央热水系统', slug: 'central-hot-water', sortOrder: 10 },
        { code: 'floor-heating-manifold', nameCn: '地暖分集水器系统', slug: 'floor-heating-manifold', sortOrder: 20 },
        { code: 'total-heat-fresh-air', nameCn: '全热交换新风机', slug: 'total-heat-fresh-air', sortOrder: 30 },
        { code: 'econet-control', nameCn: 'Econet 智控系统', slug: 'econet-control', sortOrder: 40 },
      ],
    },
    {
      code: 'commercial',
      nameCn: '商用',
      nameEn: 'Commercial',
      slug: 'commercial',
      sortOrder: 20,
      children: [
        { code: 'commercial-hot-water', nameCn: '商用热水系统', slug: 'commercial-hot-water', sortOrder: 10 },
        { code: 'commercial-heat-pump', nameCn: '商用热泵系统', slug: 'commercial-heat-pump', sortOrder: 20 },
      ],
    },
  ],
  ruud: [
    {
      code: 'home',
      nameCn: '家用',
      nameEn: 'Residential',
      slug: 'home',
      sortOrder: 10,
      children: [
        { code: 'central-air-conditioning', nameCn: '中央空调系统', slug: 'central-air-conditioning', sortOrder: 10 },
        { code: 'hot-water-system', nameCn: '热水系统', slug: 'hot-water-system', sortOrder: 20 },
      ],
    },
    {
      code: 'commercial',
      nameCn: '商用',
      nameEn: 'Commercial',
      slug: 'commercial',
      sortOrder: 20,
      children: [
        { code: 'commercial-air-conditioning', nameCn: '商用中央空调', slug: 'commercial-air-conditioning', sortOrder: 10 },
        { code: 'commercial-hot-water', nameCn: '商用热水系统', slug: 'commercial-hot-water', sortOrder: 20 },
      ],
    },
  ],
} as const;

export function assertBrandProductCategoryLevel(level: number): asserts level is BrandProductCategoryLevel {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error('brand product category level must be a positive integer');
  }
}

export function flattenBrandProductCategorySeeds(
  seeds: Readonly<Record<string, readonly BrandProductCategorySeedNode[]>> = DEFAULT_BRAND_PRODUCT_CATEGORY_SEEDS,
): BrandProductCategorySeedRow[] {
  const rows: BrandProductCategorySeedRow[] = [];
  const visit = (
    brandCode: string,
    node: BrandProductCategorySeedNode,
    level: BrandProductCategoryLevel,
    parentCode: string | null,
  ) => {
    assertBrandProductCategoryLevel(level);
    rows.push({
      brandCode,
      parentCode,
      level,
      code: node.code,
      nameCn: node.nameCn,
      nameEn: node.nameEn ?? null,
      slug: node.slug ?? null,
      sortOrder: node.sortOrder,
      status: 'active',
      description: 'default-seed',
    });
    const nextLevel = level + 1;
    for (const child of node.children ?? []) {
      assertBrandProductCategoryLevel(nextLevel);
      visit(brandCode, child, nextLevel, node.code);
    }
  };

  for (const [brandCode, roots] of Object.entries(seeds)) {
    for (const root of roots) visit(brandCode, root, 1, null);
  }
  return rows;
}

export function planIdempotentBrandProductCategorySeeds(
  existing: readonly Pick<BrandProductCategorySeedRow, 'brandCode' | 'parentCode' | 'code' | 'nameCn'>[],
  seeds = flattenBrandProductCategorySeeds(),
): BrandProductCategorySeedRow[] {
  const seen = new Set<string>();
  const key = (row: Pick<BrandProductCategorySeedRow, 'brandCode' | 'parentCode' | 'code' | 'nameCn'>, field: 'code' | 'nameCn') =>
    `${row.brandCode}::${row.parentCode ?? ''}::${field}::${row[field].trim().toLowerCase()}`;

  for (const row of existing) {
    seen.add(key(row, 'code'));
    seen.add(key(row, 'nameCn'));
  }

  const planned: BrandProductCategorySeedRow[] = [];
  for (const row of seeds) {
    const codeKey = key(row, 'code');
    const nameKey = key(row, 'nameCn');
    if (seen.has(codeKey) || seen.has(nameKey)) continue;
    seen.add(codeKey);
    seen.add(nameKey);
    planned.push(row);
  }
  return planned;
}
