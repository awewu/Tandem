# 恒热商用暖通AI设计平台 - 修复指南

## 🚀 一键修复（推荐）

直接运行项目自带的启动脚本：

```powershell
# Windows PowerShell
cd c:\Users\steve\CascadeProjects\personal-website\commercial-hvac-design
.\start-dev.bat
```

脚本会自动完成：
1. ✅ 检查 Node.js 环境
2. ✅ 安装根目录依赖
3. ✅ 安装 API 服务依赖
4. ✅ 安装前端依赖
5. ✅ 启动开发服务器

---

## 🔧 手动修复步骤

如果一键脚本遇到问题，按以下步骤手动修复：

### 步骤 1: 安装根目录依赖

```powershell
cd c:\Users\steve\CascadeProjects\personal-website\commercial-hvac-design
npm install
```

**预期输出**:
```
added XX packages in XXs
```

### 步骤 2: 安装 API 依赖

```powershell
cd apps/api
npm install
```

**验证**: 检查 `apps/api/node_modules` 目录是否创建

### 步骤 3: 安装前端依赖

```powershell
cd ../web
npm install
```

**验证**: 检查 `apps/web/node_modules` 目录是否创建

### 步骤 4: 启动服务

**终端 1 - 启动 API**:
```powershell
cd apps/api
npm run dev
```

**预期输出**:
```
🚀 API Server running on port 3002
📊 Health check: http://localhost:3002/health
```

**终端 2 - 启动前端**:
```powershell
cd apps/web
npm run dev
```

**预期输出**:
```
VITE v4.x.x ready in XXX ms
➜ Local: http://localhost:5173/
```

---

## ✅ 修复验证清单

### 基础验证

- [ ] `npm install` 无错误完成
- [ ] `apps/api/node_modules` 目录存在
- [ ] `apps/web/node_modules` 目录存在
- [ ] API 服务启动成功 (port 3002)
- [ ] 前端服务启动成功 (port 5173)

### 功能验证

- [ ] 首页加载正常 http://localhost:5173
- [ ] API 健康检查 http://localhost:3002/health
- [ ] 热水负荷计算功能正常
- [ ] 设备选型功能正常
- [ ] 经销商报价功能正常
- [ ] 设计院出图功能正常
- [ ] 项目报备功能正常
- [ ] 成交管理功能正常

---

## 🐛 常见问题排查

### 问题 1: 'node' 不是内部或外部命令

**原因**: Node.js 未安装或未添加到 PATH

**解决**:
1. 下载安装 Node.js 18+ https://nodejs.org/
2. 重启终端
3. 验证: `node --version`

### 问题 2: npm install 卡住/超时

**解决**:
```powershell
# 使用淘宝镜像加速
npm config set registry https://registry.npmmirror.com
npm install
```

### 问题 3: 端口被占用

**解决**:
```powershell
# 查找占用 3002 端口的进程
netstat -ano | findstr :3002

# 结束进程 (将 <PID> 替换为实际进程ID)
taskkill /PID <PID> /F
```

### 问题 4: TypeScript 编译错误

**解决**:
```powershell
cd apps/api
npx tsc --noEmit
```

检查错误信息并修复。

---

## 📊 修复后状态

### 代码质量

| 指标 | 修复前 | 修复后 | 状态 |
|------|--------|--------|------|
| 依赖安装 | ❌ 未安装 | ✅ 已安装 | 待执行 |
| TS配置 | ⚠️ 警告 | ✅ 已修复 | 完成 |
| CSS警告 | ⚠️ 90+处 | ⚠️ 90+处 | MVP可接受 |
| 未使用变量 | ⚠️ 10处 | ⚠️ 10处 | 不影响运行 |

### 功能模块

| 模块 | 状态 |
|------|------|
| 热水负荷计算 | 🟡 待验证 |
| 设备选型 | 🟡 待验证 |
| 经销商报价 | 🟡 待验证 |
| 设计院出图 | 🟡 待验证 |
| 项目报备 | 🟡 待验证 |
| 成交管理 | 🟡 待验证 |

---

## 📞 获取帮助

如果以上步骤无法解决问题：

1. 查看完整问题报告: `DELIVERY-ISSUES-REPORT.md`
2. 检查 ITERATION-LOG 了解开发历史
3. 提供错误日志寻求支持

---

**修复时间预估**: 5-10 分钟（依赖网络速度）
