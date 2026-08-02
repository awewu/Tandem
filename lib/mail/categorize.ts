/**
 * 收件箱分类 + 优先级 (纯启发式, 即时/离线, 无 LLM 成本)
 *
 * - 分类标签页 (对齐 Gmail): primary 主要 / social 社交 / promotions 推广 / updates 更新
 * - 优先级收件箱: 依据"是否星标 / 未读 / 是否已知联系人 / 主题紧急词 / 时效"打分, 高分置顶
 *
 * 说明: email-ai-brain 的 category(sop/case/...) 是知识沉淀维度, 需 LLM 且面向归档;
 * 收件箱标签页是"投递维度", 用信封信号即可即时判定, 二者互补、不冲突。
 */

export type MailCategory = 'primary' | 'social' | 'promotions' | 'updates';

export interface CategorizableEmail {
  from: { name?: string; address: string }[];
  to?: { name?: string; address: string }[];
  subject: string;
  date: string;
  flags: string[];
  seen: boolean;
}

const SOCIAL_DOMAINS = [
  'linkedin.com', 'facebook.com', 'facebookmail.com', 'twitter.com', 'x.com',
  'instagram.com', 'weibo.com', 'zhihu.com', 'douyin.com', 'maimai.cn',
  'youtube.com', 'quora.com', 'reddit.com', 'pinterest.com', 'tiktok.com',
];

const PROMO_KEYWORDS = [
  'unsubscribe', 'newsletter', 'sale', 'discount', 'offer', 'deal', 'promo',
  'coupon', 'webinar', '促销', '优惠', '特价', '折扣', '限时', '活动', '秒杀',
  '大促', '福利', '订阅', '退订',
];

const PROMO_LOCALPARTS = ['marketing', 'promo', 'newsletter', 'news', 'offers', 'deals', 'campaign', 'mailer'];

const UPDATE_KEYWORDS = [
  'invoice', 'receipt', 'statement', 'order', 'shipping', 'delivered', 'verification',
  'verify', 'security alert', 'password', 'notification', 'confirm', 'ticket',
  '发票', '账单', '订单', '物流', '发货', '验证码', '通知', '提醒', '确认', '工单',
  '对账', '回执', '系统',
];

const UPDATE_LOCALPARTS = ['noreply', 'no-reply', 'donotreply', 'do-not-reply', 'notification', 'notifications', 'system', 'alert', 'alerts', 'service', 'support', 'auto', 'mailer-daemon'];

const URGENT_KEYWORDS = ['urgent', 'asap', 'important', 'immediately', 'deadline', 'overdue', '紧急', '尽快', '重要', '立即', '截止', '逾期', '催'];

function primaryAddress(email: CategorizableEmail): string {
  return (email.from[0]?.address ?? '').toLowerCase();
}

function domainOf(address: string): string {
  const at = address.lastIndexOf('@');
  return at >= 0 ? address.slice(at + 1) : '';
}

function localPartOf(address: string): string {
  const at = address.indexOf('@');
  return at >= 0 ? address.slice(0, at) : address;
}

function includesAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n));
}

/** 判定单封邮件的投递分类 */
export function categorizeEmail(email: CategorizableEmail): MailCategory {
  const address = primaryAddress(email);
  const domain = domainOf(address);
  const local = localPartOf(address).toLowerCase();
  const subject = email.subject ?? '';

  // 1) 社交: 已知社交平台域名
  if (SOCIAL_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d))) return 'social';

  // 2) 推广: 营销本地名 / 退订/促销关键词
  if (PROMO_LOCALPARTS.some((p) => local.includes(p))) return 'promotions';
  if (includesAny(subject, PROMO_KEYWORDS)) return 'promotions';

  // 3) 更新: 系统/通知类本地名, 或账单/订单/验证码等关键词
  if (UPDATE_LOCALPARTS.some((p) => local === p || local.includes(p))) return 'updates';
  if (includesAny(subject, UPDATE_KEYWORDS)) return 'updates';

  // 4) 其余归主要
  return 'primary';
}

export interface PriorityContext {
  /** 判断某地址是否为已知联系人/同事 (加权) */
  isKnownContact?: (address: string) => boolean;
  /** 当前时间 (便于测试) */
  now?: number;
}

/**
 * 计算优先级分数 (越高越重要)。用于"优先级收件箱"排序/置顶。
 */
export function priorityScore(email: CategorizableEmail, ctx: PriorityContext = {}): number {
  let score = 0;
  const now = ctx.now ?? Date.now();

  if (email.flags.includes('\\Flagged')) score += 50;      // 星标: 强信号
  if (!email.seen) score += 20;                             // 未读优先
  const category = categorizeEmail(email);
  if (category === 'primary') score += 15;
  else if (category === 'updates') score += 5;
  else if (category === 'promotions') score -= 10;          // 推广降权

  if (includesAny(email.subject ?? '', URGENT_KEYWORDS)) score += 25;

  const address = primaryAddress(email);
  if (address && ctx.isKnownContact?.(address)) score += 20;

  // 时效: 24h 内 +10, 72h 内 +5
  const ageMs = now - new Date(email.date).getTime();
  if (ageMs >= 0) {
    if (ageMs <= 24 * 3600 * 1000) score += 10;
    else if (ageMs <= 72 * 3600 * 1000) score += 5;
  }

  return score;
}

export const CATEGORY_LABELS: Record<MailCategory, string> = {
  primary: '主要',
  social: '社交',
  promotions: '推广',
  updates: '更新',
};
