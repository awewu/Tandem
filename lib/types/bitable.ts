/**
 * Bitable · 多维表格 (轻量版)
 *
 * 数据模型: 一个 BitableTable 由 schema (列定义) + rows (行数据) 组成.
 *   - 列类型: text / number / date / select / multiselect / checkbox / user / link
 *   - 视图: 表格 / 看板 (by select 列分组) / 日历 (by date 列)
 *
 * V1 范围:
 *   - 单工作区单 owner
 *   - 表格 CRUD + 列 CRUD + 行 CRUD
 *   - 单视图 (表格), 看板/日历 V2
 */

export type BitableColumnType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'user'
  | 'link';

export interface BitableColumn {
  id: string;
  name: string;
  type: BitableColumnType;
  /** select / multiselect 的选项 */
  options?: Array<{ value: string; color?: string }>;
  /** 默认值 */
  defaultValue?: unknown;
  /** 是否必填 */
  required?: boolean;
  /** 列宽 (px) */
  width?: number;
}

export interface BitableTable {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  /** 多租户隔离 (默认 'default') */
  tenantId?: string;
  columns: BitableColumn[];
  /** 行数据: 每行是 { [columnId]: value } */
  rows: Array<{ id: string; data: Record<string, unknown>; createdAt: string; updatedAt: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface BitableView {
  id: string;
  tableId: string;
  name: string;
  type: 'grid' | 'kanban' | 'calendar';
  /** kanban: 分组列; calendar: 日期列 */
  groupByColumnId?: string;
  /** 过滤 + 排序 (V2) */
  filters?: unknown[];
  sorts?: Array<{ columnId: string; dir: 'asc' | 'desc' }>;
}
