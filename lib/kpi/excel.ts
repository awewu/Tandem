/**
 * KPI Excel 导入导出工具 · CHARTER-KPI-TTI §2.5
 *
 * 设计原则:
 *   1. 用 code (科目主键) 而非 id 做 Excel 列, 给人看 + 跨环境迁移
 *   2. parentCode 引用 (而非 parentId), 支持新环境从 0 重建科目树
 *   3. dry-run 模式: 解析+校验但不落库, 用于前端预览错误行
 *   4. 行号回显 (1-based, Excel 一致), 错误绑定具体行
 *
 * 通用 row -> result 形状:
 *   { row: 2, ok: true|false, errors: [..], data?: {...}, created?: '...' }
 */

import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Schema 定义 (作为 Excel template + 校验源)
// ---------------------------------------------------------------------------

export const SUBJECT_COLUMNS = [
  'code',
  'name',
  'description',
  'parentCode',
  'defaultScope',
  'defaultMeasureType',
  'defaultUnit',
  'active',
] as const;

export const KPI_COLUMNS = [
  'subjectCode',
  'level',
  'scope',
  'title',
  'description',
  'assigneeId',
  'departmentId',
  'measureType',
  'startValue',
  'targetValue',
  'unit',
  'weight',
] as const;

export type SubjectColumn = (typeof SUBJECT_COLUMNS)[number];
export type KpiColumn = (typeof KPI_COLUMNS)[number];

// ---------------------------------------------------------------------------
// 通用行结果
// ---------------------------------------------------------------------------

export interface RowResult<TPayload> {
  /** 1-based Excel 行号 (header = 1, 第一条数据 = 2) */
  row: number;
  ok: boolean;
  errors: string[];
  data?: TPayload;
  /** 实际写入后返回的 id (仅在 dry-run=false 且 ok=true 时存在) */
  createdId?: string;
}

export interface ImportSummary<TPayload> {
  total: number;
  ok: number;
  failed: number;
  rows: RowResult<TPayload>[];
  dryRun: boolean;
}

// ---------------------------------------------------------------------------
// Parse: ArrayBuffer/Uint8Array → array of records (按 header 行做 key)
// ---------------------------------------------------------------------------

export function parseSheet<T extends string>(
  buffer: ArrayBuffer | Uint8Array,
  columns: readonly T[],
): { rows: Array<Partial<Record<T, unknown>> & { __row: number }>; missingColumns: T[] } {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], missingColumns: [...columns] };
  const sheet = wb.Sheets[sheetName];

  // header: 1 让我们得到 raw rows
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (aoa.length < 1) return { rows: [], missingColumns: [...columns] };

  const header = (aoa[0] as unknown[]).map((c) => String(c).trim());
  const missingColumns = columns.filter((c) => !header.includes(c));

  const rows: Array<Partial<Record<T, unknown>> & { __row: number }> = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i] as unknown[];
    if (!r || r.every((c) => c === '' || c === null || c === undefined)) continue; // skip blank
    const obj: Record<string, unknown> = { __row: i + 1 };
    for (const col of columns) {
      const idx = header.indexOf(col);
      if (idx >= 0) obj[col] = r[idx];
    }
    rows.push(obj as Partial<Record<T, unknown>> & { __row: number });
  }
  return { rows, missingColumns };
}

// ---------------------------------------------------------------------------
// Build: records → xlsx ArrayBuffer
// ---------------------------------------------------------------------------

export function buildSheet<T extends string>(
  columns: readonly T[],
  rows: Array<Partial<Record<T, unknown>>>,
  sheetName = 'Sheet1',
): ArrayBuffer {
  const aoa: unknown[][] = [
    [...columns],
    ...rows.map((r) => columns.map((c) => (r as Record<string, unknown>)[c] ?? '')),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // 自动列宽 (粗略, 取标题长)
  ws['!cols'] = columns.map((c) => ({ wch: Math.max(12, c.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return out;
}

// ---------------------------------------------------------------------------
// 字段校验工具
// ---------------------------------------------------------------------------

export function cellString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

export function cellNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function cellBool(v: unknown): boolean | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', '是', '启用'].includes(s)) return true;
  if (['false', '0', 'no', 'n', '否', '停用', '软删'].includes(s)) return false;
  return null;
}
