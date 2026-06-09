/**
 * lib/ontology/types.ts · 本体层类型 (ON-0 · 2026-06-09)
 *
 * ─────────────────────────────────────────────────────────
 * 学 Palantir Foundry Ontology 的**真实工程机制** (剥营销, 见 docs/ONTOLOGY-CENTRAL-BRAIN.md §8):
 *   Ontology = 类型化对象视图 (ObjectType) + 关系 (Link) + 派生函数 (derived / Functions-on-Objects 雏形)。
 *   逻辑对象模型与物理存储**分离**: ObjectType.resolve/search 委托现有 repository (getStore),
 *   不复制存储、不重写分仓 —— 是**只读收口视图层** (ON-0 零写风险)。
 *
 * 不在本文件做的事 (后续相位):
 *   - 写动作 (Action Type) → ON-1 (lib/ontology/action-types.ts)
 *   - embedding 检索索引 → ON-0 增强 (§8.3 第 5 项); 当前 search = 确定性子串匹配
 */

/** 已注册对象类型 id (字符串, 由 object-types.ts 注册时确定) */
export type ObjectTypeId = string;

/**
 * 对象间关系。
 *   - 正向 (by id): 如 KeyResult.objective (kr.objectiveId → Objective)
 *   - 反向 (by query): 如 Objective.keyResults (查 objectiveId === o.id 的 KR)
 * 两者统一用 `resolve(obj)` 异步返回目标对象, 屏蔽方向差异。
 */
export interface OntologyLink<T = unknown> {
  /** 关系名 (在源对象上的字段语义), 如 'objective' / 'keyResults' / 'parent' */
  name: string;
  /** 目标对象类型 id */
  targetType: ObjectTypeId;
  /** 基数 */
  cardinality: 'one' | 'many';
  /** 给定源对象, 解析出目标对象 (one → T2|null; many → T2[]) */
  resolve: (obj: T) => Promise<unknown>;
}

/**
 * 对象类型定义 (Object Type)。一个 ObjectType = 一类业务对象的统一语义入口。
 */
export interface ObjectType<T extends { id: string } = { id: string }> {
  /** 唯一 id, 如 'Objective' / 'KeyResult' / 'Initiative' */
  id: ObjectTypeId;
  /** 人类可读标签 */
  label: string;
  /** 按 id 解析单个对象 (委托 repository) */
  resolve: (id: string) => Promise<T | null>;
  /** 确定性检索 (当前子串匹配; ON-0 增强接 embedding) */
  search: (query: string, opts?: { limit?: number }) => Promise<T[]>;
  /** 关系定义 */
  links: OntologyLink<T>[];
  /**
   * 派生属性 (Functions-on-Objects 雏形): 由对象算出的真值, 如 KR progress / Objective effectiveProgress。
   * 复用 lib/types/okr-tti.ts 的真值函数, 保证"真值唯一来源"。
   */
  derived?: (obj: T) => Record<string, unknown>;
}

/**
 * resolve 的统一返回: 原始数据 + 派生真值 + 可遍历的关系名。
 * 关系对象按需经 registry.traverse 懒解析 (不在 resolve 时全量展开, 防 N+1 爆炸)。
 */
export interface ResolvedObject<T extends { id: string } = { id: string }> {
  type: ObjectTypeId;
  id: string;
  data: T;
  /** 派生真值 (derived 计算结果; 无 derived 则空对象) */
  derived: Record<string, unknown>;
  /** 该对象可遍历的关系 (name → 元信息), 经 traverse(name) 解析 */
  links: Array<{ name: string; targetType: ObjectTypeId; cardinality: 'one' | 'many' }>;
}
