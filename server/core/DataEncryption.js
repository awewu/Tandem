/**
 * 数据加密存储模块 - AES-256实现
 * 覆盖PRD P0要求：数据安全-AES-256加密存储
 */

const crypto = require('crypto');

class DataEncryption {
  constructor(secretKey = process.env.ENCRYPTION_KEY || 'rheem-default-encryption-key-32char') {
    // 确保密钥长度为32字节（256位）
    this.key = crypto.scryptSync(secretKey, 'salt', 32);
    this.algorithm = 'aes-256-gcm';
  }

  /**
   * 加密数据
   */
  encrypt(text) {
    if (!text) return null;
    
    try {
      // 生成随机IV
      const iv = crypto.randomBytes(16);
      
      // 创建加密器
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      // 加密数据
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // 获取认证标签
      const authTag = cipher.getAuthTag();
      
      // 返回IV + authTag + encrypted的组合
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('加密失败:', error);
      return null;
    }
  }

  /**
   * 解密数据
   */
  decrypt(encryptedData) {
    if (!encryptedData) return null;
    
    try {
      // 解析IV、authTag和encrypted
      const parts = encryptedData.split(':');
      if (parts.length !== 3) return null;
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      // 创建解密器
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      
      // 解密数据
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('解密失败:', error);
      return null;
    }
  }

  /**
   * 加密对象
   */
  encryptObject(obj) {
    if (!obj) return null;
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * 解密对象
   */
  decryptObject(encryptedData) {
    const decrypted = this.decrypt(encryptedData);
    if (!decrypted) return null;
    try {
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }

  /**
   * 批量加密敏感字段
   */
  encryptSensitiveFields(data, fieldsToEncrypt) {
    const encrypted = { ...data };
    
    fieldsToEncrypt.forEach(field => {
      if (data[field]) {
        encrypted[field] = this.encrypt(data[field]);
      }
    });
    
    return encrypted;
  }

  /**
   * 批量解密敏感字段
   */
  decryptSensitiveFields(data, fieldsToEncrypt) {
    const decrypted = { ...data };
    
    fieldsToEncrypt.forEach(field => {
      if (data[field]) {
        decrypted[field] = this.decrypt(data[field]);
      }
    });
    
    return decrypted;
  }
}

/**
 * 加密数据库包装器
 */
class EncryptedDatabase {
  constructor(db, encryption) {
    this.db = db;
    this.encryption = encryption;
    this.sensitiveFields = {
      users: ['phone', 'name', 'password'],
      projects: ['customer', 'roomProfile'],
      customers: ['phone', 'address', 'name']
    };
  }

  /**
   * 安全存储数据
   */
  save(collection, id, data) {
    const sensitiveFields = this.sensitiveFields[collection] || [];
    const encrypted = this.encryption.encryptSensitiveFields(data, sensitiveFields);
    
    if (!this.db[collection]) this.db[collection] = [];
    
    const index = this.db[collection].findIndex(item => item.id === id);
    if (index >= 0) {
      this.db[collection][index] = { ...encrypted, id, updatedAt: new Date().toISOString() };
    } else {
      this.db[collection].push({ ...encrypted, id, createdAt: new Date().toISOString() });
    }
    
    return { success: true, id };
  }

  /**
   * 安全读取数据
   */
  get(collection, id) {
    if (!this.db[collection]) return null;
    
    const encrypted = this.db[collection].find(item => item.id === id);
    if (!encrypted) return null;
    
    const sensitiveFields = this.sensitiveFields[collection] || [];
    return this.encryption.decryptSensitiveFields(encrypted, sensitiveFields);
  }

  /**
   * 查询所有（解密）
   */
  getAll(collection) {
    if (!this.db[collection]) return [];
    
    const sensitiveFields = this.sensitiveFields[collection] || [];
    return this.db[collection].map(item => 
      this.encryption.decryptSensitiveFields(item, sensitiveFields)
    );
  }
}

module.exports = { DataEncryption, EncryptedDatabase };
