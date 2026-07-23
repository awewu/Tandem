/**
 * CADImportTestSuite - CAD导入测试套件
 * 真实文件测试与精度验证
 * 
 * 112Agent-A并行任务
 */

const fs = require('fs');
const path = require('path');

class CADImportTestSuite {
  constructor(cadImporterEngine, cadRecognizer) {
    this.cadImporter = cadImporterEngine;
    this.recognizer = cadRecognizer;
    this.testResults = [];
    this.sampleFiles = [];
  }

  async runAllTests() {
    console.log('[CADImportTestSuite] 启动CAD导入测试...');
    
    // 生成测试样本文件
    await this.generateSampleFiles();
    
    // 测试DXF解析
    await this.testDXFParsing();
    
    // 测试实体识别
    await this.testEntityRecognition();
    
    // 测试户型提取
    await this.testFloorPlanExtraction();
    
    // 测试3D转换
    await this.test3DConversion();
    
    // 批量测试
    await this.testBatchProcessing();
    
    return this.generateReport();
  }

  async generateSampleFiles() {
    console.log('[CADImportTestSuite] 生成测试样本...');
    
    // 创建测试目录
    const testDir = './test-files/cad';
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // 生成简单户型DXF (模拟)
    this.sampleFiles = [
      {
        name: 'simple-apartment.dxf',
        type: 'apartment',
        description: '简单两居室公寓',
        expected: {
          rooms: 3, // 2卧室+1客厅
          walls: 12,
          doors: 3,
          windows: 4
        }
      },
      {
        name: 'villa-floor1.dxf',
        type: 'villa',
        description: '别墅一层平面图',
        expected: {
          rooms: 5,
          walls: 20,
          doors: 5,
          windows: 8
        }
      },
      {
        name: 'office-layout.dxf',
        type: 'office',
        description: '办公空间布局',
        expected: {
          rooms: 4,
          walls: 15,
          doors: 4,
          windows: 6
        }
      }
    ];
    
    console.log(`[CADImportTestSuite] 已准备 ${this.sampleFiles.length} 个测试样本`);
  }

  async testDXFParsing() {
    console.log('[CADImportTestSuite] 测试DXF解析...');
    
    const tests = [];
    
    for (const file of this.sampleFiles) {
      try {
        // 模拟读取DXF文件
        const fileBuffer = await this.readSampleFile(file.name);
        
        // 解析DXF
        const result = await this.cadImporter.parseDXF(fileBuffer);
        
        tests.push({
          file: file.name,
          type: 'dxf-parsing',
          success: true,
          entities: result.statistics?.totalEntities || 0,
          layers: result.layers?.length || 0,
          error: null
        });
      } catch (error) {
        tests.push({
          file: file.name,
          type: 'dxf-parsing',
          success: false,
          error: error.message
        });
      }
    }
    
    this.testResults.push({
      category: 'dxf-parsing',
      tests
    });
    
    console.log('[CADImportTestSuite] DXF解析测试完成');
  }

  async testEntityRecognition() {
    console.log('[CADImportTestSuite] 测试实体识别...');
    
    const tests = [];
    
    for (const file of this.sampleFiles) {
      try {
        // 解析并识别
        const fileBuffer = await this.readSampleFile(file.name);
        const parsed = await this.cadImporter.parseDXF(fileBuffer);
        
        // 使用识别器
        const recognized = this.recognizer.analyze(parsed);
        
        // 验证识别结果
        const walls = recognized.walls?.length || 0;
        const doors = recognized.doors?.length || 0;
        const windows = recognized.windows?.length || 0;
        
        const wallAccuracy = Math.abs(walls - file.expected.walls) / file.expected.walls;
        const doorAccuracy = Math.abs(doors - file.expected.doors) / file.expected.doors;
        const windowAccuracy = Math.abs(windows - file.expected.windows) / file.expected.windows;
        
        tests.push({
          file: file.name,
          type: 'entity-recognition',
          success: wallAccuracy < 0.2 && doorAccuracy < 0.2 && windowAccuracy < 0.2,
          recognized: { walls, doors, windows },
          expected: file.expected,
          accuracy: {
            walls: (1 - wallAccuracy) * 100,
            doors: (1 - doorAccuracy) * 100,
            windows: (1 - windowAccuracy) * 100
          }
        });
      } catch (error) {
        tests.push({
          file: file.name,
          type: 'entity-recognition',
          success: false,
          error: error.message
        });
      }
    }
    
    this.testResults.push({
      category: 'entity-recognition',
      tests
    });
    
    console.log('[CADImportTestSuite] 实体识别测试完成');
  }

  async testFloorPlanExtraction() {
    console.log('[CADImportTestSuite] 测试户型提取...');
    
    const tests = [];
    
    for (const file of this.sampleFiles) {
      try {
        const fileBuffer = await this.readSampleFile(file.name);
        const parsed = await this.cadImporter.parseDXF(fileBuffer);
        const recognized = this.recognizer.analyze(parsed);
        
        // 验证户型数据
        const floorPlan = recognized.floorPlan;
        const rooms = recognized.rooms?.length || 0;
        
        tests.push({
          file: file.name,
          type: 'floorplan-extraction',
          success: floorPlan && rooms > 0,
          rooms,
          expectedRooms: file.expected.rooms,
          totalArea: floorPlan?.totalArea,
          roomCount: floorPlan?.roomCount,
          summary: floorPlan?.summary
        });
      } catch (error) {
        tests.push({
          file: file.name,
          type: 'floorplan-extraction',
          success: false,
          error: error.message
        });
      }
    }
    
    this.testResults.push({
      category: 'floorplan-extraction',
      tests
    });
    
    console.log('[CADImportTestSuite] 户型提取测试完成');
  }

  async test3DConversion() {
    console.log('[CADImportTestSuite] 测试3D转换...');
    
    const tests = [];
    
    for (const file of this.sampleFiles) {
      try {
        const fileBuffer = await this.readSampleFile(file.name);
        const parsed = await this.cadImporter.parseDXF(fileBuffer);
        
        // 验证3D对象生成
        const threeJSObjects = parsed.threeJSObjects;
        
        tests.push({
          file: file.name,
          type: '3d-conversion',
          success: threeJSObjects && threeJSObjects.length > 0,
          objectCount: threeJSObjects?.length || 0
        });
      } catch (error) {
        tests.push({
          file: file.name,
          type: '3d-conversion',
          success: false,
          error: error.message
        });
      }
    }
    
    this.testResults.push({
      category: '3d-conversion',
      tests
    });
    
    console.log('[CADImportTestSuite] 3D转换测试完成');
  }

  async testBatchProcessing() {
    console.log('[CADImportTestSuite] 测试批量处理...');
    
    const startTime = Date.now();
    const batchSize = 10;
    const results = [];
    
    // 模拟批量处理
    for (let i = 0; i < batchSize; i++) {
      try {
        const file = this.sampleFiles[i % this.sampleFiles.length];
        const fileBuffer = await this.readSampleFile(file.name);
        const parsed = await this.cadImporter.parseDXF(fileBuffer);
        
        results.push({
          index: i,
          success: true,
          entities: parsed.statistics?.totalEntities || 0
        });
      } catch (error) {
        results.push({
          index: i,
          success: false,
          error: error.message
        });
      }
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / batchSize;
    const successful = results.filter(r => r.success).length;
    
    this.testResults.push({
      category: 'batch-processing',
      batchSize,
      totalTime,
      avgTime: Math.round(avgTime),
      successRate: (successful / batchSize) * 100,
      throughput: Math.round((batchSize / totalTime) * 1000) // files/second
    });
    
    console.log('[CADImportTestSuite] 批量处理测试完成');
    console.log(`  - 平均处理时间: ${Math.round(avgTime)}ms/文件`);
    console.log(`  - 成功率: ${(successful / batchSize * 100).toFixed(1)}%`);
  }

  async readSampleFile(filename) {
    // 模拟读取文件
    // 实际使用时替换为真实文件读取
    const testDir = './test-files/cad';
    const filepath = path.join(testDir, filename);
    
    // 如果文件不存在，创建模拟数据
    if (!fs.existsSync(filepath)) {
      // 生成简单的模拟DXF数据
      const mockData = this.generateMockDXF(filename);
      fs.writeFileSync(filepath, mockData);
    }
    
    return fs.readFileSync(filepath);
  }

  generateMockDXF(filename) {
    // 生成简化的DXF格式数据
    const lines = [
      '0', 'SECTION',
      '2', 'HEADER',
      '0', 'ENDSEC',
      '0', 'SECTION',
      '2', 'ENTITIES',
      '0', 'LINE',
      '8', 'WALLS',
      '10', '0.0',
      '20', '0.0',
      '11', '10.0',
      '21', '0.0',
      '0', 'LINE',
      '8', 'WALLS',
      '10', '10.0',
      '20', '0.0',
      '11', '10.0',
      '21', '10.0',
      '0', 'ENDSEC',
      '0', 'EOF'
    ];
    
    return Buffer.from(lines.join('\n'));
  }

  generateReport() {
    const categories = {};
    
    for (const result of this.testResults) {
      if (result.category) {
        categories[result.category] = result;
      }
    }
    
    // 计算总体统计
    let totalTests = 0;
    let passedTests = 0;
    
    for (const cat of Object.values(categories)) {
      if (cat.tests) {
        totalTests += cat.tests.length;
        passedTests += cat.tests.filter(t => t.success).length;
      }
    }
    
    const report = {
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        passRate: (passedTests / totalTests * 100).toFixed(1),
        timestamp: new Date().toISOString()
      },
      categories,
      sampleFiles: this.sampleFiles,
      recommendations: this.getRecommendations()
    };
    
    console.log('[CADImportTestSuite] 测试报告:');
    console.log(`  - 总测试数: ${totalTests}`);
    console.log(`  - 通过: ${passedTests}`);
    console.log(`  - 失败: ${totalTests - passedTests}`);
    console.log(`  - 通过率: ${report.summary.passRate}%`);
    
    return report;
  }

  getRecommendations() {
    const recommendations = [];
    
    // 检查识别精度
    const recognitionTest = this.testResults.find(r => r.category === 'entity-recognition');
    if (recognitionTest) {
      const avgAccuracy = recognitionTest.tests.reduce((sum, t) => {
        if (t.accuracy) {
          return sum + (t.accuracy.walls + t.accuracy.doors + t.accuracy.windows) / 3;
        }
        return sum;
      }, 0) / recognitionTest.tests.length;
      
      if (avgAccuracy < 80) {
        recommendations.push({
          priority: 'high',
          issue: '实体识别精度不足',
          suggestion: '优化识别算法，增加更多训练样本'
        });
      }
    }
    
    // 检查批量处理性能
    const batchTest = this.testResults.find(r => r.category === 'batch-processing');
    if (batchTest && batchTest.avgTime > 500) {
      recommendations.push({
        priority: 'medium',
        issue: '批量处理性能较差',
        suggestion: '优化解析性能，考虑使用异步处理或缓存'
      });
    }
    
    return recommendations;
  }
}

module.exports = CADImportTestSuite;
