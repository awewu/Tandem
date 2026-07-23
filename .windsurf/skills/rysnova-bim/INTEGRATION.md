# Rysnova 集成文档

## 集成状态

✅ **集成完成** | 📅 2026-04-18 | 🎯 与瑞美HVAC AI平台深度整合

---

## 一、集成架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     瑞美HVAC AI平台                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Master Agent (总指挥)                                         │
│  └── 开发组                                                     │
│      ├── Arch-Agent (系统架构) ✅ 已连接                        │
│      ├── BE-Lead (后端API) ✅ 已连接                            │
│      ├── FE-Lead (前端界面) ✅ 已连接                         │
│      └── 🆕 Rysnova-Team (3D暖通专业) ✅ 已集成              │
│          ├── Rysnova3DEngine    → /api/rysnova-bim/pipe-routing   │
│          ├── RysnovaCalcEngine  → /api/rysnova-bim/calculation  │
│          ├── RysnovaCodeEngine  → /api/rysnova-bim/code-check     │
│          └── RysnovaBIMEngine   → /api/rysnova-bim/bim-integration│
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  前端界面 (hvac-dashboard.html)                                  │
│  └── 🆕 Rysnova模块 ✅ 已添加                                 │
│      ├── 完整工作流测试按钮                                     │
│      ├── 专业计算测试按钮                                       │
│      ├── 规范检查测试按钮                                       │
│      └── 健康检查链接                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、API端点清单

| 端点 | 方法 | 权限 | 功能 | 引擎 |
|------|------|------|------|------|
| `/api/rysnova-bim/design-workflow` | POST | designer, store_admin | 完整8阶段设计工作流 | RysnovaAgent |
| `/api/rysnova-bim/quick-design` | POST | 任意用户 | 快速概念设计 (5-10分钟) | RysnovaAgent |
| `/api/rysnova-bim/pipe-routing` | POST | designer | 3D管道路由 (A*算法) | Rysnova3DEngine |
| `/api/rysnova-bim/calculation` | POST | 任意用户 | 专业计算全套 | RysnovaCalcEngine |
| `/api/rysnova-bim/code-check` | POST | 任意用户 | 规范合规检查 | RysnovaCodeEngine |
| `/api/rysnova-bim/bim-integration` | POST | designer, store_admin | BIM集成导出 | RysnovaBIMEngine |
| `/api/rysnova-bim/clash-detection` | POST | 任意用户 | 碰撞检测 | Rysnova3DEngine |
| `/api/rysnova-bim/health` | GET | 任意用户 | 健康状态检查 | RysnovaAgent |

---

## 三、前端集成

### 新增模块位置
文件: `public/hvac-dashboard.html`

```html
<div class="card card-fullwidth card-rysnova-bim">
  <div class="card-title">
    🏗️ Rysnova 3D暖通专业架构
    <span class="tag tag-premium">NEW</span>
  </div>
  <!-- API列表 + 测试按钮 -->
</div>
```

### 新增JavaScript函数
- `testRysnovaWorkflow()` - 测试完整工作流
- `testRysnovaCalculation()` - 测试专业计算
- `testRysnovaCodeCheck()` - 测试规范检查

---

## 四、Master Agent集成

### 团队配置
位置: `MasterAgent-Management.js`

```javascript
rysnova-bimTeam: {
  team: 'Rysnova 3D暖通专业组',
  lead: 'Rysnova-Lead',
  status: '新建集成中',
  priority: '高',
  deadline: '2026-05-01',
  capabilities: [
    '3D管道自动路由 (A*算法)',
    'EnergyPlus能耗模拟',
    'GB/ASHRAE规范检查',
    'BIM碰撞检测',
    '4D施工模拟',
    'Revit/DWG导出'
  ],
  engines: ['Rysnova3DEngine', 'RysnovaCalcEngine', 'RysnovaCodeEngine', 'RysnovaBIMEngine'],
  location: '.windsurf/skills/rysnova-bim/'
}
```

---

## 五、协作接口

### 输入接口

| 来源 | 数据 | 用途 |
|------|------|------|
| Arch-Agent | 系统架构参数 | 确定3D设计技术方案 |
| PM-Analyst | 用户需求/PRD | 生成设计输入条件 |
| BE-Lead | API接口定义 | 计算结果输出格式 |
| 现有引擎 | 基础设计数据 | Rysnova深度优化 |

### 输出接口

| 目标 | 数据 | 用途 |
|------|------|------|
| FE-Lead | 3D模型数据 | Web 3D可视化 |
| BE-Lead | 计算结果JSON | 存储/进一步处理 |
| QA-Lead | 合规报告 | 质量验收依据 |
| BIM系统 | IFC/DWG文件 | 施工图交付 |

---

## 六、使用示例

### 示例1: 完整设计工作流

```javascript
// 前端调用
const response = await fetch('/api/rysnova-bim/design-workflow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectName: '上海浦东三居项目',
    buildingModel: { format: 'IFC', data: buildingData },
    hvacSystems: { type: 'vrf', capacity: 15000 },
    equipmentList: [...],
    pipeSpecs: [...],
    climateZone: 'Shanghai',
    exports: ['IFC', 'DWG', 'GLTF']
  })
});

const result = await response.json();
// result.data: 项目报告 + 8阶段结果 + 统计信息
```

### 示例2: 快速设计

```javascript
const response = await fetch('/api/rysnova-bim/quick-design', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    building: { type: 'residential', area: 120 },
    systems: { type: 'vrf' },
    area: 120
  })
});

const result = await response.json();
// result.mode: 'quick'
// 5-10分钟返回概念方案
```

### 示例3: 规范检查

```javascript
const response = await fetch('/api/rysnova-bim/code-check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectName: '测试项目',
    buildingType: 'residential',
    area: 120,
    system: { type: 'vrf', capacity: 15000 },
    indoorParams: { coolingTemp: 26, heatingTemp: 20 },
    climateZone: 'Shanghai'
  })
});

const result = await response.json();
// result.compliance: { percentage: 96, grade: 'A' }
// result.data: 详细合规报告
```

---

## 七、与现有系统的协同

### 现有HVAC引擎 → Rysnova增强

| 现有能力 | Rysnova增强 | 协同方式 |
|----------|--------------|----------|
| WaterSystemEngine | + 3D管道路由 | 基础设计 → Rysnova细化 |
| HeatingSystemEngine | + 水力计算(EPANET) | 负荷数据 → Rysnova验证 |
| AirConditioningEngine | + CFD气流模拟 | 方案设计 → Rysnova优化 |
| HVAC3DVisualization | + BIM集成 | 可视化 → Rysnova导出 |
| AIConsultantEngine | + 规范检查 | 三方案 → Rysnova合规验证 |

### 数据流向

```
用户输入 → AI问诊 → 三方案推荐
                ↓
         选中方案 → 基础引擎设计
                ↓
         初步结果 → Rysnova深度优化
                ↓
         3D/BIM → 工程量 → 报价
```

---

## 八、交付物清单

### 代码文件
- ✅ `RysnovaAgent.js` - 主控Agent
- ✅ `Rysnova3DEngine.js` - 3D设计引擎
- ✅ `RysnovaCalcEngine.js` - 专业计算引擎
- ✅ `RysnovaCodeEngine.js` - 规范检查引擎
- ✅ `RysnovaBIMEngine.js` - BIM集成引擎

### 配置文件
- ✅ `config.json` - 能力配置
- ✅ `README.md` - 架构说明
- ✅ `INTEGRATION.md` - 集成文档 (本文档)

### 集成点
- ✅ MasterAgent-Management.js - 团队配置
- ✅ server-production.js - 8个API端点
- ✅ hvac-dashboard.html - 前端模块 + 测试函数

---

## 九、后续开发计划

### Phase 1: 核心能力完善 (本周)
- [ ] 实现3D路由算法核心逻辑
- [ ] 对接EnergyPlus计算接口
- [ ] 完善GB50736规范检查规则
- [ ] 实现IFC导出基础功能

### Phase 2: 深度集成 (下周)
- [ ] 与现有引擎数据格式统一
- [ ] 建立自动工作流触发
- [ ] 实现从AI问诊到Rysnova的自动化

### Phase 3: 生产就绪 (本月)
- [ ] 完整测试覆盖
- [ ] 性能优化
- [ ] 文档完善

---

## 十、关键联系

| 角色 | Agent | 职责 |
|------|-------|------|
| Master Agent | Hermes | 统筹协调 |
| Arch-Agent | Arch | 技术架构 |
| BE-Lead | BE-Lead | 后端接口 |
| FE-Lead | FE-Lead | 前端集成 |
| **Rysnova-Lead** | **RysnovaAgent** | **专业设计** |

---

**状态**: ✅ 集成完成，等待核心能力实现  
**集成Agent**: Hermes + Rysnova Team  
**交付时间**: 2026-04-18
