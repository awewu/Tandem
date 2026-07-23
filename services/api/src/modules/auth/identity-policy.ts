import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { UserRole } from './auth.entity';

/**
 * 身份标识策略（账户注册/开户的准入规则）。
 *
 * 业务规则：
 *  - C 端客户（customer）           → 只允许「手机号」。
 *  - 品牌方员工（platform_admin /   → 只允许「公司邮箱」，且域名须在企业白名单内
 *    hq_admin / regional_manager）     （BRAND_STAFF_EMAIL_DOMAINS，默认 rhautt.com,rhautt.local）。
 *  - 经销商侧（dealer_admin /       → 「邮箱或手机号」皆可；若为邮箱，不得使用企业
 *    store_manager / designer /        白名单域名（企业域名保留给品牌员工，防冒充）。
 *    sales / engineer / installer）
 *
 * 该模块为纯函数，供自助注册（AuthService.register）与后台开户/种子共用，
 * 保证「哪种角色能用哪种标识」这一准入口径在所有入口一致。
 */

export type IdentifierKind = 'email' | 'phone' | 'invalid';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 中国大陆手机号：1 开头、次位 3-9、共 11 位。
const CN_MOBILE_RE = /^1[3-9]\d{9}$/;

const BRAND_STAFF_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'platform_admin', 'hq_admin', 'brand_admin', 'regional_manager',
]);

const CUSTOMER_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(['customer']);

/** 经销商侧角色：自助注册默认落到 dealer_admin，其余由管理员后续调整。 */
export const SELF_REGISTER_ROLE: UserRole = 'dealer_admin';

/** 判定标识类型：含 @ 视为邮箱，纯数字视为手机号，其余非法。 */
export function classifyIdentifier(raw: string): IdentifierKind {
  const s = String(raw ?? '').trim();
  if (!s) return 'invalid';
  if (s.includes('@')) return EMAIL_RE.test(s.toLowerCase()) ? 'email' : 'invalid';
  const digits = s.replace(/\D/g, '');
  return CN_MOBILE_RE.test(digits) ? 'phone' : 'invalid';
}

/** 企业邮箱白名单域名（小写、去空格）。env 覆盖，默认 rhautt.com + dev 的 rhautt.local。 */
export function brandStaffEmailDomains(): string[] {
  const raw = process.env.BRAND_STAFF_EMAIL_DOMAINS || 'rhautt.com,rhautt.local';
  return raw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
}

function emailDomain(email: string): string {
  return String(email).trim().toLowerCase().split('@')[1] ?? '';
}

/** 邮箱是否属于企业白名单域名（= 品牌员工专用域名）。 */
export function isBrandStaffEmail(email: string): boolean {
  return brandStaffEmailDomains().includes(emailDomain(email));
}

/**
 * 校验「角色 + 标识」是否符合准入规则；不合法抛出 4xx。
 * 校验通过返回标识类型，供调用方决定后续写入逻辑。
 */
export function assertIdentifierForRole(role: UserRole, identifier: string): IdentifierKind {
  const kind = classifyIdentifier(identifier);
  if (kind === 'invalid') {
    throw new BadRequestException('账号标识需为有效的手机号或邮箱');
  }

  if (CUSTOMER_ROLES.has(role)) {
    if (kind !== 'phone') throw new BadRequestException('客户账号仅支持使用手机号注册');
    return kind;
  }

  if (BRAND_STAFF_ROLES.has(role)) {
    if (kind !== 'email') throw new ForbiddenException('品牌方员工账号必须使用公司邮箱');
    if (!isBrandStaffEmail(identifier)) {
      throw new ForbiddenException(`品牌方员工邮箱域名须为企业域名（${brandStaffEmailDomains().join(' / ')}）`);
    }
    return kind;
  }

  // 经销商侧：邮箱或手机号皆可，但企业域名邮箱保留给品牌员工，禁止冒用。
  if (kind === 'email' && isBrandStaffEmail(identifier)) {
    throw new ForbiddenException('该邮箱域名为企业内部专用，经销商请使用非企业邮箱或手机号');
  }
  return kind;
}
