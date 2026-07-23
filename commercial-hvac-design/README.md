# 恒热商用暖通AI设计平台 MVP

> AI驱动的多能互补🔥 恒热商用暖通AI设计平台

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0

### 开发启动

#### Windows (一键启动)
```bash
start-dev.bat
```

#### 手动启动
```bash
# 1. 安装依赖
npm install
cd apps/api && npm install
cd ../web && npm install

# 2. 启动后端 (http://localhost:3002)
cd apps/api && npm run dev

# 3. 启动前端 (http://localhost:5173)
- **前端界面**: http://localhost:5173
- **API服务**: http://localhost:3002
- **经销商报价**: http://localhost:5173/quotation
- **设计院出图**: http://localhost:5173/drawings/export
- **项目报备**: http://localhost:5173/registrations
- **成交管理**: http://localhost:5173/orders
cd apps/web && npm run dev
```

### Docker部署
```bash
docker-compose up -d
```

## 📁 项目结构

```
commercial-hvac-design/
├── apps/
│   ├── api/                    # Express后端 API服务
│   │   ├── src/
│   │   │   ├── engines/        # 计算引擎 ⭐
│   │   │   │   └── HotWaterCalculationEngine.ts  # GB 50015-2019计算引擎
│   │   │   ├── routes/         # API路由
│   │   │   │   ├── calculations.ts   # 计算API
│   │   │   │   ├── equipment.ts      # 设备API
│   │   │   │   └── projects.ts       # 项目API
│   │   │   └── index.ts        # 入口
│   │   └── package.json
│   │
│   └── web/                    # React前端 界面
│       ├── src/
│       │   ├── components/     # 组件
│       │   │   └── Header.tsx
│       │   ├── pages/          # 页面
│       │   │   ├── HomePage.tsx           # 场景化首页
│       │   │   ├── ProjectCreate.tsx      # 项目创建向导
│       │   │   ├── CalculationResult.tsx  # 计算结果展示
│       │   │   └── EquipmentSelect.tsx    # 设备选型推荐
│       │   ├── App.tsx
│       │   └── main.tsx
│       └── package.json
│
├── docker-compose.yml          # Docker编排
└── README.md
```

## ✨ 核心功能

### MVP已实现功能

| 功能模块 | 状态 | 说明 |
|---------|------|------|
| **热水负荷计算引擎** | ✅ | 基于GB 50015-2019标准 |
| **24小时负荷曲线** | ✅ | 可视化展示 |
| **设备选型推荐** | ✅ | 经济型/标准型/豪华型三方案 |
| **场景化首页** | ✅ | 酒店/医院/学校/健身房 |
| **项目创建向导** | ✅ | 两步引导式输入 |
| **计算结果展示** | ✅ | 图表+公式+参数明细 |
| **经销商报价系统** | ✅ | 三档报价+真实成本测算+ROI分析 |
| **设计院出图系统** | ✅ | 系统原理图+平面布置图+材料清单 |
| **项目报备系统** | ✅ | 30天保护期+冲突检测+跟进记录 |
| **成交管理系统** | ✅ | 订单全流程+业绩统计+佣金管理 |

### API接口

#### 计算接口
```http
POST /api/calculations/hot-water
Content-Type: application/json

{
  "buildingType": "hotel",
  "unitCount": 200,
  "coldWaterTemp": 15,
  "hotWaterTemp": 60,
  "hourlyVariationCoeff": 2.33,
  "dailyWaterQuota": 160
}
```

#### 设备推荐
```http
POST /api/equipment/recommend
Content-Type: application/json

{
  "heatConsumption": 320,
  "ambientTemp": 15,
  "redundancy": 1.1
}
```

## 🏗️ 技术架构

### 技术栈
| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 18 + TypeScript + Ant Design | 企业级UI |
| 后端 | Node.js + Express | 轻量高效 |
| 计算引擎 | TypeScript 纯函数 | 精确可控 |
| 图纸引擎 | SVG 生成 | 矢量施工图 |
| 报价引擎 | 真实成本库 + ROI算法 | 经销商专用 |
| 部署 | Docker + Docker Compose | 一键启动 |

### 计算引擎核心公式

**设计小时耗热量 (GB 50015-2019)**
```
Qh = Kh × m × qr × (tr - tl) × C × ρ / 86400

式中:
Qh - 设计小时耗热量 (kW)
Kh - 小时变化系数
m - 计算单位数 (人数/床位数)
qr - 用水定额 (L/人·d 或 L/床·d)
tr - 设计热水温度 (℃)
tl - 设计冷水温度 (℃)
C - 水的比热容 4.187 kJ/(kg·℃)
ρ - 热水密度 0.983 kg/L
```

## 📐 设计亮点

学习海尔水暖通"六大数智化"模式：

| 设计模式 | 实现 |
|---------|------|
| **数智化引流** | 8大行业场景卡片式首页 |
| **数智化设计** | 引导式步骤+智能默认值 |
| **数智化支持** | 实时负荷曲线+公式展示 |
| **数智化培训** | 规范提示+计算说明 |
| **数智化服务** | 项目全生命周期管理 |
| **数智化施工** | 施工图纸+材料清单导出 |

### 商用核心功能

#### 经销商报价体系（美景舒适家模式）
| 功能 | 说明 | 商业价值 |
|------|------|---------|
| **三档报价** | 基础型/标准型/豪华型 | 满足不同客户预算 |
| **真实成本测算** | 材料成本+人工成本+利润分析 | 确保经销商利润空间 |
| **ROI计算器** | 投资回收期+年节省费用 | 帮助客户决策 |
| **智能推荐** | 68%客户选择标准型 | 提高转化率 |
| **报价单导出** | CSV格式材料清单 | 快速响应客户 |

#### 设计院出图系统（筑星云模式）
| 功能 | 说明 | 商业价值 |
|------|------|---------|
| **系统原理图** | SVG格式矢量图 | 专业设计交付 |
| **平面布置图** | 设备定位+管道走向 | 施工指导 |
| **材料清单** | 完整BOM表+重量统计 | 精准采购 |
| **技术规格书** | GB 50015-2019标准 | 规范合规 |
| **图纸导出** | SVG/CSV格式 | 便于打印和分享 |

#### 项目报备系统（渠道保护）
| 功能 | 说明 | 商业价值 |
|------|------|---------|
| **项目报备** | 客户信息+项目信息登记 | 获得保护期 |
| **30天保护期** | 自动计算到期日 | 防止内部抢单 |
| **冲突检测** | 手机号/客户名查重 | 避免重复报备 |
| **跟进记录** | 拜访/电话/报价记录 | 销售过程管理 |
| **延期申请** | 保护期延长申请 | 灵活应对 |
| **成交/丢单标记** | 报备闭环管理 | 数据统计 |

#### 成交管理系统（业绩追踪）
| 功能 | 说明 | 商业价值 |
|------|------|---------|
| **订单全流程** | 草稿→确认→生产→发货→安装→完成 | 状态可视化 |
| **付款管理** | 定金+尾款记录 | 收款跟踪 |
| **业绩统计** | 月度/季度业绩报表 | 激励销售 |
| **佣金计算** | 自动计算销售佣金 | 及时结算 |
| **经销商排名** | Top10业绩排行 | 良性竞争 |
| **订单导出** | 数据导出分析 | 管理决策 |

## 📝 开发计划

### 已完成 (Week 1-2)
- ✅ PRD文档编写
- ✅ 界面原型设计
- ✅ 项目架构搭建
- ✅ 核心计算引擎
- ✅ 基础API开发
- ✅ 前端界面实现

### 进行中 (Week 3-4)
- 🔄 单元测试编写
- 🔄 代码规范配置
- 🔄 性能优化
- 🔄 部署测试

### 待完成 (Week 5-6)
- ⏳ 制冷负荷计算
- ⏳ 更多建筑场景
- ⏳ 方案导出功能
- ⏳ 用户反馈收集

## 🤝 参与贡献

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

MIT License

---

**项目名称**: 恒热商用暖通AI设计平台  
**版本**: v1.0.0-MVP  
**更新时间**: 2026-04-13
