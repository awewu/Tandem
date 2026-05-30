# Docs Index · Tandem 项目文档总目录

> **最后整理**: 2026-05-30 PT
> **维护承诺**: 新加 docs/*.md 必须在本文件登记一行 (避免再次"83 份找不到最新")。
> 删 / 归档老文档时, 把行移到 §6 归档区, 不要直接删。

---

## 0. 单一真相源 (Source of Truth) ★

按"凡冲突, 以下文件优先"顺序：

| 优先级 | 文件 | 范围 | 状态 |
|---|---|---|---|
| 1 (最高) | `docs/MANIFESTO.md` | 20 条不动条款 | 不可频繁改 |
| 2 | `docs/CHARTER-UI-V1.md` | UI 铁律 + 违规事故档案 | 持续累积 |
| 3 | `docs/CHARTER-FOUR-PILLARS.md` | IM/文档/日历/邮件 4 支柱护城河 | 战略 |
| 4 | `docs/CHARTER-KPI-TTI.md` | KPI vs TTI 双轨度量 | 战略 |
| 5 | `docs/PLATFORM-ARCHITECTURE-2026-05-29.md` | 18 项架构决议 + AI 三层 + G1-G4 护栏 | 最新架构 |
| 6 | `docs/PRD.md` | 当前 PRD (PRD-v0.1 / v0.2 已归档) | 持续修订 |
| 7 | `docs/OKR-DRIVEN-ARCHITECTURE.md` | 事半 (OKR) 域架构 | 持续修订 |
| 8 | `docs/CENTRAL-AI-ARCHITECTURE.md` | 中央 AI / Tandem Atlas | 持续修订 |

**当前状态报告 (single status SSOT)**:
- `STATUS.md` (根目录) = 项目整体状态当前页, **唯一状态真相源**。
- `PROGRESS-2026-05-29.md` (根目录) = 历次推进的"档案", 不再更新, 仅作历史参考。
- `RELEASE-COMMIT-PLAN.md` / `RELEASE-COMMIT-PLAN-2.md` = 历史交付计划档案。
- `docs/EVOLUTION-*` 系列 = 历次进化路线规划; 最新是 `EVOLUTION-PLAN-2026-05-30.md`。

> 写新进展, **追加到 STATUS.md**, 不要再开 `PROGRESS-{date}.md`。如果一定要开, 在 STATUS 顶部加引用。

---

## 1. 战略 · 宪章与铁律

| 文件 | 一句话 |
|---|---|
| `MANIFESTO.md` | 20 条不动条款 ("决议替消息" / "3+1" / "拿捏老板分" / 反卷度量) |
| `CHARTER-UI-V1.md` | UI 铁律 + 6 条违规事故档案 + ratchet (script: `check-ui-charter.mjs`) |
| `CHARTER-FOUR-PILLARS.md` | IM/文档/日历/邮件 4 模块 30+ 条飞书 18-24 月做不到的能力 |
| `CHARTER-KPI-TTI.md` | KPI/TTI 双轨度量, 财务奖金路径 + 战略推动力路径 |
| `CHARTER-CHEATSHEET.md` | 上面 4 份的速查卡片 |
| `CHARTER-TECH-v2.md` | 工程层设计原则 |
| `PRODUCT-DEFINITION.md` | 产品定义 |
| `PRODUCT-SPIRIT.md` | 产品精神 |
| `PRODUCT-NARRATIVE.md` | 产品叙事 |
| `PITCH-LAUNCH-2026-05-30.md` ★ | **上线介绍资料** (89,878 行实证 + 5 道闸全绿 + 客户边界 + 销售话术) |
| `PITCH-SPEAKER-SCRIPT-2026-05-30.md` ★ | **12 分钟演讲稿** (8 段 + 6 类 Q&A + 演示动作 + 场地准备清单) — PITCH-LAUNCH 的口播版 |
| `COMPETITIVE-ANALYSIS-2026-05-30.md` ★ | **企业级 AI Agent 竞品对标** (Coze/Claude/Copilot/ChatGPT Enterprise 时间线 + 真定位 "首个 OKR 决议链 OS" + Q&A 应对脚本) |
| `REFLECTION-2026-05-30-CLOSURE.md` ★ | **闭环复盘 + 文档冲突修正 + 借鉴清单 + AI 时代产品自信论据** (40 项功能闭环计分 / 4 处战略冲突修复 / 8 类大厂借鉴 / 3 个产品自信论据) |
| `TEST-MATRIX-2026-05-30.md` ★ | **测试矩阵 + 完整测试规划** (40 文件 / 372 it 覆盖矩阵 + 修 1 fail + 抽 fixture 共享 + 5 道 CI 闸协同 + 90 天补齐路线) |
| `MANIFESTO.md` 序言 + 文化基座 | "四个满意" (客户/员工/股东/社会) |

## 2. 架构 · 当前生效

| 文件 | 一句话 |
|---|---|
| `PLATFORM-ARCHITECTURE-2026-05-29.md` ★ | **最新**: 18 项架构决议 + AI 三层 + G1-G4 护栏 |
| `OKR-DRIVEN-ARCHITECTURE.md` | 事半 OKR 域 |
| `CENTRAL-AI-ARCHITECTURE.md` | Tandem Atlas / 中央 AI |
| `CENTRAL-AI-ENTERPRISE-EDGE.md` | 中央 AI 企业边界 (G2 数据红线) |
| `AGENT-FRAMEWORK.md` | Agent 分层 (Layer 1-4) |
| `KNOWLEDGE-ARCHITECTURE.md` | Memory 4 层 ownership |
| `INFO-ARCHITECTURE.md` | 信息架构 (路由/模块边界) |
| `UI-IA.md` | UI 信息架构 + §5 设计语言 |
| `PERSONA-EVOLUTION.md` | 主分身 5 阶段进化 |
| `MEETING-PROXY.md` | 议事室代理参会规则 |
| `TTI-FRAMEWORK.md` | TTI 战略推动力 |
| `CONVERGENCE-PRINCIPLE.md` | 17 分钟议事收敛 |
| `SUMMON-AND-NURTURE.md` | 召唤式工作台 / 主分身培养 |
| `ACADEMY-METAPHOR-2026-05-29.md` | 学院化主分身 (StudentCard/CourseTabs) |

## 3. 演进 · 路线 / 反思 / 审计

| 文件 | 一句话 |
|---|---|
| `EVOLUTION-PLAN-2026-05-30.md` ★ | **最新**: 19 项技术债与战略短板的整合方案 |
| `EVOLUTION-2026-05.md` | 2026-05 总进化 |
| `EVOLUTION-2026-05-APPENDIX-*` | 三份附录 (Claude Code / Ruflo / Skills) |
| `EVOLUTION-ROADMAP-2026-05-28.md` | 路线图 |
| `EVOLUTION-ROADMAP-2026-05-V2.md` | 路线图 V2 |
| `EVOLUTION-STATUS-2026-05-28.md` | 路线进展 (历史) |
| `REFLECTION-2026-05.md` | 月度反思 |
| `META-REVIEW-2026-05-27.md` | 元审查 |
| `RETROSPECTIVE-2026-05-12.md` | 早期复盘 |
| `RELEASE-2026-05-19.md` | 发版日志 |
| `OPTIMIZATION-PLAN-2026-05-28.md` | 优化计划 |
| `OPTIMIZATION-PLAN-2026-05-28-CROSSCHECK.md` | 交叉验证 |
| `AUDIT-2026-05-10.md` | 早期审计 |
| `AUDIT-2026-05-10-A-realbackend.md` | 后端真实化审计 |
| `AUDIT-2026-05-13-FULL.md` | 全量审计 |
| `DEAD-CODE-AUDIT-2026-05-29.md` | 死代码审计 |
| `DEPLOY-READINESS-AUDIT.md` | 部署就绪审计 |
| `IMPL-NOTES-2026-05-29.md` | 实施备注 |
| `STATE-OF-THE-CODE.md` | 代码现状 |

## 4. 业务模块文档

| 主题 | 文件 |
|---|---|
| OKR | `OKR-DRIVEN-ARCHITECTURE.md`, `OKR-EXPERIENCE.md`, `OKR-FEATURE-MATRIX.md`, `OKR-VS-TITA.md` |
| AI / Backlog | `AI-BACKLOG.md`, `AI-RADAR.md`, `AI-SETUP.md`, `ROADMAP-AI.md` |
| Skill Gateway | `EVOLUTION-2026-05-APPENDIX-SKILLS-AND-HERMES.md` |
| IM vs 企微 | `IM-VS-WECOM.md`, `WECOM-FEATURE-MAPPING.md` |
| 移动端 vs 桌面 AI | `MOBILE-VS-GPT-KIMI.md` |
| Tandem vs 飞书差距 | `TANDEM-vs-FEISHU-GAP-ANALYSIS.md` |
| 团队协作补充 | `SUPPLEMENT-TEAMS-COWORK.md` |

## 5. 运营 / 合规 / 商业

| 文件 | 一句话 |
|---|---|
| `PILOT-ONBOARDING.md` | 试点企业上车 SOP |
| `INTERNAL-USER-GUIDE.md` | 内部用户指南 |
| `USER-GUIDE.md` | 终端用户指南 |
| `MARKETPLACE-SUBMISSION.md` | 应用市场提交 |
| `PITCH-DECK.md` | 路演稿 |
| `SELF-USE-FIRST.md` | "我们先自用" 原则 |
| `COMMERCIAL-READINESS-GAP.md` | 商业化就绪差距 |
| `COMPLIANCE-CHECKLIST.md` | 合规清单 |
| `PRIVACY-POLICY.md` | 隐私政策 |
| `DPA-TEMPLATE.md` | 数据处理协议模板 |
| `PRODUCTION.md`, `PRODUCTION-DEPLOY.md` | 生产部署 |
| `RECOVERY-SOP.md` | 故障恢复 |

## 6. 技术 / 接入 / 基础设施

| 文件 | 一句话 |
|---|---|
| `OSS-STACK.md` | 开源技术栈 |
| `PRISMA-SETUP.md` | (已切 drizzle) |
| `YJS-SETUP.md` | Yjs 协同 |
| `AUTH-NATIVE.md` | 原生鉴权 |
| `BUILD-FEISHU-CLASS-FOUNDATION.md` | 飞书级基础设施 |
| `PROCESS-RULES.md` | 流程规则 |

## 7. 归档区 (Archived · 不再追加)

| 文件 | 替代 |
|---|---|
| `PRD-v0.1-archive.md` | → `PRD.md` |
| `PRD-v0.2-archive.md` | → `PRD.md` |
| `RETROSPECTIVE-2026-05-12.md` | → 留作历史 |
| `AUDIT-2026-05-10*.md` | → 已修, 留作历史 |
| `A2-PROGRESS.md` | 历史里程碑档案 |
| `ARCHITECTURE-AND-CHARTER.md` | → `PLATFORM-ARCHITECTURE-2026-05-29.md` |
| `EVOLUTION-2026-05-APPENDIX-CLAUDE-CODE.md` | EVOLUTION-2026-05 附录 (claude code 部分) |
| `EVOLUTION-2026-05-APPENDIX-RUFLO.md` | EVOLUTION-2026-05 附录 (ruflo 部分) |
| `ROADMAP.md` | 早期路线图, 已被 EVOLUTION-PLAN-2026-05-30 取代 |
| `README.md` | docs/ 子目录入门, 现统一进入 `docs/INDEX.md` |

---

## 项目根目录的高层文档 (非 docs/)

| 文件 | 用途 |
|---|---|
| `README.md` | 项目入门 |
| `STATUS.md` ★ | **当前项目状态唯一真相源** |
| `PROGRESS-2026-05-29.md` | 历史推进档案 (不再追加) |
| `RELEASE-COMMIT-PLAN.md` / `RELEASE-COMMIT-PLAN-2.md` | 历史交付计划档案 |
| `TEST-REPORT.md` | 测试报告 |
| `DEPLOY*.md`, `DOCKER-SETUP.md`, `DESKTOP.md`, `LAUNCH-CHECKLIST.md` | 部署/桌面/上线手册 |
| `LOCAL-SHARE.md`, `TRY-IT.md` | 本地分享、试用 |

---

## 维护节奏

- 写新 docs/*.md → **必须**在本文件登记一行 (写在合适分区)
- 删/归档 → 移到 §7 归档区, 不删
- 每月 1 日 Steward 巡视: 检查"过去 30 天没人引用"的文档是否应归档
- 自动化 backlog: `scripts/check-docs-index.mjs` (P2) — 扫 docs/ 与 INDEX.md 出入
