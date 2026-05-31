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
  | 'link'
  /** D-02: AI 计算列 (Tandem 杀手锏 · 飞书没有). LLM 按 aiPrompt + 本行其它字段计算值. */
  | 'ai_compute';

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

  // ----- D-02 · AI 计算列专用 -----
  /**
   * AI 列的提示词. 占位符 {{字段名}} 会被自动展开为本行该字段的值.
   * 例: "用一句话评估这个员工本季度 OKR 的进展. 姓名: {{姓名}}, KR: {{KR}}, 当前值: {{当前值}}, 目标值: {{目标值}}"
   */
  aiPrompt?: string;
  /** 该 AI 列依赖的其它列 id (用于增量重算判定). 不填则依赖所有其它列. */
  aiDependsOn?: string[];
  /** 'fast' (高频低成本) 或 'standard' (Opus 等). 默认 fast. */
  aiModel?: 'fast' | 'standard';
}

/**
 * D-02: AI 列单元格的运行状态.
 * 写在 row.data[colId] 上面, 让前端能区分"计算中 / 成功 / 失败".
 * (常规字段直接是 string/number 等; AI 字段是这个对象, 用 typeof 判断.)
 */
export interface BitableAiCellValue {
  __ai: true;
  /** 计算结果 (LLM 输出, 已 trim). 失败时为 undefined. */
  value?: string;
  /** 'pending' (排队中) | 'running' (LLM 调用中) | 'ok' | 'error' */
  status: 'pending' | 'running' | 'ok' | 'error';
  /** 错误信息 (status='error' 时). */
  error?: string;
  /** 上次成功计算时间. */
  computedAt?: string;
  /** 使用的 model. */
  model?: string;
}

export function isAiCellValue(v: unknown): v is BitableAiCellValue {
  return typeof v === 'object' && v !== null && (v as { __ai?: boolean }).__ai === true;
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
