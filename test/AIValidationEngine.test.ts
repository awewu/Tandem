/**
 * AIValidationEngine 单元测试
 * 测试覆盖率目标: 80%+
 */

import AIValidationEngine from '../server/engines/AIValidationEngine';

describe('AIValidationEngine', () => {
  let engine: any;

  beforeEach(async () => {
    // 创建新实例进行测试
    engine = new (AIValidationEngine as any).constructor();
    await engine.initialize();
  });

  afterEach(async () => {
    // 清理
    if (engine.testSamples) {
      engine.testSamples.clear();
    }
    if (engine.testResults) {
      engine.testResults.clear();
    }
  });

  describe('初始化', () => {
    test('应该成功初始化', async () => {
      const result = await engine.initialize();
      expect(result).toBe(true);
      expect(engine.initialized).toBe(true);
    });

    test('应该创建存储目录', async () => {
      const fs = require('fs');
      expect(fs.existsSync(engine.storagePath)).toBe(true);
    });

    test('应该加载或生成测试样本', async () => {
      expect(engine.testSamples.size).toBeGreaterThan(0);
    });
  });

  describe('测试样本管理', () => {
    test('应该生成默认样本', async () => {
      const sampleCount = engine.testSamples.size;
      expect(sampleCount).toBe(100);
    });

    test('样本应该包含必要字段', async () => {
      const firstSample = engine.testSamples.values().next().value;
      
      expect(firstSample).toHaveProperty('id');
      expect(firstSample).toHaveProperty('index');
      expect(firstSample).toHaveProperty('houseType');
      expect(firstSample).toHaveProperty('area');
      expect(firstSample).toHaveProperty('groundTruth');
      expect(firstSample).toHaveProperty('aiPrediction');
    });

    test('应该生成随机的房屋类型', () => {
      const houseTypes = ['apartment', 'villa', 'townhouse', 'duplex'];
      const houseType = (engine as any).getRandomHouseType();
      expect(houseTypes).toContain(houseType);
    });

    test('应该生成合理的面积范围', () => {
      const area = (engine as any).getRandomArea();
      expect(area).toBeGreaterThanOrEqual(50);
      expect(area).toBeLessThanOrEqual(500);
    });

    test('应该生成合理的楼层范围', () => {
      const floors = (engine as any).getRandomFloors();
      expect(floors).toBeGreaterThanOrEqual(1);
      expect(floors).toBeLessThanOrEqual(5);
    });

    test('应该生成合理的卫生间数量', () => {
      const bathrooms = (engine as any).getRandomBathrooms();
      expect(bathrooms).toBeGreaterThanOrEqual(1);
      expect(bathrooms).toBeLessThanOrEqual(4);
    });
  });

  describe('验证逻辑', () => {
    test('应该计算匹配度', () => {
      const groundTruth = ['pain1', 'pain2', 'pain3'];
      const aiPrediction = ['pain1', 'pain2', 'pain4'];
      const matchRate = (engine as any).calculateMatchRate(groundTruth, aiPrediction);
      
      expect(matchRate).toBeGreaterThanOrEqual(0);
      expect(matchRate).toBeLessThanOrEqual(1);
    });

    test('完全匹配应该返回1', () => {
      const groundTruth = ['pain1', 'pain2', 'pain3'];
      const aiPrediction = ['pain1', 'pain2', 'pain3'];
      const matchRate = (engine as any).calculateMatchRate(groundTruth, aiPrediction);
      
      expect(matchRate).toBe(1);
    });

    test('完全不匹配应该返回0', () => {
      const groundTruth = ['pain1', 'pain2', 'pain3'];
      const aiPrediction = ['pain4', 'pain5', 'pain6'];
      const matchRate = (engine as any).calculateMatchRate(groundTruth, aiPrediction);
      
      expect(matchRate).toBe(0);
    });
  });

  describe('精度统计', () => {
    test('应该计算总体精度', () => {
      const results = [
        { matchRate: 0.8, confidence: 0.9 },
        { matchRate: 0.7, confidence: 0.85 },
        { matchRate: 0.9, confidence: 0.95 }
      ];
      
      const accuracy = (engine as any).calculateOverallAccuracy(results);
      expect(accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy).toBeLessThanOrEqual(1);
    });

    test('应该计算平均置信度', () => {
      const results = [
        { matchRate: 0.8, confidence: 0.9 },
        { matchRate: 0.7, confidence: 0.85 },
        { matchRate: 0.9, confidence: 0.95 }
      ];
      
      const avgConfidence = (engine as any).calculateAverageConfidence(results);
      expect(avgConfidence).toBeCloseTo(0.9, 2);
    });
  });

  describe('报告生成', () => {
    test('应该生成精度报告', () => {
      const report = (engine as any).generateAccuracyReport({
        overallAccuracy: 0.85,
        averageConfidence: 0.9,
        sampleCount: 100,
        passedSamples: 85,
        failedSamples: 15
      });
      
      expect(report).toHaveProperty('overallAccuracy');
      expect(report).toHaveProperty('averageConfidence');
      expect(report).toHaveProperty('sampleCount');
      expect(report).toHaveProperty('passedSamples');
      expect(report).toHaveProperty('failedSamples');
      expect(report).toHaveProperty('timestamp');
    });

    test('报告应该包含时间戳', () => {
      const report = (engine as any).generateAccuracyReport({
        overallAccuracy: 0.85,
        averageConfidence: 0.9,
        sampleCount: 100,
        passedSamples: 85,
        failedSamples: 15
      });
      
      expect(report.timestamp).toBeDefined();
      expect(new Date(report.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('系统状态', () => {
    test('应该返回系统状态', () => {
      const status = (engine as any).getSystemStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('sampleCount');
      expect(status).toHaveProperty('resultCount');
      expect(status).toHaveProperty('storagePath');
    });
  });

  describe('数据持久化', () => {
    test('应该保存测试结果', async () => {
      const testId = 'test-001';
      const result = {
        sampleId: 'sample-001',
        matchRate: 0.85,
        confidence: 0.9,
        passed: true
      };
      
      await (engine as any).saveTestResult(testId, result);
      expect(engine.testResults.has(testId)).toBe(true);
    });

    test('应该加载测试结果', async () => {
      const testId = 'test-002';
      const result = {
        sampleId: 'sample-002',
        matchRate: 0.75,
        confidence: 0.8,
        passed: false
      };
      
      await (engine as any).saveTestResult(testId, result);
      const loaded = await (engine as any).loadTestResults();
      
      expect(loaded.size).toBeGreaterThan(0);
    });
  });
});
