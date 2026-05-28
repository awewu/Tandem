# Tandem (牛马搭子) · 产品需求文档 (PRD v0.3) · ⚠️ ARCHIVE 性质

> ## ⚠️ 2026-05-27 SUPERSEDE 通告
>
> **本文档已下放为 archive 性质**. 后续权威按以下三层文档体系:
>
> | 层级 | 文档 | 性质 |
> |---|---|---|
> | **不变根基** | [MANIFESTO.md](./MANIFESTO.md) (19 条宪章) | 不可频繁修改 |
> | **灵魂层** | [OKR-DRIVEN-ARCHITECTURE.md](./OKR-DRIVEN-ARCHITECTURE.md) (6 条立项初心) | 不可频繁修改, 跟 MANIFESTO 同等地位 |
> | **产品决策** | [PRODUCT-DEFINITION.md](./PRODUCT-DEFINITION.md) (14 项决策, 已升级) | 季度更新 |
> | **当前状态** | [STATE-OF-THE-CODE.md](./STATE-OF-THE-CODE.md) | 持续维护 |
>
> ### 哪些内容已 supersede
>
> - **§ 0-3 (产品定位 + 模块树)**: 看 PRODUCT-DEFINITION.md
> - **§ 9-12 (GTM / 定价 / 竞品 / 财务)**: 已 supersede 为 [SELF-USE-FIRST.md](./SELF-USE-FIRST.md) — Tandem 是 Owner 自己企业的内部协作 AI 平台, 不是 SaaS 创业项目, 商业化是远期可选项
> - **§ 5 (数据模型)**: 看 `lib/types/*.ts` + `lib/infra/drizzle-schema.ts` (代码即权威)
>
> ### 哪些内容仍有价值 (不删)
>
> - **§ 4 (系统架构 + 技术栈)**: 历史栈选型决策记录
> - **§ 6 (UI/IA)**: 已被 [UI-IA.md](./UI-IA.md) supersede 但作背景
> - **§ 7 (NFR)**: 等保 / GDPR / PIPL 合规清单 — 可继续参考
> - **§ 8 (验收标准)**: 50/50 e2e + 新模块 - 已大部分完成, 可对照
>
> **下次大改时再迁移结构清晰内容; 当前优先做代码 + 灵魂层 + 4 板块超越**.

---

> **版本**: v0.3 (2026-05-10)
> **状态**: ARCHIVE (2026-05-27 起) · 原标题: V1 GA 实施基线
> **历史**: v0.1 / v0.2 见 `PRD-v0.2-archive.md`
> **同栈文档**:
> - `MANIFESTO.md` (19 条宪章, 不可改, 优先级最高)
> - `OKR-DRIVEN-ARCHITECTURE.md` (灵魂层)
> - `PRODUCT-DEFINITION.md` (14 项决策, 优先于 PRD)
> - `UI-IA.md` (UI 信息架构 + 设计语言)
> - `PILOT-ONBOARDING.md` (种子客户运营 — 远期商业化才用)

---

## 目录

```
0   一句话定位 + 双模块结构
1   北极星指标 + 三大差异化 + 反差异化
2   12 项产品决策汇总 (引 PRODUCT-DEFINITION)
3   功能模块树 (M0/事半/拿捏)
4   系统架构 + 技术栈
5   数据模型 (Prisma schema 26+ 表)
6   信息架构 + UI (引 UI-IA)
7   非功能需求 (NFR)
8   验收标准 (V1 GA, 50/50 e2e + 新模块)
9   GTM (Go-to-Market) 策略 ★ 新章
10  定价模型 ★ 新章
11  竞品分析 ★ 新章
12  财务模型 (12 人 / 14 月 / 1200 万) ★ 新章
13  风险登记 (V0.2 表 + 新决策风险)
14  路线图 V1/V2/V3
15  团队 + 招聘
16  决策日志 (含本次 14 项)
17  附录 (引用文档清单)
```

---

## 0. 一句话定位

> **Tandem (牛马搭子)**: 一个有 AI 副驾的**企业决议操作系统 + 员工成长伴侣**.
> 双模块: **事半 (企业级 OKR-决议-知识闭环)** × **拿捏 (员工级个人 AI 持续成长)**.

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

---

## 1. 北极星 + 差异化

### 1.1 北极星指标 (6 维度, V0.3 扩展)

| 维度 | 目标 | 备注 |
|---|---|---|
| 决议平均成交时长 | ≤ 17 min | V1 GA 硬指标 |
| 决议否决率 | ≤ 15% | 高 = 拍脑袋多 |
| D 选项使用率 | ≥ 20% | 反 AI 欺诈 |
| **KR 绑定率** | **≥ 95%** | ★ V0.3 新加 (软绑) |
| **日报完成率** | **≥ 90%** | ★ V0.3 新加 |
| **5min 内完成日报** | **≥ 80%** | ★ V0.3 新加 |

### 1.2 三大差异化

```
1. 17 分钟决议室    — 杜绝无效会议, 用结构化框架强制收敛
2. 拿捏老板分身    — 5 阶段进化, 学老板风格代老板做事 (autonomy 守门)
3. OKR 驱动 + 日报反虚报闭环 — 决议挂 KR, 日报算 KR, AI 滞后预警
```

### 1.3 反差异化 (我们不做)

- ❌ 不做通用 IM (V1 仅替代企微**内部**, 不接个人微信, V2 评估)
- ❌ 不做项目管理 (Jira / Linear 已经够好)
- ❌ 不做"全自动决策" AI (永远人在环, 24h 否决窗口)
- ❌ 不让 AI 起草高敏内容 (薪资 / 法律 / 投诉 强制员工亲自处理)
- ❌ 不做政企/事业单位 (§17 sweet spot 限 7 类民企)
- ❌ 不做行政 OA (寄生钉钉/企微即可: 请假/报销/出勤 走 Launchpad 跳板)

---

## 2. 14 项产品决策 (锁定基线)

> **完整说明见 `PRODUCT-DEFINITION.md` §2**. 此处仅汇总.

| # | 维度 | 决策 |
|---|---|---|
| 1 | 第二模块命名 | **拿捏** |
| 2 | DC ↔ KR 关系 | **软绑定**, 默认必选, escape hatch 须填理由 |
| 3 | IM 范围 | **完整替代企微 (内部)** + 会议/文件/文档 + 多端 (PC/Web/iOS/Android) |
| 4 | Persona 模型 | **双层**: 本地 Hermes + 云 DeepSeek |
| 5 | OKR 深度 | **重型 5 层**: O→KR→Initiative→DC→AP + AI 滞后预警 |
| 6 | V1 GA 时间线 | **7-7.75 月** |
| 7 | 邮件存证 | **完整双向**: IMAP 入站 + SMTP 12 事件出站 + hash 入审计 |
| 8 | 日报闭环 | **5min 极简**, AI 预填 80%, AP 反向强推, 反虚报 |
| 9 | 三层 Dashboard | 个人 / 主管 / 老板 三套 |
| 10 | UI 重构 | 5 大顶级导航 + 4 段式首页 + 砍 9 个 Hermes 遗留页 |
| 11 | Intranet | 4 分类 (公告/政策/大事记/福利) + 强制已读 + AI 摘要 + CEO 周记 + 匿名意见箱 |
| 12 | Launchpad | 3 分类 (业务系统/通讯/学习) + SSO + 部门权限 + AI 推荐 |
| 13 | 个人微信 | **V1 不做** (V2 评估合规路径) |
| 14 | 设计语言 | **苹果 + 微软级**: SF Pro/PingFang + 8pt 网格 + 玻璃拟态 + WCAG AA |

---

## 3. 功能模块树

```
M0  共享地基
    ├── M0.1 自研 Auth (登录/MFA/邀请/锁定/会话)            ✅ V1
    ├── M0.2 §13 隐私 (导出/匿名化/否决/拒签)              ✅ V1
    ├── M0.3 链式审计 (hash 不可篡改)                      ✅ V1
    ├── M0.4 双 Storage (InMemory↔Prisma+PG)               ✅ V1
    ├── M0.5 中央 AI 拦截器 (强注入 Baseline + Memory)     ★ M2
    ├── M0.6 SSE 实时层                                    ✅ V1
    └── M0.7 Cron / 慢扫描 (复盘 / SLA / Memory / Persona) ✅ V1

事半 (企业)
    ├── E1 OKR 重型 5 层 + 日报 + Dashboard
    │   ├── E1.1 OKR 5 层骨架 (O/KR/Initiative/DC/AP)      ★ M1
    │   ├── E1.2 KR 软绑定 + escape hatch                  ★ M1
    │   ├── E1.3 5min 日报 ↔ OKR 双向闭环                  ★ M2
    │   ├── E1.4 三层 Dashboard (个人/主管/老板)           ★ M3
    │   ├── E1.5 1on1 + 周报 + 季度 review                 ★ M3
    │   ├── E1.6 9 宫格 (KPI×TTI)                          ✅ V1
    │   └── E1.7 AI 滞后预警 cron                          ★ M3
    │
    ├── E2 议事室 (Convergence)
    │   ├── E2.1 17min 5 步状态机                          ✅ V1
    │   ├── E2.2 3+1 选项 (D 必填)                         ✅ V1
    │   ├── E2.3 KR 软绑定 + 理由                          ★ M1
    │   ├── E2.4 24h 否决窗口                              ✅ V1
    │   ├── E2.5 SSE 流式                                  ✅ V1
    │   └── E2.6 自动 ESCALATE / 7 天复盘 cron             ✅ V1
    │
    ├── E3 IM 完整替代企微 (内部)
    │   ├── E3.1 通讯录树 + 群聊 + 私聊                    ✅ V1 (基础)
    │   ├── E3.2 一键开议事 + 沉 Memory                    ✅ V1
    │   ├── E3.3 @中央 AI / @个人 Persona                  ✅ V1
    │   ├── E3.4 已读回执 + 撤回 + 多端同步                ★ M4
    │   ├── E3.5 音视频会议 (LiveKit + 腾讯 ISV)           ★ M4
    │   ├── E3.6 文件存储 (MinIO)                          ★ M4
    │   ├── E3.7 协同文档 (Univer + Tiptap+Yjs)            ★ M4
    │   └── E3.8 移动端 (iOS + Android)                    ★ M5
    │
    ├── E4 知识 4 层
    │   ├── E4.1 Origins (素材, 90 天)                     ✅ V1
    │   ├── E4.2 Materials (议题)                          ✅ V1
    │   ├── E4.3 Memory 三级签批                           ✅ V1
    │   ├── E4.4 Memory 反向降级                           ✅ V1
    │   └── E4.5 Baseline (公司基线, 强注入)               ★ M2
    │
    ├── E5 邮件存证回路
    │   ├── E5.1 入站 IMAP (Material/DC/Memory 联接)       ★ M5
    │   ├── E5.2 出站 SMTP (12 事件)                       ★ M5
    │   └── E5.3 邮件归档 hash + 合规                      ★ M5
    │
    ├── E6 Intranet (企业内网)
    │   ├── E6.1 4 分类内容 (公告/政策/大事记/福利)        ★ M3
    │   ├── E6.2 强制已读 + AI 摘要 + 版本管理             ★ M3
    │   ├── E6.3 政策同步 Memory.value                     ★ M3
    │   ├── E6.4 CEO 周记 + 匿名意见箱                     ★ M3
    │   └── E6.5 新员工必读 onboarding                     ★ M3
    │
    └── E7 Launchpad (跳板入口)
        ├── E7.1 卡片 CRUD + 3 分类                        ★ M2
        ├── E7.2 部门权限 + SSO 一键                       ★ M2
        ├── E7.3 AI 今日推荐 + 未读角标                    ★ M2
        └── E7.4 使用统计                                  ★ M2

拿捏 (员工)
    ├── P1 个人 AI 双层架构
    │   ├── P1.1 Persona = 本地 Hermes (量化模型)          ★ M5
    │   ├── P1.2 中央 AI = 云 DeepSeek                     ✅ V1
    │   ├── P1.3 路由策略 (本地优先 / 复杂升中央)          ★ M5
    │   └── P1.4 离线模式                                  ★ M5
    │
    ├── P2 5 阶段进化 + 拿捏度
    │   ├── P2.1 newborn → apprentice → assistant         ✅ V1
    │   ├── P2.2 → deputy (consent banner)                ✅ V1
    │   ├── P2.3 → partner (双向 consent)                 ✅ V1
    │   └── P2.4 bossCaptureScore 0-100                   ✅ V1
    │
    ├── P3 持续训练材料挂接
    │   ├── P3.1 强注入 Baseline                           ★ M2
    │   ├── P3.2 强注入 Memory (SOP/Case/Redline)         ✅ V1 (软)
    │   ├── P3.3 调用 Skills (标准智能体)                  ✅ V1
    │   ├── P3.4 个人 DecisionHistory ingest               ✅ V1
    │   └── P3.5 风格学习 (speed/risk/options/comm)        ✅ V1
    │
    └── P4 代行边界 (autonomy 守门)
        ├── P4.1 红区永禁                                  ✅ V1
        ├── P4.2 黄区 24h 否决 + 水印                      ✅ V1
        └── P4.3 绿区可代                                  ✅ V1
```

**模块统计**: ✅ 已上线 27 项 / ★ V1 GA 待建 30 项 / 共 57 项.

---

## 4. 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│              UI 层 (Next.js 14 App Router + Tauri)               │
│   5 大顶级导航 / 4 段式首页 / WCAG AA / Apple+MS 设计语言         │
│   PC Web + Tauri 桌面 + iOS/Android (M5)                         │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌─────────────────────── 业务层 (lib/) ────────────────────────────┐
│  事半 业务模块                  拿捏 业务模块                     │
│  ├ convergence (议事室)         ├ persona (5 阶段)                │
│  ├ okr (5 层重型)               ├ persona/learning                │
│  ├ daily-report (M2)            ├ persona/local-hermes (M5)       │
│  ├ memory (4 层 + 三级签批)     └ persona/proxy                   │
│  ├ im (替代企微 + 协同 M4)                                        │
│  ├ email-bridge (M5)            共享                              │
│  ├ intranet (M3)                ├ central-ai-interceptor (M2)     │
│  └ launchpad (M2)               ├ baseline-injection (M2)         │
│                                 ├ audit (链式 hash)               │
│                                 └ taf (4 层 AI 编排)              │
└─────────────────────────────┬────────────────────────────────────┘
                              ▼
┌─────────── Storage 抽象 (lib/storage/repository.ts) ─────────────┐
│  V1: InMemoryStore (dev)   |   GA: PrismaStore (prod, ✅ 已实跑)  │
└─────────────────────────────┬────────────────────────────────────┘
                              ▼
┌─────────────────── 数据 / 集成 / OSS ───────────────────────────┐
│  PostgreSQL 16 (主)  ·  MinIO (文件 M4)  ·  LiveKit (会议 M4)    │
│  Univer (表格 M4)  ·  Tiptap+Yjs (富文本 M4)                     │
│  IMAP/SMTP (邮件 M5)  ·  腾讯会议 ISV (M4)                       │
│  DeepSeek V3 (云 LLM)  ·  Hermes 4 (本地 Persona M5, Ollama/vLLM)│
└──────────────────────────────────────────────────────────────────┘
```

### 4.1 关键技术决策

- **全 TypeScript** (Next.js 14 + Prisma + 自研 TAF)
- **Storage 双路径**: InMemory 默认 (dev), 设 `DATABASE_URL` 自动切 Prisma + PG (✅ 已 e2e)
- **LLM 双层**: 中央云 DeepSeek + 本地 Hermes (Persona, M5 接入 Ollama/vLLM)
- **私有化优先**: 客户机房或私有云, 我方 0 触碰
- **OSS 借力**: LiveKit/MinIO/Univer/Tiptap 自托管, 不上 SaaS

---

## 5. 数据模型 (Prisma schema)

V1 已上线 26 张表 (✅ migrate init 已实跑). V1 GA 新增 ~10 张表:

```
M0 / Auth (6 表)            ✅ User / PasswordHash / Session / MfaSecret / Invite / AuthEvent
                               + AnonymizationLog (V1 GA)
M0 / Audit (1)              ✅ AuditLog
事半 / 议事室 (5)           ✅ DecisionCard / Origin / Material / NineBoxSnapshot / _DecisionInitiatives
事半 / OKR (5)              ✅ Objective / KeyResult / Initiative / CheckIn / Cycle
                               + ActionItem (✅) + DailyReport (★ M2) + WeeklyReview (★ M3)
事半 / Memory (3)           ✅ MemoryEntry / MemoryPromotionRequest + MemoryDowngradeRequest
事半 / IM (3)               ✅ ImChannel / ImMembership / ImMessage
                               + MeetingRoom (★ M4) + FileAsset (★ M4) + DocAsset (★ M4)
事半 / 邮件 (2)             ★ EmailInbound / EmailOutbound (M5)
事半 / Intranet (3)         ★ IntranetPost / IntranetReadReceipt / IntranetComment (M3)
事半 / Launchpad (2)        ★ Launchpad / LaunchpadClick (M2)
拿捏 / Persona (1)          ✅ Persona
组织 (2)                    ✅ Department / Steward / TTI
```

详细 schema 见 `prisma/schema.prisma`. ER 图见 `docs/ER-DIAGRAM.md` (待建 M1).

---

## 6. UI / 信息架构

> **完整 IA + 设计语言见 `docs/UI-IA.md`** (本 PRD 不重复).

### 6.1 5 大顶级导航

```
🏠 首页 (4 段式)
  ├── 段 1 我的工作台 (Dashboard 浓缩)
  ├── 段 2 企业内网 (Intranet)        ★ 新加
  ├── 段 3 快速跳板 (Launchpad)       ★ 新加
  └── 段 4 IM 摘要 / 议事预告

📊 事半 (企业)
  └── OKR / 议事室 / IM / Memory / 9 宫格

🐉 拿捏 (员工)
  └── 我的 Persona / 成长路径 / 5min 日报

🛠️ 管理 (admin/steward)
  └── 邀请 / Steward / Baseline / Intranet / Launchpad / TAF Skills

⚙️ 设置
  └── 个人 / §13 数据自助 / 通知偏好
```

### 6.2 27 页清理 (M1 W1 第一波 PR)

- 保留 12 / 重命名合并 4 / 新建 5 / 砍 9 / 不确定 2
- 详见 `UI-IA.md` §3 清理映射表

### 6.3 设计语言 (Apple + MS 级)

- **配色**: Semantic Tokens (CSS 变量), 自动 dark mode
- **字体**: SF Pro Text + Segoe UI Variable + PingFang SC, 8 档字号阶梯
- **间距**: 8pt Grid (4/8/16/24/32/48/64)
- **圆角/阴影**: Apple soft shadow + Vibrancy 玻璃拟态
- **动效**: Semantic Motion (5 档时长 + Apple Bezier)
- **可访问性**: WCAG 2.1 AA, Cmd+K 全局命令面板
- 详见 `UI-IA.md` §5

---

## 7. 非功能需求 (NFR)

| 项 | V1 GA 目标 | V2 目标 | 当前状态 |
|---|---|---|---|
| 议事室首屏 | < 2s | < 1s | ✅ ~1.6s |
| LLM 3+1 流式 P50 | < 8s | < 5s | ✅ ~7s (DeepSeek V3) |
| 并发议事室 | 100 / 实例 | 1000 / 实例 | ⚠️ 待压测 (M6) |
| 日报 5min 完成率 | ≥ 80% | ≥ 90% | ⚠️ M2 上线后测 |
| KR 绑定率 | ≥ 95% | ≥ 98% | ⚠️ M1 上线后测 |
| 数据库 | Prisma + PG (✅) | + 读写分离 | ✅ |
| 可用性 SLA | 99% | 99.9% | ⚠️ M6 压测 |
| 安全 | 等保二级 (评估中 M5-M7) | 等保 + 三级 | ⚠️ |
| 国际化 | 中文 | 中英 | 中文 |
| 浏览器 | Chrome/Edge/Safari 现代 | + Firefox | ✅ |
| 移动端 | iOS 15+ / Android 10+ (M5 上线) | 全适配 | ❌ M5 |
| 响应式 | 桌面优先, 平板可用 | 完整响应式 | 桌面 |

---

## 8. 验收标准 (V1 GA)

### 8.1 功能 e2e (50 + 35 = 85 项)

V1 PoC 已 50/50 PASS (33 业务 + 17 auth/隐私). V1 GA 新增 35 项:

```
新增 e2e (V1 GA):
  E1 OKR 5 层 (8): O/KR/Initiative/AP CRUD + DC↔KR 软绑定 + escape hatch + AI 预警
  E1 日报 (5): 5min 倒计时 + AI 预填 + AP 反向强推 + ESCALATE + 反虚报算 KR
  E1 三层 Dashboard (3): 个人/主管/老板 关键卡片渲染
  E3 IM 替代 (6): 已读回执 / 撤回 / 多端同步 / 通讯录树 / LiveKit 接通 / 文件上传
  E3 协同文档 (2): Univer 表格 + Tiptap 富文本 协同写
  E5 邮件 (4): IMAP 入站 → DC 关联 / SMTP COMMIT 通知 / hash 入审计 / DKIM 配置
  E6 Intranet (3): 政策强制已读 / AI 摘要 / 版本 diff
  E7 Launchpad (2): 卡片点击统计 / SSO 一键
  P1 Persona 双层 (2): 本地 Hermes 路由 / 复杂升级中央
```

合并目标: **85 / 85 PASS · 0 FAIL**.

### 8.2 安全验收 (V0.2 + V0.3 新加)

```
✅ 红区 skill 拒 AI 代行
✅ 5 次密码错误账号锁
✅ MFA 启用后无 TOTP 不能 access 高敏 API
✅ 链式 hash 审计不可篡改
✅ /api/integrations/health 全绿
★ 邮件 DKIM/SPF/DMARC 全配
★ 政策强制已读 banner 30 天后邮件 ESCALATE
★ Persona 升 deputy/partner 必须员工 consent (consent_required 守门)
★ Baseline 注入 LLM middleware 100% 命中 (单元测试)
★ 等保二级评估提交 (M5)
```

### 8.3 商业验收 (V0.3 新加)

```
□ 3 家友好客户跑过 7 天 Pilot
□ 4 个 Go-No-Go 硬指标全部达标:
  - ≥ 7 决议
  - ≥ 70% 17min 内
  - ≥ 20% D 选项率
  - ≥ 1 SOP pilot 自产
□ NPS ≥ 40 (一周后回访)
□ Pilot 期 P0 响应中位 ≤ 30 min
□ 至少 1 家正式签约 V1 GA
```

---

## 9. GTM (Go-to-Market) 策略 ★ 新章

### 9.1 目标客户 (§17 sweet spot)

```
规模:    200-1000 人民营企业
行业:    7 类 (互联网 / SaaS / 跨境 / 文娱 / 教育 / 消费 / 创意)
不进:    政府 / 事业单位 / 国企 / 军工 / 金融监管类
决策人:  CEO / COO / 创始人 (本人愿意 Day 1 跑议事室)
痛点签:  曾装钉钉/飞书但员工不用 / 老板感受决策质量没提升 / 数据归属焦虑
```

### 9.2 销售漏斗

```
Awareness (品牌)
  · Pitch Deck PDF 散发 (已就绪 docs/PITCH-DECK.pdf)
  · 创始人微信圈 + 行业群
  · 1 篇 manifesto 长文 (V1 GA 前发布)
  · 反 AI 欺诈 / §13 员工尊严 等观点输出 (季度 2 篇)
        ↓
Interest (兴趣)
  · 30 min 创始人答辩会 (Zoom / 腾讯会议)
  · 现场跑 50/50 e2e PASS 演示
  · Manifesto §4 / §13 / §17 解读
        ↓
Evaluation (评估)
  · 7 天 Pilot (60 min 装机 + Day 1-7 runbook)
  · 不达标全额退款承诺
  · 创始人 30 min P0 SLA
        ↓
Purchase (签约)
  · V1 GA 主合同 (1 年起)
  · 私有化部署 + 数据 100% 客户
        ↓
Expansion (扩张)
  · 部门 → 全公司 (按月加 seat)
  · Pilot 自产 SOP 入 Memory marketplace (V3)
```

### 9.3 阶段目标

| 阶段 | 时间 | 客户数 | ARR 目标 |
|---|---|---|---|
| Pilot Wave 1 | M7 (V1 GA) - M9 | 3 | 0 (免费) |
| Pilot Wave 2 | M9 - M12 | 10 (含 7 家付费) | ¥420 万 (60 万/家) |
| 商业放量 | Y2 (M13-M24) | 30 (累计) | ¥1800 万 |
| 行业领先 | Y3+ | 100+ | ¥6000 万+ |

---

## 10. 定价模型 ★ 新章

### 10.1 V1 GA 定价 (私有化部署)

```
基础版          ¥600 / seat / year, 起订 200 seat = ¥12 万 / 年
                · 全部 V1 GA 功能 (事半 + 拿捏 + 14 项决策)
                · 私有化部署
                · 工作日 P1 响应

专业版          ¥1200 / seat / year, 起订 200 seat = ¥24 万 / 年
                · 基础版 +
                · 本地 Hermes Persona (要求客户有 GPU)
                · 7×24 P0 响应
                · 季度复盘 + Steward 培训

旗舰版          ¥2400 / seat / year + ¥30 万 一次性 implementation fee
                · 专业版 +
                · 国密 SM2/SM3/SM4 (V3)
                · Memory marketplace 接入 (V3)
                · CSM 专人对接
```

### 10.2 Pilot 阶段定价 (M7-M12)

```
Wave 1 (前 3 家): 完全免费, 创始人陪跑, 不达标全额退款
Wave 2 (4-10 家): 50% 折扣, 6 个月起订
Wave 3+:          标准定价
```

### 10.3 单客户经济 (Unit Economics)

```
假设 500 seat 中型客户, 基础版:
  · 年度合同价 (ACV)         = ¥30 万
  · 客户获取成本 (CAC)       = ¥10 万 (销售 + Pilot 期成本)
  · 服务成本 (年度)           = ¥6 万 (LLM api 50% + DevOps 30% + CSM 20%)
  · 毛利率                    = (30 - 6) / 30 = 80%
  · 回本期 (Payback)          = 10 / (30 - 6) = 5 月
  · 假设 3 年留存率 70%
  · LTV (Lifetime Value)     = 30 * (1 + 0.7 + 0.7²) ≈ ¥69 万
  · LTV / CAC                 = 69 / 10 = 6.9x ✅ 健康 (SaaS 标杆 ≥ 3)
```

---

## 11. 竞品分析 ★ 新章

### 11.1 通讯 + 协同象限

| 竞品 | 强 | 弱 (vs Tandem) |
|---|---|---|
| **钉钉** | 大客户 / 政企 / 行政全 | 决策质量 0 关注 / AI 欺诈加速 / 数据出境合规 |
| **企微** | 微信生态 / 私域 / B2C | 内部决策机制弱 / 没 OKR 5 层 / 没 Persona |
| **飞书** | 海外 / 现代 UX / 文档协同强 | 跨境合规风险 / OKR 实施流于表面 / 价格高 |
| **Lark (海外)** | 海外用户体验 | 中国大陆合规问题 |

**Tandem 差异化**: 我们**不替代它们的通讯**, 而是**接管决策层**. 跳板 (Launchpad) 让客户可继续用钉钉/企微做行政, Tandem 接管 OKR + 议事 + 知识.

### 11.2 OKR 工具象限

| 竞品 | 强 | 弱 (vs Tandem) |
|---|---|---|
| **Tita** | 国内 OKR 标杆 / 流程齐 | 没 17min 议事 / 没 AI 反虚报 / 没 Persona |
| **Worktile** | 国产, 集成项目管理 | OKR 是附属 / 没 AI 闭环 |
| **Lattice (海外)** | 全 HR-Tech / 1on1+OKR+360 | 海外, 中国不可用 / 价格 |
| **Notion 项目** | 灵活极高 | 太灵活 = 没流程, OKR 名存实亡 |

**Tandem 差异化**: **决议挂 KR + 日报算 KR + AI 预警 + Memory 反向降级** = 整套反虚报闭环, 别人没有.

### 11.3 AI Copilot 象限

| 竞品 | 强 | 弱 (vs Tandem) |
|---|---|---|
| **Microsoft 365 Copilot** | 生态全 / Excel/Word 自动化 | 个人生产力, 不是组织工具 / 不防 AI 欺诈 |
| **Notion AI** | 写作助手 / 集成度好 | 单点效率 / 没 autonomy / 不防 AI 替员工 |
| **Lark AI** | 集成飞书生态 | 加速 AI 欺诈 / 没 D 选项必填 |
| **国内 "AI 员工"** | 替员工干活 | **直接违反 §1 反 AI 欺诈** |

**Tandem 差异化**: **18 条宪章是工程约束, 不是产品价值观**. AI 分身只是 Persona 学员工的助手, 不是替员工; D 选项强制人写, 红区强禁 AI; 24h 否决人撤回. 别人都不敢碰这条.

### 11.4 公司内网象限

| 竞品 | 强 | 弱 (vs Tandem) |
|---|---|---|
| **WordPress 内网模板** | 便宜 / 自部署 | 非智能 / 没强制已读 / 没 AI 摘要 |
| **Confluence** | 文档协同强 | 公告/政策没 SOP / 不挂 OKR |
| **企微/钉钉公告** | 集成原生 | 混在 IM 里 / 没版本管理 / 没匿名意见 |

**Tandem 差异化**: **Intranet 政策同步 Memory.value + AI 强注入** = 政策不再是死文档, AI 每次决策都按它办. 反"老板说一套, 员工干一套".

---

## 12. 财务模型 ★ 新章

### 12.1 12 人 / 14 月 / 1200 万 RMB 分解

```
人头 (12 人 × 14 月 × 平均 5 万 / 月)            ≈ 840 万   (70%)
  · CEO/产品 1                  · 销售/BD 2
  · CTO/架构 1                  · CSM 1
  · 全栈工程 4                  · 法务/合规 0.5 (兼)
  · 设计 1                      · HR/财务 0.5 (兼)
  · QA/DevOps 1

LLM API (DeepSeek + 备选)                          ≈ 60 万   (5%)
  · 开发期 + Pilot 期我方垫付
  · 上线后客户按用量收回

服务器 / 云 (含 GPU 一台 A10×4 用于 Hermes 调试)   ≈ 80 万   (7%)

法务 / AGPL review / 合同模板                       ≈ 30 万   (2.5%)

等保二级评估 + 渗透测试                             ≈ 40 万   (3%)

销售 / 市场 (Pitch Deck 设计 + 行业活动 + 内容)    ≈ 80 万   (7%)

办公 / 差旅 / 杂项                                  ≈ 70 万   (5.5%)
                                                    ─────────
                                                   1200 万
```

### 12.2 收入预测 (Y1-Y3)

```
                    Y1 (M1-M12)    Y2 (M13-M24)    Y3 (M25-M36)
新签客户            10              30              80
累计客户            10              40              120
平均 ACV            ¥30 万          ¥40 万          ¥50 万 (含旗舰版)
新签 ARR            ¥420 万 *       ¥1800 万        ¥6000 万
留存 ARR            ¥0              ¥210 万 (Y1 留)  ¥1500 万 (Y1+Y2 留)
总收入              ¥420 万          ¥2010 万        ¥7500 万

假设 Y1 留存 50%, Y2 留存 75%, Y3 留存 85% (符合 SaaS 增长曲线)
* Wave 1 (3 家) 免费 + Wave 2 (7 家) 50% 折扣 = ¥420 万
```

### 12.3 单位经济演进

| 指标 | Y1 | Y2 | Y3 |
|---|---|---|---|
| LTV / CAC | 5x (Pilot 折扣) | 7x | 8x |
| 毛利率 | 70% | 78% | 82% |
| Net Revenue Retention | n/a (新公司) | 110% | 125% |
| Payback Period | 8 月 | 5 月 | 4 月 |

---

## 13. 风险登记

### 13.1 V0.2 已识别 + V0.3 状态更新

| 风险 | 概率 | 影响 | 缓解 | V0.3 状态 |
|---|---|---|---|---|
| AGPL (Cal.com / MinIO / Univer) | 高 | 中 | 法务 review (M6), 备选 SeaweedFS | M6 启动 |
| 腾讯会议 ISV 慢 | 高 | 中 | M2 启动 BD, M4 接入 | 待启动 |
| 应用市场审核 | 高 | 低 | 平行三家, 不阻塞私有化 | 不阻塞 |
| 等保二级 3 月 | 高 | 中 | M5 提交, M7 GA 时若未拿证 用"评估中" | 计划中 |
| LLM 成本失控 | 中 | 高 | TAF Budget Tracker 三层守门 | ✅ 已实现 |
| 客户对"分身"恐惧 | 中 | 高 | autonomy 守门 + §13 4 项保障 | ✅ 已实现 |
| Persona deputy 误代行 | 中 | 高 | 24h 否决 + 红区强退 + 水印 | ✅ 已实现 |

### 13.2 V0.3 新决策风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 客户没 GPU 跑 Hermes Persona | 高 | 中 | 提供"全云 fallback", 用 DeepSeek 模拟 Persona |
| Hermes 4 量化版质量 < DeepSeek | 中 | 高 | 选官方 70B 量化, 复杂任务保守路由升中央 |
| 28 周工期超支 | 中 | 高 | 月度评审, 必要时砍协同文档 (E3.7) 到 V1.5 |
| Univer/Tiptap+Yjs 协作冲突难调 | 中 | 中 | V1 GA 仅单人编辑, V1.5 加多人 OT/CRDT |
| LiveKit 自部署运维负担 | 中 | 中 | docker-compose + Coturn 一键启动 + SOP |
| 移动端 +3 周追加工期失败 | 中 | 中 | M5 双轨 (Web 优先打磨), 移动端不行就 V1.5 |
| Pilot Wave 1 全额退款风险 | 中 | 高 | 4 硬指标提前明示, 心态上接受其中 1 家退款 |
| 个人微信 V2 接合规路径不通 | 中 | 中 | V2 设计期同步 BD 企微/Wechaty, 双备用 |
| 设计 Apple+MS 级落地难 | 低 | 中 | 招专业设计师 + 建立 design system (M1 优先) |

---

## 14. 路线图

### V1 PoC (M0, 已完成)

```
✅ 50/50 e2e PASS (33 业务 + 17 auth/隐私)
✅ 14 篇战略文档 + PRODUCT-DEFINITION + UI-IA + PILOT-ONBOARDING + PITCH-DECK
✅ Prisma migrate 实跑 PostgreSQL
✅ 议事室 5 步 + 3+1 + 17min 闭环
✅ Persona 5 阶段 + consent UI + 学习钩子
✅ §13 4 项尊严 (导出 + 匿名化)
✅ Memory 三级签批 + 反向降级
✅ 红区 AI 拒签
✅ 链式审计 hash
```

### V1 GA (M1-M7, 7 月)

```
M1  UI 重构 (1w) + OKR 5 层 (3w)
M2  日报闭环 (2w) + 中央 AI 拦截器 (1w) + Launchpad (1w)
M3  三层 Dashboard (2w) + Intranet (2w)
M4  IM 升级 (会议 + 文件 + 文档) (4w)
M5  Persona 双层 + 邮件回路 + 移动端 (4w + 弹性)
M6  法务 + 合规 + 性能压测 (4w)
M7  GA + 3 家友好客户 Pilot (4w)
```

### V2 商业放量 (M8-M18, 1 年)

```
□ 钉钉 / 企微 / 飞书任一上架
□ 多租户 SaaS 切面
□ Persona deputy 阶段公开 + V1.5 多人协同文档
□ 移动端深度打磨
□ WebAuthn / Passkey
□ 销售落地页 + 视频 demo + 10 个 logo 案例
□ Steward 培训 SOP 体系
□ 个人微信集成 (V2 评估合规路径)
```

### V3 生态 (M19+)

```
□ Persona partner 阶段 (跨企业)
□ Tandem 作为 OIDC Provider (反向 IdP)
□ Memory marketplace (跨企业 SOP 交换)
□ AI Native 重构议事室 (不限 17min, 但保留质量信号)
□ 国密 SM2/SM3/SM4 (政企客户 V3, §17 限制松绑后)
□ 国际化 (中英双语, 海外华人民企)
```

---

## 15. 团队 + 招聘

### 15.1 V1 GA 12 人配置

| 角色 | 人数 | 主责 |
|---|:-:|---|
| CEO / 产品 | 1 | 战略 + Champion 接洽 + 宪章守门 |
| CTO / 架构 | 1 | TAF + Storage + Persona 双层 |
| 全栈工程 | 4 | M1-M5 业务模块 (M1 OKR / M2 日报+中央 AI / M3 Dashboard+Intranet / M4 IM 升级) |
| 设计 | 1 | UI-IA §5 设计语言落地 + 组件库 |
| QA / DevOps | 1 | e2e 维护 + 等保 + 压测 + Pilot 部署 |
| 销售 / BD | 2 | Pitch + 行业拓展 + 应用市场 BD |
| CSM | 1 | Pilot 陪跑 + Steward 培训 |
| 法务/合规/HR/财务 | 0.5 各, 共 1 | 兼任, 必要时外包 |

### 15.2 招聘画像 (重点 4 个)

```
全栈工程 (4)
  · 5 年+ TS + Next.js + Prisma 实战
  · 认同 18 条宪章 (面试时给读)
  · 不要 "AI 万能论" 信徒, 要怀疑论者

设计 (1)
  · 苹果 / 微软 / Linear / Vercel 风格作品
  · 熟悉 8pt 网格 / Semantic Tokens / WCAG
  · 有 design system 落地经验

CTO (1)
  · GPU 量化模型部署经验 (Ollama / vLLM)
  · 私有化部署 SOP 编写能力
  · 数据库 / 安全 / 性能全栈

销售 (2)
  · 200-1000 人民企 CEO 资源
  · 听得懂 §13 数据归属 + §17 sweet spot
  · 不卖 "替代钉钉飞书" 故事, 卖 "决议操作系统"
```

---

## 16. 决策日志

### V0.2 决策 (2026-05-07)

| 日期 | 决策 | 替代方案 | 理由 |
|---|---|---|---|
| 2026-05-07 | 改名 Tandem | 拿捏 Enterprise | 国际化 + 中性 |
| 2026-05-07 | 全 TS 砍 Python | NestJS+Python | 团队同栈 |
| 2026-05-07 | TAF 自研 | LangGraph | 议事室专用 |
| 2026-05-07 | 自研身份 | NextAuth | 私有化 + 数据归属 |
| 2026-05-07 | 17min 硬上限 | 自由议事 | 强制收敛 |
| 2026-05-07 | 3+1 框架 (D 必写) | 单选 | 反 AI 欺诈 |
| 2026-05-07 | 9 宫格 KPI×TTI | 单 KPI | 双轨防完成 100% 没成长 |
| 2026-05-07 | Memory 三方签批 | 任意员工提交 | 防劣币驱逐 |
| 2026-05-07 | 砍 yearEndBonusModifier | 软挂钩 ±10% | §4 TTI 永不挂奖金 |
| 2026-05-07 | 议事室 ALIGN/FRAME 重命名 | CONTEXT_GATHER | §3 字面对齐 |
| 2026-05-07 | 17min 硬闭环 + 7 天复盘 cron | stall-detector 软信号 | 真状态机 ESCALATE |
| 2026-05-07 | Memory Lv1/Lv2/Lv3 三级 | 单级 CEO 都签 | 不可行 |
| 2026-05-07 | Memory 反向降级 | 时间归档 | §8.2 严肃流程 |
| 2026-05-07 | Persona 自动升 + autonomy 守门 | 全部手动 | UX 优化 |

### V0.3 决策 (2026-05-10, 本次)

| # | 决策 | 替代方案 | 理由 |
|---|---|---|---|
| 1 | 第二模块 = 拿捏 | 功倍 / 伴成长 / 倍速 | 呼应北极星 |
| 2 | DC ↔ KR 软绑定 | 硬绑定 / 不绑 | 95% 决议挂 KR, 5% 紧急 escape |
| 3 | IM 完整替代企微 (内部) | 寄生 RocketChat | 客户痛点直击 |
| 4 | Persona 双层 (本地+云) | 全云 / 全本地 | 拿捏故事强 + 成本可控 |
| 5 | OKR 重型 5 层 | 轻 / 中 | 类 Tita 体验 + AI 预警 |
| 6 | V1 GA 7 月 | 6 月 / 8 月 | 14 项决策可塞下 |
| 7 | 邮件双向完整 | 仅出站 | 法律级存证 + 12 事件通知 |
| 8 | 5min 日报 + AP 反向强推 | 形式主义周报 | 反虚报闭环 |
| 9 | 三层 Dashboard | 单层 | 老板/主管/员工各取所需 |
| 10 | UI 5 大导航重构 | 维持 27 页混乱 | 必须重构, 砍 9 页 |
| 11 | Intranet 4 分类 | 仅公告 | 政策强制读 + AI 摘要 是差异化 |
| 12 | Launchpad 3 分类 | 不做 | ERP/CRM 入口刚需 |
| 13 | V1 不接个人微信 | V1 接合规 / V1 接 wxbot | V1 资源给替代企微优先 |
| 14 | 苹果+MS 设计基准 | 现有混乱 Tailwind | 大气整洁 = 信任来源 |

---

## 17. 附录 · 引用文档清单

```
docs/
├── MANIFESTO.md                      ★ 18 条宪章 (产品哲学根, 不可改)
├── PRODUCT-DEFINITION.md             ★ 14 项决策锁定稿 (优先于 PRD)
├── UI-IA.md                          ★ UI 信息架构 + 设计语言
├── PRD.md                            ★ 本文 (v0.3)
├── PRD-v0.2-archive.md                  历史归档
├── PILOT-ONBOARDING.md                  种子客户 7 天 runbook
├── PITCH-DECK.md / .pdf / .pptx         销售 16 页 deck
├── PRISMA-SETUP.md                      PG 部署 SOP
├── USER-GUIDE.md                        终端用户指南
├── MANIFESTO 子文档 (12):
│   ├── CONVERGENCE-PRINCIPLE.md         议事室 5 步原理
│   ├── TTI-FRAMEWORK.md                 TTI 双轨 60-70% 健康
│   ├── KNOWLEDGE-ARCHITECTURE.md        4 层知识架构
│   ├── PERSONA-EVOLUTION.md             5 阶段路线
│   ├── MEETING-PROXY.md                 寄生腾讯会议
│   ├── OKR-EXPERIENCE.md                OKR 设计哲学
│   ├── OKR-FEATURE-MATRIX.md            60+ OKR 功能
│   ├── AUTH-NATIVE.md                   自研身份
│   ├── COMPLIANCE-CHECKLIST.md          等保/GDPR/PIPL
│   ├── MARKETPLACE-SUBMISSION.md        应用市场
│   ├── INFO-ARCHITECTURE.md             早期 IA (被 UI-IA.md 取代)
│   └── WECOM-FEATURE-MAPPING.md         企微功能对标
├── AGENT-FRAMEWORK.md                   TAF 4 层架构
├── OSS-STACK.md                         14 个 OSS 集成
├── ROADMAP.md                           长期路线
├── SUPPLEMENT-TEAMS-COWORK.md           协作补充
└── progress.txt                         代码进度
```

---

## 文档优先级

```
MANIFESTO (不可改, 法律)
    ↓
PRODUCT-DEFINITION (本次会话锁定, 改动须走变更评审)
    ↓
PRD (本文, 完整规格)
    ↓
UI-IA (UI 设计实施)
    ↓
USER-GUIDE (面向终端用户)
```

任何冲突, 上层优先. 本 PRD 任何后续变更必须更新 §16 决策日志.

> "不做更多功能, 而是让每个决议在 17 分钟内有结果." — Tandem 团队
