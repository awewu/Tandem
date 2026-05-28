# Tandem · 完整试用指南

> 本指南覆盖**已跑通**的所有功能。优化项见 `progress.txt` / 复盘总结。

---

## 1️⃣ 启动

```powershell
# 已自动启动在 3002 端口
# 如未运行：
npm run dev
```

打开：**http://localhost:3002**

---

## 2️⃣ 登录

```
账号: admin@tandem.local
密码: Test1234!!
```

---

## 3️⃣ 核心路径（必试）

### A. AI 真实接通验证（DeepSeek 已配 ✅）

| 步骤 | URL | 期望现象 |
|---|---|---|
| 看模型设置 | `/settings/llm` | 已注册 Provider 显示 `deepseek-v3` 绿标 |
| 个人 AI 切换 | `/settings/llm` → 个人AI 标签 | `Persona 对话` 选 `deepseek-v3` → 保存 |
| IM 触发自动回复 | `/im` | 进任意频道发消息 → AI 分身用 **真实 DeepSeek** 回复 |
| 决议生成 | `/convergence/new` | 输入议题 → 真实 LLM 出 3+1 选项 |

> 🎯 验证 1.08 秒响应：`node --env-file=.env.local scripts/test-llm.mjs`

### B. Persona 拿捏闭环（① ② ③ ④）

| 阶段 | URL | 操作 |
|---|---|---|
| ① **观察** | `/persona/me` | 看 Persona 阶段（newborn → partner）+ 拿捏老板度 |
| ② **评分** | `/persona/me` | bossCaptureScore + decisionHistory 每次决策更新 |
| ③ **代行** | `/persona/me/proxy-actions` | 24h 否决窗口 / 立即确认 / 否决 |
| ④ **反馈** | 同上页面 | 已执行的代行点 👍 / 👎 → bossCaptureScore 实时变化 |

**端到端测试链路：**
```
1. /im 发消息触发 IM 自动回复
2. → 在 /persona/me/proxy-actions 看到一条 awaiting_veto 状态
3. → 点 "立即确认" → 状态变 executed
4. → 点 👍 / 👎 → 看到 "✓ bossCaptureScore 已更新"
5. → 回 /persona/me 看 score 数字变化
```

### C. 协同模块（飞书追赶项）

| 模块 | URL | 状态 |
|---|---|---|
| 议事室 | `/convergence` | ✅ 真实 LLM |
| 5min 日报 | `/checkin` | ✅ AI 起草 |
| OKR / KR | `/okr` | ✅ |
| IM 频道 | `/im` | ✅ 真实 LLM 自动回复 |
| 文档 | `/docs` | ✅ Yjs 协作（需另起 server） |
| 日程 | `/calendar` | ✅ 基础 CRUD |
| 云盘 | `/drive` | ✅ 基础 CRUD |
| 搜索 | `/search` | ✅ 跨模块 |
| 通知 | `/notifications` | ✅ |
| 智能信号 | `/signals` | ✅ |

### D. 决议族谱

| URL | 说明 |
|---|---|
| `/convergence/[id]` | 单条决议详情 + 议事链 |
| `/convergence/[id]/family-tree` | 决议族谱（PIPL §13 24h 否决窗口可视化） |

### E. 管理员功能

| URL | 说明 |
|---|---|
| `/admin/skills` | Skills 治理（红黄绿区审批） |
| `/admin/audit` | 审计日志 hash chain |
| `/admin/observability` | TAF Router 健康 / Token 用量 |
| `/settings/llm` → 中央AI | 全租户默认模型配置 |

---

## 4️⃣ 切换模型测试（推荐流程）

```
1. /settings/llm
2. 个人AI 标签 → "Persona 对话" 选 deepseek-v3 → 保存
3. /im 发消息 → 看后端 console: [boot] LLM providers registered: deepseek-v3
4. 后端日志会打印实际调用的 provider
```

如果你**有其他 API key**（Kimi/Qwen/Doubao），加到 `.env.local`：

```bash
# Kimi
KIMI_API_KEY=sk-xxxxx
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=moonshot-v1-32k

# 通义千问
QWEN_API_KEY=sk-xxxxx
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-max
```

重启 `npm run dev` → 设置页就能选了。

---

## 5️⃣ 已知约束（试用版）

| 项 | 状态 | 影响 |
|---|---|---|
| Yjs 协作 server | 需手动 `npm run yjs:server` | 不启则文档协作降级到单人 |
| 1on1 / 360 评估 | "PRO FEATURE" 占位 | 不影响主流程 |
| ContextInjector 5 层注入 | 各处独立拼 prompt | 待统一 |
| bossCaptureScore | 三套实现并存 | 数字可能波动 |
| 多租户隔离 | 应用层手动 filter | 单租户场景无影响 |

---

## 6️⃣ 故障速查

```powershell
# 查看实时日志
Get-Content nextjs.log -Tail 50 -Wait

# 验证 LLM 接通
node --env-file=.env.local scripts/test-llm.mjs

# tsc 检查
npx tsc --noEmit

# vitest
npm test

# 重置 in-memory 数据（重启即可）
# 重置 PG 数据（如配了 DATABASE_URL）
docker compose -f docker-compose.db.yml down -v
```

---

## 7️⃣ 反馈到我这里

试用过程中：
- 哪个功能体感不顺
- 哪里报错（贴控制台错误）
- 哪个 LLM 回复质量不行（贴 prompt + reply）
- 哪个 UI 想改

→ 我汇总后做**统一优化**（避免今天改一处坏一处的反复）。
