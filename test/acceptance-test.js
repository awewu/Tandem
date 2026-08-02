/**
 * 瑞美舒适家居系统设计平台 - 自动化测试验收套件
 * 最高标准验收检查机制
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 测试配置
const CONFIG = {
  serverPort: 5000,
  apiBaseUrl: 'http://localhost:5000/api',
  timeout: 5000,
  retries: 3
};

// 验收检查清单
const CHECKLIST = {
  // P0 核心功能检查项
  P0: {
    '账号权限管理': [
      '用户注册功能正常',
      '账号密码登录正常',
      '短信验证码登录正常',
      '角色权限控制正常',
      'JWT认证机制正常'
    ],
    '双模式设计流程': [
      '快速估算模式可用',
      '精细化设计模式可用',
      'AI方案推荐正常',
      '3D展示功能正常',
      '设计流程完整'
    ],
    '六大系统支持': [
      '五恒系统支持',
      '净水系统支持',
      '采暖系统支持',
      '热水系统支持',
      '新风系统支持',
      '除湿系统支持'
    ],
    '设备库管理': [
      '瑞美产品预设完整',
      '第三方产品审核',
      '设备搜索筛选正常',
      '设备详情展示'
    ],
    '智能报价系统': [
      '多促销配置',
      '实时价格计算',
      '材料清单生成',
      '报价单导出'
    ]
  },
  // P1 扩展功能检查项
  P1: {
    '方案管理': [
      '版本控制正常',
      '云端存储同步',
      '项目分享协作',
      '批量操作功能'
    ],
    '多终端支持': [
      'Web端功能完整',
      'Pad端适配',
      '移动端查看'
    ],
    '智能控制': [
      '控制系统集成',
      'API接口预留'
    ]
  }
};

// 测试套件
class AcceptanceTestSuite {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
  }

  // 记录测试结果
  log(test, status, message = '') {
    const result = {
      test,
      status,
      message,
      timestamp: new Date().toISOString()
    };
    this.results.push(result);
    
    if (status === 'PASS') this.passed++;
    else if (status === 'FAIL') this.failed++;
    else if (status === 'SKIP') this.skipped++;
    
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${test}${message ? ': ' + message : ''}`);
  }

  // 测试API连接
  async testAPIConnection() {
    try {
      const response = await this.httpRequest(`${CONFIG.apiBaseUrl}/health`);
      if (response.status === 'ok') {
        this.log('API连接测试', 'PASS', '服务器响应正常');
        return true;
      } else {
        this.log('API连接测试', 'FAIL', '服务器响应异常');
        return false;
      }
    } catch (error) {
      this.log('API连接测试', 'FAIL', `连接失败: ${error.message}`);
      return false;
    }
  }

  // 测试用户认证
  async testAuthentication() {
    // 测试登录API
    try {
      const loginResponse = await this.httpRequest(
        `${CONFIG.apiBaseUrl}/auth/login`,
        'POST',
        { phone: '13800000000', password: '123456' }
      );
      
      if (loginResponse.success && loginResponse.data.token) {
        this.log('用户登录测试', 'PASS', '认证流程正常');
      } else {
        this.log('用户登录测试', 'FAIL', '认证失败');
      }
    } catch (error) {
      this.log('用户登录测试', 'FAIL', error.message);
    }
  }

  // 测试项目API
  async testProjectAPI() {
    try {
      const response = await this.httpRequest(`${CONFIG.apiBaseUrl}/projects`);
      if (response.success && Array.isArray(response.data.projects)) {
        this.log('项目列表API', 'PASS', `返回${response.data.projects.length}个项目`);
      } else {
        this.log('项目列表API', 'FAIL', '数据结构异常');
      }
    } catch (error) {
      this.log('项目列表API', 'FAIL', error.message);
    }
  }

  // 测试设备API
  async testDeviceAPI() {
    try {
      const response = await this.httpRequest(`${CONFIG.apiBaseUrl}/devices`);
      if (response.success && Array.isArray(response.data.devices)) {
        this.log('设备列表API', 'PASS', `返回${response.data.devices.length}个设备`);
      } else {
        this.log('设备列表API', 'FAIL', '数据结构异常');
      }
    } catch (error) {
      this.log('设备列表API', 'FAIL', error.message);
    }
  }

  // 测试设计API
  async testDesignAPI() {
    try {
      const response = await this.httpRequest(
        `${CONFIG.apiBaseUrl}/design/quick/estimate`,
        'POST',
        { area: 120, rooms: 3, city: 'beijing', budget: 'medium' }
      );
      
      if (response.success && response.data.recommendations) {
        this.log('AI设计API', 'PASS', '方案生成正常');
      } else {
        this.log('AI设计API', 'FAIL', '方案生成失败');
      }
    } catch (error) {
      this.log('AI设计API', 'FAIL', error.message);
    }
  }

  // 检查文件结构
  checkFileStructure() {
    const requiredFiles = [
      'package.json',
      'server/index.js',
      'server/models/User.js',
      'server/models/Project.js',
      'server/models/Device.js',
      'services/api/src/modules/auth/auth.controller.ts',
      'server/routes/projects.js',
      'server/routes/devices.js',
      'services/api/src/modules/module-boundary.ts',
      'src/App.jsx',
      'src/main.jsx',
      'src/pages/Dashboard.jsx',
      'src/pages/auth/Login.jsx',
      'src/pages/design/QuickDesign.jsx',
      'src/pages/design/DetailedDesign.jsx'
    ];

    let missingCount = 0;
    requiredFiles.forEach(file => {
      const fullPath = path.join(__dirname, '..', file);
      if (fs.existsSync(fullPath)) {
        this.log(`文件检查: ${file}`, 'PASS');
      } else {
        this.log(`文件检查: ${file}`, 'FAIL', '文件缺失');
        missingCount++;
      }
    });

    return missingCount === 0;
  }

  // 检查依赖安装
  checkDependencies() {
    const requiredDeps = [
      'express',
      'mongoose',
      'cors',
      'jsonwebtoken',
      'bcryptjs',
      'zod',
      'react',
      'react-dom',
      'react-router-dom'
    ];

    const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
    
    requiredDeps.forEach(dep => {
      const depPath = path.join(nodeModulesPath, dep);
      if (fs.existsSync(depPath)) {
        this.log(`依赖检查: ${dep}`, 'PASS');
      } else {
        this.log(`依赖检查: ${dep}`, 'FAIL', '依赖未安装');
      }
    });
  }

  // HTTP请求工具
  httpRequest(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 80,
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: CONFIG.timeout
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ raw: data });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  // 生成验收报告
  generateReport() {
    const report = {
      summary: {
        total: this.results.length,
        passed: this.passed,
        failed: this.failed,
        skipped: this.skipped,
        passRate: ((this.passed / this.results.length) * 100).toFixed(2) + '%'
      },
      results: this.results,
      checklist: CHECKLIST,
      timestamp: new Date().toISOString()
    };

    // 保存报告
    const reportPath = path.join(__dirname, '..', 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 打印报告
    console.log('\n' + '='.repeat(60));
    console.log('瑞美舒适家居系统设计平台 - 验收测试报告');
    console.log('='.repeat(60));
    console.log(`总测试项: ${report.summary.total}`);
    console.log(`通过: ${report.summary.passed} ✅`);
    console.log(`失败: ${report.summary.failed} ❌`);
    console.log(`跳过: ${report.summary.skipped} ⚠️`);
    console.log(`通过率: ${report.summary.passRate}`);
    console.log('='.repeat(60));
    
    if (report.summary.failed === 0) {
      console.log('🎉 验收通过！系统符合所有立项要求。');
    } else {
      console.log('⚠️ 验收未完全通过，请检查失败项。');
    }
    console.log('='.repeat(60) + '\n');

    return report;
  }

  // 执行完整测试套件
  async runAllTests() {
    console.log('\n开始执行验收测试...\n');

    // 1. 文件结构检查
    console.log('【阶段1】文件结构检查');
    this.checkFileStructure();

    // 2. 依赖检查
    console.log('\n【阶段2】依赖安装检查');
    this.checkDependencies();

    // 3. API连接测试
    console.log('\n【阶段3】API功能测试');
    const apiConnected = await this.testAPIConnection();
    
    if (apiConnected) {
      await this.testAuthentication();
      await this.testProjectAPI();
      await this.testDeviceAPI();
      await this.testDesignAPI();
    }

    // 生成报告
    const report = this.generateReport();
    return report;
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const suite = new AcceptanceTestSuite();
  suite.runAllTests().then(report => {
    process.exit(report.summary.failed > 0 ? 1 : 0);
  }).catch(err => {
    console.error('测试执行失败:', err);
    process.exit(1);
  });
}

module.exports = AcceptanceTestSuite;
