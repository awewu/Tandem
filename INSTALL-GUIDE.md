# 瑞美舒适家居设计平台 - 安装使用指南

## 系统要求

### 最低配置
- **操作系统**: Windows 10 (64位) 或 Windows 11
- **内存**: 8 GB RAM
- **硬盘空间**: 5 GB 可用空间
- **网络**: 宽带互联网连接
- **Node.js**: v16.0.0 或更高版本（开发环境）

### 推荐配置
- **操作系统**: Windows 11 (64位)
- **内存**: 16 GB RAM
- **硬盘空间**: 10 GB 可用空间 (SSD)
- **显示器**: 1920x1080 分辨率
- **网络**: 稳定的互联网连接

---

## 安装方式

### 方式一：使用安装程序（推荐）

#### 1. 下载安装包
获取安装文件：`瑞美舒适家居设计平台-1.0.0-setup.exe`

#### 2. 运行安装程序
1. 双击安装文件
2. 选择安装语言（简体中文）
3. 阅读并接受许可协议
4. 选择安装目录（默认：`C:\Program Files\瑞美舒适家居设计平台`）
5. 点击"安装"等待完成
6. 勾选"创建桌面快捷方式"
7. 点击"完成"

#### 3. 启动程序
- 双击桌面快捷方式
- 或在开始菜单搜索"瑞美舒适家居设计平台"

---

### 方式二：使用便携版

#### 1. 下载便携版
获取文件：`瑞美设计平台-便携版-1.0.0-x64.exe`

#### 2. 使用方法
1. 将文件复制到任意目录（如 `D:\瑞美设计平台`）
2. 双击运行即可，无需安装
3. 所有数据保存在同一目录下

#### 适用场景
- 需要在多台电脑使用
- 不想修改系统注册表
- U盘随身携带

---

### 方式三：源码运行（开发者）

#### 1. 环境准备
```bash
# 检查Node.js版本（需v16+）
node -v

# 检查npm版本（需v8+）
npm -v
```

#### 2. 克隆或解压源码
```bash
# 进入项目目录
cd personal-website

# 安装依赖
npm install
```

#### 3. 启动方式

**开发模式**（前后端分离）：
```bash
npm run dev
```
- 前端：http://localhost:3000
- 后端：http://localhost:5000

**生产模式**（桌面应用）：
```bash
# 方式1：直接启动桌面版
npm run start:desktop

# 方式2：先启动后端，再启动桌面
npm run start:dual

# 方式3：多端口启动
npm run start:multi
```

---

## 首次使用

### 1. 等待服务启动
首次启动可能需要 30-60 秒初始化：
- 启动后端服务器
- 初始化数据库
- 加载AI模型

### 2. 浏览器访问
程序启动后会自动打开浏览器，访问地址：
- 本地：`http://localhost:5000`
- 桌面版：内嵌浏览器窗口

### 3. 主要功能入口

| 功能 | 访问路径 | 说明 |
|------|----------|------|
| AI诊断 | `/pain-diagnosis-v3.html` | 48项痛点诊断 |
| 方案匹配 | `/solution-matching-v3.html` | 智能方案推荐 |
| 方案导出 | `/ppt-export.html` | PPT方案导出 |
| 设计工作区 | `/design-workspace-v3.html` | 绘图设计 |
| 后台管理 | `/admin-dashboard.html` | 系统管理 |

---

## 常见问题

### Q1: 启动时提示"Node.js未安装"
**解决**: 
1. 访问 https://nodejs.org/
2. 下载 LTS 版本（v18 或 v20）
3. 运行安装程序，一路下一步
4. 重启电脑后重试

### Q2: 端口被占用
**解决**:
```bash
# 查看占用5000端口的进程
netstat -ano | findstr :5000

# 结束占用进程（管理员权限）
taskkill /PID <进程ID> /F
```

或者修改 `server-production.js` 中的端口配置。

### Q3: PPT导出失败
**解决**:
1. 检查是否安装 `pptxgenjs` 依赖：
   ```bash
   npm list pptxgenjs
   ```
2. 如未安装：
   ```bash
   npm install pptxgenjs@^3.12.0
   ```

### Q4: 如何更新软件
**便携版**:
1. 备份 `exports` 和 `database` 目录
2. 下载新版本覆盖
3. 恢复备份数据

**安装版**:
1. 卸载旧版本
2. 安装新版本
3. 数据自动保留

---

## 文件结构说明

```
瑞美设计平台/
├── electron-main.js          # 桌面应用主进程
├── server-production.js      # 生产服务器
├── server/                   # 后端API
│   ├── core/                 # 核心引擎
│   │   ├── PainPointDiagnosisEngineV3.js  # AI诊断
│   │   ├── ExportEngine.js   # 导出引擎
│   │   └── EvolutionMechanismV3.js  # 进化机制
│   ├── api/                  # API路由
│   │   └── ppt-export-api.js # PPT导出API
│   └── index.js              # 服务器入口
├── public/                   # 前端页面
│   ├── ppt-export.html       # PPT导出界面
│   ├── pain-diagnosis-v3.html  # AI诊断
│   └── solution-matching-v3.html # 方案匹配
├── exports/                  # 导出文件
│   └── ppt/                  # PPT文件
├── database/                 # 本地数据库
└── logs/                     # 运行日志
```

---

## 技术支持

### 运行日志
查看问题时的日志文件：
- `logs/evolution-v3-tech.log` - 技术进化日志
- `logs/tech-competitive-analysis.json` - 竞争分析报告
- `logs/tech-intelligence.json` - 技术情报

### 联系方式
- 产品支持：通过软件内反馈功能
- 技术文档：查看 `TECH-COMPETITIVE-ANALYSIS-REPORT.md`

---

## 卸载

### 安装版卸载
1. 控制面板 → 程序和功能
2. 找到"瑞美舒适家居设计平台"
3. 点击卸载
4. 可选：删除用户数据（`%APPDATA%\瑞美舒适家居设计平台`）

### 便携版删除
直接删除整个目录即可，无残留。

---

## 版本历史

### v1.0.0 (2026-04-19)
- 初始发布
- 48项痛点AI诊断
- 三方案智能匹配
- 专业PPT方案导出
- 技术竞争进化机制

---

**文档版本**: v1.0.0  
**更新日期**: 2026-04-19
