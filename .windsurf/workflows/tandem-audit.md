---
description: Tandem 项目全面验收 — PRD/宪章合规 + VI合规 + 功能闭环 + 测试验证
---

# Tandem 项目验收工作流 `/tandem-audit`

## 用途
每次功能迭代结束后执行，确保代码围绕 PRD 和 MANIFESTO 运行，记录问题，驱动修复。

---

## Step 1：编译 + 单测基线（自动可跑）

```powershell
# 类型检查（忽略 vendor/paperclip 的 @paperclipai/* 缺模块错）
npx tsc --noEmit 2>&1 | Where-Object { $_ -notmatch "vendor/paperclip" }

# 单元测试全跑
npx vitest run
```

**验收门控**：TSC 0 错，Vitest 全绿。任何失败阻塞后续步骤。

---

## Step 2：VI 合规扫描（设计 token 检查）

```powershell
# 扫描 IM 模块所有硬色残留（白名单排除物理白色用途）
Select-String -Path "e:\Hermes\components\im\*.tsx","e:\Hermes\app\im\page.tsx" `
  -Pattern "bg-white|slate-[0-9]|gray-[0-9]" `
  | Where-Object { $_.Line -notmatch "text-white|border-white|from-white|ring-white|/white|shadow.*white" } `
  | Select-Object Filename, LineNumber, Line

# 扫描全局（排除 vendor）
Select-String -r -Include "*.tsx","*.ts" `
  -Path "e:\Hermes\app","e:\Hermes\components" `
  -Pattern "bg-white|slate-[0-9]" `
  | Where-Object { $_.Line -notmatch "text-white|border-white|ring-white" } `
  | Select-Object Filename, LineNumber | Format-Table
```

**验收门控**：IM 相关文件 0 命中。其他模块逐步清理，记录剩余数。

---

## Step 3：PRD 功能闭环检查（人工 + 代码 grep）

检查以下核心闭环，每条需要 grep 到对应实现：

| # | 功能 | 检查点 |
|---|---|---|
| P1 | OKR 真 rollup | `propagateRollupFromKr` 在 checkins route 被调用 |
| P2 | 消息设置持久化 | `updateMemberSettings` in `lib/im/service.ts` |
| P3 | pinnedChat 置顶排序 | `listMyChannels` sort 含 `pinnedChat` |
| P4 | @我 精确计数 | `hasUnreadMention` in `ImMembership` |
| P5 | CA-13 决策飞轮 | `recordDecision` 出现在 5 个入口 |
| P6 | proposeAction 宪法A | `__company__` userId 被拦截不能作为 proposer |
| P7 | 部门树 AddMembers | `AddMembersDialog` 按 `departmentId` 分组 |
| P8 | 消息未读清零 | `markChannelRead` 在 `loadMessages` 后被调用 |

```powershell
# 批量 grep 验证（示例）
Select-String -Path "e:\Hermes\lib\im\service.ts" -Pattern "pinnedChat" | Select-Object LineNumber, Line
Select-String -Path "e:\Hermes\lib\im\service.ts" -Pattern "hasUnreadMention" | Select-Object LineNumber, Line
Select-String -Path "e:\Hermes\lib\types\im.ts" -Pattern "hasUnreadMention" | Select-Object LineNumber, Line
```

---

## Step 4：宪章（MANIFESTO）红线核查

三条红线（宪章 v2.0 §1/§13/§15）：

```powershell
# 红线1：双轨分离 — 活跃度不挂钩金钱/晋升
Select-String -r -Include "*.ts","*.tsx" -Path "e:\Hermes" `
  -Pattern "salary|bonus|promotion.*active|active.*rank" | Select-Object Filename, Line

# 红线2：宪法A — 中央AI不能是 proposer
Select-String -Path "e:\Hermes\lib\ontology\propose-action.ts" -Pattern "__company__" | Select-Object LineNumber, Line

# 红线3：baseline-guard 阈值来自 CompanyBrainVersion（非硬编码）
Select-String -Path "e:\Hermes\lib\persona\company-brain-version.ts" -Pattern "getActiveBrainVersion" | Select-Object LineNumber, Line
```

---

## Step 5：空架子检测（假闭环防止）

检查以下模式是否存在真实实现（非 TODO / console.log 占位）：

```powershell
# 找所有 TODO 和 FIXME
Select-String -r -Include "*.ts","*.tsx" -Path "e:\Hermes\lib","e:\Hermes\app" `
  -Pattern "TODO|FIXME|NOT IMPLEMENTED|throw new Error\('not implemented'\)" `
  | Select-Object Filename, LineNumber, Line | Format-Table -Wrap

# 找纯 console.log 替代实现的空函数
Select-String -r -Include "*.ts" -Path "e:\Hermes\lib" `
  -Pattern "console\.log.*stub|stub.*console\.log" | Select-Object Filename, Line
```

---

## Step 6：数据库安全检查

```powershell
# 确认没有 db:push 被调用
Select-String -r -Include "*.ts","*.json","*.ps1" -Path "e:\Hermes" `
  -Pattern "db:push|drizzle-kit push" `
  | Where-Object { $_.Filename -notmatch "node_modules" } | Select-Object Filename, Line

# 确认新表变更用 IF NOT EXISTS DDL
Select-String -r -Include "*.ts","*.mjs" -Path "e:\Hermes\scripts","e:\Hermes\lib\db" `
  -Pattern "CREATE TABLE|ALTER TABLE" | Select-Object Filename, LineNumber, Line
```

---

## Step 7：生成验收报告

执行以上步骤后，输出以下格式报告：

```
## Tandem 验收报告 [日期]

### 基线
- TSC：[0 错 / N 错]
- Vitest：[全绿 XXXX 个 / N 失败]

### VI 合规
- IM 模块硬色残留：[0 / N 处]
- 全局残留（待清理）：[N 处，文件列表]

### PRD 功能闭环
- P1~P8：[✅ / ❌ 每条结果]

### 宪章红线
- 红线1 双轨分离：[通过 / 警告]
- 红线2 宪法A：[通过 / 警告]
- 红线3 baseline-guard：[通过 / 警告]

### 空架子
- TODO/FIXME 数：[N 条，列关键路径]
- 影响生产的空架子：[0 / N]

### 遗留问题（下迭代优先）
1. [问题描述 + 文件位置]
```
