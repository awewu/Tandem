/**
 * PMS · 选型引擎 (Selector Engine) — 纯函数, 配置驱动
 *
 * 输入: 一个已发布的 SelectorRuleSet (规则=数据, 由"研"维护) + 业务员填写的工况 inputs
 *       + 产品目录快照 (用于把规则里的产品引用解析成真实型号/面价)。
 * 输出: 一个可直接回填报价编辑器的 QuoteSystem + 逐行追溯 + 告警。
 *
 * 设计要点:
 *   - 无副作用、不触 DB、可单测; DB 读取在 selector-service.ts 完成后注入。
 *   - fail-soft: 缺必填 / 产品未命中 / 规则畸形 → 收集 warning, 不抛错阻断业务。
 *   - 去重: 同一解析产品 (dedupeKey) 多规则命中 → 数量相加, 保留高 priority 的元信息。
 */

import type {
  SelectorRuleSet,
  SelectorRule,
  SelectorCondition,
  SelectorInputField,
  SelectorProductRef,
  SelectorQuantity,
  SelectorResult,
  SelectorResultLine,
  QuoteItem,
  QuoteSystem,
  QuoteWorkingConditions,
} from '@/lib/types/pms';

/** 引擎所需的产品目录最小快照 (由 service 从 pms_product_catalog 拉取映射) */
export interface SelectorCatalogProduct {
  id: string;
  model: string;
  series?: string;
  specification?: string;
  unit?: string;
  listPrice?: number;
  category?: string;
  attributes?: Record<string, string>;
}

export type SelectorInputs = Record<string, string | number | boolean>;

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 判定单条条件是否满足 (类型不匹配/字段缺失 → false, 不抛错) */
export function evaluateCondition(cond: SelectorCondition, inputs: SelectorInputs): boolean {
  const raw = inputs[cond.field];
  if (raw === undefined || raw === null || raw === '') {
    return false;
  }
  switch (cond.op) {
    case 'eq':
      return String(raw) === String(cond.value);
    case 'ne':
      return String(raw) !== String(cond.value);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = toNumber(raw);
      const b = toNumber(cond.value as unknown);
      if (a === null || b === null) return false;
      if (cond.op === 'gt') return a > b;
      if (cond.op === 'gte') return a >= b;
      if (cond.op === 'lt') return a < b;
      return a <= b;
    }
    case 'in': {
      const arr = Array.isArray(cond.value) ? cond.value : [];
      return arr.map(String).includes(String(raw));
    }
    case 'between': {
      const arr = Array.isArray(cond.value) ? cond.value : [];
      const a = toNumber(raw);
      const lo = toNumber(arr[0]);
      const hi = toNumber(arr[1]);
      if (a === null || lo === null || hi === null) return false;
      return a >= lo && a <= hi;
    }
    case 'contains':
      return String(raw).toLowerCase().includes(String(cond.value).toLowerCase());
    default:
      return false;
  }
}

/** 规则命中 = 所有条件满足 (空条件 = 恒命中) */
export function ruleMatches(rule: SelectorRule, inputs: SelectorInputs): boolean {
  const conds = rule.when ?? [];
  if (conds.length === 0) return true;
  return conds.every((c) => evaluateCondition(c, inputs));
}

/** 计算数量 (fail-soft: 无效 → 至少 1) */
export function computeQuantity(q: SelectorQuantity, inputs: SelectorInputs): number {
  if (q.mode === 'fixed') {
    const v = toNumber(q.value);
    return clampQty(v ?? 1, q.min, q.max);
  }
  // perInput
  const base = q.inputField ? toNumber(inputs[q.inputField]) : null;
  const divisor = toNumber(q.divisor) ?? 1;
  if (base === null || !(divisor > 0)) {
    return clampQty(1, q.min, q.max);
  }
  return clampQty(Math.ceil(base / divisor), q.min, q.max);
}

function clampQty(n: number, min?: number, max?: number): number {
  let v = Math.max(0, Math.floor(n) || 0);
  if (min != null && v < min) v = min;
  if (max != null && v > max) v = max;
  return Math.max(1, v);
}

/** 把产品引用解析成目录产品 (未命中 → null) */
export function resolveProduct(
  ref: SelectorProductRef,
  catalog: SelectorCatalogProduct[],
): SelectorCatalogProduct | null {
  if (ref.matchBy === 'catalogId' && ref.catalogId) {
    return catalog.find((p) => p.id === ref.catalogId) ?? null;
  }
  if (ref.matchBy === 'model' && ref.model) {
    const target = ref.model.trim().toLowerCase();
    return catalog.find((p) => (p.model || '').trim().toLowerCase() === target) ?? null;
  }
  if (ref.matchBy === 'attributes' && ref.attributes) {
    const entries = Object.entries(ref.attributes);
    return (
      catalog.find((p) => {
        const attrs = p.attributes ?? {};
        return entries.every(([k, v]) => String(attrs[k]) === String(v));
      }) ?? null
    );
  }
  return null;
}

/** 校验必填输入; 返回缺失字段的告警文案 */
export function validateInputs(fields: SelectorInputField[], inputs: SelectorInputs): string[] {
  const warnings: string[] = [];
  for (const f of fields ?? []) {
    if (!f.required) continue;
    const v = inputs[f.key];
    if (v === undefined || v === null || v === '') {
      warnings.push(`缺少必填工况: ${f.label || f.key}`);
    }
  }
  return warnings;
}

function collectWorkingConditions(
  fields: SelectorInputField[],
  inputs: SelectorInputs,
): QuoteWorkingConditions {
  const wc: QuoteWorkingConditions = {};
  const num = (k: string): number | undefined => {
    const n = toNumber(inputs[k]);
    return n === null ? undefined : n;
  };
  const str = (k: string): string | undefined => {
    const v = inputs[k];
    return v === undefined || v === null || v === '' ? undefined : String(v);
  };
  // 已知键直接映射; 其余进 note
  if (inputs.demandPoints !== undefined) wc.demandPoints = num('demandPoints');
  if (inputs.flowRate !== undefined) wc.flowRate = num('flowRate');
  if (inputs.temperature !== undefined) wc.temperature = str('temperature');
  if (inputs.area !== undefined) wc.area = num('area');
  if (inputs.climateZone !== undefined) wc.climateZone = str('climateZone');
  if (inputs.buildingType !== undefined) wc.buildingType = str('buildingType');
  const extras = (fields ?? [])
    .filter(
      (f) =>
        !['demandPoints', 'flowRate', 'temperature', 'area', 'climateZone', 'buildingType'].includes(
          f.key,
        ) &&
        inputs[f.key] !== undefined &&
        inputs[f.key] !== '',
    )
    .map((f) => `${f.label || f.key}: ${inputs[f.key]}${f.unit ?? ''}`);
  if (extras.length) wc.note = extras.join('; ');
  return wc;
}

let lineSeq = 0;
function nextItemId(): string {
  lineSeq += 1;
  return `sel_it_${Date.now().toString(36)}_${lineSeq.toString(36)}`;
}

/**
 * 核心: 评估规则集 → 推荐系统。
 * 注意: 只返回结构, 单价/小计交给报价编辑器的 recomputeQuote 归一化 (单一真值)。
 */
export function evaluateSelector(
  ruleset: SelectorRuleSet,
  inputs: SelectorInputs,
  catalog: SelectorCatalogProduct[],
): SelectorResult {
  const warnings = validateInputs(ruleset.inputFields ?? [], inputs);
  const lines: SelectorResultLine[] = [];

  // dedupeKey → 行索引 (合并同产品数量)
  const dedupe = new Map<string, number>();
  const priorityOf = new Map<string, number>();

  const rules = [...(ruleset.rules ?? [])];

  for (const rule of rules) {
    if (!ruleMatches(rule, inputs)) continue;

    const product = resolveProduct(rule.product, catalog);
    const qty = computeQuantity(rule.quantity, inputs);
    const costType = rule.product.costType ?? 'equipment';
    const model = product?.model ?? rule.product.fallbackModel ?? rule.product.model ?? '待选型';
    const resolved = product !== null;

    if (!resolved) {
      warnings.push(`规则「${rule.label || rule.id}」未在产品目录命中, 已产出占位行: ${model}`);
    }

    const dedupeKey = `${costType}::${product?.id ?? model.toLowerCase()}`;
    const rulePriority = rule.priority ?? 0;

    if (dedupe.has(dedupeKey)) {
      const idx = dedupe.get(dedupeKey)!;
      const existing = lines[idx];
      existing.item.quantity += qty;
      // 高优先规则覆盖元信息 (型号说明)
      if (rulePriority > (priorityOf.get(dedupeKey) ?? 0)) {
        existing.item.note = rule.label ?? existing.item.note;
        priorityOf.set(dedupeKey, rulePriority);
        existing.ruleId = rule.id;
        existing.ruleLabel = rule.label;
      }
    } else {
      const item: QuoteItem = {
        id: nextItemId(),
        costType,
        productCatalogId: product?.id,
        series: product?.series,
        model,
        specification: product?.specification,
        unit: product?.unit ?? '台',
        quantity: qty,
        listPrice: product?.listPrice ?? 0,
        discountRate: undefined,
        unitPrice: product?.listPrice ?? 0,
        amount: (product?.listPrice ?? 0) * qty,
        attributesSnapshot: product?.attributes,
        note: rule.label,
        sortOrder: lines.length,
      };
      lines.push({ ruleId: rule.id, ruleLabel: rule.label, item, resolved });
      dedupe.set(dedupeKey, lines.length - 1);
      priorityOf.set(dedupeKey, rulePriority);
    }

    if (rule.stopOnMatch) break;
  }

  if (lines.length === 0) {
    warnings.push('无规则命中当前工况, 未产出推荐; 请调整工况或完善规则集。');
  }

  const items = lines.map((l) => l.item);
  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  const system: QuoteSystem = {
    id: `sel_sys_${Date.now().toString(36)}`,
    name: ruleset.systemName || ruleset.name || '选型系统',
    category: ruleset.category,
    workingConditions: collectWorkingConditions(ruleset.inputFields ?? [], inputs),
    description: ruleset.scenario ? `选型场景: ${ruleset.scenario}` : undefined,
    items,
    subtotal,
    sortOrder: 0,
    sourceRuleSetId: ruleset.id,
    sourceRuleSetVersion: ruleset.version,
    sourceRuleSetName: ruleset.name,
  };

  return { rulesetId: ruleset.id, system, lines, warnings };
}
