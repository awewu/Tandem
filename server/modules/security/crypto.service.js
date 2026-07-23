const crypto = require('crypto');

const DEFAULT_ALGORITHM = 'aes-256-gcm';
const DEFAULT_VERSION = 'v1';

function normalizeSecret(secret) {
  const value = secret || process.env.PII_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || '';
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PII_ENCRYPTION_KEY or ENCRYPTION_KEY is required in production');
    }
    console.warn('[CryptoService] ⚠️  PII_ENCRYPTION_KEY 未配置，使用不安全的开发默认密钥。生产上线前必须设置。');
    return 'rhautt-nexus-dev-pii-encryption-key';
  }
  return value;
}

class CryptoService {
  constructor(options = {}) {
    this.algorithm = options.algorithm || DEFAULT_ALGORITHM;
    this.version = options.version || DEFAULT_VERSION;
    this.key = crypto.scryptSync(normalizeSecret(options.secret), options.salt || 'rhautt-nexus-pii', 32);
    this.randomBytes = options.randomBytes || crypto.randomBytes;
  }

  encryptText(value) {
    if (value === undefined || value === null || value === '') return null;
    const iv = this.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(String(value), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return [
      this.version,
      this.algorithm,
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted
    ].join(':');
  }

  decryptText(encryptedValue) {
    if (!encryptedValue) return null;
    const parts = String(encryptedValue).split(':');
    if (parts.length !== 5) return null;
    const [version, algorithm, ivHex, authTagHex, encrypted] = parts;
    if (version !== this.version || algorithm !== this.algorithm) return null;

    try {
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return null;
    }
  }

  encryptObject(value) {
    if (!value) return null;
    return this.encryptText(JSON.stringify(value));
  }

  decryptObject(encryptedValue) {
    const decrypted = this.decryptText(encryptedValue);
    if (!decrypted) return null;
    try {
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }

  isEncryptedValue(value) {
    return String(value || '').startsWith(`${this.version}:${this.algorithm}:`);
  }
}

module.exports = CryptoService;
