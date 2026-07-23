# Rhautt Nexus / 瑞合数智枢纽

## 项目简介

Rhautt Nexus / 瑞合数智枢纽是品牌/厂家/营销资料中台软件平台，用于承载品牌运营、产品资料、DAM 素材、官网发布、市场营销和账号权限管理。

Rhautt Comfort / 瑞合瑞德暖通科技集团是客户/集团实例定位，不作为本软件系统的名称使用。

> **恒热 EVERHOT 官网**：建设/运维/迭代总纲见 [`docs/EVERHOT-WEBSITE-HANDBOOK.md`](docs/EVERHOT-WEBSITE-HANDBOOK.md)（应用目录 [`apps/everhot-cn/`](apps/everhot-cn/README.md)）。

对外产品与品牌口径：

- Rhautt Nexus / 瑞合数智枢纽：软件平台名称。
- Rhautt Comfort / 瑞合瑞德暖通科技集团：客户/集团实例定位。
- 瑞诺瓦 / Rysnova：独立经销商赋能软件厂商，交付实例适当位置标记 `Powered by Rysnova`。
- Rheem / Ruud / Everhot：设备品牌，进入瑞诺瓦舒适家系统方案的产品配置矩阵。

## 核心功能

### 双模式设计流程

- **快速估算模式**：3-5分钟出方案，适合现场谈单
- **精细化设计模式**：30分钟出施工级设计，包含详细图纸和材料清单

### 六大系统支持

- 五恒系统（恒温恒湿恒氧）
- 净水系统（全屋净水解决方案）
- 采暖系统（节能采暖方案）
- 热水系统（中央热水供应）
- 新风系统（全热交换新风）
- 除湿系统（智能除湿控制）

### AI智能功能

- 智能负荷计算
- 设备自动选型
- AI方案推荐
- 3D自动布局
- 碰撞检测优化

### 完整项目管理

- 方案版本管理
- 云端存储同步
- 多终端适配（Web/Pad/手机）
- 客户信息管理
- 分享协作功能

### 智能报价系统

- 多促销类型配置
- 实时价格计算
- 材料清单生成
- 报价单导出

## 技术架构

### 前端技术栈

- **React 18** + **TypeScript** - 现代化前端框架
- **Vite** - 快速构建工具
- **Tailwind CSS** - 实用优先的CSS框架
- **Three.js** + **React Three Fiber** - 3D渲染引擎
- **Zustand** - 轻量级状态管理
- **React Query** - 数据获取和缓存

### 后端技术栈

> 口径以 `PROJECT-CHARTER.md` 第 5 章为准。终态已锁定为 NestJS + Fastify + PostgreSQL；Express + MongoDB 为迁移期兼容主干，按域（auth → tenant → crm → quote）逐步下线。

**终态（目标架构）**

- **NestJS** + **Fastify** - 服务端框架（DDD 模块化单体，`services/api/`）
- **PostgreSQL** + **TypeORM** - 主数据库，行级安全（RLS）多租户隔离
- **MongoDB** - 文档库（诊断报告、AI 草稿、设计上下文、对话记录）
- **Redis** - 缓存 / 会话；**Temporal + Outbox** - 流程编排与跨域事件
- **JWT** - 身份认证（HttpOnly cookie）

**迁移期兼容主干（逐步退役）**

- **Node.js** + **Express**（`server-production.js`）+ **MongoDB / Mongoose**

### 开发工具

- **TypeScript** - 类型安全
- **ESLint** + **Prettier** - 代码规范
- **Docker** - 容器化部署

### 系统完整性与生产加固

- 立项宪章（单一事实源）：[PROJECT-CHARTER.md](PROJECT-CHARTER.md)
- 生产完成执行路线图：[docs/EXECUTION-ROADMAP-2026-07.md](docs/EXECUTION-ROADMAP-2026-07.md)
- 增长中枢（板块三 · AI 营销）蓝图：[docs/BOARD-3-NEXUS-GROWTH-BLUEPRINT.md](docs/BOARD-3-NEXUS-GROWTH-BLUEPRINT.md)
- 架构 Harness：[audit/architecture-harness.js](audit/architecture-harness.js)
- 系统完整性 Harness：[audit/system-integrity-harness.js](audit/system-integrity-harness.js)
- 设计系统真相源：[DESIGN.md](DESIGN.md)

```bash
npm run harness:all
npm run test:production-readiness
```

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- MongoDB >= 4.4
- npm >= 8.0.0

### 安装步骤

1. **克隆项目**

```bash
git clone <repository-url>
cd rheem-design-platform
```

1. **安装依赖**

```bash
npm install
```

1. **环境配置**

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息
```

1. **启动数据库**

```bash
# 确保MongoDB服务正在运行
mongod
```

1. **启动开发服务器**

```bash
# 同时启动前端和后端
npm run dev

# 或者分别启动
npm run dev:server  # 后端服务 (端口 5000)
npm run dev:client  # 前端服务 (端口 3000)
```

1. **访问应用**

- 前端：<http://localhost:3000>
- 后端API：<http://localhost:5000>

## 项目结构

```
rheem-design-platform/
├── apps/                         # 多应用 monorepo 目标结构
│   ├── public-portal/           # 瑞合瑞德集团官网
│   ├── consumer-diagnosis/     # 瑞诺瓦 AI 问诊
│   ├── customer-portal/        # 客户项目门户
│   ├── dealer-workbench/       # 经销商 / 业务控制台
│   ├── designer-workbench/     # 设计师成交工作台
│   ├── rysnova-bim-workbench/     # Rysnova 技术支持 / BIM
│   ├── rheem-cn/               # Rheem 中国独立品牌站
│   ├── ruud-cn/                # Ruud 中国独立品牌站
│   └── everhot-cn/             # Everhot 中国独立品牌站
├── src/                          # 前端源码（候选服务面）
│   ├── components/               # 通用组件
│   │   ├── Layout.jsx          # 主布局组件
│   │   ├── Sidebar.jsx         # 侧边栏
│   │   ├── Header.jsx          # 顶部导航
│   │   └── MobileMenu.jsx      # 移动端菜单
│   ├── pages/                   # 页面组件
│   │   ├── auth/              # 认证页面
│   │   ├── design/            # 设计模块
│   │   ├── projects/          # 项目管理
│   │   ├── devices/           # 设备库
│   │   └── Dashboard.jsx      # 工作台
│   ├── services/               # API服务
│   ├── stores/                 # 状态管理
│   ├── hooks/                  # 自定义钩子
│   ├── utils/                  # 工具函数
│   └── types/                  # TypeScript类型定义
├── server/                      # 后端源码
│   ├── models/                 # 数据模型
│   │   ├── User.js            # 用户模型
│   │   ├── Project.js         # 项目模型
│   │   └── Device.js          # 设备模型
│   ├── routes/                 # API路由
│   │   ├── auth.js            # 认证路由
│   │   ├── projects.js        # 项目路由
│   │   ├── devices.js         # 设备路由
│   │   └── design.js          # 设计路由
│   ├── middleware/             # 中间件
│   │   └── auth.js            # 认证中间件
│   └── index.js                # 服务器入口
├── public/                      # 静态资源
├── uploads/                     # 文件上传目录
├── logs/                        # 日志文件
└── docs/                        # 项目文档
```

## 核心功能说明

### 1. 用户认证

- 支持账号密码登录和短信验证码登录
- 经销商注册审核机制
- 角色权限管理（管理员、经理、设计师、销售）
- 账号安全保护（异地登录提醒、失败锁定）

### 2. 快速估算

- 3-5分钟完成基础方案设计
- 基于户型和需求的AI推荐
- 简易3D展示
- 预估报价输出

### 3. 精细化设计

- 详细户型绘制（手绘/CAD导入/模板）
- 专业负荷计算（符合国家标准）
- 智能设备选型
- 3D布局设计
- 完整材料清单
- 精准报价方案

### 4. 设备库管理

- 瑞美全系产品参数预设
- 第三方产品审核机制
- 设备收藏和分类
- 价格和库存管理

### 5. 项目管理

- 方案版本控制
- 云端存储同步
- 项目分享协作
- 客户信息管理

## API文档

## 数据库后端架构

面向上线规模（500+ 经销商并发、2000+ 设计/销售人员、10万+ 用户/客户档案）的数据库后端设计见：

- PostgreSQL 迁移与行级安全：[database/postgres/migrations/](database/postgres/migrations/)（001–008，含 RLS 004/005、auth/PIPL 007）

### 认证接口

- `POST /api/auth/login` - 账号密码登录
- `POST /api/auth/login-sms` - 短信验证码登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/send-sms` - 发送验证码

### 项目接口

- `GET /api/projects` - 获取项目列表
- `POST /api/projects` - 创建项目
- `GET /api/projects/:id` - 获取项目详情
- `PUT /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目

### 设备接口

- `GET /api/devices` - 获取设备列表
- `GET /api/devices/:id` - 获取设备详情
- `POST /api/devices` - 添加第三方设备
- `PUT /api/devices/:id` - 更新设备

### 设计接口

- `POST /api/design/quick/estimate` - 快速估算
- `POST /api/design/load/calculation` - 负荷计算
- `POST /api/design/equipment/recommendation` - 设备推荐
- `POST /api/design/layout/generate` - 3D布局生成

## 部署说明

### Docker部署

```bash
# 构建镜像
docker build -t rheem-platform .

# 运行容器
docker run -p 3000:3000 -p 5000:5000 rheem-platform
```

### 生产环境部署

1. 配置环境变量
2. 构建前端资源
3. 启动MongoDB服务
4. 运行后端服务
5. 配置Nginx反向代理

## 开发指南

### 代码规范

- 使用TypeScript进行类型检查
- 遵循ESLint和Prettier配置
- 组件采用函数式写法
- 使用React Hooks管理状态

### 提交规范

```bash
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建工具或辅助工具的变动
```

### 分支管理

- `main` - 主分支，用于生产环境
- `develop` - 开发分支
- `feature/*` - 功能分支
- `hotfix/*` - 热修复分支

## 许可证

本项目为瑞美公司内部使用，未经授权不得外传。

## 联系方式

- 开发团队：<dev@rheem.com>
- 技术支持：<support@rheem.com>
- 项目地址：[内部Git仓库]

---

© 2024 Rhautt Comfort. All rights reserved.
