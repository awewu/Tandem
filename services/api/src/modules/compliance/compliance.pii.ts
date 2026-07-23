import * as crypto from 'crypto';

/**
 * PII 加密工具（PIPL/数据安全法：个人信息存储须加密）。
 * - encryptPII / decryptPII：AES-256-GCM 可逆加密（用于需还原的联系方式）
 * - hashPII：SHA-256 不可逆哈希（用于可检索去重，如 phone_hash，不落明文）
 * - maskPhone：界面脱敏展示
 * 密钥来源：env PII_ENCRYPTION_KEY（32 字节 hex/base64）；生产必须注入，不得用默认。
 */
const ALGO = 'aes-256-gcm';

function resolveKey(): Buffer {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (raw) {
    const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[compliance] PII_ENCRYPTION_KEY (32-byte) is required in production');
  }
  // 仅非生产：从固定串派生，保证可启动但不安全
  return crypto.createHash('sha256').update('rhautt-nexus-dev-pii-key').digest();
}

export function encryptPII(plaintext: string): string {
  if (plaintext == null) return plaintext as unknown as string;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, resolveKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 存储格式：v1:iv:tag:ciphertext（base64）
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptPII(payload: string): string {
  if (!payload || !payload.startsWith('v1:')) return payload;
  const [, ivB64, tagB64, dataB64] = payload.split(':');
  const decipher = crypto.createDecipheriv(ALGO, resolveKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}

export function hashPII(value: string): string {
  const salt = process.env.PII_HASH_SALT || 'rhautt-nexus-pii-salt';
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

export function maskPhone(phone: string): string {
  const s = String(phone || '');
  return s.length >= 7 ? `${s.slice(0, 3)}****${s.slice(-4)}` : '***';
}
