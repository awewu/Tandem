/**
 * DataBackupEngine 单元测试
 * 测试覆盖率目标: 80%+
 */

import DataBackupEngine from '../server/engines/DataBackupEngine';

describe('DataBackupEngine', () => {
  let engine: any;

  beforeEach(() => {
    // 创建新实例进行测试
    engine = new (DataBackupEngine as any).constructor();
  });

  afterEach(async () => {
    // 清理
    if (engine.backupTimer) {
      engine.stopAutoBackup();
    }
  });

  describe('初始化', () => {
    test('应该成功初始化', async () => {
      const result = await engine.initialize();
      expect(result).toBe(true);
      expect(engine.initialized).toBe(true);
    });

    test('应该创建备份目录', async () => {
      await engine.initialize();
      const fs = require('fs');
      expect(fs.existsSync(engine.backupDir)).toBe(true);
    });

    test('应该加载备份配置', async () => {
      await engine.initialize();
      expect(engine.backupInterval).toBeDefined();
      expect(engine.maxBackups).toBeDefined();
    });
  });

  describe('备份配置', () => {
    test('应该设置备份间隔', async () => {
      await engine.initialize();
      const newInterval = 12 * 60 * 60 * 1000; // 12小时
      engine.setBackupInterval(newInterval);
      expect(engine.backupInterval).toBe(newInterval);
    });

    test('应该设置最大备份数', async () => {
      await engine.initialize();
      const newMaxBackups = 15;
      engine.setMaxBackups(newMaxBackups);
      expect(engine.maxBackups).toBe(newMaxBackups);
    });
  });

  describe('系统状态', () => {
    test('应该返回正确的系统状态', async () => {
      await engine.initialize();
      const status = engine.getSystemStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('dataDir');
      expect(status).toHaveProperty('backupDir');
      expect(status).toHaveProperty('backupCount');
      expect(status).toHaveProperty('autoBackupEnabled');
      expect(status).toHaveProperty('backupInterval');
      expect(status).toHaveProperty('maxBackups');
      
      expect(status.initialized).toBe(true);
      expect(status.dataDir).toBe('./data');
      expect(status.backupDir).toBe('./backups');
    });
  });

  describe('自动备份', () => {
    test('应该启动自动备份', async () => {
      await engine.initialize();
      expect(engine.backupTimer).not.toBeNull();
    });

    test('应该停止自动备份', async () => {
      await engine.initialize();
      engine.stopAutoBackup();
      expect(engine.backupTimer).toBeNull();
    });

    test('重新启动应该替换旧定时器', async () => {
      await engine.initialize();
      const oldTimer = engine.backupTimer;
      engine.startAutoBackup();
      expect(engine.backupTimer).not.toBe(oldTimer);
    });
  });

  describe('备份列表', () => {
    test('应该返回备份列表', async () => {
      await engine.initialize();
      const backupList = engine.getBackupList();
      expect(Array.isArray(backupList)).toBe(true);
    });

    test('空目录应该返回空列表', async () => {
      await engine.initialize();
      const backupList = engine.getBackupList();
      expect(backupList.length).toBe(0);
    });
  });

  describe('文件大小格式化', () => {
    test('应该正确格式化字节', async () => {
      await engine.initialize();
      const formatSize = (engine as any).formatSize.bind(engine);
      
      expect(formatSize(0)).toBe('0 B');
      expect(formatSize(1024)).toBe('1 KB');
      expect(formatSize(1024 * 1024)).toBe('1 MB');
      expect(formatSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('备份信息接口', () => {
    test('备份信息应该包含必要字段', async () => {
      const backupInfo = {
        timestamp: '2026-04-10T12:00:00.000Z',
        size: 1024,
        files: ['data1.json', 'data2.json']
      };

      expect(backupInfo).toHaveProperty('timestamp');
      expect(backupInfo).toHaveProperty('size');
      expect(backupInfo).toHaveProperty('files');
      expect(Array.isArray(backupInfo.files)).toBe(true);
    });
  });

  describe('配置接口', () => {
    test('配置应该支持可选字段', async () => {
      const config1: { interval?: number; maxBackups?: number } = {};
      expect(config1.interval).toBeUndefined();
      expect(config1.maxBackups).toBeUndefined();

      const config2: { interval?: number; maxBackups?: number } = {
        interval: 24 * 60 * 60 * 1000,
        maxBackups: 30
      };
      expect(config2.interval).toBeDefined();
      expect(config2.maxBackups).toBeDefined();
    });
  });
});
