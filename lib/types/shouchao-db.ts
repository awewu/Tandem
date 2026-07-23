/**
 * 搭子手抄 · 数据库 (对标 Notion databases) 类型
 *
 * 一个数据库 = 一组自定义属性 (列) + 若干行 + 若干视图 (表格/看板/画廊).
 * 个人资产, 按 ownerId 隔离. 存储: KvStore collections
 *   shouchao_databases (库定义) / shouchao_rows (行数据), 无迁移、幂等.
 *
 * 与笔记正交: 数据库是结构化数据; 笔记是自由 Markdown. 可各自独立存在.
 */

/** 属性 (列) 类型 */
export type ShouchaoPropType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiSelect'
  | 'date'
  | 'checkbox'
  | 'url';

export interface ShouchaoProperty {
  id: string;
  name: string;
  type: ShouchaoPropType;
  /** select / multiSelect 的候选项 */
  options?: string[];
}

/** 视图类型 */
export type ShouchaoViewType = 'table' | 'board' | 'gallery';

export interface ShouchaoSort {
  propId: string;
  dir: 'asc' | 'desc';
}

/** 筛选: 目前支持等值 / 包含 / 布尔 (MVP, 可扩展操作符) */
export interface ShouchaoFilter {
  propId: string;
  op: 'eq' | 'contains' | 'isTrue' | 'isFalse';
  value?: string;
}

export interface ShouchaoView {
  id: string;
  name: string;
  type: ShouchaoViewType;
  /** board/gallery 按此 select 属性分组 */
  groupByPropId?: string;
  sorts?: ShouchaoSort[];
  filters?: ShouchaoFilter[];
}

export interface ShouchaoDatabase {
  id: string;
  ownerId: string;
  tenantId: string;
  name: string;
  icon?: string;
  properties: ShouchaoProperty[];
  views: ShouchaoView[];
  /** 可选: 内嵌在某笔记页面下 (Notion inline database) */
  parentId?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** 单元格值: 按属性类型存不同形态 (text/url=string, number=number, select=string, multiSelect=string[], date=ISO, checkbox=boolean) */
export type ShouchaoCellValue = string | number | boolean | string[] | null;

export interface ShouchaoRow {
  id: string;
  databaseId: string;
  ownerId: string;
  tenantId: string;
  /** propId → value */
  cells: Record<string, ShouchaoCellValue>;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}
