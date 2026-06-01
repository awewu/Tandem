# Docs Index · Tandem 项目文档总目录

> **最后整理**: 2026-06-01 (文档复盘去重: 110 → 68 活跃 + 4 删除(v1残留) + 37 归档)
> **维护承诺**: 新加 `docs/*.md` 必须在本文件登记一行。
> **归档政策**: 被取代/历史快照 → `git mv` 到 `docs/archive/`，并在 §7 登记，**不直接删**(git 历史可恢复)。

---

## 0. 单一真相源 (Source of Truth) ★

按"凡冲突，以下文件优先"顺序：

| 优先级 | 文件 | 范围 |
|---|---|---|
| 1 (最高) | `MANIFESTO.md` | 20 条不动条款 (v2.0) |
| 2 | `CHARTER-UI-V1.md` | UI 铁律 + 违规事故档案 |
| 3 | `CHARTER-FOUR-PILLARS.md` | IM/文档/日历/邮件 4 支柱 |
| 4 | `CHARTER-KPI-TTI.md` | KPI vs TTI 双轨度量 |
| 5 | `PLATFORM-ARCHITECTURE-2026-05-29.md` | 18 项架构决议 + AI 三层 + G1-G4 |
| 6 | `PRD.md` | 当前 PRD |
| 7 | `OKR-DRIVEN-ARCHITECTURE.md` | 事半 (OKR) 域架构 |
| 8 | `CENTRAL-AI-ARCHITECTURE.md` | 中央 AI / Tandem Atlas |

**状态真相源**: `STATUS.md` (根目录) = 项目当前状态唯一真相源。写新进展追加到 STATUS.md，不再开 `PROGRESS-{date}.md`。

---

## 1. 战略 · 宪章与产品

| 文件 | 一句话 |
|---|---|
| `MANIFESTO.md` | 20 条不动条款 (v2.0 价值进取型) |
| `CHARTER-FOUR-PILLARS.md` | IM/文档/日历/邮件 4 模块护城河 |
| `CHARTER-KPI-TTI.md` | KPI/TTI 双轨度量 |
| `CHARTER-TECH-v2.md` | 工程层设计原则 |
| `CHARTER-CHEATSHEET.md` | 4 份宪章速查卡 (v2.0 对齐) |
| `PRODUCT-DEFINITION.md` | 产品定义 (v2.0 对齐) |
| `PRODUCT-NARRATIVE.md` | 产品叙事 (v2.0 对齐) |
| `PROJECT-OVERVIEW.md` | 项目总览 |
| `SELF-USE-FIRST.md` | "我们先自用" 原则 |

## 2. 架构 · 当前生效

| 文件 | 一句话 |
|---|---|
| `PLATFORM-ARCHITECTURE-2026-05-29.md` ★ | 18 项架构决议 + AI 三层 + G1-G4 护栏 |
| `UNIFIED-TECH-DESIGN.md` ★ | 统一技术设计 (TandemNode 原语 / governedChat / Skill Gateway as MCP) |
| `OKR-DRIVEN-ARCHITECTURE.md` | 事半 OKR 域架构 (第一性原理) |
| `CENTRAL-AI-ARCHITECTURE.md` | Tandem Atlas / 中央 AI |
| `CENTRAL-AI-DRIVER-MAP.md` | 中央 AI 驱动全模块复盘 (介入各模块详解) |
| `CENTRAL-AI-TECH-STACK-DRIVER.md` | 中央 AI 技术栈驱动全模块分析 (5 层技术栈) |
| `CENTRAL-AI-ENTERPRISE-EDGE.md` | 中央 AI 企业边界 (G2 数据红线) |
| `AGENT-FRAMEWORK.md` | Agent 分层 (Layer 1-4) |
| `KNOWLEDGE-ARCHITECTURE.md` | Memory 4 层 ownership |
| `INFO-ARCHITECTURE.md` | 信息架构 (路由/模块边界) |
| `UI-IA.md` | UI 信息架构 + §5 设计语言 |
| `PERSONA-EVOLUTION.md` | 主分身 5 阶段进化 |
| `MEETING-PROXY.md` | 议事室代理参会规则 (v2.0 对齐) |
| `CONVERGENCE-PRINCIPLE.md` | 17 分钟议事收敛 |
| `TTI-FRAMEWORK.md` | TTI 战略推动力 |
| `SUMMON-AND-NURTURE.md` | 召唤式工作台 / 主分身培养 |
| `ACADEMY-METAPHOR-2026-05-29.md` | 学院化主分身 |
| `OWNERSHIP-SSOT-2026-05-31.md` | Ownership SSOT + Org 后端化 |
| `ARCHITECTURE-BREAKDOWN.md` | Tandem 7 大思路功能+架构拆解 (实现轴) |
| `STATE-OF-THE-CODE.md` | 代码现状 |
| `STORE-SLICE-PLAN-2026-05-31.md` | `lib/store.ts` 拆 slice 备忘 |

## 3. UI 设计

| 文件 | 一句话 |
|---|---|
| `CHARTER-UI-V1.md` ★ | UI 铁律 + 违规事故档案 |
| `CHARTER-UI-V1-CHEATSHEET.md` | UI 铁律速查卡 |
| `UI-DESIGN-COMMUNICATION.md` | 设计沟通规范 |
| `UI-AUDIT-2026-05-31.md` | UI 审计 (charter 违规扫描基线) |

## 4. 竞品对标 (复盘去重后)

| 文件 | 一句话 |
|---|---|
| `COMPETITOR-ARCHITECTURE.md` ★ | 7 竞品架构拆解 **详细 SoT** (灵魂+代码映射+gap，2026-06-01 逐条核实) |
| `CLAUDE-COWORK-ANALYSIS.md` | Claude Cowork vs Tandem 技术体系对比分析 (4 道闸 + MCP 三原语) |
| `EVOLUTION-CHECKLIST-FULL.md` ★ | 7 竞品**可执行进化清单** (编号项+落点+验收+核实状态) |
| `COMPETITIVE-ANALYSIS-2026-05-30.md` | 竞品定位 + 销售 Q&A 脚本 |
| `WECOM-FEATURE-MAPPING.md` | IM vs 企业微信功能映射 |
| `TANDEM-vs-FEISHU-GAP-ANALYSIS.md` | Tandem vs 飞书差距 |

## 5. OKR 专题 (复盘去重后)

| 文件 | 一句话 |
|---|---|
| `OKR-DRIVEN-ARCHITECTURE.md` ★ | OKR 域架构 SoT |
| `OKR-EVOLUTION-PLAN.md` ★ | OKR 双层进化 (底座 B1-B8 + 杠杆 L1-L2) |
| `TITA-OKR-DEEP-DIVE.md` | Tita OKR 深度分析 (OKR-EVOLUTION-PLAN 的详细来源) |

## 6. 演进 · 计划 / 复盘 / 审计 (当前)

| 文件 | 一句话 |
|---|---|
| `EVOLUTION-PLAN-2026-05-30.md` | 19 项技术债与战略短板整合方案 |
| `MASTER-UPGRADE.md` | 主升级总纲 (v2.0 对齐) |
| `ROADMAP-AI.md` | AI 路线 |
| `PLAN-DOCS-BEYOND-FEISHU-2026-05-31.md` | 文档能力超飞书计划 |
| `NOTION-CATCHUP-PLAN.md` | Notion 完整追赶计划（6 阶段 16-18 周） |
| `AI-BACKLOG.md` | AI backlog (B-xxx 编号) |
| `AI-RADAR.md` | AI 技术雷达 |
| `REFLECTION-2026-05-30-CLOSURE.md` | 闭环复盘 (最新) |
| `PRODUCTION-AUDIT-2026-05-31.md` | 生产级上线审计 |
| `TEST-MATRIX-2026-05-30.md` | 测试矩阵 + 规划 |
| `GOVERNANCE-THREE-DEPARTMENTS-2026-05-30.md` | 三省六部治理协同 |

## 7. 运营 / 合规 / 商业 / 接入

| 文件 | 一句话 |
|---|---|
| `PILOT-ONBOARDING.md` | 试点企业上车 SOP |
| `INTERNAL-USER-GUIDE.md` | 内部用户指南 |
| `USER-GUIDE.md` | 终端用户指南 |
| `PITCH-DECK.md` (+pdf/pptx) | 路演稿 (SaaS 过期, 保留 pdf/pptx) |
| `MARKETPLACE-SUBMISSION.md` | 应用市场提交 |
| `COMMERCIAL-READINESS-GAP.md` | 商业化就绪差距 |
| `COMPLIANCE-CHECKLIST.md` | 合规清单 |
| `PRIVACY-POLICY.md` | 隐私政策 |
| `DPA-TEMPLATE.md` | 数据处理协议模板 |
| `PRODUCTION-DEPLOY.md` | 生产部署 |
| `RECOVERY-SOP.md` | 故障恢复 |
| `OSS-STACK.md` | 开源技术栈 |
| `AI-SETUP.md` | AI 模型接入 |
| `AUTH-NATIVE.md` | 原生鉴权 |
| `YJS-SETUP.md` | Yjs 协同 |
| `BUILD-FEISHU-CLASS-FOUNDATION.md` | 飞书级基础设施 |
| `PROCESS-RULES.md` | 流程规则 |

---

## 8. 归档区 (Archived · 不再追加，`docs/archive/`)

> 2026-06-01 复盘归档。被取代或历史快照，保留供追溯。

### 历史快照 / 审计

`A2-PROGRESS.md` · `ARCHITECTURE-AND-CHARTER.md` (→PLATFORM-ARCHITECTURE) · `AUDIT-2026-05-10.md` · `AUDIT-2026-05-10-A-realbackend.md` · `AUDIT-2026-05-13-FULL.md` · `DEAD-CODE-AUDIT-2026-05-29.md` · `DEPLOY-READINESS-AUDIT.md` · `META-REVIEW-2026-05-27.md` · `REFLECTION-2026-05.md` (→CLOSURE) · `RETROSPECTIVE-2026-05-12.md` · `RELEASE-2026-05-19.md` · `IMPL-NOTES-2026-05-29.md` · `UI-AUDIT-AFTER-CODEMOD.md` · `UI-AUDIT-FINAL.md` · `UI-AUDIT-REPORT-GEMINI.md`

### Evolution 旧版 (→ EVOLUTION-PLAN-2026-05-30 / EVOLUTION-CHECKLIST-FULL)

`EVOLUTION-2026-05.md` · `EVOLUTION-2026-05-APPENDIX-CLAUDE-CODE.md` · `EVOLUTION-2026-05-APPENDIX-RUFLO.md` · `EVOLUTION-2026-05-APPENDIX-SKILLS-AND-HERMES.md` · `EVOLUTION-ROADMAP-2026-05-28.md` · `EVOLUTION-ROADMAP-2026-05-V2.md` · `EVOLUTION-STATUS-2026-05-28.md` · `OPTIMIZATION-PLAN-2026-05-28.md` · `OPTIMIZATION-PLAN-2026-05-28-CROSSCHECK.md` · `ROADMAP.md`

### 竞品旧版 (→ COMPETITOR-ARCHITECTURE / EVOLUTION-CHECKLIST-FULL)

`COMPETITIVE-DEEP-DIVE-2026-05-30.md` · `COMPETITIVE-CLAUDE-CODE-CODEX-DEEP-2026-05-30.md` · `IM-VS-WECOM.md` (→WECOM-FEATURE-MAPPING) · `MOBILE-VS-GPT-KIMI.md` · `SUPPLEMENT-TEAMS-COWORK.md`

### OKR 旧版 (→ OKR-EVOLUTION-PLAN / TITA-OKR-DEEP-DIVE)

`OKR-EXPERIENCE.md` · `OKR-FEATURE-MATRIX.md` · `OKR-VS-TITA.md`

### 其他

`PRD-v0.1-archive.md` · `PRD-v0.2-archive.md` · `PRISMA-SETUP.md` (已切 drizzle) · `PRODUCTION.md` (→PRODUCTION-DEPLOY)

---

## 项目根目录的高层文档 (非 docs/)

| 文件 | 用途 |
|---|---|
| `README.md` | 项目入门 |
| `STATUS.md` ★ | **当前项目状态唯一真相源** |
| `TEST-REPORT.md` | 测试报告 |
| `DEPLOY*.md` / `DOCKER-SETUP.md` / `DESKTOP.md` / `LAUNCH-CHECKLIST.md` | 部署/桌面/上线手册 |
| `LOCAL-SHARE.md` / `TRY-IT.md` | 本地分享、试用 |

---

## 维护节奏

- 写新 `docs/*.md` → **必须**在本文件登记一行
- 删/归档 → `git mv` 到 `docs/archive/` + 移到 §8 登记，不直接删
- 每月 Steward 巡视: "过去 30 天没人引用"的文档考虑归档
