# Hammer Architecture

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HAMMER VALIDATION SYSTEM                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐               │
│  │   CLI/API   │    │   Web UI    │    │  CI/CD Hook  │               │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘               │
│         │                  │                  │                       │
│         └──────────────────┼──────────────────┘                       │
│                            │                                          │
│                            ▼                                          │
│         ┌─────────────────────────────────────┐                       │
│         │         Hammer Orchestrator         │                       │
│         │     ┌──────────────────────────┐    │                       │
│         │     │    Validation Engine     │    │                       │
│         │     │  ┌────────────────────┐  │    │                       │
│         │     │  │  9-Layer Pipeline  │  │    │                       │
│         │     │  │  L1 → L2 → ... → L9│  │    │                       │
│         │     │  └────────────────────┘  │    │                       │
│         │     └──────────────────────────┘    │                       │
│         │     ┌──────────────────────────┐    │                       │
│         │     │    Quality Gate Engine    │    │                       │
│         │     │  (G0-G4 Decision Logic)  │    │                       │
│         │     └──────────────────────────┘    │                       │
│         │     ┌──────────────────────────┐    │                       │
│         │     │     Reporting Engine        │    │                       │
│         │     │  (JSON/Markdown/JUnit)    │    │                       │
│         │     └──────────────────────────┘    │                       │
│         └─────────────────────────────────────┘                       │
│                            │                                          │
│         ┌──────────────────┼──────────────────┐                       │
│         │                  │                  │                       │
│         ▼                  ▼                  ▼                       │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                │
│   │  L1-L3:     │   │  L4-L6:     │   │  L7-L9:     │                │
│   │  Static     │   │  Runtime    │   │  System     │                │
│   │  Analysis   │   │  Testing    │   │  Testing    │                │
│   └─────────────┘   └─────────────┘   └─────────────┘                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. Hammer 类

```javascript
class Hammer extends EventEmitter {
  // 配置管理
  constructor(config)
  
  // 套件管理
  registerSuite(id, suite)
  registerGate(id, gate)
  registerValidator(suiteId, validator)
  
  // 执行控制
  strike(options)        // 执行验证
  executeSuite(id)       // 执行单个套件
  executeValidator(v, suite)  // 执行单个验证器
  
  // 门禁控制
  evaluateQualityGate()  // 评估质量门禁
  calculateSummary()     // 计算汇总
  
  // 报告输出
  outputReport()         // 输出报告
  generateJUnitReport()  // 生成JUnit XML
  generateMarkdownReport()  // 生成Markdown
}
```

### 2. 验证套件结构

```typescript
interface ValidationSuite {
  id: string;                    // 唯一标识 (L1-L9)
  name: string;                  // 显示名称
  description: string;           // 描述
  weight: number;                // 权重 (1-25)
  enabled: boolean;              // 是否启用
  validators: Validator[];        // 验证器列表
}

interface Validator {
  id: string;                    // 唯一标识 (如 S01)
  name: string;                  // 名称
  weight: number;                // 权重
  fn: () => Promise<Result>;    // 验证函数
}

interface ValidationResult {
  id: string;
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  duration: number;
  details: object;
  message?: string;
  fix?: string;
}
```

### 3. 质量门禁结构

```typescript
interface QualityGate {
  id: string;                    // G0-G4
  name: string;
  description: string;
  failOn: string[];              // 触发失败的问题级别
  maxIssues?: number;            // 最大允许问题数
  action: 'BLOCK' | 'WARN' | 'PASS';
  notify: string[];              // 通知对象
}
```

## 执行流程

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  Init   │────▶│ Config  │────▶│ Precheck│
└─────────┘     └─────────┘     └────┬────┘
                                    │
                         ┌──────────┘
                         ▼
              ┌──────────────────────┐
              │   Execute Suites     │
              │   ┌──────────────┐   │
              │   │ Parallel     │   │
              │   │ L1, L2, L3   │   │
              │   └──────────────┘   │
              │   ┌──────────────┐   │
              │   │ Serial       │   │
              │   │ L4-L9        │   │
              │   └──────────────┘   │
              └──────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Evaluate Gate       │
              │  (Critical → Pass)    │
              └──────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Generate Reports    │
              │  - Console           │
              │  - JSON              │
              │  - Markdown          │
              │  - JUnit XML         │
              └──────────────────────┘
```

## 扩展机制

### 自定义验证器

```javascript
// 注册自定义验证器
hammer.registerValidator('L6_FUNCTIONAL', {
  id: 'F99',
  name: 'Custom Business Rule',
  weight: 5,
  fn: async () => {
    const result = await checkCustomRule();
    return {
      success: result.valid,
      severity: result.valid ? 'INFO' : 'HIGH',
      message: result.message,
      fix: result.suggestion
    };
  }
});
```

### 插件系统

```javascript
// hammer-plugin-custom.js
module.exports = {
  name: 'custom-validator',
  version: '1.0.0',
  
  register(hammer) {
    hammer.registerSuite('L10_CUSTOM', {
      name: 'L10: Custom Validation',
      validators: [
        // 自定义验证器
      ]
    });
  }
};
```

## 性能优化

### 并行执行策略

```javascript
// L1-L3 静态分析可并行
const staticSuites = ['L1_STRUCTURE', 'L2_SYNTAX', 'L3_DEPENDENCY'];
await Promise.all(staticSuites.map(id => this.executeSuite(id)));

// L4-L9 需要运行时环境，串行执行
const runtimeSuites = ['L4_CONFIGURATION', 'L5_RUNTIME', ...];
for (const id of runtimeSuites) {
  await this.executeSuite(id);
}
```

### 增量验证

```javascript
const hammer = new Hammer({
  incremental: true,
  cacheResults: '.hammer-cache',
  changedFiles: git.getChangedFiles()
});
```

### 超时控制

```javascript
const hammer = new Hammer({
  timeouts: {
    syntax: 30000,      // 30s for static analysis
    runtime: 60000,     // 60s for runtime tests
    performance: 300000 // 5m for load tests
  }
});
```

## 集成模式

### 1. Git Hooks

```javascript
// .husky/pre-commit
const Hammer = require('./server/core/Hammer');
const hammer = new Hammer({ mode: 'fast' });

const result = await hammer.strike();
if (!result.gate.passed) {
  process.exit(1);
}
```

### 2. CI/CD Pipeline

```yaml
# .github/workflows/hammer.yml
- name: Hammer Validation
  run: |
    node -e "
      const Hammer = require('./server/core/Hammer');
      const hammer = new Hammer({ mode: 'strict' });
      hammer.strike().then(r => {
        if (!r.gate.passed) process.exit(1);
      });
    "
```

### 3. IDE 集成

```javascript
// VS Code Extension API
const hammer = new Hammer({ mode: 'fast' });
hammer.on('validator:complete', ({ validator, result }) => {
  if (!result.success) {
    vscode.diagnostics.set(uri, [{
      message: result.message,
      severity: result.severity === 'CRITICAL' 
        ? vscode.DiagnosticSeverity.Error 
        : vscode.DiagnosticSeverity.Warning
    }]);
  }
});
```

## 事件系统

```javascript
hammer.on('init', ({ name, version }) => {
  console.log(`Hammer ${version} initialized`);
});

hammer.on('strike:start', ({ timestamp }) => {
  console.log('Validation started');
});

hammer.on('suite:start', ({ id, name }) => {
  console.log(`Running ${id}: ${name}`);
});

hammer.on('validator:complete', ({ suite, validator, result }) => {
  console.log(`[${validator}] ${result.status}`);
});

hammer.on('suite:complete', ({ id, passed, failed, critical }) => {
  console.log(`${id}: ${passed} passed, ${failed} failed`);
});

hammer.on('strike:complete', (results) => {
  console.log(`Quality Score: ${results.summary.qualityScore}`);
});
```

## 配置体系

### 配置优先级

```
1. CLI 参数 (最高)
2. 环境变量
3. hammer.config.js
4. package.json#hammer
5. 默认值 (最低)
```

### 环境变量

```bash
HAMMER_MODE=strict
HAMMER_PARALLEL=true
HAMMER_TIMEOUT_SYNTAX=30000
HAMMER_THRESHOLD_COVERAGE=0.90
HAMMER_REPORT_FORMAT=full
```
