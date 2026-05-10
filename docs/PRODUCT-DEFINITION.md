# Tandem 产品定义 · 锁定稿

> **状态**: 待创始人最终签字 (2026-05-10 会话产出)
> **作用**: 此文档锁定 Tandem 产品的**双模块定义** + **6 项核心决策**, 是 PRD v0.3 重写的前置基线.
> **优先级**: 高于 PRD, 低于 MANIFESTO. 一旦签字, 改动须走变更评审.

---

## 0. 一句话定义

> **Tandem (牛马搭子)**: 一个有 AI 副驾的**企业决议操作系统 + 员工成长伴侣**.
> 双模块: **事半 (企业级 OKR-决议-知识闭环)** × **拿捏 (员工级个人 AI 持续成长)**.

---

## 1. 双模块结构

```
                 ┌─────────────────────┐
                 │  Tandem · 牛马搭子   │
                 │  18 条宪章 (不可改)   │
                 └──────────┬──────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                                        ▼
   ╔═══════════╗                          ╔═══════════╗
   ║   事半    ║                          ║   拿捏    ║
   ║  (企业)   ║                          ║  (员工)   ║
   ╚═══════════╝                          ╚═══════════╝
   事半功倍                                拿捏老板 (能力 > 老板需求)
```

- **事半** 服务**老板/Champion/Steward**: OKR 落地 + 决议高质 + 知识沉淀
- **拿捏** 服务**员工本人**: 个人 AI 持续成长, 直至能轻松搞定老板的需求

---

## 2. 锁定的 9 项核心决策 (本次会话)

| # | 维度 | 决策 |
|---|---|---|
| 1 | 第二模块命名 | **拿捏** (呼应北极星"拿捏老板") |
| 2 | DecisionCard ↔ KR 关系 | **软绑定**: 默认必选 KR, 可选 "无关 KR" 但**强制填写理由** |
| 3 | IM 范围 | 文本 IM ✅ + **音视频会议 + 文件存储 + 协同文档** (LiveKit/腾讯 + MinIO + Univer/Tiptap) |
| 4 | Persona 模型架构 | **双层**: Persona = **本地 Hermes** / 中央 AI = **云 DeepSeek** |
| 5 | OKR 追踪深度 | **重型 5 层**: O → KR → Initiative → DC → ActionItem + AI 滞后预警 |
| 6 | V1 GA 时间线 | **7-7.5 个月** (原 6-7 月 + 新加 3 项扩到 7.5 月) |
| 7 | 邮件存证回路 | **完整双向**: 入站 (IMAP) + 出站 (12 事件) + 邮件归档 hash 入审计 |
| 8 | 日报 ↔ OKR 闭环 | **5 分钟极简日报**, AI 预填 80%, AP 反向强推, 自动算 KR 进度 (反虚报) |
| 9 | 三层 Dashboard | 个人 / 主管 / 老板 (Champion) 三套, AI 聚合关键信号 |

---

## 3. 事半模块 (企业级) · 4 大功能区

### 3.1 OKR 重型 5 层 + 日报闭环 + Dashboard

#### 3.1.1 OKR 5 层结构

```
Objective (年度 / 公司或部门)
  └─ KR (季度 / 可量化)
       ├─ Initiative (跨季度举措)
       ├─ DecisionCard (议事决议, 17min 闭环)
       └─ ActionItem / AP (任务追踪 + 截止日)
```

#### 3.1.2 周边: 1on1 / 周报 / 季度 review / 9 宫格 / AI 滞后预警

- KR 进度 < 时间进度 70% → AI 主动给 KR owner 推 3 个推进选项
- 季末前 2 周自动启动 review

#### 3.1.3 ★ 5 分钟极简日报 ↔ OKR 双向闭环 (新加)

**Flow1 · 日报 → OKR 自动同步 (反虚报)**

员工不填"完成度 %", 系统从今日产出**自动算**:
- COMMIT 的 DC 数 → 关联的 KR 推进
- 交付的 AP → ActionItem 完成
- IM 高价值消息 → Material 候选

**Flow2 · OKR AP → 日报模板反向强推**

日报模板每天**自动列出**:
- 截止前 1 天的 AP → 强制填"今天怎么推进?"
- 已逾期 AP → 强制填"为什么延期?"
- 写不出来 / 留白超 24h → 自动 ESCALATE 给主管

**Flow3 · 日报 → Material → Memory**

日报 IM 风格内容沉淀, AI 周末扫高价值条目入 Memory promotion 队列.

**Flow4 · 5 分钟硬上限 UX**

```
┌─ 今日总结 (倒计时 5min, 超时自动收) ─────┐
│  📌 完成 (AI 草稿 80%, 你只核对)         │
│  🚧 卡点 (你必须自写 ≥1 句)               │
│  📅 明日计划 (系统列出 AP, 你勾选)        │
│  ⏱️ 3:42 / 5:00    [发送] [明早补]        │
└──────────────────────────────────────────┘
```

#### 3.1.4 ★ 三层 Dashboard (新加)

**个人仪表盘 (员工)**
- 今日: 待办 AP / 进行中议事 / 待回邮件
- 本周: 我贡献的 KR / 我的 D 选项率 / 否决率
- 本月: TTI 成长热点 / Persona 学到的新风格
- 季度: 9 宫格我在哪 / KR 完成度 / 1on1 摘要

**主管仪表盘**
- 团队 KR 红绿灯 + AI 滞后预警
- 团队成员日报摘要 (AI 聚合, 不是逐字读)
- AP 卡点热力图
- 团队 D 选项率 / 否决率分布

**老板仪表盘 (Champion)**
- 全公司 OKR 树状图 (O→KR→Initiative→DC)
- 9 宫格 (KPI×TTI)
- Memory 健康 (升降级速率/引用率)
- Persona 进化全员热图
- §13 4 项尊严合规仪表 (导出/匿名化/否决/拒签 计数)

#### 3.1.5 北极星指标更新

> 每决议平均成交 ≤ 17min · 否决率 ≤ 15% · D 选项率 ≥ 20% · **KR 绑定率 ≥ 95%** · **日报完成率 ≥ 90%** · **5min 内完成率 ≥ 80%**

### 3.2 议事室 (Convergence)

5 步状态机 17min 硬上限 + 3+1 选项 (D 必填) + 24h 否决窗口
**新增**: 发起议事**默认必选 KR**, escape hatch (无关 KR) 必须填写理由 (审计留痕).

### 3.3 IM 企微级 (★ V1 GA 重大扩展)

| 子能力 | 状态 | 实现 |
|---|---|---|
| 频道 + 私聊 + 群 | ✅ V1 已有 | 现有 `app/im/*` |
| 一键开议事 + 沉 Memory | ✅ V1 已有 | spawn-room + promote-to-memory |
| @中央 AI / @个人 Persona | ✅ V1 已有 | DeepSeek 流式 |
| **音视频会议** | ★ V1 GA 加 |  + 腾讯会议 ISV (API打通调用，员工账号和个人AI均可参会会议) |
| **文件存储** | ★ V1 GA 加 | MinIO (AGPL, 走法务) |
| **协同文档** | ★ V1 GA 加 | Univer (表格) + Tiptap+Yjs (富文本) |

### 3.4 知识 4 层架构

`Origins → Materials → Memory → Baseline`, 三级签批 (Lv1/Lv2/Lv3) + AI 反向降级 (引用率扫描).
**新增重点**: Baseline (公司基线) 由**中央 AI 拦截器**强注入到所有个人 Persona 调用, **防止个人 AI 跑偏**.

### 3.5 ★ 邮件存证回路 (新加)

#### 3.5.1 入站 (U1) · 员工→系统 · 邮件作为法律级存证

```
员工/客户/合作方 ─ SMTP ─►  企业邮箱 ─ IMAP ─► Tandem
                                                 │
                                  ┌──────────────┼──────────────┐
                                  ▼              ▼              ▼
                              Material       DC.originRefs   Memory promotion
                            (附件入 MinIO)   (按抄送号关联)   (主题前缀触发)
```

支持邮箱: Exchange / Office 365 / Gmail Workspace / 腾讯企业邮 / 阿里企业邮.

主题前缀约定:
- `[Tandem-DC#xxx]` → 关联到议事室
- `[Tandem-KR#xxx]` → 关联到 KR
- `[Tandem-Memory]` → 直接进 Memory promotion 队列

#### 3.5.2 出站 (U2) · 系统→员工 · 12 个事件邮件

| # | 触发 | 收件人 | 时机 |
|---|---|---|---|
| 1 | DC COMMIT | 全参与者 | 立即 |
| 2 | DC VETOED | 全参与者 | 立即 |
| 3 | DC 24h 否决窗口最后 1h | 全参与者 | 1h 前 |
| 4 | KR 周进度 | KR owner + 主管 | 每周一 |
| 5 | KR 滞后预警 | KR owner | AI 扫到时 |
| 6 | 季度 review 启动 | 全员 | 季末前 2 周 |
| 7 | Persona 升阶提议 | 员工本人 | 满足条件时 |
| 8 | Memory 升级公示开始 | 利益相关方 | 立即 |
| 9 | Memory 降级评估 | Steward | AI 扫到时 |
| 10 | Steward SLA 即将逾期 | Steward + 治理委员会 | 24h 前 |
| 11 | 邀请码生成 | 被邀员工 | 立即 |
| 12 | 安全事件 (异常登录/MFA/锁定) | 员工本人 + admin | 立即 |

#### 3.5.3 邮件归档 + 合规

- 所有进出邮件 hash 链入审计 (§13 不可篡改)
- 个人邮件可在自助导出 bundle 里 (§13.3)
- 离职 anonymize 时邮件正文 PII 脱敏 (§13.2)
- DKIM / SPF / DMARC 全配 (反钓鱼 + 反伪装 Tandem)
- 退订链接 (营销类邮件, 安全类不可退订)

---

## 4. 拿捏模块 (员工级) · 4 大功能区

### 4.1 个人 AI 双层架构 (★ V1 GA 重大新建)

```
┌──────────────────────────────────────────────┐
│  员工 Persona (本地)                          │
│    模型: Hermes 4 (7B/13B 量化)              │
│    部署: 客户企业本地 GPU 集群 (或员工笔记本)  │
│    职责: 学员工本人风格, 跑日常 Skill          │
│    数据: 个人 decisionHistory + styleProfile  │
└──────────────────┬───────────────────────────┘
                   │ 复杂任务升级
                   ▼
┌──────────────────────────────────────────────┐
│  中央 AI (云)                                 │
│    模型: DeepSeek V3 (主) + Qwen-Max (备)    │
│    部署: 云调用, 按用量计费                   │
│    职责: 复杂推理 + 跨部门 + 高难 reasoning   │
│    强注入: Baseline + Memory (公司价值观+SOP) │
└──────────────────────────────────────────────┘
```

**路由策略**:
- 默认: Persona 本地优先
- 升级条件: token 估计 > 4K / 任务标签 ∈ {reasoning_complex, code_review, cross_dept}
- 离线模式: 无云时纯本地, 标注 `degraded=true`

**部署形态**:
- 客户必须有 **GPU** (A10/4090 起步, 1 台支撑 50-100 员工)
- 我方提供 **GPU 部署 SOP** + **Hermes 量化模型权重** + **Ollama 启动脚本**

### 4.2 5 阶段进化 + 拿捏度

```
🥚 newborn (0-2w 旁听)
🐣 apprentice (2w-2m 代汇报)        ── 自动升级
🐤 assistant (2m-6m 绿区表态)       ── 自动升级
🦅 deputy (6m-1y 黄区代行)          ── ★ 员工 consent
🐉 partner (>1y 跨企业代行)         ── ★ 双向 consent

bossCaptureScore (0 → 100)
   = f(决议数, 否决率, 风格相似度, KR 贡献度)

当 score ≥ 80 → 员工 "反客为主" 提示出现
```

### 4.3 持续训练材料挂接

每次 Persona 调用时, **5 层强注入**:

```
1. Baseline       公司价值观 (强制, 不可绕过)
2. Memory.redline 公司红线 (硬约束)
3. Memory.sop     公司 SOP (软建议)
4. Memory.case    最佳案例 (参考)
5. Skills         标准智能体 (工具)

+ 个人层
6. decisionHistory  个人决议轨迹
7. styleProfile     个人沟通/决策风格
```

### 4.4 代行边界 (autonomy 守门)

- 红区 (薪资/法律/投诉) **永禁** AI 代行
- 黄区 24h 否决窗口 + 全程水印 `isProxy=true`
- 绿区可自动代

---

## 5. 共享地基 (M0)

| 子模块 | V1 状态 |
|---|---|
| 自研 Auth (登录/MFA/邀请) | ✅ 17/17 e2e PASS |
| §13 隐私 (导出/匿名化) | ✅ 17/17 e2e PASS |
| 链式审计 hash | ✅ |
| 双 Storage (InMemory↔Prisma+PG) | ✅ Prisma migrate 已实跑 |
| **中央 AI 拦截器** | ★ V1 GA 加: 中间件层强制注入 Baseline + Memory |
| SSE 实时层 | ✅ |

---

## 6. V1 GA 时间线 (锁定 7 个月, 新加 3 项后)

```
Month 0 (现在)        V1 PoC 完成 · 50/50 e2e PASS
                     · 所有 ✅ 项已上线
                     · Pilot 文档 + Pitch Deck 就绪
                     · Prisma migrate 实跑 OK

Month 1              E1.1-E1.2 OKR 5 层骨架 + KR 软绑定
                     · Initiative 实体 + 5 层级联 UI
                     · DC 创建器加 KR 选择 + escape hatch 理由
                     · Schema migration

Month 2              E1.3 日报闭环 + E0.5 中央 AI 拦截器
                     · 5min 日报 UI + AI 草稿生成
                     · AP 反向强推 + 24h ESCALATE
                     · LLM 中间件 Baseline + Memory 强注入
                     · /admin/baseline 配置页

Month 3              E1.4 三层 Dashboard + AI 滞后预警
                     · 个人/主管/老板 三套仪表盘
                     · KR 进度自动算 + AI 预警 cron
                     · 周报 + 季度 review 模板

Month 4              E3.4-E3.6 IM 企微级 (会议 + 文件 + 文档)
                     · LiveKit 自部署 + 腾讯会议 ISV API + 通话 UI
                     · MinIO 文件库 + 频道附件
                     · Univer 表格 + Tiptap 富文本

Month 5              P1 个人 AI 双层 + E5 邮件存证回路
                     · Hermes 量化模型 SOP (Ollama / vLLM)
                     · GPU 资源探针 + 双层路由策略
                     · 离线模式
                     · IMAP 入站 + SMTP 出站 + 12 事件模板
                     · DKIM/SPF/DMARC 配置

Month 6              法务 + 合规 + 性能
                     · AGPL 法务 review (Cal.com / MinIO / Univer)
                     · 等保二级评估提交
                     · 性能压测 (并发议事室 100 → 1000)
                     · 渗透测试

Month 7              GA 准备 + 友好客户 Pilot
                     · docker-compose.tandem.yml 全栈烟测
                     · 客户成功 SOP + Steward 培训课
                     · 第一批 3 家友好客户跑过 7 天 Pilot
                     · GA 上线
```

### 6.1 工期分解

| 模块 | 工期 | Month |
|---|---|---|
| OKR 5 层骨架 + KR 软绑定 | 4 周 | M1 |
| 日报闭环 + 中央 AI 拦截器 | 4 周 | M2 |
| 三层 Dashboard + 预警 | 4 周 | M3 |
| IM 升级 (会议/文件/文档) | 4 周 | M4 |
| Persona 双层 + 邮件回路 | 4 周 | M5 |
| 法务 + 合规 + 性能 | 4 周 | M6 |
| GA + Pilot | 4 周 | M7 |
| **合计** | **28 周 (~7 个月)** | |

---

## 7. 不变的 (V1 GA 之后才动)

- **MANIFESTO 18 条宪章**: 永远不可改 (V1/V2/V3 都遵守)
- **§17 sweet spot**: 仅服务 7 类民企 (互联网/SaaS/跨境/文娱/教育/消费/创意)
- **§4 TTI 永不挂奖金**: 任何"系数浮动"提议直接拒绝
- **§13 4 项尊严**: 数据归公司但有 4 项不可绕过的员工保障

---

## 8. V2 / V3 已锁定 (不在 V1 GA scope)

- V2 (V1 GA 后 6 个月): 钉钉/企微/飞书任一上架, 多租户 SaaS 切面, 销售落地页
- V3 (V1 GA 后 12 个月): Persona partner 跨企业, Memory marketplace, Tandem 反向 IdP, 国密 SM2/SM3/SM4

---

## 9. 风险登记 (新决策带来的)

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 客户没 GPU 不能跑 Hermes Persona | 高 | 中 | 提供"全云 fallback" 模式, 允许暂用 DeepSeek 模拟 Persona |
| Hermes 4 量化模型质量不及 DeepSeek | 中 | 高 | 选用 Hermes 4 70B 官方量化版, 保守路由 (复杂任务都升级中央) |
| 22 周工期超支 | 中 | 高 | 月度里程碑 + 每月评审, 必要时砍 IM 协同文档 (E3.6) 到 V1.5 |
| Univer / Tiptap+Yjs 协作冲突难调 | 中 | 中 | V1 GA 仅做单人编辑, V1.5 加多人 OT/CRDT |
| LiveKit 自部署运维负担重 | 中 | 中 | 提供 docker-compose 一键启动 + Coturn STUN/TURN 配置 |
| 法务发现 AGPL 阻塞 (Cal.com/MinIO) | 中 | 高 | M5 启动时已 review 完, 备选 Coolify (Cal.com 替代) / SeaweedFS (MinIO 替代) |
| 等保二级 3 个月评估周期阻塞 GA | 中 | 中 | M5 提交评估, M7 GA 时若未拿到证, 用"等保评估中" 状态推 Pilot, 不影响私有化 |

---

## 10. 签字栏

```
[ ] 创始人 (你):       _________________ 日期: _________
[ ] CTO / 技术 lead:   _________________ 日期: _________
[ ] 法务 lead:         _________________ 日期: _________
```

签字后, **PRD v0.3 重写正式启动**.

任何后续变更须更新此文档 §11 决策日志 (待添加).
