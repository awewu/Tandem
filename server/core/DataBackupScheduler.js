/**
 * DataBackupScheduler - 数据备份调度器
 * 实现每日自动备份、加密存储、365天保留策略
 * 
 * Vibe Coding生成 - 2026-04-06 Session 1
 * 自然语言需求: 实现完整的数据备份恢复系统
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const mkdirAsync = promisify(fs.mkdir);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const unlinkAsync = promisify(fs.unlink);

class DataBackupScheduler {
  constructor(options = {}) {
    this.backupDir = options.backupDir || './backups';
    this.encryptionKey = options.encryptionKey || this.generateKey();
    this.retentionDays = options.retentionDays || 365;
    this.scheduleHour = options.scheduleHour || 2; // 凌晨2点
    this.scheduleMinute = options.scheduleMinute || 0;
    
    this.isRunning = false;
    this.timer = null;
    this.backupHistory = [];
    
    this.initialize();
  }

  async initialize() {
    // 确保备份目录存在
    await this.ensureBackupDir();
    
    // 加载历史备份记录
    await this.loadBackupHistory();
    
    console.log('[DataBackupScheduler] 初始化完成');
    console.log(`  - 备份目录: ${path.resolve(this.backupDir)}`);
    console.log(`  - 保留策略: ${this.retentionDays}天`);
    console.log(`  - 定时任务: 每日${this.scheduleHour}:${this.scheduleMinute.toString().padStart(2, '0')}`);
  }

  async ensureBackupDir() {
    const dailyDir = path.join(this.backupDir, 'daily');
    const archiveDir = path.join(this.backupDir, 'archive');
    
    for (const dir of [this.backupDir, dailyDir, archiveDir]) {
      if (!fs.existsSync(dir)) {
        await mkdirAsync(dir, { recursive: true });
      }
    }
  }

  async loadBackupHistory() {
    try {
      const historyFile = path.join(this.backupDir, 'backup-history.json');
      if (fs.existsSync(historyFile)) {
        const data = await readFileAsync(historyFile, 'utf8');
        this.backupHistory = JSON.parse(data);
      }
    } catch (error) {
      console.warn('[DataBackupScheduler] 加载历史记录失败:', error.message);
      this.backupHistory = [];
    }
  }

  async saveBackupHistory() {
    try {
      const historyFile = path.join(this.backupDir, 'backup-history.json');
      await writeFileAsync(historyFile, JSON.stringify(this.backupHistory, null, 2));
    } catch (error) {
      console.error('[DataBackupScheduler] 保存历史记录失败:', error.message);
    }
  }

  generateKey() {
    // 生成256位加密密钥
    return crypto.randomBytes(32).toString('hex');
  }

  encryptData(data) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm
    };
  }

  decryptData(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  async createBackup(data, options = {}) {
    const timestamp = new Date();
    const backupId = `backup-${timestamp.toISOString().replace(/[:.]/g, '-')}`;
    const backupType = options.type || 'full';
    
    console.log(`[DataBackupScheduler] 创建备份: ${backupId}`);
    
    try {
      // 准备备份数据
      const backupData = {
        id: backupId,
        timestamp: timestamp.toISOString(),
        type: backupType,
        version: '1.0',
        data: data
      };
      
      // 加密数据
      const encrypted = this.encryptData(backupData);
      
      // 保存到文件
      const backupFile = path.join(
        this.backupDir, 
        'daily', 
        `${backupId}.enc`
      );
      await writeFileAsync(backupFile, JSON.stringify(encrypted, null, 2));
      
      // 记录备份历史
      const backupRecord = {
        id: backupId,
        timestamp: backupData.timestamp,
        type: backupType,
        file: backupFile,
        size: JSON.stringify(encrypted).length,
        status: 'success'
      };
      
      this.backupHistory.push(backupRecord);
      await this.saveBackupHistory();
      
      // 清理过期备份
      await this.cleanupOldBackups();
      
      console.log(`[DataBackupScheduler] 备份成功: ${backupId}`);
      return backupRecord;
      
    } catch (error) {
      console.error(`[DataBackupScheduler] 备份失败: ${backupId}`, error);
      throw error;
    }
  }

  async restoreBackup(backupId, targetDb) {
    console.log(`[DataBackupScheduler] 恢复备份: ${backupId}`);
    
    try {
      // 查找备份文件
      const backupRecord = this.backupHistory.find(b => b.id === backupId);
      if (!backupRecord) {
        throw new Error(`备份不存在: ${backupId}`);
      }
      
      // 读取加密文件
      const encryptedData = JSON.parse(await readFileAsync(backupRecord.file, 'utf8'));
      
      // 解密数据
      const backupData = this.decryptData(encryptedData);
      
      // 恢复数据到目标数据库
      Object.assign(targetDb, backupData.data);
      
      console.log(`[DataBackupScheduler] 恢复成功: ${backupId}`);
      return {
        success: true,
        backupId,
        timestamp: backupData.timestamp,
        type: backupData.type
      };
      
    } catch (error) {
      console.error(`[DataBackupScheduler] 恢复失败: ${backupId}`, error);
      throw error;
    }
  }

  async cleanupOldBackups() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    
    const oldBackups = this.backupHistory.filter(
      b => new Date(b.timestamp) < cutoffDate
    );
    
    for (const backup of oldBackups) {
      try {
        if (fs.existsSync(backup.file)) {
          await unlinkAsync(backup.file);
          console.log(`[DataBackupScheduler] 清理过期备份: ${backup.id}`);
        }
      } catch (error) {
        console.warn(`[DataBackupScheduler] 清理失败: ${backup.id}`, error.message);
      }
    }
    
    // 更新历史记录
    this.backupHistory = this.backupHistory.filter(
      b => new Date(b.timestamp) >= cutoffDate
    );
    await this.saveBackupHistory();
  }

  startScheduledBackups(getDataCallback) {
    if (this.isRunning) {
      console.warn('[DataBackupScheduler] 定时任务已在运行');
      return;
    }
    
    this.isRunning = true;
    this.getDataCallback = getDataCallback;
    
    // 计算下一次执行时间
    const scheduleNext = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(this.scheduleHour, this.scheduleMinute, 0, 0);
      
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      
      const delay = next - now;
      
      console.log(`[DataBackupScheduler] 下次备份时间: ${next.toLocaleString()}`);
      
      this.timer = setTimeout(async () => {
        try {
          const data = this.getDataCallback();
          await this.createBackup(data, { type: 'scheduled' });
        } catch (error) {
          console.error('[DataBackupScheduler] 定时备份失败:', error);
        }
        scheduleNext(); // 递归调度下一次
      }, delay);
    };
    
    scheduleNext();
    console.log('[DataBackupScheduler] 定时备份已启动');
  }

  stopScheduledBackups() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[DataBackupScheduler] 定时备份已停止');
  }

  getBackupList() {
    return this.backupHistory.map(b => ({
      id: b.id,
      timestamp: b.timestamp,
      type: b.type,
      size: b.size,
      status: b.status
    }));
  }

  getStats() {
    const totalBackups = this.backupHistory.length;
    const totalSize = this.backupHistory.reduce((sum, b) => sum + b.size, 0);
    const oldestBackup = this.backupHistory[0]?.timestamp;
    const latestBackup = this.backupHistory[this.backupHistory.length - 1]?.timestamp;
    
    return {
      totalBackups,
      totalSize,
      oldestBackup,
      latestBackup,
      retentionDays: this.retentionDays,
      isRunning: this.isRunning,
      nextBackup: this.timer ? 'scheduled' : 'not scheduled'
    };
  }
}

module.exports = DataBackupScheduler;
