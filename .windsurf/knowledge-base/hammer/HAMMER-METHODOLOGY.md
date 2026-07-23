# 🔨 Hammer Methodology

**工业级验证与质量门禁方法论体系**

> *"Quality is not an act, it is a habit."* — Aristotle

---

## 目录

1. [核心理念](#核心理念)
2. [9层验证架构](#9层验证架构)
3. [质量门禁体系](#质量门禁体系)
4. [执行模式](#执行模式)
5. [度量体系](#度量体系)
6. [最佳实践](#最佳实践)

---

## 核心理念

### 1.1 设计哲学

Hammer 基于 **"验证即生产" (Validation as Production)** 的理念，将质量验证视为软件交付流水线的核心环节。

#### 三大原则

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  🔒 ZERO TOLERANCE FOR CRITICAL ISSUES                      │
│     关键问题零容忍：安全漏洞、数据丢失、系统崩溃              │
│                                                             │
│  🔍 SHIFT LEFT VALIDATION                                   │
│     左移验证：问题发现越早，修复成本越低                      │
│                                                             │
│  📊 DATA-DRIVEN QUALITY GATES                               │
│     数据驱动质量门禁：可量化、可追踪、可改进                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 参考标准

| 标准 | 适用领域 | Hammer 应用 |
|------|----------|-------------|
| ISO/IEC 25010 | 软件质量模型 | 全面覆盖9个质量维度 |
| NASA-STD-8719.13 | 软件安全标准 | L9 安全验证层 |
| IEC 61508 | 功能安全 | L5 运行时验证 |
| DO-178C | 航空软件标准 | L6 功能验证 |
| ISO 26262 | 汽车功能安全 | L7 集成验证 |
| NIST SSDF | 安全软件开发框架 | L3 依赖验证 |
| CWE Top 25 | 软件缺陷 | L9 安全扫描 |
| OWASP ASVS | 应用安全 | L9 安全测试 |

---

## 9层验证架构

### 2.1 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                      L9: SECURITY                             │
│     安全验证层: SAST / DAST / 密钥 / 注入 / 访问控制            │
├─────────────────────────────────────────────────────────────┤
│                    L8: PERFORMANCE                            │
│     性能验证层: 延迟 / 吞吐 / 资源 / 压测 / 负载              │
├─────────────────────────────────────────────────────────────┤
│                   L7: INTEGRATION                           │
│     集成验证层: DB / Cache / 队列 / 外部API / 服务网格         │
├─────────────────────────────────────────────────────────────┤
│                   L6: FUNCTIONAL                            │
│     功能验证层: API / 业务逻辑 / 边界条件 / 异常处理           │
├─────────────────────────────────────────────────────────────┤
│                    L5: RUNTIME                              │
│     运行时验证层: 启动 / 健康 / 端口 / 进程 / 内存            │
├─────────────────────────────────────────────────────────────┤
│                 L4: CONFIGURATION                           │
│     配置验证层: 环境 / 秘钥 / 版本 / 兼容性 / 基础设施        │
├─────────────────────────────────────────────────────────────┤
│                  L3: DEPENDENCY                             │
│     依赖验证层: 包 / 版本 / 冲突 / 许可证 / 漏洞              │
├─────────────────────────────────────────────────────────────┤
│                    L2: SYNTAX                               │
│     语法验证层: AST / 类型 / 规范 / 复杂度 / 死代码          │
├─────────────────────────────────────────────────────────────┤
│                   L1: STRUCTURE                             │
│     结构验证层: 文件 / 目录 / 模块 / 完整性 / 命名规范        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 各层详解

#### L1: Structure - 结构验证层

**职责**: 验证项目基础结构完整性和一致性

**验证器 (Validators)**:

| ID | 名称 | 权重 | 说明 |
|----|------|------|------|
| S01 | Core Engines Existence | 10 | 核心引擎文件存在性检查 |
| S02 | Directory Structure | 5 | 目录结构完整性 |
| S03 | File Integrity | 5 | 文件内容有效性 |
| S04 | Module Boundaries | 3 | 模块边界合规性 |
| S05 | Naming Conventions | 2 | 命名规范符合度 |

**通过标准**:
- 所有核心引擎文件存在且非空
- 目录结构符合项目规范
- 文件编码统一为 UTF-8
- 命名符合 PascalCase / camelCase / snake_case 规范

**故障示例**:
```
💀 [S01] Core Engines Existence
   message: 3 个引擎文件异常
   missing: ["AgencyAgentEngine.js", "CacheEngine.js"]
   fix: 运行 npm run generate:engines
```

---

#### L2: Syntax - 语法验证层

**职责**: 代码语法解析、静态分析、复杂度检查

**验证器**:

| ID | 名称 | 权重 | 说明 |
|----|------|------|------|
| Y01 | JavaScript Parsing | 10 | JS 语法正确性 |
| Y02 | Import Resolution | 8 | 模块导入解析 |
| Y03 | Circular Dependencies | 6 | 循环依赖检测 |
| Y04 | Code Complexity | 5 | 圈复杂度分析 |
| Y05 | Dead Code Detection | 3 | 死代码识别 |

**阈值**:
- 圈复杂度 (Cyclomatic): ≤ 10 (警告), ≤ 15 (失败)
- 认知复杂度 (Cognitive): ≤ 15
- 重复代码: ≤ 3%
- 最大文件行数: ≤ 500 行

**工具链**:
- ESLint (代码规范)
- Acorn (AST 解析)
- Madge (依赖分析)
- Plato (复杂度报告)

---

#### L3: Dependency - 依赖验证层

**职责**: 第三方依赖包管理、版本控制、安全审计

**验证器**:

| ID | 名称 | 权重 | 说明 |
|----|------|------|------|
| D01 | Node Modules | 10 | node_modules 完整性 |
| D02 | Package.json Validity | 8 | package.json 有效性 |
| D03 | Version Conflicts | 6 | 版本冲突检测 |
| D04 | Unused Dependencies | 4 | 未使用依赖清理 |
| D05 | Security Vulnerabilities | 10 | 安全漏洞扫描 |

**策略**:
- **锁定版本**: 使用 package-lock.json / yarn.lock
- **定期审计**: npm audit / yarn audit
- **依赖图谱**: 生成依赖关系图
- **许可证合规**: 检查 GPL/LGPL 等传染性许可证

---

#### L4: Configuration - 配置验证层

**职责**: 环境配置、基础设施、秘钥管理

**验证器**:

| ID | 名称 | 权重 | 说明 |
|----|------|------|------|
| C01 | Environment Files | 8 | 环境变量文件 |
| C02 | Docker Configuration | 6 | Docker 配置 |
| C03 | CI/CD Pipeline | 5 | 持续集成配置 |
| C04 | Secret Management | 10 | 秘钥管理 |
| C05 | Feature Flags | 3 | 功能开关 |

**安全要求**:
- 敏感配置不提交到版本控制
- 使用 .env.example 作为模板
- 秘钥使用 KMS/Vault 管理
- 配置变更需 Code Review

---

#### L5: Runtime - 运行时验证层

**职责**: 服务启动、健康检查、进程管理

**验证器**:

| ID | 名称 | 权重 | 说明 |
|----|------|------|------|
| R01 | Server Boot | 10 | 服务启动能力 |
| R02 | Port Binding | 8 | 端口绑定检查 |
| R03 | Process Health | 6 | 进程健康状态 |
| R04 | Memory Leak Check | 5 | 内存泄漏检测 |
| R05 | Graceful Shutdown | 4 | 优雅停机 |

**健康检查端点**:
```javascript
GET /health
{
  status: "healthy",
  uptime: 3600,
  memory: { used: "128MB", total: "512MB" },
  checks: {
    database: "ok",
    cache: "ok",
    external_api: "ok"
  }
}
```

---

#### L6: Functional - 功能验证层

**职责**: API 端点、业务逻辑、边界条件

**验证器**:

| ID | 名称 | 权重 | 说明 |
|----|------|------|------|
| F01 | API Routes | 10 | API 路由完整性 |
| F02 | Engine Instances | 8 | 引擎实例化检查 |
| F03 | Middleware Chain | 6 | 中间件链配置 |
| F04 | Error Handling | 8 | 错误处理覆盖 |
| F05 | Data Validation | 7 | 数据验证规则 |
| F06 | Business Logic | 9 | 业务逻辑正确性 |

**API 契约测试**:
```yaml
endpoint: /api/agent/execute
method: POST
request:
  taskType: "design_hvac"
  parameters:
    area: 100
response:
  status: 200
  body:
    success: true
    data:
      systemType: "FiveConstant"
      estimatedCost: 150000
```

---

#### L7: Integration - 集成验证层

**职责**: 数据库、缓存、消息队列、外部服务

**验证器**:

| ID | 名称 | 权重 | 说明 |
|----|------|------|------|
| I01 | Database Connection | 10 | 数据库连接 |
| I02 | Cache Service | 6 | 缓存服务 |
| I03 | External APIs | 7 | 外部 API |
| I04 | Message Queue | 5 | 消息队列 |
| I05 | Service Mesh | 4 | 服务网格 |

**测试策略**:
- **契约测试**: 验证服务间接口契约
- **集成测试**: 端到端流程测试
- **混沌工程**: 模拟故障注入
- **性能基准**: 建立性能基线

---

#### L8: Performance - 性能验证层

**职责**: 启动时间、响应延迟、吞吐量、资源利用率

**验证器**:

| ID | 名称 | 权重 | 说明 |
|----|------|------|------|
| P01 | Boot Time | 6 | 启动时间 |
| P02 | Response Time | 8 | 响应时间 |
| P03 | Throughput | 5 | 吞吐量 |
| P04 | Resource Usage | 5 | 资源使用 |
| P05 | Load Test | 4 | 负载测试 |

**性能阈值** (P95):

| 指标 | 目标 | 警告 | 失败 |
|------|------|------|------|
| 启动时间 | < 3s | < 5s | ≥ 5s |
| API 响应 | < 100ms | < 200ms | ≥ 200ms |
| 数据库查询 | < 50ms | < 100ms | ≥ 100ms |
| 内存占用 | < 512MB | < 1GB | ≥ 1GB |
| CPU 使用率 | < 50% | < 70% | ≥ 70% |

**压测配置**:
```yaml
load_test:
  duration: 5m
  ramp_up: 30s
  target_rps: 1000
  concurrent_users: 100
  scenarios:
    - name: api_health
      weight: 30
    - name: api_execute
      weight: 70
```

---

#### L9: Security - 安全验证层

**职责**: SAST、DAST、密钥管理、注入防护、访问控制

**验证器**:

| ID | 名称 | 权重 | 说明 |
|----|------|------|------|
| X01 | Hardcoded Secrets | 10 | 硬编码秘钥检测 |
| X02 | Input Validation | 8 | 输入验证 |
| X03 | CORS Configuration | 6 | CORS 配置 |
| X04 | Dependency Vulnerabilities | 10 | 依赖漏洞 |
| X05 | Injection Prevention | 8 | 注入防护 |

**安全扫描工具链**:
- **SAST**: SonarQube, Semgrep, CodeQL
- **DAST**: OWASP ZAP, Burp Suite
- **SCA**: Snyk, Black Duck, WhiteSource
- **秘钥扫描**: GitLeaks, TruffleHog
- **容器安全**: Trivy, Clair

**CWE Top 25 检查**:
- CWE-79: XSS
- CWE-89: SQL 注入
- CWE-94: 代码注入
- CWE-798: 硬编码凭证
- CWE-200: 信息泄露

---

## 质量门禁体系

### 3.1 门禁等级

```
                    QUALITY GATE HIERARCHY
                    
┌────────────────────────────────────────────────────────────┐
│                    💀 Gate 0: Critical                      │
│   零容忍: 安全漏洞 / 数据丢失 / 系统崩溃 / 核心功能失败       │
│   Action: BLOCK ｜ Notify: CTO, Security Lead              │
├────────────────────────────────────────────────────────────┤
│                     ❌ Gate 1: High                         │
│   必须修复: 核心功能失败 / 性能严重降级 / API 破坏           │
│   Action: BLOCK ｜ Notify: Tech Lead, PM                     │
├────────────────────────────────────────────────────────────┤
│                    ⚠️  Gate 2: Medium                        │
│   建议修复: 次要功能问题 / 性能警告 / 代码异味               │
│   Action: WARN ｜ Notify: Developer                         │
├────────────────────────────────────────────────────────────┤
│                     ℹ️  Gate 3: Low                          │
│   信息提示: 代码规范 / 文档 / 注释 / 优化建议                │
│   Action: PASS ｜ Notify: None                              │
├────────────────────────────────────────────────────────────┤
│                     ✅ Gate 4: Pass                           │
│   完全通过: 所有指标达标                                     │
│   Action: PASS ｜ Notify: Team                               │
└────────────────────────────────────────────────────────────┘
```

### 3.2 门禁规则配置

```javascript
// hammer-config.js
module.exports = {
  qualityGates: {
    critical: {
      failOn: ['CRITICAL'],
      maxIssues: 0,
      action: 'BLOCK'
    },
    high: {
      failOn: ['CRITICAL', 'HIGH'],
      maxHighIssues: 3,
      action: 'BLOCK'
    },
    medium: {
      failOn: ['CRITICAL', 'HIGH', 'MEDIUM'],
      maxMediumIssues: 10,
      action: 'WARN'
    },
    coverage: {
      minCodeCoverage: 85,
      minBranchCoverage: 80,
      action: 'WARN'
    },
    complexity: {
      maxCyclomatic: 10,
      maxCognitive: 15,
      action: 'WARN'
    }
  }
};
```

### 3.3 门禁执行流程

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   L1-L9      │────▶│   汇总评分   │────▶│  门禁判定   │
│  验证套件    │     │  加权计算    │     │  等级确定   │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                       ┌──────────────────────────┼──────────────────────────┐
                       │                          │                          │
                       ▼                          ▼                          ▼
                 ┌─────────┐               ┌─────────┐               ┌─────────┐
                 │  BLOCK  │               │  WARN   │               │  PASS   │
                 │  阻断   │               │  警告   │               │  通过   │
                 └────┬────┘               └────┬────┘               └────┬────┘
                      │                          │                          │
                      ▼                          ▼                          ▼
                 ┌─────────┐               ┌─────────┐               ┌─────────┐
                 │禁止合并 │               │允许合并 │               │自动部署 │
                 │通知管理层│              │标记风险 │               │生成报告 │
                 └─────────┘               └─────────┘               └─────────┘
```

---

## 执行模式

### 4.1 三种模式

```javascript
// strict 模式 - 工业级严格
const hammer = new Hammer({
  mode: 'strict',
  thresholds: {
    coverage: 0.90,        // 90% 覆盖率
    complexity: 8,         // 圈复杂度 < 8
    duplications: 2        // 重复 < 2%
  }
});

// normal 模式 - 标准开发
const hammer = new Hammer({
  mode: 'normal',
  thresholds: {
    coverage: 0.85,
    complexity: 10,
    duplications: 3
  }
});

// fast 模式 - 快速迭代
const hammer = new Hammer({
  mode: 'fast',
  thresholds: {
    coverage: 0.70,
    complexity: 15,
    duplications: 5
  },
  suites: ['L1', 'L2', 'L5']  // 仅核心层
});
```

### 4.2 执行策略

**串行执行 (Serial)**:
- 适用: 资源受限、依赖严格
- 优点: 资源占用低、易于调试
- 缺点: 执行时间长

**并行执行 (Parallel)**:
- 适用: 独立验证层
- 优点: 速度快、效率高
- 缺点: 资源占用高、并发问题难追踪

**混合执行 (Hybrid)**:
- L1-L3: 并行 (静态分析)
- L4-L9: 串行 (需要运行时环境)

### 4.3 CI/CD 集成

```yaml
# .github/workflows/hammer.yml
name: Hammer Validation

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  hammer:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install Dependencies
        run: npm ci
        
      - name: Run Hammer
        run: node hammer.js
        
      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: hammer-report
          path: hammer-reports/
          
      - name: Quality Gate
        run: |
          if grep -q '"level": "G0_CRITICAL"' hammer-reports/hammer-report.json; then
            echo "Quality Gate Failed: Critical issues found"
            exit 1
          fi
```

---

## 度量体系

### 5.1 质量分数计算

```
Quality Score = Σ(Weight_i × Status_i) / Σ(Weight_i) × 100

其中:
- Status_i = 1 (PASSED) 或 0 (FAILED)
- Weight_i = 验证器权重
```

**示例**:
```
验证器:       S01    Y01    D01    F01    X01
权重:         10     10     10     10     10
状态:         PASS   PASS   PASS   FAIL   PASS

Quality Score = (10+10+10+0+10) / 50 × 100 = 80
```

### 5.2 关键指标 (KPIs)

| 指标 | 目标 | 测量频率 | 可视化 |
|------|------|----------|--------|
| 质量分数 | ≥ 85 | 每次提交 | 仪表盘 |
| 代码覆盖率 | ≥ 85% | 每日 | 趋势图 |
| 平均圈复杂度 | ≤ 10 | 每次构建 | 热力图 |
| 技术债务率 | ≤ 5% | 每周 | 燃尽图 |
| 安全漏洞数 | 0 Critical | 实时 | 告警 |
| 平均修复时间 | < 4h | 实时 | SLA 仪表盘 |

### 5.3 趋势分析

```
质量分数趋势 (30天)

100 ┤                              ★ 95
 95 ┤        ★ 92           ★ 94
 90 ┤   ★ 88        ★ 91
 85 ┤                              ─── 目标线
 80 ┤
 75 ┤
    └────┬────┬────┬────┬────┬────┬────┬────┬
        W1   W2   W3   W4   W5   W6   W7   W8

技术债务增长

5% ┤
4% ┤              ╱╲
3% ┤         ╱╲╱  ╲
2% ┤    ╱╲╱        ╲
1% ┤╱╲╱
0% ┴────────────────────────────
```

---

## 最佳实践

### 6.1 项目初始化

```bash
# 1. 安装 Hammer
npm install @rysnova-bim/hammer --save-dev

# 2. 初始化配置
npx hammer init

# 3. 运行完整验证
npx hammer strike

# 4. 查看报告
cat hammer-reports/hammer-report.md
```

### 6.2 日常使用

```javascript
// 本地开发 - 快速检查
const hammer = new Hammer({ mode: 'fast' });
await hammer.strike();

// 预提交 - 标准检查
const hammer = new Hammer({ mode: 'normal' });
await hammer.strike();

// CI/CD - 严格检查
const hammer = new Hammer({ mode: 'strict' });
const result = await hammer.strike();
if (!result.gate.passed) {
  process.exit(1);
}
```

### 6.3 增量验证

```javascript
// 仅验证变更的文件
const hammer = new Hammer({
  incremental: true,
  changedFiles: ['server/core/AgencyAgentEngine.js']
});

// 跳过已通过层
const hammer = new Hammer({
  skipPassed: true,
  cacheResults: '.hammer-cache'
});
```

### 6.4 自定义验证器

```javascript
// 注册自定义验证器
hammer.registerValidator('L6_FUNCTIONAL', {
  id: 'F07',
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

### 6.5 团队协作

```
┌─────────────────────────────────────────────────────────────┐
│                      质量责任矩阵                             │
├─────────────────────────────────────────────────────────────┤
│ 角色           │  质量职责                                   │
├─────────────────┼─────────────────────────────────────────────┤
│ 开发者          │  本地运行 fast 模式，修复 L1-L3 问题         │
│ Tech Lead       │  审核 normal 报告，关注 L4-L6               │
│ 架构师          │  评审 strict 报告，优化 L7-L9               │
│ DevOps          │  配置 CI/CD 集成，维护门禁规则              │
│ 安全团队        │  监控 L9 安全层，处理漏洞告警                │
│ QA              │  分析质量趋势，制定改进计划                  │
└─────────────────┴─────────────────────────────────────────────┘
```

---

## 附录

### A. 常见问题 (FAQ)

**Q: Hammer 与 ESLint/Jest/Sonar 的关系？**
A: Hammer 是编排层，整合 ESLint(语法)、Jest(测试)、Sonar(分析) 等工具，统一输出和质量门禁。

**Q: 如何处理遗留项目的低质量分数？**
A: 使用 `baseline` 模式建立基线，设定改进目标，逐步提升分数。

**Q: 可以禁用某些验证层吗？**
A: 可以，通过 `disableSuite('L8')` 或在配置中设置 `enabled: false`。

### B. 配置参考

```javascript
// hammer.config.js - 完整配置示例
module.exports = {
  // 基础配置
  mode: 'strict',
  basePath: process.cwd(),
  parallel: true,
  failFast: false,
  
  // 超时配置
  timeouts: {
    syntax: 30000,
    runtime: 60000,
    functional: 120000,
    integration: 30000,
    performance: 60000
  },
  
  // 质量阈值
  thresholds: {
    coverage: 0.85,
    complexity: 10,
    duplications: 3,
    maintainability: 70,
    reliability: 90
  },
  
  // 报告配置
  reporting: {
    format: 'full',
    outputDir: './hammer-reports',
    artifacts: true
  },
  
  // 忽略模式
  ignore: {
    patterns: ['node_modules/**', '.git/**'],
    files: ['*.test.js', '*.spec.js']
  },
  
  // 扩展配置
  extensions: {
    'L6_FUNCTIONAL': {
      customValidators: ['./custom-validators']
    }
  }
};
```

---

**文档版本**: 3.0.0  
**最后更新**: 2026-04-19  
**维护团队**: Rysnova Engineering
