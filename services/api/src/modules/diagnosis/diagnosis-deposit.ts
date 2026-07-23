/**
 * 定金 · 经销商收款路由（第 5 步）—— 纯核心。
 * 事实源：docs/RYSNOVA-DIAGNOSIS-LIGHT-INTAKE-ALIGNMENT-2026-07-05.md §4（定金可退，支付即派单接 CRM）。
 *
 * 定位（用户裁定）：**我们是赋能经销商的工具，不是收款平台。**
 *  - 钱不进平台，进「当前线索所属经销商」各自的收款路径（每家不同：线下/收款码/自有链接/自有商户）。
 *  - 定金**可退**；平台只负责下单、路由到经销商收款方式、跟踪状态并触发派单/CRM。
 *  - 无任何在线渠道配置时，默认走**线下向经销商支付**，闭环照样成立（零支付密钥可运行）。
 *  - 诚实红线：不编造金额/费率；渠道密钥永不硬编码，仅回显「给消费者看的」信息（收款码图/链接/联系方式）。
 */

/** 经销商收款渠道类型（可插拔；wechat/alipay 商户为后续接入占位）。 */
export type CollectionChannel = 'offline' | 'qr' | 'link' | 'wechat_merchant' | 'alipay_merchant';

/** 单个经销商的收款路径配置（每家不同，由经销商自行维护）。 */
export interface DealerCollectionConfig {
  dealerId: string;
  channel: CollectionChannel;
  /** link 渠道：经销商自有收款链接。 */
  payUrl?: string | null;
  /** qr 渠道：经销商收款码图片（DAM/对象存储 URL 或 artifactId）。 */
  qrImageUrl?: string | null;
  /** offline 渠道：线下收款说明/联系方式（展示给消费者）。 */
  offlineNote?: string | null;
  /** 商户渠道占位：经销商自有商户参考号（不含密钥；密钥走安全配置）。 */
  merchantRef?: string | null;
  /** 经销商设定的默认定金金额（分为单位或元，统一用元；由经销商决定）。 */
  defaultDepositAmount?: number | null;
  active?: boolean;
}

/** 默认线下配置（无任何在线渠道时兜底，确保闭环可跑）。 */
export function defaultOfflineConfig(dealerId: string): DealerCollectionConfig {
  return { dealerId, channel: 'offline', offlineNote: null, active: true };
}

export interface PaymentInstruction {
  channel: CollectionChannel;
  /** 是否可立即在线支付（false = 需线下/联系经销商）。 */
  online: boolean;
  title: string;
  /** 展示要素（按渠道给出其一）。 */
  payUrl?: string;
  qrImageUrl?: string;
  offlineNote?: string;
  /** 统一免责/说明：定金可退。 */
  note: string;
}

const REFUNDABLE_NOTE = '此为初步意向定金，可退；最终方案与报价以现场勘测和设计为准。';

/**
 * 由经销商收款配置装配「给消费者看的」支付指引（纯函数）。
 * 在线渠道未配置齐全时，自动降级为线下向经销商支付（不阻断闭环）。
 */
export function buildPaymentInstruction(config: DealerCollectionConfig): PaymentInstruction {
  const base = { note: REFUNDABLE_NOTE };
  switch (config.channel) {
    case 'link':
      if (config.payUrl) return { ...base, channel: 'link', online: true, title: '向经销商在线支付定金', payUrl: config.payUrl };
      break;
    case 'qr':
      if (config.qrImageUrl) return { ...base, channel: 'qr', online: true, title: '扫码向经销商支付定金', qrImageUrl: config.qrImageUrl };
      break;
    case 'wechat_merchant':
    case 'alipay_merchant':
      // 商户渠道需安全配置的密钥，此处不产出支付串；未接入前降级线下。
      break;
    case 'offline':
    default:
      break;
  }
  return {
    ...base,
    channel: 'offline',
    online: false,
    title: '向您的专属经销商支付定金',
    offlineNote: config.offlineNote || '请联系您的专属顾问确认定金支付方式（线下/转账/门店）。',
  };
}

// ── 定金订单状态机（可退） ────────────────────────────────────────────────
export type DepositState = 'created' | 'awaiting_payment' | 'paid' | 'refunded' | 'cancelled' | 'expired';

export const DEPOSIT_TRANSITIONS: Record<string, { from: DepositState[]; to: DepositState }> = {
  issue: { from: ['created'], to: 'awaiting_payment' },
  mark_paid: { from: ['awaiting_payment', 'created'], to: 'paid' }, // 经销商确认或渠道回调
  refund: { from: ['paid'], to: 'refunded' },
  cancel: { from: ['created', 'awaiting_payment'], to: 'cancelled' },
  expire: { from: ['created', 'awaiting_payment'], to: 'expired' },
};

/** 校验一个动作能否从当前态执行；返回目标态或 null（非法）。 */
export function resolveDepositTransition(action: string, current: DepositState): DepositState | null {
  const t = DEPOSIT_TRANSITIONS[action];
  if (!t) return null;
  return t.from.includes(current) ? t.to : null;
}

/** 是否可退（仅已支付可退）。 */
export function isRefundable(state: DepositState): boolean {
  return state === 'paid';
}

/** 归一化定金金额：非正/非法一律 null（宁可不显示，也不编造）。 */
export function normalizeDepositAmount(input: unknown): number | null {
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
