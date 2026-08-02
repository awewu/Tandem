/**
 * PMS · 选型规则集配置校验 (纯函数, 无依赖)
 *
 * 项目未引入 zod, 故手写轻量结构校验, 与代码库风格一致。
 * create/update 落库前调用 → 拦截畸形配置 (不合法引用 / 缺字段), 避免 "存了才发现跑不出来"。
 * 返回错误文案数组 (空数组 = 通过)。fail-fast 只针对结构性错误, 语义留给引擎 fail-soft。
 */

import type { SelectorInputField, SelectorRule, SelectorOperator } from '@/lib/types/pms';

const FIELD_TYPES = new Set(['number', 'enum', 'boolean', 'text']);
const OPERATORS = new Set<SelectorOperator>(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'between', 'contains']);
const ARRAY_OPS = new Set<SelectorOperator>(['in', 'between']);

export function validateInputFields(fields: SelectorInputField[]): string[] {
  const errors: string[] = [];
  if (!Array.isArray(fields)) return ['输入字段必须是数组'];
  const seen = new Set<string>();
  fields.forEach((f, i) => {
    const at = `输入字段[${i}]`;
    if (!f || typeof f !== 'object') return errors.push(`${at} 必须是对象`);
    if (!f.key || !String(f.key).trim()) errors.push(`${at} 缺少 key`);
    else if (seen.has(f.key)) errors.push(`${at} key 重复: ${f.key}`);
    else seen.add(f.key);
    if (!f.label || !String(f.label).trim()) errors.push(`${at}(${f.key}) 缺少 label`);
    if (!FIELD_TYPES.has(f.type)) errors.push(`${at}(${f.key}) type 非法: ${f.type}`);
    if (f.type === 'enum' && (!Array.isArray(f.options) || f.options.length === 0)) {
      errors.push(`${at}(${f.key}) enum 类型必须提供 options`);
    }
  });
  return errors;
}

export function validateRules(rules: SelectorRule[], fieldKeys: Set<string>): string[] {
  const errors: string[] = [];
  if (!Array.isArray(rules)) return ['规则必须是数组'];
  const seen = new Set<string>();
  rules.forEach((r, i) => {
    const at = `规则[${i}]`;
    if (!r || typeof r !== 'object') return errors.push(`${at} 必须是对象`);
    if (!r.id || !String(r.id).trim()) errors.push(`${at} 缺少 id`);
    else if (seen.has(r.id)) errors.push(`${at} id 重复: ${r.id}`);
    else seen.add(r.id);

    // 条件
    if (r.when !== undefined && !Array.isArray(r.when)) {
      errors.push(`${at}(${r.id}) when 必须是数组`);
    } else {
      (r.when ?? []).forEach((c, j) => {
        const cat = `${at}(${r.id}) 条件[${j}]`;
        if (!c || typeof c !== 'object') return errors.push(`${cat} 必须是对象`);
        if (!c.field || !fieldKeys.has(c.field)) errors.push(`${cat} 引用了不存在的输入字段: ${c.field}`);
        if (!OPERATORS.has(c.op)) errors.push(`${cat} 运算符非法: ${c.op}`);
        if (ARRAY_OPS.has(c.op) && !Array.isArray(c.value)) {
          errors.push(`${cat} 运算符 ${c.op} 的 value 必须是数组`);
        }
      });
    }

    // 产品引用
    const p = r.product;
    if (!p || typeof p !== 'object') {
      errors.push(`${at}(${r.id}) 缺少 product`);
    } else {
      if (p.matchBy === 'catalogId' && !p.catalogId) errors.push(`${at}(${r.id}) matchBy=catalogId 需提供 catalogId`);
      else if (p.matchBy === 'model' && !p.model) errors.push(`${at}(${r.id}) matchBy=model 需提供 model`);
      else if (p.matchBy === 'attributes' && (!p.attributes || Object.keys(p.attributes).length === 0)) {
        errors.push(`${at}(${r.id}) matchBy=attributes 需提供 attributes`);
      } else if (!['catalogId', 'model', 'attributes'].includes(p.matchBy)) {
        errors.push(`${at}(${r.id}) product.matchBy 非法: ${p.matchBy}`);
      }
    }

    // 数量
    const q = r.quantity;
    if (!q || typeof q !== 'object') {
      errors.push(`${at}(${r.id}) 缺少 quantity`);
    } else if (q.mode === 'fixed') {
      if (typeof q.value !== 'number' || !Number.isFinite(q.value)) errors.push(`${at}(${r.id}) quantity.mode=fixed 需提供数字 value`);
    } else if (q.mode === 'perInput') {
      if (!q.inputField || !fieldKeys.has(q.inputField)) errors.push(`${at}(${r.id}) quantity.perInput 引用了不存在的输入字段: ${q.inputField}`);
    } else {
      errors.push(`${at}(${r.id}) quantity.mode 非法: ${q.mode}`);
    }
  });
  return errors;
}

/** 完整校验一份规则集配置; 返回错误文案数组 (空 = 通过) */
export function validateRuleSetConfig(
  inputFields: SelectorInputField[] = [],
  rules: SelectorRule[] = [],
): string[] {
  const fieldErrors = validateInputFields(inputFields);
  const fieldKeys = new Set((Array.isArray(inputFields) ? inputFields : []).map((f) => f?.key).filter(Boolean) as string[]);
  const ruleErrors = validateRules(rules, fieldKeys);
  return [...fieldErrors, ...ruleErrors];
}
