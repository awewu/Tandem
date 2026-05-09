/**
 * Invite · 邀请制 (B2B 主流程)
 *
 * Tandem 默认关闭公开注册. 流程:
 *   1. 管理员 / 老板在 /admin/invite 生成邀请码
 *   2. 邀请码可选锁定 email + 预设 role + 部门
 *   3. 通过邮件 / IM / 二维码分发
 *   4. 受邀者在 /register?invite=XXXX 注册
 *   5. 验证通过后 redeem (单次/多次)
 */

import { randomBytes, createHash } from 'crypto';

const INVITE_CODE_LENGTH = 16;          // 16 字节, 表现为 26 字符 base32
const DEFAULT_VALIDITY_HOURS = 7 * 24;  // 7 天

// ---------------------------------------------------------------------------
// 生成 + 哈希
// ---------------------------------------------------------------------------

export function generateInviteCode(): { plainCode: string; codeHash: string } {
  // base32 易读, 去掉容易混淆的 0/O/1/I
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < bytes.length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  // 加分隔符: XXXX-XXXX-XXXX-XXXX
  const formatted = code.match(/.{1,4}/g)!.join('-');
  return { plainCode: formatted, codeHash: hashInviteCode(formatted) };
}

export function hashInviteCode(plain: string): string {
  // 加 pepper, 防止数据库泄露后字典爆破
  const pepper = process.env.NEXTAUTH_SECRET ?? 'dev-only';
  return createHash('sha256').update(`${pepper}::invite::${plain.toUpperCase()}`).digest('hex');
}

// ---------------------------------------------------------------------------
// 校验
// ---------------------------------------------------------------------------

export interface InviteRecord {
  id: string;
  codeHash: string;
  email?: string | null;
  presetRoles: string[];
  presetDepartmentId?: string | null;
  tenantId: string;
  invitedById: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | string;
  redeemedAt?: Date | string | null;
}

export interface InviteValidation {
  ok: boolean;
  reason?: string;
  invite?: InviteRecord;
}

export function validateInvite(plain: string, record: InviteRecord | null, forEmail?: string): InviteValidation {
  if (!record) return { ok: false, reason: '邀请码不存在' };
  if (hashInviteCode(plain) !== record.codeHash) return { ok: false, reason: '邀请码错误' };
  if (new Date(record.expiresAt).getTime() < Date.now()) return { ok: false, reason: '邀请码已过期' };
  if (record.usedCount >= record.maxUses) return { ok: false, reason: '邀请码已被使用完' };
  if (record.email && forEmail && record.email.toLowerCase() !== forEmail.toLowerCase()) {
    return { ok: false, reason: '此邀请码已绑定其他邮箱' };
  }
  return { ok: true, invite: record };
}

// ---------------------------------------------------------------------------
// 默认有效期
// ---------------------------------------------------------------------------

export function defaultExpiry(hours = DEFAULT_VALIDITY_HOURS): Date {
  return new Date(Date.now() + hours * 3600 * 1000);
}
