/**
 * A1 · 手抄 → 数据库 结构化抽取 (纯逻辑, 无 LLM/DB 依赖, 便于单测)
 *
 * 职责:
 *   - buildExtractionJsonSchema: 由数据库属性生成 LLM 结构化输出 schema (json_schema)
 *   - normalizeCell: 把 LLM 返回的原始值按属性类型归一到 ShouchaoCellValue
 *   - normalizeDraftRows: 把 LLM 的 rows[] 逐行归一, 越界/脏值安全丢弃
 *
 * 承 megaplan C3: 只产"草稿", 不落库; 归一保证 select 越界留空、多选过滤、数字解析。
 */

import type { ShouchaoProperty, ShouchaoCellValue } from '../types/shouchao-db';

/** 单属性 → JSON schema 片段 (strict 模式: 允许 null 表示"无值")。 */
function propSchema(p: ShouchaoProperty): Record<string, unknown> {
  switch (p.type) {
    case 'number':
      return { type: ['number', 'null'] };
    case 'checkbox':
      return { type: 'boolean' };
    case 'select':
      return { type: ['string', 'null'], enum: [...(p.options ?? []), null] };
    case 'multiSelect':
      return { type: 'array', items: { type: 'string', ...(p.options?.length ? { enum: p.options } : {}) } };
    case 'date':
    case 'url':
    case 'text':
    default:
      return { type: ['string', 'null'] };
  }
}

/**
 * 生成 { rows: [{ <propId>: value, ... }] } 的 json_schema。
 * strict 要求所有 key 进 required (用 null 表达缺值)。
 */
export function buildExtractionJsonSchema(properties: ShouchaoProperty[]): Record<string, unknown> {
  const cellProps: Record<string, unknown> = {};
  for (const p of properties) cellProps[p.id] = propSchema(p);
  return {
    type: 'object',
    additionalProperties: false,
    required: ['rows'],
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: properties.map((p) => p.id),
          properties: cellProps,
        },
      },
    },
  };
}

/** 人类可读的属性清单, 注入 prompt 帮助 LLM 对齐。 */
export function describeProperties(properties: ShouchaoProperty[]): string {
  return properties
    .map((p) => {
      const opt = p.options?.length ? ` (可选值: ${p.options.join(' / ')})` : '';
      return `- ${p.id} · ${p.name} [${p.type}]${opt}`;
    })
    .join('\n');
}

/** 把单个原始值按属性类型归一。无法归一 → null (checkbox → false)。 */
export function normalizeCell(prop: ShouchaoProperty, raw: unknown): ShouchaoCellValue {
  switch (prop.type) {
    case 'number': {
      if (raw === null || raw === undefined || raw === '') return null;
      if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
      const cleaned = String(raw).replace(/[^\d.\-]/g, '');
      if (cleaned.trim() === '') return null;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    }
    case 'checkbox':
      return raw === true || raw === 'true' || raw === 1;
    case 'select': {
      const v = raw == null ? '' : String(raw).trim();
      if (!v) return null;
      // 越界值(不在 options)一律留空, 防脏数据污染
      if (prop.options && prop.options.length && !prop.options.includes(v)) return null;
      return v;
    }
    case 'multiSelect': {
      const arr = Array.isArray(raw)
        ? raw.map((x) => String(x).trim())
        : typeof raw === 'string'
          ? raw.split(',').map((s) => s.trim())
          : [];
      const cleaned = arr.filter(Boolean);
      const scoped = prop.options && prop.options.length ? cleaned.filter((x) => prop.options!.includes(x)) : cleaned;
      return scoped;
    }
    case 'date':
    case 'url':
    case 'text':
    default: {
      if (raw == null) return null;
      const s = String(raw).trim();
      return s || null;
    }
  }
}

export interface DraftRow {
  cells: Record<string, ShouchaoCellValue>;
  /** 可选: 来源笔记 id (便于 UI 溯源)。 */
  sourceNoteId?: string;
}

/**
 * 把 LLM 返回的 rows 逐行归一。非对象行安全跳过; 每行只保留已知 propId 的归一值。
 * 全空行 (所有 cell 为 null/空) 丢弃, 避免灌入空草稿。
 */
export function normalizeDraftRows(
  properties: ShouchaoProperty[],
  rawRows: unknown,
): DraftRow[] {
  if (!Array.isArray(rawRows)) return [];
  const out: DraftRow[] = [];
  for (const r of rawRows) {
    if (!r || typeof r !== 'object') continue;
    const src = r as Record<string, unknown>;
    const cells: Record<string, ShouchaoCellValue> = {};
    let hasValue = false;
    for (const p of properties) {
      const v = normalizeCell(p, src[p.id]);
      cells[p.id] = v;
      if (v !== null && !(Array.isArray(v) && v.length === 0) && v !== false) hasValue = true;
    }
    if (hasValue) out.push({ cells });
  }
  return out;
}
