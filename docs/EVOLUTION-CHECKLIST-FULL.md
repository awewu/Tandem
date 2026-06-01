# Tandem 完整进化清单与对比分析（对标 7 大竞品）

> **版本**: 2026-06-01
> **范围**: 7 大竞品逐项对比 + 每条可勾选进化项 + 代码落点 + 验收标准
> **关联**: `COMPETITOR-ARCHITECTURE.md`(架构拆解) · `UNIFIED-TECH-DESIGN.md`(技术落地) · `OKR-EVOLUTION-PLAN.md`(OKR 双层) · `ARCHITECTURE-BREAKDOWN.md`(Tandem 7 思路轴) · `MANIFESTO.md` v2.0
> **优先级图例**: 🔴P0 必达地基 · 🟠P1 核心 · 🟡P2 增强 · 🟣杠杆(护城河) · ⬜不做

## 文档地图（消除漂移）

本文档是 7 竞品轴的**可执行清单**。与其他对标文档关系如下，避免重复维护：

| 文档 | 组织轴 | 定位 |
|------|--------|------|
| `COMPETITOR-ARCHITECTURE.md` | 按竞品 | 架构拆解 **详细 SoT**（灵魂+代码映射+gap） |
| **本文档** `EVOLUTION-CHECKLIST-FULL.md` | 按竞品 | **可执行清单**（编号项+落点+验收+核实状态） |
| `ARCHITECTURE-BREAKDOWN.md` | 按 Tandem 7 思路 | 实现拆解（要求+资产+缺失+填补，另一条轴） |
| `OKR-EVOLUTION-PLAN.md` | OKR 专题 | Tita 主线（§5）的双层深化 |
| ~~`EVOLUTION-ROADMAP-7BENCHMARKS.md`~~ | — | **已并入本文档第一部分，删除** |

## 核实状态说明

每条"现状/落点"标注核实状态：**✅已核**(本轮读代码确认) · **⚠️待核**(沿用旧文档未重验)。截至 2026-06-01 本轮已核：企微 IM、Cowork 闸③④、OpenClaw 技能树/XP、MCP 锚注入、OKR store/subscribers/dashboard。

---

## 第一部分 · 总览矩阵

### 1.1 7 竞品灵魂 → 母题归属

| # | 竞品 | 灵魂一句话 | 母题 | 贡献的进化主线 |
|---|------|-----------|------|--------------|
| 1 | Notion | 块即唯一原语，类型是渲染非结构 | A | TandemNode 统一原语 |
| 2 | 企业微信 | 用户级单调 seq 派生一切 | A | IM seq 主干 |
| 3 | Claude Cowork | agent 循环为单元 + 个人主权治理 | 护城河 | 组织主权治理 / MCP 接入 |
| 4 | MCP | 薄客户端厚协议，三原语分权 | B | Skill Gateway as MCP server |
| 5 | Tita | OKRs-E 执行闭环 + 自动 rollup + CFR | B | OKR 完整底座 + AI 反虚报 |
| 6 | Gmail | 标签即指针，搜索代替层级 | A | 邮件归一到 TandemNode |
| 7 | OpenClaw | 开放技能市场（80% 垃圾/恶意） | 护城河 | 受治理技能树 + XP 事件化 |

### 1.2 两母题一护城河

- **母题 A · 存一次 + 指针/索引组织 + 类型即渲染**：Notion / Gmail / 企业微信
- **母题 B · 解耦信号 + 沿图事件驱动传播**：Tita / Persona / MCP
- **护城河 · 中央 AI 组织主权治理（4 道闸）**：Cowork/OpenClaw 反证，Tandem 独有

---

## 第二部分 · 逐竞品对比分析 + 进化清单

---

## 1. Notion · 块即唯一原语

### 对比分析

| 维度 | Notion | Tandem 现状 | 差距 |
|------|--------|------------|------|
| 数据原语 | 单一 `block{id,type,properties,content[指针],parent}` | `lib/storage/repository.ts` ~40 个按类型分仓 `Repository<T>` | 🔴 致命 |
| 类型语义 | 类型=渲染提示，Turn into 不丢 properties | 类型=独立表结构，跨类型=搬运丢上下文 | 🔴 |
| 层级 | `content[]` 指针构成 render tree | 各 repo 各自父子字段 | 🔴 |
| 写入 | 事务 `/saveTransactions`(before→op→after→校验→commit) | 各 repo 各自写 | 🟡 |
| 实时 | WebSocket + MessageStore 版本推送 | 部分轮询 | 🟡 |
| 索引 | 异步 Quick Find 倒排 | 无统一索引 | 🟡 |

**致命 Gap**：知识 4 层 `origins`/`materials`/`memories`/`decisionCards` 是独立 repo，无法"一条消息 Turn into 决议卡"。

### 进化清单

- 🔴 **N1** 引入统一 `TandemNode{id,type,props,content[],parent,ownershipLevel}` 原语 · 落点 `lib/storage/` 新建 node-repo · 验收: 一条记录可跨 type 转换不丢 props
- 🔴 **N2** 知识 4 层迁移为同一原语的 type 跃迁 + 签批 · 落点 `origins/materials/memories` repo · 验收: Origins→Material→Memory 转换零拷贝
- 🟠 **N3** 统一写入事务层(before→op→after→校验→commit) · 落点 `lib/storage/transaction.ts` · 验收: 并发写一致
- 🟡 **N4** 异步倒排索引(Quick Find analog) · 落点 `app/search` · 验收: 跨 type 全文检索
- 🟡 **N5** WebSocket 版本推送替代轮询 · 验收: 多端实时同步

---

## 2. 企业微信 · 用户级单调 seq 主干

### 对比分析

| 维度 | 企业微信 | Tandem 现状 | 差距 |
|------|---------|------------|------|
| 时序主干 | 用户级递增 seq(仲裁发号段) | 无 seq，靠 createdAt | 🟠 中 |
| 多端同步 | 客户端存 `last_seen_seq` 拉增量 | 无增量游标 | 🟠 |
| 未读数 | `maxSeq − readSeq` 派生 | ✅`unreadCount` 计数器(`im/service.ts:231-232` 每成员 +1) | 🟠 |
| 已读回执 | per-user read cursor(单行) | ✅单个 `lastReadAt` 时间戳(`:305-307`) | 🟠 |
| 投递 | 写扩散 + 推拉结合 | ✅写扩散 fan-out 已有(`:228`)；全文件无 seq | 🟢 |

**Gap**：v2.0 要做的"已读回执/响应时效"建在时间戳+计数器上，时钟偏移/同时间戳排序会出问题，多端一致性弱。

### 进化清单

- 🟠 **W1** 会话级单调 seq 生成器 · 落点 `lib/im/seq.ts` · 验收: 严格递增无重复
- 🟠 **W2** per-user seq read cursor 替代 `lastReadAt` · 落点 `im/service.ts` · 验收: 已读=cursor 单行
- 🟠 **W3** 未读数派生 `maxSeq−readSeq`(废计数器) · 验收: 重算未读无需扫消息
- 🟡 **W4** 客户端 `last_seen_seq` 增量拉取 · 验收: 多端断线重连补齐
- 🟡 **W5** 响应时效统计建在 seq 上 · 关联 MANIFESTO §11 高效协同

---

## 3. Claude Cowork · 组织主权 vs 个人主权（护城河对照）

### 对比分析（逐条镜像）

| Cowork 能力 | Tandem 对应 | 状态 |
|------------|------------|------|
| 异步委托(手机→电脑跑→拿结果) | 搭子召唤 | 🟡 部分 |
| Projects(持久工作区 files/links/instructions/memory) | Persona + Memory | 🟡 |
| Plugins=Skills+Connectors+Sub-agents | Skill Gateway + 技能树 | 🟡 |
| 选 folders/connectors 访问 | ✅闸③ `checkDataScope_`(真接 RBAC, `skill-gateway/index.ts:182`) | 🟢 |
| 默认 ask，可授权自动 | ✅闸④ `checkActionScope_`(`:218-222` caller 声明 actionScope→zone) + 24h 否决 | 🟢 |
| 工具调用流式入 SIEM(OpenTelemetry) | `lib/audit/log.ts` audit() + Steward | 🟡 缺 OTel |

**本质差异（护城河）**：Cowork=个人主权(you decide/your choice)；Tandem=组织主权(company 红线一票否决，个人不能解除，见 §19.5)。这是 To C agent 工具 vs To B 企业网关的本质分野。

**技术债**：✅已核实——`checkActionScope_`(`:218-222`) `const action = input.actionScope ?? 'read_only'`，caller 声明即生效，零内容校验 = 退化成 Cowork 个人模型，与组织主权矛盾。

### 进化清单

- 🟣 **C1** `checkActionScope_` 改为组织判定 zone(非 caller 声明) · 落点 `skill-gateway/index.ts` · 验收: caller 声明绿区无效，由组织基线裁定
- 🟣 **C2** audit() 暴露成 OpenTelemetry 合规事件流 · 落点 `lib/audit/` · 验收: 工具调用/文件访问/审批态流式可导出 SIEM
- 🟣 **C3** Skill Gateway 表达成 MCP server，Cowork/Claude Code 作为 Connector 穿 4 道闸 · 见 §4
- 🟡 **C4** Memory 打包成角色技能包(类比 Cowork brand-voice/legal/finance plugins) · 落点 `lib/memory/`

---

## 4. MCP · 薄客户端厚协议，三原语分权

### 对比分析（精确对应）

| MCP 原语 | 控制方 | Tandem 代码 | 状态 |
|---------|-------|------------|------|
| tools | 模型控制 | 闸④ Action Scope 企业动作 | 🟡 库函数 |
| resources | 应用控制 | ✅`govern-persona.ts:115` 注入 `buildOkrAnchorContext`(实体 `company-brain.ts:144`, 只注 company 层 O) | 🟡 |
| prompts | 用户触发 | ✅ 3+1 模板(`three-plus-one-engine.ts:222` 也注 OKR 锚) | 🟡 |

**Gap**：`runSkillGateway` 是内部库函数，不是协议边界。

### 进化清单

- 🟠 **M1** 把 `runSkillGateway` 表达成 MCP server(JSON-RPC, stdio/HTTP transport) · 落点 `lib/mcp/gateway-server.ts` · 验收: 外部 client 可经协议调用穿 4 道闸
- 🟠 **M2** resources 用 Resource Templates 暴露 OKR/基线上下文(`okr://anchor/{userId}`) · 验收: 应用控制注入
- 🟡 **M3** prompts 暴露议事室/3+1 模板为 MCP prompts · 验收: 用户触发标准化
- 🟣 **M4**(与 C1 合流) 统一强制出口 `governedChat()` 串输入闸+LLM+输出闸+动作闸，autonomous fail-closed，ESLint 禁直调 `router.chat`

---

## 5. Tita · OKRs-E 执行闭环 + 自动 rollup + CFR（今日重点）

### 对比分析

| Tita 模块 | Tita | Tandem 现状(看代码) | 评级 |
|-----------|------|---------------------|------|
| 数据模型 | 单一 | **两套并存**: `lib/store/okr.ts`(localStorage) + `lib/types/okr-tti.ts`(server API) | 🔴 同步债 |
| OKR CRUD/对齐 | 完整 | server `parentObjectiveId` 单父(最多3层) | 🟡 单父 |
| 自动 rollup | 唯一卖点 task→KR→O | ✅`okr.kr-progressed` 事件**只打日志不传播**(`subscribers.ts:148`)；Objective 进度在 UI 读时算(`dashboard:47` 先看 `progressOverride` 再 KR 加权)，非事件驱动 | 🔴 假闭环 |
| OKRs-E 执行 | 任务/项目驱动 KR | `Initiative{keyResultId, decisionCardIds}` 有结构，但完成不驱动 KR `currentValue` | 🔴 断裂 |
| KR 计算 | 定量任务聚合 | `computeKRProgress` / `computeMethod`(cumulative/latest/average) 已有，但无任务来源 | 🟡 |
| OKR 地图 | 全局 DAG | ✅`app/okr/cascade` 五层树状只读(读服务端 API，与 dashboard 不同源)，非地图 | 🔴 |
| 仪表盘 | 饼/柱/健康度/提醒 | ✅`app/okr/dashboard`: 部门聚合+Top5 落后/高风险/领先+跨部门对齐成本(读 localStorage store) | 🟡 较全,缺一键提醒 |
| 评分 | KR 加权→O | `selfScore/managerScore/finalScore` 字段 + `lib/okr/scoring.ts` | 🟡 |
| 复盘 | 看板/5Why/AI | `retrospective` 文本字段 | 🔴 手填 |
| CFR | 对话/反馈/认可 | `app/1on1` + `app/360` 独立页未接 OKR | 🔴 割裂 |
| 案例库 | 上千套模板 | 无 | 🔴 |
| 进度信任 | **靠人诚实填** | (Tandem 机会点: AI 萃取+反虚报) | 🟣 杠杆 |

### 进化清单 — 底座层(必达，立身之本)

- 🔴 **B1** 单一数据模型收敛(server 为真值，localStorage 降级 UI 缓存) · 落点 `lib/store/okr.ts` + `lib/types/okr-tti.ts` · 验收: 字段一致，无双写
- 🔴 **B2** 真 rollup 引擎(`kr-progressed` 订阅者向上聚合到 O→顶层，废 `progressOverride` 默认) · 落点 `lib/okr/rollup-engine.ts` + `events/subscribers.ts` · 验收: KR 变 → O 自动变
- 🔴 **B3** OKRs-E 执行联动(Initiative/Task `done` 驱动 KR `currentValue`) · 落点 `Initiative` + `task` 事件 · 验收: 任务完成 → KR 进度涨
- 🟠 **B4** 多父对齐 + OKR 地图 DAG · 落点新建 `okr_alignments` 表 + `components/okr/okr-map.tsx` · 验收: 一 O 对齐多父 + 全局图
- 🟠 **B5** 评分 + 结构化复盘(5Why/KISS 模板) · 落点 `lib/okr/scoring.ts` + 复盘组件 · 验收: 周期评分 + 结构化记录
- 🟠 **B6** 仪表盘健康度监控(饼/柱/落后预警/一键提醒) · 落点 `app/okr/dashboard` · 验收: 落后 O 高亮 + 提醒
- 🟠 **B7** CFR/360/绩效与 OKR 打通(1on1 锚 OKR 主题) · 落点 `app/1on1` `app/360` · 验收: 1:1 关联 OKR
- 🟡 **B8** OKR 案例库(内置岗位模板) · 落点 `lib/okr/templates/` · 验收: 新建 O 可选模板

### 进化清单 — 杠杆层(护城河，建在完整底座上)

- 🟣 **L1** AI 自动萃取进度 + 反虚报(接通 `source:'daily-report'` + output-guard 校验) · 依赖 B2/B3 · 落点 `events/bus.ts` source + `lib/memory/output-guard.ts` · 验收: 日报→KR 进度候选经校验落地，虚报被拦
- 🟣 **L2** 中央 AI 复盘诊断 / OKR 漂移检测(走 governedChat) · 依赖 B5/B2 · 落点 `lib/persona/govern-persona.ts` + 漂移闸 · 验收: AI 诊断 OKR 健康度 + 偏离告警

---

## 6. Gmail · 标签即指针，搜索代替层级

### 对比分析

| 维度 | Gmail | Tandem 现状 | 差距 |
|------|-------|------------|------|
| 存储 | 消息存一份 + label 多对多指针 | 邮件=企邮+Outlook API 联邦(不自建存储, §18) | 🟡 |
| 线程 | Message-ID/In-Reply-To/References header | 无统一线程模型 | 🟡 |
| 导航 | per-user 倒排索引搜索 | 无统一搜索 | 🟡 |
| 推送 | IMAP IDLE / watch→Pub/Sub | V2 计划 IMAP 收件 | 🟡 |

### 进化清单

- 🟡 **G1** IMAP 收件归一到 TandemNode(type=email)，不建文件夹模型 · 依赖 N1 · 验收: 邮件入统一原语
- 🟡 **G2** label 多对多指针替代文件夹 · 验收: 一邮件多 label 零拷贝
- 🟡 **G3** header 串线程(Message-ID/References) · 验收: 回复链聚合
- 🟡 **G4** 邮件可 Turn into Material→Decision Card · 依赖 N2 · 验收: 邮件转知识/决议

---

## 7. OpenClaw · 开放 agent 技能生态（反证网关价值）

### 对比分析

| 维度 | OpenClaw | Tandem 现状 | 评价 |
|------|----------|------------|------|
| 技能分发 | ClawdHub 开放市场(~80% 垃圾/恶意) | ✅`STAGE_TO_DEFAULT_SKILLS`(`lib/types/persona.ts:161`, newborn:[] → 递增; 红区 human-only) + `canPersonaUseSkill` | 🟢 更强(受治理) |
| 养成 | XP/levels/badges/streaks | ✅`bossCaptureScore`(三处算: learning-collector/feedback/evolution) | 🟢 已有 analog |
| 阶段 | levels | ✅ 5 阶段 newborn→partner(`evolution.ts`) | 🟢 |
| 升级门槛 | streaks | ✅`STAGE_UPGRADE_CRITERIA`(newborn minDays14/minDecisions5...) | 🟢 |
| 审计 | agent-audit-trail(hash 链) | `audit/log.ts` | 🟡 缺 hash 链 |

**洞察**：OpenClaw 的"80% 恶意技能"恰是 Tandem 4 道闸的最强论据。Tandem 技能树多了治理+委托分级+autonomy 守门。缺的是事件化/可视化。

### 进化清单

- 🟡 **O1** XP/阶段进阶事件化(emit `persona.stage-upgraded` 已有，补 XP 增量事件) · 落点 `lib/persona/feedback.ts` · 验收: 养成可视化
- 🟡 **O2** 技能树可视化(解锁路径 + 红区 human-only 标注) · 落点 `app/persona` · 验收: 员工看见成长路径
- 🟡 **O3** audit 升级 hash 链(防篡改) · 落点 `lib/audit/log.ts` · 验收: 审计链可验证
- 🟣 **O4** 外部技能接入穿 4 道闸(与 C3/M1 合流) · 验收: 市面 AI 技能受治理

---

## 第三部分 · 三大跨竞品架构改造（收敛）

| 改造 | 来源 | 内容 | 关联清单项 |
|------|------|------|-----------|
| **统一 TandemNode 原语** | Notion+Gmail+企微(母题A) | 一原语承载知识/邮件/消息，type 解耦 | N1-N5, G1-G4, W1-W5 |
| **事件驱动 rollup 引擎** | Tita+Persona+MCP(母题B) | 解耦信号沿图传播，OKR 自动 rollup | B1-B3, L1-L2 |
| **Skill Gateway as MCP server** | MCP+Cowork+OpenClaw(护城河) | 4 道闸升级为治理协议边界 | C1-C3, M1-M4, O4 |

---

## 第四部分 · 优先级总清单（执行顺序）

### 🔴 P0 地基（必达，先做）

- N1 TandemNode 原语
- B1 OKR 单一模型收敛
- B2 真 rollup 引擎
- B3 OKRs-E 执行联动
- C1 zone 组织判定（修护城河技术债）

### 🟠 P1 核心

- N2 知识 4 层迁移原语
- B4 多父对齐+OKR 地图 · B5 评分复盘 · B6 仪表盘 · B7 CFR 打通
- W1-W3 IM seq 主干
- M1 Skill Gateway MCP 化 · M4 governedChat 统一出口

### 🟣 杠杆（护城河，建在地基上）

- L1 AI 萃取进度+反虚报
- L2 中央 AI 复盘诊断
- C2 OTel 合规流 · C3 MCP server 接入
- O4 外部技能穿闸

### 🟡 P2 增强

- B8 案例库 · N3-N5 · W4-W5 · G1-G4 · O1-O3 · M2-M3 · C4

### ⬜ 明确不做

- 重型项目管理套件（甘特/依赖/资源调度）—— PM 工具的活，非 OKR 底座
- 600 套考核指标库（先做 OKR 案例库 B8）
- 移动端独立 OKR App（桌面/Web 优先）
- 开放技能市场（与 OpenClaw 拼分发量，无治理无意义）

---

## 第五部分 · 三条不可动摇红线（护城河本质）

1. **双轨分离**：活跃度等协同指标严禁挂钩金钱/晋升（KPI 挂钱，TTI/OKR 不挂钱，`okr-tti.ts:153` `affectsCompensation: false` 编译期固化）。
2. **公平底线**：不公开末位/离职不抹黑/不歧视/生物特征需告知。
3. **中央基线管控**：company 红线一票否决，个人不能解除（区别于 Cowork 个人主权）。

---

## 第六部分 · 一句话总纲

> 7 大竞品对标收敛为 **2 母题(TandemNode 统一原语 + OKR 完整底座/事件驱动 rollup) + 1 护城河(中央 AI 组织主权治理)**。Tandem 不与任一竞品拼单点功能广度，而是用"完整 OKR 底座 + 中央 AI 治理"驱动企业战略落地——这是 Tita/Notion/Cowork 各自架构上都做不到的合题。**地基(P0)先行，护城河(杠杆)紧随，PM 套件明确不做。**
