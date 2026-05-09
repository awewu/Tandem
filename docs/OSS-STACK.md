# 开源底座选型决议 · OSS Stack

> **「上面思考层是我们的, 下面底座是社区的.」**
>
> 版本: v1.0
> 最后更新: 2026-05
> 状态: ✅ 已锁 (创始人 + 产品 共同确认)
> 依据: MANIFESTO 第十八条

---

## 摘要

牛马搭子 V1 全栈选型: **AI 加速 + OSS 借力 + 思考层自建**.

```
V1 总工时:  ~ 60 人月
V1 团队:    12-15 人
V1 时长:    12-14 月
V1 资金:    1100-1400 万 RMB
V1 GA:      M14 末
```

---

## 第一章: 锁定选型一览表

| 模块 | 选型 | 协议 | 工时 | 备注 |
|---|---|---|---|---|
| **IM 消息 + 群聊** | Rocket.Chat fork | MIT | 1.5 人月 | 主流, 中文社区好 |
| **组织架构 + 通讯录** | 自建 (Hermes 基础) | — | 1.5 人月 | 可从企微/钉钉初始导入 |
| **Inbox 聚合层** | 自建 | — | 2 人月 | 聚合三巨头 + 邮件 |
| **邮件 (通用)** | IMAP/SMTP 标准协议 | — | 1 人月 | 网易/腾讯/Outlook 等 |
| **邮件 (深度)** | 腾讯企邮 + Outlook + 网易企邮 API | — | 1.5 人月 | Tier 2 增强 |
| **日历** | Cal.com fork | AGPL ⚠️ | 1.5 人月 | 法务 review |
| **文档 (Doc)** | Yjs + Tiptap | MIT | 2 人月 | 富文本 + 实时协作 |
| **文档 (Sheet)** | Univer | Apache 2 | 1 人月 | 中国开源 Excel 替代 |
| **云盘 / 存储** | MinIO + 自建 UI | AGPL ⚠️ | 2 人月 | MinIO 仅作后端 |
| **音视频会议** | 腾讯会议 API (寄生) | — | 2 人月 | 含分身代参 |
| **TAF Agent 编排** | 自建 (借鉴 Cline + Hermes) | — | 6 人月 | 5 层架构 |
| **LLM 基座路由** | DeepSeek/Qwen/Doubao/Kimi 多模型 | — | 1 人月 | OpenAI 兼容接口 |
| **向量库** | PostgreSQL + pgvector | PostgreSQL | 0.5 人月 | V2 升 Milvus |
| **认证 SSO** | Auth.js / NextAuth + 三巨头 OAuth | MIT | 1 人月 | 钉钉/企微/飞书 |
| **WebSocket / 实时** | EMQX 或自建 | Apache 2 | 0.5 人月 | IM 实时支撑 |
| **工作流引擎** | n8n (备选) / 自建 | Apache 2 | 1 人月 | V2 评估 |

---

## 第二章: 模块详细决议

### 2.1 IM 消息 + 群聊 → **Rocket.Chat fork**

**选型对比**:

| 候选 | 优势 | 劣势 | 决议 |
|---|---|---|---|
| **Rocket.Chat** ⭐ | 10 年+ 成熟 / 文档全 / 中文社区好 / MIT 协议 | Meteor 框架略老 | ✅ 采纳 |
| Mattermost | Go 写, 性能好 | 商业版限制多 | 备选 |
| Element / Matrix | 端到端加密 / 去中心 | 学习曲线陡, 复杂 | 不选 |

**改造工作**:

- Fork 仓库, 替换品牌为 Tandem
- 集成牛马搭子认证 (从 RC 默认改为我们的 SSO)
- 加 Decision Card 内嵌卡片
- 加议事室入口 (从群聊一键发起议事室)
- 加 Inbox 聚合钩子

**协议**: MIT, 商用零风险.

---

### 2.2 组织架构 + 通讯录 → **自建 (Hermes 基础)**

**为什么自建 (不用 OSS)**:

- 现有 `app/organization/page.tsx` 已有 10KB UI 骨架
- 牛马搭子需要扩展 RBAC + Knowledge Steward 角色 + Persona 绑定
- 通用 OSS 通讯录 (如 Open-Resource) 不能满足这些独特需求

**初始数据来源**:

```
方式 1: 一键从企微/钉钉/飞书导入 (V1 必含)
方式 2: 手动添加 + Excel 批量导入 (V1 必含)
方式 3: SCIM 2.0 协议同步 HRIS (V2)
```

**关键能力**:

- 部门 / 岗位 / 上下级关系
- 角色权限 (员工 / 经理 / HR / 管理员 / Steward)
- 与拿捏老板分身绑定
- 导入企微/钉钉/飞书后保留映射

---

### 2.3 Inbox 聚合层 → **自建**

无现成 OSS. 牛马搭子独创 (聚合三巨头 + 邮件 + 我们自身).

**详见**: `WECOM-FEATURE-MAPPING.md` 第四章 / `AGENT-FRAMEWORK.md` Layer 5.

---

### 2.4 邮件 → **三层架构**

**Tier 1 (通用, 1 人月)**: IMAP/SMTP 标准协议

支持任何符合标准的邮箱:
- 腾讯企业邮箱 (imap.exmail.qq.com)
- 网易企业邮箱 (imap.qiye.163.com)
- Outlook / Microsoft 365 (outlook.office365.com)
- 网易 163 / 126 (imap.163.com)
- Gmail / Google Workspace (imap.gmail.com)
- 阿里云邮箱 (imap.mxhichina.com)
- 263 企业邮箱 (imap.263.net)
- QQ 邮箱 / Foxmail (imap.qq.com)

**Tier 2 (深度, 1.5 人月)**: 主流厂商 native API

| 厂商 | API 优势 |
|---|---|
| 腾讯企业邮箱 | 联系人 / 日历邀请 / 已读回执 / 会议联动 |
| Outlook / Microsoft 365 | Graph API 全套 |
| 网易企业邮箱 | 联系人 / 日历 / 反垃圾 |

**Tier 3 (V2 扩展)**: Gmail Workspace / 自建 Postfix 等长尾.

**为什么不自建邮箱服务器** (Mailcow):

- 邮件运维超复杂 (反垃圾 / SPF / DKIM / DMARC / IP 信誉)
- 客户期望用现有邮箱地址 (不会接受改成 @tandem.com)
- 腾讯/网易/Outlook 已是世界一流

---

### 2.5 日历 → **Cal.com fork**

**选型对比**:

| 候选 | 优势 | 劣势 | 决议 |
|---|---|---|---|
| **Cal.com** ⭐ | Next.js 14 (与 Hermes 同栈!) / 现代 UI / 智能找时间 | AGPL ⚠️ | ✅ 采纳 |
| Outlook Calendar API | 不自建 | 受限于 Outlook 客户 | 仅集成 |
| 自建 | 完全控制 | 工时大 | 不选 |

**AGPL 应对**:

- Cal.com 主体 fork 后保持开源 (符合 AGPL)
- 我们的 OKR/议事室 等模块**单独打包**, 通过 API 调用 Cal.com, 不混合
- 法务 review 后 V1 启动

**改造**:

- 集成牛马搭子 SSO
- 与议事室排期联动 (Smart Find Time)
- 与 KR 关联 (会议关联到 OKR)
- 接入腾讯/网易/Outlook 日历 (双向同步)

---

### 2.6 文档协作 (Doc) → **Yjs + Tiptap**

**为什么这套**:

- Yjs: 实时协作 CRDT 引擎 (Notion / 飞书文档 同款)
- Tiptap: 富文本编辑器 (基于 ProseMirror)
- MIT 协议, 商用零风险
- Next.js 友好, 与 Hermes 完美兼容

**改造**:

- 集成牛马搭子 SSO + 权限模型
- 加 Smart Block (嵌入 Decision Card / OKR / KR)
- 与 Memory 层挂钩 (复盘文档可升级到 Memory)
- 协作历史保留

---

### 2.7 文档协作 (Sheet) → **Univer**

**为什么 Univer**:

- 中国开源 (达梦科技 / 上海蓝湾科技)
- Apache 2 协议
- Excel 格式兼容
- 现代架构 (TypeScript + Canvas 渲染)
- 与 Yjs 配合可实时协作

**备选**: OnlyOffice (太重, 不选).

---

### 2.8 云盘 / 文件存储 → **MinIO + 自建 UI**

**MinIO**:

- 工业级对象存储 (像 AWS S3)
- 国内大厂在用 (字节 / 腾讯 / 阿里部分场景)
- AGPL 协议, **作为后端服务调用不传染**(关键!)
- 支持私有部署

**UI 自建**:

- Hermes 已有 `components/file-manager.tsx` 雏形
- 在此基础上扩展: 文件夹 / 共享链接 / 版本管理 / 全文检索

**AGPL 风险**:

- MinIO 作为独立服务运行 (Docker 容器), 通过 S3 API 调用
- 我们的应用代码不直接 link MinIO 代码
- AGPL 不传染我们主代码

---

### 2.9 音视频会议 → **腾讯会议 API (寄生)**

**详见**: `MEETING-PROXY.md`. 完全寄生, 不自建.

V3 出海版加 LiveKit (开源 WebRTC SFU).

---

### 2.10 TAF Agent 编排 → **自建** (借鉴 Cline + Hermes)

**为什么自建**: 这是核心护城河, 不能依赖 OSS.

**借鉴清单**:

- Hermes Function Calling 格式 (协议层)
- Cline 工程实践 (Provider Abstraction / Plan/Act)
- LangChain 部分组件 (向量检索 / 记忆链)
- MCP 协议 (V2 接入)

**详见**: `AGENT-FRAMEWORK.md`.

---

### 2.11 LLM 基座路由 → **多模型路由**

**详见**: `AGENT-FRAMEWORK.md` 第三章.

V1 主力: DeepSeek-V3 + Qwen-3 + Doubao + Kimi K2 + Hermes 4 (备选)
开发期: 优先用本地 Hermes 4 (Ollama / vLLM 部署), 零 API 费

---

### 2.12 向量库 → **PostgreSQL + pgvector**

**为什么 PG**:

- Hermes 已用 PG (复用)
- pgvector 插件成熟 (1.0+ 稳定版)
- 单库管理, 运维简单
- 中小数据量 (< 1 亿 vectors) 性能足够

**升级路径**: V2 客户数据量上升时迁 Milvus (开源, 工业级).

---

### 2.13 认证 SSO → **Auth.js (NextAuth)**

**为什么**:

- Next.js 原生方案
- 支持 OAuth 2.0 / SAML / 微信 / 钉钉 / 企微 / 飞书 / Google / Microsoft 等
- MIT 协议
- 社区活跃

**改造**:

- 加 钉钉 OAuth provider
- 加 企微 OAuth provider
- 加 飞书 OAuth provider
- 加 Magic Link / 短信验证

---

### 2.14 WebSocket / 实时 → **EMQX 或自建**

**V1 决议**: 先自建 (Next.js + Socket.io 或 SSE), 用户量大再切 EMQX.

EMQX 准备好作为 V2 升级路径.

---

### 2.15 工作流引擎 → **V2 评估**

V1 不需要复杂工作流引擎. V2 看是否有客户需求, 可考虑:

- n8n (开源, 类 Zapier)
- Temporal (Uber 开源, 重)
- 自建简化版

---

## 第三章: 协议风险评估

### 3.1 协议分类

| 协议 | 商用风险 | 我们使用的 OSS |
|---|---|---|
| **MIT** | ✅ 0 风险 | Rocket.Chat / Yjs / Tiptap / Auth.js / NextAuth |
| **Apache 2** | ✅ 0 风险 (含专利保护) | Univer / EMQX / n8n |
| **PostgreSQL License** | ✅ 0 风险 (类 BSD) | PostgreSQL + pgvector |
| **AGPL** | ⚠️ 需法务 review | Cal.com / MinIO / Nextcloud |
| **GPL v3** | ⚠️ 类似 AGPL | (我们不用) |
| **专有 SDK** | 需 SDK 协议 | 腾讯会议 / 钉钉 / 企微 / 飞书 |

### 3.2 AGPL 应对策略

| OSS | 应对 |
|---|---|
| **Cal.com** | Fork 后修改保持开源; 通过 API 调用, 不混合分发 |
| **MinIO** | 作为独立服务部署, S3 API 调用; 我们应用代码不 link MinIO |
| **Nextcloud** | 不采纳 (AGPL + 太重) |

### 3.3 V1 启动前必做

1. **法务 review 全部 OSS 协议清单** (1 周)
2. **Cal.com / MinIO 的 AGPL 边界** 法律意见书 (内部)
3. **每个 fork 仓库** 添加协议声明 + 修改记录
4. **公开发布版本**: 在产品官网列出 OSS 借力清单 (透明性)

---

## 第四章: V1 工时净估算 (修订)

```
OSS 改造层:
  IM (Rocket.Chat fork)             1.5 人月
  组织架构 (自建)                    1.5 人月
  Inbox 聚合层 (自建)                2.0 人月
  邮件 Tier 1 (IMAP/SMTP)            1.0 人月
  邮件 Tier 2 (3 厂商深度)            1.5 人月
  日历 (Cal.com fork)                1.5 人月
  文档 Doc (Yjs + Tiptap)            2.0 人月
  文档 Sheet (Univer)                1.0 人月
  云盘 (MinIO + UI)                  2.0 人月
  会议 (腾讯会议 API)                 2.0 人月
  ─────────────────────────────────
  小计:                               16.0 人月

差异化层 (核心自建):
  TAF (Layer 1-4)                   6.0 人月
  OKR/TTI 双轨 + 9 宫格              5.0 人月
  Decision Card 全链路               3.0 人月
  议事室 5 步 + 3+1 决策             5.0 人月
  拿捏老板 (Persona Engine)          5.0 人月
  四层知识架构 + Steward + 签批      4.0 人月
  Decision Heat Map                  2.0 人月
  自动绩效自评包                      2.0 人月
  卡顿信号检测                        1.0 人月
  AI Check-in 草稿                   1.0 人月
  9 宫格人才矩阵                      1.0 人月
  晋升评审材料包                      1.5 人月
  ─────────────────────────────────
  小计:                               36.5 人月

支撑层:
  SSO (Auth.js + 三巨头 OAuth)        1.0 人月
  实时 WebSocket                     0.5 人月
  向量库 + RAG                       0.5 人月
  应用市场上架准备                    1.0 人月
  ─────────────────────────────────
  小计:                               3.0 人月

集成 + 测试 + 等保 + DevOps:
  钉钉/企微/飞书集成 (上架)            2.0 人月
  E2E 测试                           2.0 人月
  等保二级合规                        1.0 人月
  DevOps + CI/CD + 监控               1.0 人月
  Bug fix + 打磨                     2.0 人月
  ─────────────────────────────────
  小计:                               8.0 人月

═══════════════════════════════════════
V1 总人月:                            63.5 人月
═══════════════════════════════════════
```

按团队 12 人 × 14 月 = 168 名义人月, 实际有效约 60-70 人月 (考虑会议 / 重构 / 上下文切换), **覆盖率 95%-100%**, 充分.

---

## 第五章: 团队建议 (12 人)

| 角色 | 数量 | 主要职责 |
|---|---|---|
| 创始人 / CEO | 1 | 战略 / 销售 / 创始客户 |
| 产品负责人 (PM) | 1 | PRD / 路线图 / 客户访谈 |
| 设计 (UX/UI) | 1 | 视觉系统 / 关键页面 / 用户研究 |
| 后端 (Node/Go) | 3 | TAF + OSS 改造 + API |
| 前端 (Next.js) | 2 | OKR/议事室/Inbox + 文档 UI |
| AI 工程师 | 2 | TAF + 拿捏老板 + 多模型路由 |
| DevOps / 测试 | 1 | CI/CD + 等保 + 监控 |
| 客户成功 (CS) | 1 | M6 后加入, PoC 客户支持 |
| **合计** | **12** | — |

V2 起扩到 18-20 人.

---

## 第六章: 资金需求 (V1 14 月)

```
人力:
  12 人 × 4 万/月 × 14 月 = 672 万

基础设施 (云 + LLM API + 工具):
  LLM API (V1 期):       80 万
  云服务器 + CDN:         60 万
  开发工具 + SaaS 订阅:    20 万
  ─────────────────────
  小计:                   160 万

合规 + 安全:
  等保二级评估 + 整改:    50 万
  安全审计 + 渗透测试:    30 万
  数据合规咨询:           20 万
  ─────────────────────
  小计:                   100 万

GTM (营销 + 销售):
  品牌 + 内容 + 公关:     80 万
  种子客户支持 / PoC:     50 万
  应用市场上架费:         20 万
  ─────────────────────
  小计:                   150 万

办公 + 杂项:               80 万

═══════════════════════════
V1 总预算:                 1162 万 ≈ 1200 万 RMB
═══════════════════════════

含 buffer 推荐预留: 1400 万
```

---

## 第七章: V1 风险与对策

| 风险 | 概率 | 应对 |
|---|---|---|
| **Rocket.Chat 改造工时超预期** | 中 | M1 立即 spike 评估; 备用 Mattermost |
| **Cal.com AGPL 法务卡** | 中 | M1 法务 review; 备用方案: 自建轻量日历 |
| **OSS 升级跟不上** (各仓库版本演进) | 低 | 大版本升级一次/年; 季度小升级 |
| **AI 编码质量不稳** | 中 | 每个 PR 必须人工 review; 关键代码不依赖 AI 直出 |
| **腾讯会议 API 限制** | 低 | 提前与腾讯会议 BD; 备用飞书会议 |
| **多 LLM 路由调试复杂** | 中 | M1 用本地 Hermes 4 测试; M3 才上多模型 |

---

## 第八章: M1 启动清单 (前 4 周)

```
Week 1: 法务 + 选型确认
  ✅ 法务 review 全部 OSS 协议
  ✅ AGPL 边界法律意见书
  ✅ 选型决议公开公示

Week 2: 仓库 + CI/CD
  ✅ Hermes 改名为 Tandem (品牌切换)
  ✅ Rocket.Chat fork → tandem-chat
  ✅ Cal.com fork → tandem-calendar
  ✅ 主仓库 monorepo 结构定型 (turborepo)
  ✅ CI/CD 跑通

Week 3: TAF Layer 1-2 spike
  ✅ Provider Abstraction 接口定义
  ✅ DeepSeek-V3 / Qwen-3 / Hermes 4 三个 provider 接通
  ✅ 一个简单的 3+1 demo 跑通

Week 4: 数据模型 + 开发联调
  ✅ Decision Card 数据库表
  ✅ Persona 数据库表
  ✅ Memory 层四张表
  ✅ 团队全面进入 M2 开发阶段
```

---

## 修订历史

| 版本 | 日期 | 主要变化 |
|---|---|---|
| v1.0 | 2026-05 | 初版, 锁定 V1 OSS 选型决议 |
