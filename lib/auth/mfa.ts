/**
 * MFA · TOTP (RFC 6238) + 恢复码
 *
 * 自研实现, 兼容 Google Authenticator / Authy / 微软 Authenticator.
 * 不依赖 speakeasy / otplib (减少供应链攻击面).
 *
 * 流程:
 *   1. 用户在 /account/mfa/setup 启用
 *   2. 后端生成 secret + 10 个恢复码
 *   3. 返回 otpauth:// URI → 前端用 qrcode.js 渲染二维码
 *   4. 用户扫码后, 提交 6 位 code 验证一次
 *   5. 验证通过 → secret 加密存储, 恢复码 hash 存储
 *   6. 后续登录时第二步要求 6 位 code
 */

import { createHmac, randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';

const TOTP_PERIOD_SEC = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1; // 容忍前后各 30 秒漂移

// ---------------------------------------------------------------------------
// Base32 (RFC 4648)
// ---------------------------------------------------------------------------

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

function base32Decode(s: string): Buffer {
  const cleaned = s.replace(/=+$/g, '').toUpperCase();
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ---------------------------------------------------------------------------
// HOTP / TOTP (RFC 4226 / 6238)
// ---------------------------------------------------------------------------

function hotp(secret: Buffer, counter: number): string {
  const counterBuf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hmac = createHmac('sha1', secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = (binary % 10 ** TOTP_DIGITS).toString();
  return code.padStart(TOTP_DIGITS, '0');
}

export function generateTotp(secretBase32: string, atSec?: number): string {
  const t = Math.floor((atSec ?? Date.now() / 1000) / TOTP_PERIOD_SEC);
  return hotp(base32Decode(secretBase32), t);
}

export function verifyTotp(secretBase32: string, code: string, atSec?: number): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const tNow = Math.floor((atSec ?? Date.now() / 1000) / TOTP_PERIOD_SEC);
  const secret = base32Decode(secretBase32);
  for (let w = -TOTP_WINDOW; w <= TOTP_WINDOW; w++) {
    if (hotp(secret, tNow + w) === code) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export interface MfaEnrollmentMaterial {
  /** 给前端展示二维码 */
  otpauthUri: string;
  /** 本次会话内显示, 入库前要加密 */
  secretBase32: string;
  /** 10 个恢复码 (明文给用户保存一次, 入库存 hash) */
  recoveryCodes: string[];
}

export function generateEnrollment(label: string, issuer = 'Tandem'): MfaEnrollmentMaterial {
  const secret = randomBytes(20); // 160 bit
  const secretBase32 = base32Encode(secret);
  const otpauthUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
    label
  )}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SEC}`;

  const recoveryCodes = Array.from({ length: 10 }, () =>
    randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-')
  );

  return { otpauthUri, secretBase32, recoveryCodes };
}

export function hashRecoveryCode(code: string): string {
  // sha256, salted by SESSION_SECRET (server-side pepper)
  const pepper = process.env.NEXTAUTH_SECRET ?? 'dev-only';
  return createHash('sha256').update(`${pepper}::${code}`).digest('hex');
}

export function verifyRecoveryCode(code: string, hashes: string[]): { ok: boolean; matchedHash?: string } {
  const candidate = hashRecoveryCode(code);
  const matched = hashes.find((h) => h === candidate);
  return matched ? { ok: true, matchedHash: matched } : { ok: false };
}

// ---------------------------------------------------------------------------
// 加密存储 (TOTP secret 不能明文落库)
// ---------------------------------------------------------------------------

function getEncKey(): Buffer {
  const seed = process.env.MFA_ENCRYPTION_KEY ?? process.env.NEXTAUTH_SECRET ?? 'dev-only-mfa-key';
  return createHash('sha256').update(seed).digest();
}

export function encryptSecret(secretBase32: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncKey(), iv);
  const enc = Buffer.concat([cipher.update(secretBase32, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm$${iv.toString('hex')}$${tag.toString('hex')}$${enc.toString('hex')}`;
}

export function decryptSecret(stored: string): string {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'gcm') throw new Error('bad mfa secret format');
  const [, iv, tag, enc] = parts;
  const decipher = createDecipheriv('aes-256-gcm', getEncKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(enc, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}
