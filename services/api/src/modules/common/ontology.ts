/**
 * 本体对象类型注册表（Ontology Object Types）· 平台名词的单一真相源
 *
 * 借鉴 Palantir Foundry Ontology 的**概念划分**（objects/links 是名词，actions/functions 是动词），
 * 但**不引入 Foundry 基础设施**（无数据集成层/微服务群/图数据库）——只要那一条最有价值的纪律：
 *   **动作锚定的对象类型，必须与事实图谱的节点类型是同一套词汇。**
 *
 * 为什么必须有这张表（真实存在的漂移）：
 *   · `geo-actions.ts` 的 `objectType` 此前是**自由字符串**，写错、拼歧义、与设计文档
 *     `docs/architecture/FACT-GRAPH-DESIGN.md` 的节点名分叉都无人察觉。
 *   · 实测已发生一次分叉：动作里写 `CopyAsset`，事实图谱设计里叫 `ContentAsset`——
 *     同一个东西两个名字，图谱一旦落地就会接不上。此处以别名显式收敛，而非假装从未发生。
 *
 * 有牙的方式：`GeoActionType.objectType` 的类型改为 `ObjectTypeId` 联合类型，
 * 拼错或用未登记的名字**编译期即失败**，无需靠人记得跑门禁。
 */

/** 落地状态：诚实区分「已有表」「有实现但未入图」「仅设计」。 */
export type ObjectPersistence =
  | 'entity'            // 已有数据库表
  | 'code-only'         // 有代码实现但未持久化为图节点（如 HVAC 内核）
  | 'registry-file'     // 由仓库内注册文件描述（如 brand-registry.json）
  | 'vocabulary'        // 词表常量（气候区/角色）
  | 'planned';          // 仅设计，尚无实现

export interface ObjectTypeDef {
  /** 稳定标识（PascalCase，与事实图谱节点名一致） */
  id: string;
  label: string;
  /** 归属模块（对齐模块边界，便于判断谁有权写） */
  module: string;
  persistence: ObjectPersistence;
  /**
   * 落地出处（persistence='planned' 时为 null）。
   * persistence='entity' 一律填**表名**（`schema.table`）而非实体类名：表名是跨模块稳定标识，
   * 且避免本登记表沦为绕过模块边界门禁的后门（`guard:product-fact-base` 禁止非 D2 模块
   * 出现产品事实实体类名——该约束是对的，不为登记表破例）。
   */
  backing: string | null;
  /** 是否为事实图谱节点（FACT-GRAPH-DESIGN.md §2 目标实体模型） */
  factGraphNode: boolean;
  /** 历史别名 → 收敛用（曾用名不得再新增使用） */
  aliases?: string[];
  note?: string;
}

/**
 * 对象类型定义。新增受治理动作时若需要新对象类型，必须先在此登记，
 * 否则 `objectType` 通不过类型检查（这是刻意的摩擦：防止名词无序增殖）。
 */
export const OBJECT_TYPES = {
  Brand: {
    id: 'Brand', label: '品牌', module: 'brand-registry', persistence: 'registry-file',
    backing: 'config/brand-registry.json', factGraphNode: true,
  },
  ProductCategory: {
    id: 'ProductCategory', label: '产品品类（三级树）', module: 'brand-product-category', persistence: 'entity',
    backing: 'rhautt_nexus.brand_product_categories', factGraphNode: true,
  },
  Product: {
    id: 'Product', label: '产品（SKU 级事实）', module: 'product-catalog', persistence: 'entity',
    backing: 'rhautt_nexus.products', factGraphNode: true,
    note: '产品事实基座（D2）是对外产品声明的唯一来源；下游模块只读，不得直连其实体',
  },
  TechKernel: {
    id: 'TechKernel', label: 'HVAC 技术内核', module: 'packages/domain/hvac-kernels', persistence: 'code-only',
    backing: 'packages/domain/hvac-kernels', factGraphNode: true,
    note: '9 域精算内核已实现，但尚未作为图节点持久化（事实图谱 Phase 1 待办）',
  },
  SystemPack: {
    id: 'SystemPack', label: '系统包（内核组合）', module: 'system-packs', persistence: 'code-only',
    backing: 'packages/domain/system-packs', factGraphNode: true,
  },
  Scenario: {
    id: 'Scenario', label: '场景（品类×角色×痛点×房型×气候区）', module: 'growth', persistence: 'entity',
    backing: 'rhautt_nexus.growth_scenario', factGraphNode: true,
  },
  Question: {
    id: 'Question', label: 'GEO 选题（prompt）', module: 'growth', persistence: 'entity',
    backing: 'rhautt_nexus.growth_geo_question', factGraphNode: true,
  },
  ContentAsset: {
    id: 'ContentAsset', label: '内容资产（文案/GEO 内容）', module: 'growth', persistence: 'entity',
    backing: 'rhautt_nexus.growth_copy_asset', factGraphNode: true,
    // 收敛已发生的命名分叉：动作层曾用 CopyAsset，事实图谱设计用 ContentAsset。
    aliases: ['CopyAsset'],
    note: '统一取事实图谱名 ContentAsset；CopyAsset 为历史别名，不得新增使用',
  },
  BrandSitePage: {
    id: 'BrandSitePage', label: '品牌站页面（发布产物）', module: 'brand-sites', persistence: 'entity',
    backing: 'rhautt_nexus.tenant_brand_sites', factGraphNode: true,
  },
  Dealer: {
    id: 'Dealer', label: '经销商', module: 'crm', persistence: 'entity',
    backing: 'rhautt_nexus.dealers', factGraphNode: true,
    note: '图谱中只放服务能力（区域×品类），终端用户 PII 不入图',
  },
  ClimateZone: {
    id: 'ClimateZone', label: '气候区（GB 建筑气候区划）', module: 'growth', persistence: 'vocabulary',
    backing: 'geo-scenarios.CLIMATE_ZONES', factGraphNode: true,
  },
  Audience: {
    id: 'Audience', label: '角色（业主/装修/设计/安装）', module: 'growth', persistence: 'vocabulary',
    backing: 'geo-scenarios.ScenarioAudience', factGraphNode: true,
  },
  Competitor: {
    id: 'Competitor', label: '竞品', module: 'insight', persistence: 'entity',
    backing: 'rhautt_nexus.insight_competitor', factGraphNode: true,
  },
  GeoExperiment: {
    id: 'GeoExperiment', label: 'GEO 闭环实验（lift 验证单元）', module: 'growth', persistence: 'entity',
    backing: 'rhautt_nexus.growth_geo_experiment', factGraphNode: false,
    note: '实验是过程对象而非事实节点，不入事实图谱；但受治理动作需锚定它',
  },
  GeoBootstrap: {
    id: 'GeoBootstrap', label: '新品牌/品类启动序列', module: 'growth', persistence: 'planned',
    backing: null, factGraphNode: false,
    note: '编排动作的锚点，无独立持久化对象（步骤结果落在场景/选题/探测上）',
  },
} as const satisfies Record<string, ObjectTypeDef>;

/** 已登记的对象类型标识。动作的 objectType 必须取自此联合类型（编译期约束）。 */
export type ObjectTypeId = keyof typeof OBJECT_TYPES;

export function listObjectTypes(): ObjectTypeDef[] {
  return Object.values(OBJECT_TYPES) as ObjectTypeDef[];
}

export function getObjectType(id: string): ObjectTypeDef | undefined {
  return (OBJECT_TYPES as Record<string, ObjectTypeDef>)[id];
}

/** 事实图谱节点类型（FACT-GRAPH-DESIGN.md §2 的落地口径）。 */
export function listFactGraphNodeTypes(): ObjectTypeDef[] {
  return listObjectTypes().filter((o) => o.factGraphNode);
}

/** 解析历史别名 → 现行标识；未知名字返回 null（不猜、不静默通过）。 */
export function resolveObjectTypeId(name: string): ObjectTypeId | null {
  const raw = String(name || '').trim();
  if (!raw) return null;
  if (raw in OBJECT_TYPES) return raw as ObjectTypeId;
  for (const def of listObjectTypes()) {
    if (def.aliases?.includes(raw)) return def.id as ObjectTypeId;
  }
  return null;
}
