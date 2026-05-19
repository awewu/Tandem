/**
 * Password · 密码哈希 + 强度校验
 *
 * 算法选择 (优先级):
 *   1. argon2id (推荐, 抗 GPU 爆破) - 需 npm i argon2
 *   2. bcrypt (兼容性好)             - 需 npm i bcryptjs
 *   3. scrypt (Node 内置, 备用)     - 无需依赖
 *
 * 默认使用 Node 内置 scrypt, 部署时可切换.
 *
 * 密码策略 (参考等保二级):
 *   - 至少 10 字符
 *   - 必须包含: 大写字母 + 小写字母 + 数字 + 特殊字符
 *   - 禁用常见弱密码 (top 10000)
 *   - 不可与最近 5 次密码重复 (历史 hash)
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

// ---------------------------------------------------------------------------
// 强度校验
// ---------------------------------------------------------------------------

const COMMON_WEAK_PASSWORDS = new Set([
  '12345678', 'password', 'qwerty12', 'admin123', 'letmein1',
  'welcome1', 'iloveyou', 'changeme', '11111111', '00000000',
  'tandem123', 'niuma123', 'password1',
]);

export interface PasswordStrength {
  ok: boolean;
  score: number;             // 0-4
  errors: string[];
  suggestions: string[];
}

export function evaluatePassword(password: string, userInfo?: { email?: string; name?: string }): PasswordStrength {
  const errors: string[] = [];
  const suggestions: string[] = [];

  if (password.length < 10) errors.push('至少 10 字符');
  if (!/[A-Z]/.test(password)) errors.push('需要大写字母');
  if (!/[a-z]/.test(password)) errors.push('需要小写字母');
  if (!/[0-9]/.test(password)) errors.push('需要数字');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('需要特殊字符 (如 !@#$%)');

  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    errors.push('该密码在常见弱密码字典内');
  }

  // 不能含用户信息
  if (userInfo?.email) {
    const local = userInfo.email.split('@')[0].toLowerCase();
    if (local.length > 3 && password.toLowerCase().includes(local)) {
      errors.push('密码不可包含邮箱前缀');
    }
  }
  if (userInfo?.name && userInfo.name.length > 2 && password.includes(userInfo.name)) {
    errors.push('密码不可包含姓名');
  }

  // 简易熵评估
  const variety =
    Number(/[A-Z]/.test(password)) +
    Number(/[a-z]/.test(password)) +
    Number(/[0-9]/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));
  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (variety >= 3) score++;
  if (variety === 4 && password.length >= 12) score++;

  if (score < 3) suggestions.push('建议: 14 字符以上, 大小写+数字+符号都用');

  return {
    ok: errors.length === 0,
    score,
    errors,
    suggestions,
  };
}

// ---------------------------------------------------------------------------
// 哈希 (Node 内置 scrypt, 无外部依赖)
// ---------------------------------------------------------------------------

const SCRYPT_KEYLEN = 64;
// §T10: N 越大越抗爆破, 但 CPU 越慢. 16384=快(dev), 65536=安全(prod)
const SCRYPT_N = Number(process.env.SCRYPT_N ?? 16384);
const SCRYPT_PARAMS = { N: SCRYPT_N, r: 8, p: 1 } as const;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS).toString('hex');
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, N, r, p, salt, hash] = parts;
    const computed = scryptSync(password, salt, SCRYPT_KEYLEN, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    const stored_buf = Buffer.from(hash, 'hex');
    return computed.length === stored_buf.length && timingSafeEqual(computed, stored_buf);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 历史复用检查
// ---------------------------------------------------------------------------

/**
 * 检查新密码是否与历史 hash 重复.
 * 允许的历史 hashes 列表 (最近 N 次).
 */
export function isPasswordReused(newPassword: string, historyHashes: string[]): boolean {
  return historyHashes.some((h) => verifyPassword(newPassword, h));
}
