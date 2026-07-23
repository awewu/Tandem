# 瑞美舒适家居平台 - 部署与启动指南

## 📋 系统要求

- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0
- **操作系统**: Windows 10/11, macOS, Linux
- **内存**: 建议 8GB+
- **磁盘空间**: 建议 5GB+

## 🚀 快速启动

### 方式1: 多端口同步启动 (推荐)

一键启动所有服务：

```bash
# Windows
.\启动多端口服务.bat

# 或Node.js方式
npm run start:multi
```

启动的服务：
- 🌐 Web主服务: http://localhost:3000
- ⚡ 改图联动服务: WebSocket 端口3001
- 🔧 API微服务: http://localhost:3002
- 📁 静态资源服务: http://localhost:3003

### 方式2: 开发模式

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 或启动多服务开发模式
npm run dev:multi
```

### 方式3: 桌面版启动

```bash
# 同时启动Web服务和桌面版
npm run start:dual

# 仅启动桌面版
npm run start:desktop
```

## 📦 生产部署

### 步骤1: 安装依赖

```bash
npm install --production
```

### 步骤2: 配置环境变量

创建 `.env` 文件：

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://localhost:27017/rheem
JWT_SECRET=your-secret-key
REDIS_URL=redis://localhost:6379
```

### 步骤3: 启动服务

```bash
# 启动生产服务器
npm start

# 或使用PM2
pm2 start server-production.js --name "rheem-platform"
```

## 🧪 测试与质量门禁

### 运行测试

```bash
# 运行所有测试
npm test

# 生成覆盖率报告
npm run test:coverage

# 查看覆盖率报告
open coverage/lcov-report/index.html
```

### 覆盖率目标

- 分支覆盖率: >= 80%
- 函数覆盖率: >= 80%
- 行覆盖率: >= 80%
- 语句覆盖率: >= 80%

## 🌐 访问地址

启动后，可通过以下地址访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| 控制台 | http://localhost:3000 | 主控制台入口 |
| 改图联动 | http://localhost:3000/drawing-sync.html | 设计师/客户协同 |
| 模板库 | http://localhost:3000/template-library.html | 方案模板管理 |
| 数据备份 | http://localhost:3000/backup-management.html | 备份与恢复 |
| AI测试 | http://localhost:3000/ai-accuracy-test.html | 精度测试报告 |
| API文档 | http://localhost:3002/api/docs | API接口文档 |

## 📁 新增文件清单

本次交付新增的文件：

```
📄 public/drawing-sync.html          # 改图联动界面 (A1)
📄 public/template-library.html       # 方案模板库 (A2)
📄 public/backup-management.html      # 数据备份恢复 (A3)
📄 public/ai-accuracy-test.html     # AI精度测试 (A4)
📄 public/inline-styles-refactored.css # CSS重构 (B1)
📄 server/core/DrawingSyncEngine.js # WebSocket服务
📄 multi-port-launcher.js            # 多端口启动器
📄 启动多端口服务.bat                # Windows启动脚本
📄 jest.config.js                    # Jest测试配置
📄 test/setup.js                     # 测试环境设置
📄 test/DrawingSyncEngine.test.js    # 改图联动测试
📄 test/DeviceSelectionEngine.test.js # 设备选型测试
📄 test/integration/real-service.test.js # 真实服务测试
📄 DEPLOYMENT-GUIDE.md               # 本部署指南
```

## 🔧 故障排除

### 端口冲突

如果端口被占用，可修改 `multi-port-launcher.js` 中的端口配置。

### 服务启动失败

1. 检查Node.js版本: `node -v`
2. 检查端口占用: `netstat -ano | findstr :3000`
3. 查看日志: `logs/` 目录

### WebSocket连接失败

1. 确认改图联动服务已启动: http://localhost:3001/health
2. 检查防火墙设置
3. 确认浏览器支持WebSocket

## 📞 支持

遇到问题请联系技术支持团队。

---

**版本**: v1.0.0  
**更新日期**: 2026-04-08
