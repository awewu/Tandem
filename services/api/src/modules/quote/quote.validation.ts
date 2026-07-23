import { BadRequestException } from '@nestjs/common';

/**
 * 报价写入/计算边界的显式类型校验（零依赖，不引入 class-validator / 全局 ValidationPipe）。
 *
 * 定位：公开计算端点（generate/load-calc/econet/export/guardrail）为纯函数、无租户数据，
 * 有意公开（C 端问诊/快速估算直调）——保持公开，但入参不能是 `any` 裸奔：本层拦截明确
 * 类型错误（如 devices 传成对象、area 传成非数字、items 传成字符串），以 400 明确拒绝，
 * 避免脏输入进入精算引擎产生误导性报价。对合法输入完全透明，不改变既有行为。
 *
 * 仅约束报价模块自身端点，不触碰其他模块的 body 约定。
 */

function assertPlainObject(v: unknown, field: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new BadRequestException(`${field} 必须是对象`);
  return v as Record<string, unknown>;
}

function assertOptionalObject(v: unknown, field: string): void {
  if (v === undefined || v === null) return;
  assertPlainObject(v, field);
}

function assertOptionalArray(v: unknown, field: string): void {
  if (v === undefined || v === null) return;
  if (!Array.isArray(v)) throw new BadRequestException(`${field} 必须是数组`);
}

function assertRequiredArray(v: unknown, field: string): unknown[] {
  if (!Array.isArray(v)) throw new BadRequestException(`${field} 必填且必须是数组`);
  return v;
}

function assertOptionalString(v: unknown, field: string): void {
  if (v === undefined || v === null) return;
  if (typeof v !== 'string') throw new BadRequestException(`${field} 必须是字符串`);
}

function assertRequiredString(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new BadRequestException(`${field} 必填且必须是非空字符串`);
  return v.trim();
}

function toFiniteNumber(v: unknown): number {
  return typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
}

function assertOptionalFiniteNumber(v: unknown, field: string): void {
  if (v === undefined || v === null || v === '') return;
  if (!Number.isFinite(toFiniteNumber(v))) throw new BadRequestException(`${field} 必须是数字`);
}

/** generate：design?/devices?/services? 类型校验。 */
export function validateGenerateInput(dto: unknown): Record<string, unknown> {
  const b = assertPlainObject(dto, 'quote body');
  assertOptionalObject(b.design, 'design');
  assertOptionalArray(b.devices, 'devices');
  assertOptionalArray(b.services, 'services');
  return b;
}

/** load-calc：area 必填正数；city/buildingType 字符串；ceilingHeight 数字。 */
export function validateLoadCalcInput(dto: unknown): Record<string, unknown> {
  const b = assertPlainObject(dto, 'load-calc body');
  const area = toFiniteNumber(b.area);
  if (!Number.isFinite(area) || area <= 0) throw new BadRequestException('area 必填且必须是正数');
  assertOptionalString(b.city, 'city');
  assertOptionalString(b.buildingType, 'buildingType');
  assertOptionalFiniteNumber(b.ceilingHeight, 'ceilingHeight');
  return b;
}

/** econet-premium：devices 必填数组，每项含字符串 type。 */
export function validateEconetInput(dto: unknown): Record<string, unknown> {
  const b = assertPlainObject(dto, 'econet body');
  const devices = assertRequiredArray(b.devices, 'devices');
  devices.forEach((d, i) => {
    const dev = assertPlainObject(d, `devices[${i}]`);
    assertRequiredString(dev.type, `devices[${i}].type`);
    assertOptionalFiniteNumber(dev.quantity, `devices[${i}].quantity`);
  });
  return b;
}

/** export：body 为对象；format（若提供）为字符串。 */
export function validateExportInput(dto: unknown): Record<string, unknown> {
  const b = assertPlainObject(dto, 'export body');
  assertOptionalString(b.format, 'format');
  return b;
}

/** guardrail-check：items?/thresholds? 类型校验。 */
export function validateGuardrailInput(dto: unknown): Record<string, unknown> {
  const b = assertPlainObject(dto, 'guardrail body');
  assertOptionalArray(b.items, 'items');
  assertOptionalObject(b.thresholds, 'thresholds');
  return b;
}

/** persist：customerId 必填字符串；集合字段类型校验（其余由服务落库默认值兜底）。 */
export function validatePersistInput(dto: unknown): Record<string, unknown> {
  const b = assertPlainObject(dto, 'quotation body');
  assertRequiredString(b.customerId, 'customerId');
  assertOptionalString(b.opportunityId, 'opportunityId');
  assertOptionalString(b.status, 'status');
  assertOptionalObject(b.project, 'project');
  assertOptionalArray(b.items, 'items');
  assertOptionalArray(b.systemFamilies, 'systemFamilies');
  assertOptionalObject(b.costBreakdown, 'costBreakdown');
  assertOptionalObject(b.econetPremium, 'econetPremium');
  assertOptionalObject(b.taxProfile, 'taxProfile');
  return b;
}
