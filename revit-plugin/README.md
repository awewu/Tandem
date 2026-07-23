# Rysnova BIM Plugin for Revit

> 瑞美HVAC AI平台官方Revit插件 - 双向同步、原生族库映射

## 🎯 核心能力

| 功能 | 说明 |
|------|------|
| **从平台导入BIM** | 一键将平台设计方案导入Revit，自动转换为原生族实例 |
| **导出到平台** | 将Revit模型上传到平台进行AI分析、CFD仿真、碰撞检测 |
| **双向增量同步** | 智能差异检测，仅同步变更项；自动冲突解决 |
| **原生族库映射** | 12种HVAC设备类型预定义Revit Family映射 |
| **平台云端能力** | 直接调用平台BVH碰撞检测、CFD仿真、工程量统计 |

## 📦 项目结构

```
revit-plugin/
├── RysnovaBIMPlugin.csproj    # MSBuild项目文件
├── RysnovaBIM.addin           # Revit插件清单
├── README.md                   # 本文档
├── src/
│   ├── RysnovaBIMApp.cs       # 应用入口（注册Ribbon）
│   ├── Commands/               # 命令实现
│   │   ├── ImportBIMCommand.cs # 导入命令
│   │   ├── ExportBIMCommand.cs # 导出命令
│   │   ├── SyncBIMCommand.cs   # 双向同步
│   │   └── ...
│   ├── Services/               # 服务层
│   │   ├── RysnovaAPIClient.cs    # 平台API客户端
│   │   ├── FamilyMappingService.cs # 族库映射
│   │   ├── PipeMappingService.cs   # 管道映射
│   │   ├── BIMSyncService.cs       # 同步服务
│   │   └── SyncDiffEngine.cs       # 差异计算引擎
│   ├── Models/
│   │   └── BIMModels.cs        # 数据模型
│   └── UI/
│       ├── ProjectSelectionDialog.cs
│       ├── SyncPreviewDialog.cs
│       └── ProgressDialog.cs
├── Resources/                  # 图标资源
└── FamilyLibrary/              # 预置族库 (.rfa文件)
```

## 🛠️ 开发环境要求

- **Visual Studio 2022** (Community / Professional)
- **.NET Framework 4.8**
- **Autodesk Revit 2022/2023/2024 SDK**
- **NuGet包**: `Newtonsoft.Json 13.0.3`

## 🔨 构建步骤

### 1. 安装Revit SDK
下载并安装：https://www.autodesk.com/developer-network/platform-technologies/revit

### 2. 配置引用路径
编辑 `RysnovaBIMPlugin.csproj`，取消Revit API引用的注释：

```xml
<Reference Include="RevitAPI">
  <HintPath>$(ProgramFiles)\Autodesk\Revit 2024\RevitAPI.dll</HintPath>
  <Private>False</Private>
</Reference>
```

### 3. 构建项目
```powershell
cd revit-plugin
dotnet build -c Release
```

### 4. 部署插件
将以下文件复制到Revit插件目录 `%APPDATA%\Autodesk\Revit\Addins\2024\`：
- `RysnovaBIMPlugin.dll`
- `RysnovaBIM.addin`
- `Newtonsoft.Json.dll`
- `Resources/` (图标)
- `FamilyLibrary/` (族库)

### 5. 启动Revit验证
打开Revit，应在Ribbon中看到 **"Rysnova BIM"** 选项卡。

## 🌐 与平台联通

### 配置后端地址
首次使用，点击 **设置** 按钮配置：
- API地址: `http://localhost:3000`（本地）或 `https://platform.rheem.com`（生产）
- API Key: 从平台用户中心获取

### 测试连接
插件会自动调用 `GET /api/rysnova-bim-bim/projects` 验证连接。

## 📊 工作流示例

### 场景A：从平台导入设计方案
```
1. 用户在Web平台完成方案设计（含12台设备）
2. 在Revit中点击 "导入BIM方案"
3. 选择项目 RH-2026-001
4. 插件自动:
   - 加载12个Rheem原生Family
   - 创建FamilyInstance到对应坐标
   - 写入Rysnova参数（DeviceID/Power/Brand等）
   - 显示导入报告
5. Revit中得到完整的暖通模型
```

### 场景B：双向同步
```
1. 设计师在Revit中调整了3台设备位置
2. 同时,平台AI优化建议增加了1台分集水器
3. 用户点击 "双向同步"
4. 插件:
   - 拉取平台版本v5
   - 比对本地变更
   - 显示同步预览（3 modified, 1 added）
   - 检测到 AC-IN-02 位置冲突 → 用户选择 "保留Revit版本"
5. 应用合并:
   - 平台拉取: +1台分集水器
   - Revit上传: 3台位置变更
   - 服务端版本升级到 v6
```

### 场景C：调用平台云能力
```
1. Revit中模型完成
2. 点击 "碰撞检测"
3. 插件:
   - 提取所有HVAC设备和管道
   - 调用 POST /api/rysnova-bim/cloud/clash
   - 平台用BVH算法100ms完成检测
   - 返回硬碰撞2个、软碰撞5个
   - 在Revit视图中高亮显示问题点
```

## 📡 平台API契约（Sprint 5.1 命名空间统一）

> 所有 Revit 插件能力统一收敛到 `/api/rysnova-bim/*` 命名空间，避免历史双写 `rysnova-bim-bim` 路径。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/rysnova-bim/projects` | GET | 项目列表 |
| `/api/rysnova-bim/projects/:id` | GET | 项目详情 |
| `/api/rysnova-bim/projects/:id/sync` | POST | 增量同步（DesignSyncService） |
| `/api/rysnova-bim/projects/:id/history` | GET | 同步历史 |
| `/api/rysnova-bim/cloud/clash` | POST | 云端碰撞检测（BVH） |
| `/api/rysnova-bim/cloud/ifc` | POST | 云端 IFC 导出 |
| `/api/rysnova-bim/cloud/boq` | POST | 云端工程量统计 |
| `/api/rysnova-bim/artifacts` | POST | 创建产物 |
| `/api/rysnova-bim/artifacts/:id/download` | GET | 下载产物 |
| `/api/ai-design/propose` | POST | AI 方案生成（Sprint 4） |
| `/api/ai-design/verify` | POST | AI 方案确认（Sprint 4） |

## 🔄 增量同步算法

采用**三路合并**(Three-Way Merge)：

```
        baseline (上次同步基线)
         /        \
        v          v
   local变更   remote变更
        \        /
         v      v
        merged (合并结果)
```

冲突解决策略：
- **位置冲突** (>50mm): 默认采用Revit版本（设计师精准）
- **型号冲突**: 默认采用平台版本（产品库权威）
- **功率冲突**: 默认采用平台版本（计算结果）
- **删除冲突**: 提示用户决策

## 🧪 测试

### 后端测试（已通过）
```bash
node test/revit-sync-test.js
```

### 插件单元测试
推荐使用 Revit Test Runner 或 RTF (Revit Testing Framework)。

## 📈 性能指标

| 操作 | 目标 | 实测 |
|------|------|------|
| 导入100个设备 | <30s | ~15s |
| 导出当前模型 | <5s | ~2s |
| 增量同步 | <3s | ~1s |
| 碰撞检测100对象 | <1s | ~100ms |

## 🚀 部署到生产

```powershell
# 打包
dotnet publish -c Release -o publish/

# 创建MSI安装包（推荐使用WiX Toolset）
# 或者打包为ZIP分发

# 推送族库到平台云端
# Family文件统一管理
```

## 🆘 故障排查

| 问题 | 解决 |
|------|------|
| Ribbon未显示 | 检查 `.addin` 文件是否在 `%APPDATA%\Autodesk\Revit\Addins\` |
| 加载失败 | 查看 `journal.txt` 日志（位于Revit Journals目录） |
| API连接失败 | 检查防火墙、API Key、CORS配置 |
| Family加载失败 | 确认 `FamilyLibrary/` 中包含对应族文件 |

## 📞 联系

- 项目主页: https://platform.rheem.com
- 技术支持: dev-support@rheem.com
- GitHub Issues: 内部仓库

---

**版本**: 1.0.0  
**作者**: Rheem HVAC AI Team  
**许可**: Internal Use Only
