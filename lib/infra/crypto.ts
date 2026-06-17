/**
 * Crypto · 凭据加密/解密
 *
 * 用于加密存储用户级 SMTP/IMAP 密码.
 * 使用 AES-256-GCM, 密钥来自 ENCRYPTION_KEY 环境变量.
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    const fallback = 'tandem-dev-fallback-key-32-chars!!';
    return Buffer.from(fallback.slice(0, 32).padEnd(32, '\0'));
  }
  return Buffer.from(raw.slice(0, 32).padEnd(32, '\0'));
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}