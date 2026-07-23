import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { painPointsToSystems } from './diagnosis-painpoints';

/**
 * 原生问诊引擎（纯函数）—— 从 Legacy server/modules/diagnosis 收割「有用」部分并去除编造：
 *   保留：真实客户校验、痛点→系统分类、分享令牌（HMAC）。
 *   丢弃：budgetBase（面积×¥1680 魔数）、buildTiers（编造 ROI/节能率/月供/档位）。
 *
 * 原则（用户裁定 · 慎重引用旧店）：缺数据就不输出，绝不向消费者展示虚构数字。
 * 价格/档位一律交 quote 域与产品目录真实价，问诊只产出「需求画像 + 系统建议」。
 */

export const SYSTEM_LABELS: Record<string, string> = {
  hot_water: '中央热水',
  heating: '采暖',
  water_treatment: '净水',
  fresh_air: '新风',
  air: '空调 / 全空气',
  smart_control: '智能控制',
};

// PIPL/数据质量：已知占位兜底黑名单（历史前端兜底值），服务端一律拒绝。
const PLACEHOLDER_CUSTOMER_NAMES = new Set(['待跟进客户', '匿名客户', '客户']);
const PLACEHOLDER_CUSTOMER_PHONES = new Set(['13800000000', '00000000000', '10000000000']);

const PAIN_TO_SYSTEMS: { pattern: RegExp; systems: string[] }[] = [
  { pattern: /热水|洗澡|水温|水压|等待/i, systems: ['hot_water'] },
  { pattern: /冷|采暖|地暖|暖气|老人/i, systems: ['heating'] },
  { pattern: /水质|净水|软水|水垢/i, systems: ['water_treatment'] },
  { pattern: /空气|新风|闷|甲醛|pm2\.?5|鼻炎|过敏/i, systems: ['fresh_air'] },
  { pattern: /空调|制冷|全空气|温差|恒温|恒湿/i, systems: ['air'] },
  { pattern: /智能|控制|远程|能耗|联动/i, systems: ['smart_control'] },
];

export interface NormalizedCustomer {
  name: string;
  phone: string;
  city?: string;
  address?: string;
}

/** 真实客户校验：name/phone 必填，且拒绝历史占位值（不信任前端兜底）。 */
export function normalizeCustomer(payload: any = {}): NormalizedCustomer {
  const customer = payload.customer || {};
  if (!customer.name) throw new BadRequestException('customer.name is required for diagnosis completion');
  if (!customer.phone) throw new BadRequestException('customer.phone is required for diagnosis completion');
  const name = String(customer.name).trim();
  const phone = String(customer.phone).trim();
  if (PLACEHOLDER_CUSTOMER_NAMES.has(name)) throw new BadRequestException('请填写真实客户姓名');
  if (PLACEHOLDER_CUSTOMER_PHONES.has(phone)) throw new BadRequestException('请填写真实联系电话');
  return {
    name, phone,
    city: customer.city || payload.home?.city || payload.city,
    address: customer.address || payload.home?.address,
  };
}

export function normalizePainPoints(payload: any = {}): string[] {
  const source = payload.painPoints || payload.diagnosis?.painPoints || [];
  return source
    .map((item: any) => (typeof item === 'string' ? item : item?.name || item?.label || item?.title || item?.id))
    .filter(Boolean);
}

/** 痛点文本 → 系统分类（纯分类，非报价）。无命中给通用组合；智控始终并入。 */
export function inferSystems(payload: any = {}): string[] {
  const explicit = payload.systems || payload.requirements?.systems || [];
  const systems = new Set<string>(explicit);
  const painItems = normalizePainPoints(payload);
  // ① 结构化痛点 id（收割自知识库，如 t_01/h_02）直接映射到系统建议。
  painPointsToSystems(painItems).forEach((s) => systems.add(s));
  // ② 自由文本痛点走关键词兜底分类（兼容旧口径/自然语言输入）。
  const painText = painItems.join(' ');
  for (const rule of PAIN_TO_SYSTEMS) {
    if (rule.pattern.test(painText)) rule.systems.forEach((s) => systems.add(s));
  }
  if (!systems.size) {
    systems.add('hot_water');
    systems.add('fresh_air');
    systems.add('air');
  }
  systems.add('smart_control');
  return [...systems].filter((s) => SYSTEM_LABELS[s]);
}

const SHARE_SECRET =
  process.env.DIAGNOSIS_SHARE_TOKEN_SECRET || process.env.JWT_SECRET || 'rhautt-diagnosis-share-dev-secret';

export function issueShareToken(reportId: string, customerId?: string): string {
  return crypto
    .createHmac('sha256', SHARE_SECRET)
    .update(`${reportId}:${customerId || 'anonymous'}:${Date.now()}:${crypto.randomBytes(12).toString('hex')}`)
    .digest('hex')
    .slice(0, 32);
}

export function hashShareToken(token: string): string {
  return crypto.createHmac('sha256', SHARE_SECRET).update(String(token || '')).digest('hex');
}

export function newReportId(): string {
  return `RND-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
}
