# Tandem 商业级落地 · 完整差距分析 (2026-05-12)

> **当前状态**: V1 PoC 完成 (61 commit / 28/28 e2e PASS / InMemory 全量跑通)
> **目标**: 从"可演示原型"到"可卖给民企客户并稳定运行"
> **文档性质**: 诚实清单. 不夸大已交付, 不缩小未交付.

---

## 摘要: 还有多远?

```
当前 ──► V1 GA ──► 商业可用 ──► 规模化 SaaS
     │        │          │
     ▼        ▼          ▼
   3 天    +4~6 周    +6~9 月
   (技术)   (产品)     (运营+合规)
```

| 阶段 | 标准 | 剩余工作量 | 人月 |
|---|---|---|---|
| **V1 GA** | 代码功能完整 + Prisma PG 持久化 + e2e 全过 | 3 天~2 周 | ~0.5 |
| **商业可用** | 第一家客户私有化部署上线, 员工真实使用 | +4~6 周 | ~2 |
| **规模化 SaaS** | 多租户 / 等保 / 移动端 / 钉企飞上架 | +6~9 月 | ~8 |

**诚实结论**: 如果今天客户问"能买吗", 答案是 **"不能"** — 数据在内存里, 重启即丢.
如果问"还要多久", 答案是 **"2 个月可到商业可用"** (V1 GA + 部署硬化 + 种子客户 pilot).

---

## 一、诚实自检: 当前代码 vs 商业需求

### 1.1 已真正跑通的部分 (可演示)

| 模块 | 实现度 | 证据 |
|---|---|---|
| 自研 Auth (登录/MFA/邀请/密码策略) | ✅ 100% | 17/17 e2e PASS, native.ts 完整 |
| 议事室 5 步状态机 | ✅ 100% | LLM 真调 DeepSeek, 3+1 生成, COMMIT/VETO 全链路 |
| KR 软绑定 + escape hatch | ✅ 100% | 5 个边界 case e2e 验证 |
| Memory 签批流 (team_leader + steward) | ✅ 100% | 7b/7c/7d 双角色签字验证 |
| Memory 降级评估 | ✅ 100% | 7.5b/7.5c AI 提议 + steward 决策 |
| IM 自建 PoC (频道/消息/议事室 spawn) | ✅ 90% | 2a~2g e2e 全过, @persona DeepSeek 真回 |
| Persona 双层骨架 | ✅ 80% | progress/upgrade/dismiss API 有, GPU 层未联调 |
| 9 宫格矩阵 | ✅ 80% | API 有, UI 有, 真数据需积累 |
| 审计链 hash | ✅ 70% | verify() 逻辑通, 但 hash 算法非 SHA256, 无持久化 |
| 全局 auth gate (middleware.ts) | ✅ 已交付 | G1 V1 GA 阻塞解除 |
| PII 默认剥离框架 | ✅ 已交付 | EVO-7 框架 + 3 endpoint 已接入 |
| Workbench Agent View | ✅ 已交付 | EVO-10 UI 聚合 |

### 1.2 关键差距矩阵 (5 级分类)

```
P0 致命 ── 没有就不能用 (数据/安全/部署)
P1 合规 ── 没有就违法/过不了等保 (审计/法务/隐私)
P2 产品 ── 没有就验收不通过 (PRD 功能缺口)
P3 运营 ── 没有就交付不了客户 (文档/监控/容器)
P4 规模 ── 没有就做不了 SaaS (多租户/移动端/生态)
```

---

## 二、P0 · 致命阻塞 (没有就不能用)

### P0-1 · 数据库持久化 (G2)

**现状**: 全部 28/28 e2e 跑在 `InMemoryStore`. 重启 dev server → 数据归零.

**Prisma 状态**:
- Schema 30+ 表已定义 ✅
- `prisma-store.ts` 有 User/Session/PasswordHash/MfaSecret 的显式实现 ✅
- 但 `imChannels`/`imMessages`/`imMemberships` 等用通用 `PrismaRepository` 封装, JSON 字段/关系查询未充分验证 ⚠️
- **从未在生产 PostgreSQL 上跑过 end-to-end**

**商业影响**: 客户数据在内存里, 进程崩溃 = 全部丢失. 这是 0 分项.

**DoD**:
1. `docker-compose -f docker-compose.tandem.yml up -d` 起 PG
2. `DATABASE_URL=postgresql://... npm run dev` 切到 PrismaStore
3. `scripts/e2e-v1.ps1` 在 Prisma 模式下 28/28 全过 → **扩展为 38/38** (加 1on1/360 真实写入)
4. 重启进程 → 数据仍在

**工期**: 1~2 天 (G2 预算 1 天, 实际可能 2 天因 JSON 字段适配)

---

### P0-2 · 审计日志持久化

**现状**:
```ts
// lib/audit/log.ts
class AuditLog {
  private entries: AuditEntry[] = [];  // ← 内存数组!
  // hash 是简单字符串 hash, 非 SHA256
}
```

**商业影响**: 等保二级要求审计日志留存 ≥ 6 个月且不可篡改. 内存数组重启即丢, 且 hash 算法可逆.

**DoD**:
1. AuditLog 写入 PostgreSQL (新表 `AuditEntry`)
2. hash 升级 SHA256 (`crypto.createHash`)
3. 查询接口支持时间范围 / actor / action 过滤
4. 保留期策略 (V1 至少 90 天)

**工期**: 2 天

---

### P0-3 · 生产部署可运行

**现状**:
- `npm run dev` (开发服务器, 单进程, 无集群)
- `next build` 可过, 但 `next start` 未在 Prisma 模式下验证
- Docker compose 只有 PG/Cal.com/MinIO, **没有 Tandem 应用本身**
- 无环境变量清单 / 无生产配置手册

**商业影响**: 客户买了不知道怎么部署.

**DoD**:
1. `Dockerfile` (Next.js standalone output)
2. `docker-compose.prod.yml` (Tandem app + PG + MinIO + Cal.com)
3. `.env.production` 模板 (所有必填变量 + 说明)
4. `DEPLOY.md` (私有化部署 SOP, 30 分钟可完成)
5. 单机 smoke test: 新机器 → docker compose up → e2e-v1.ps1 PASS

**工期**: 3~4 天

---

### P0-4 · 数据备份与恢复

**现状**: 无.

**商业影响**: 硬盘坏了 = 客户全部数据丢失.

**DoD**:
1. PG 自动定时备份 (pg_dump cron)
2. MinIO 桶复制策略
3. 恢复 SOP (RTO < 4h, RPO < 24h)

**工期**: 1 天 (脚本 + 文档)

---

### P0-5 · 剩余 API 的 auth gate (EVO-7 phase 3)

**现状**:
- `middleware.ts` 全局拦截 ✅ (G1 交付)
- `/api/me/dashboard` + `/api/persona/[userId]` 已加 endpoint 级 auth ✅
- 但 ~27 个 endpoint 仍只有 `requireAuth` 基础检查, **未做角色级/数据级权限控制**

**商业影响**: 员工 A 可能通过猜 ID 访问员工 B 的 1on1 记录.

**DoD**:
- 所有 `/api/*` 路由自查: ① 是否验证身份 ② 是否锁定 userId 到 session ③ 是否按角色过滤数据
- 高风险接口 (1on1/360/persona/export/admin) 加数据级权限

**工期**: 3~4 天 (逐个审查 + 补测)

---

## 三、P1 · 合规必需 (没有就违法/过不了等保)

### P1-1 · 等保二级

**现状**: 未启动.

**流程**: 准备材料 → 测评机构初测 → 整改 → 复测 → 发证 (周期 2~3 个月)

**DoD**:
- [ ] 定级报告 (系统描述/重要性/威胁分析)
- [ ] 安全管理制度 (运维/开发/应急/备份)
- [ ] 技术测评通过:
  - 身份鉴别 (✅ JWT+MFA)
  - 访问控制 (⚠️ middleware + requireAuth, 需补完)
  - 安全审计 (⚠️ 审计持久化 SHA256)
  - 数据完整性 (⚠️ 需确认 PG 传输加密)
  - 数据备份恢复 (❌ 未做)
  - 入侵防范 (❌ 无 WAF/IDS)

**工期**: 3 个月 (其中我方准备 2 周, 其余等测评机构)
**预算**: 5~10 万 RMB (测评费)

---

### P1-2 · AGPL 法务 Review

**现状**: docker-compose 包含 `Cal.com` (AGPL) 和 `MinIO` (AGPL).

**风险**: AGPL 要求衍生作品开源. 若 Tandem 调用 Cal.com/MinIO API 是否触发 "衍生作品" 存在争议.

**DoD**:
1. 法务/外部律师出具意见:
   - Tandem 作为 Cal.com API 消费者 → 是否触发 AGPL?
   - MinIO 作为独立存储后端 → 是否触发 AGPL?
2. 若风险高 → 替换方案:
   - Cal.com → Coolify / 自建日历 (2 周)
   - MinIO → SeaweedFS (Apache 2) (1 周)

**工期**: 1~2 周 (法务意见) + (若替换) +3 周

---

### P1-3 · GDPR / PIPL 数据合规

**现状**:
- 有 PII 剥离框架 ✅
- 有数据导出 API (`/api/me/export`) ✅
- 有 anonymize API (`/api/admin/users/[id]/anonymize`) ✅
- 但**无隐私政策文档 / 无数据处理协议 (DPA) 模板 / 无用户同意记录**

**DoD**:
1. `PRIVACY-POLICY.md` (中文隐私政策, 面向员工)
2. `DPA-TEMPLATE.md` (数据处理协议, 面向企业客户)
3. 注册流程加"同意隐私政策" checkbox (记录 timestamp + IP)
4. 数据保留期配置 (自动删除离职员工 Origins 层数据)

**工期**: 3~5 天

---

### P1-4 · 密码/密钥生产硬化

**现状**:
- `SESSION_SECRET` fallback 到 `'dev-only-secret-do-not-use-in-prod'` ⚠️
- `docker-compose.tandem.yml` 硬编码 `minioadmin/minioadmin` ⚠️
- 无密钥轮转机制

**DoD**:
1. 生产启动检查: `NODE_ENV=production` 时拒绝默认 secret
2. 密钥生成脚本 + 环境变量注入指南
3. Session secret 轮转 (双 secret 并行期)

**工期**: 1 天

---

## 四、P2 · 产品完整 (PRD 功能缺口)

### P2-1 · 三层 Dashboard (PRD §3.1.4)

**现状**: 首页有 Workbench Agent View (EVO-10) + 基础 stats, 但**主管/老板层 Dashboard 未实现**.

**DoD**:
- 主管: 团队 KR 红绿灯 + 日报摘要 + AP 卡点热力图
- 老板 (Champion): 全公司 OKR 树 + 9 宫格 + Memory 健康 + 合规仪表

**工期**: 2~3 周

---

### P2-2 · 5 分钟极简日报 ↔ OKR 闭环 (PRD §3.1.3)

**现状**: `/checkin` 页面存在但功能不完整. AI 预填 + AP 反向强推未实现.

**DoD**:
- 日报 UI: 完成/卡点/明日计划 (倒计时 5min)
- AI 草稿: 从今日 DC + IM 高价值消息自动摘要
- AP 反向强推: 截止前 1 天的 AP 强制填推进
- 逾期 escalate: 留白超 24h → 主管通知
- 日报 → Material → Memory promotion 队列

**工期**: 2~3 周

---

### P2-3 · 邮件存证回路 (PRD §3.5)

**现状**: 文档完整, 代码为 0.

**DoD**:
- IMAP 入站 (Exchange/Office 365/腾讯/阿里)
- SMTP 出站 (12 事件模板)
- 主题前缀识别 (`[Tandem-DC#xxx]` / `[Tandem-KR#xxx]`)
- 归档 hash 入审计

**工期**: 3~4 周

---

### P2-4 · Intranet 完整内容 (PRD §3.6)

**现状**: `/intranet` 页面有 BrandHeader + 框架, 但**4 类内容管理后台未实现**.

**DoD**:
- 公告/政策/大事记/福利 CRUD (admin 后台)
- 政策强制已读 (未读 banner 不消失 + 30 天邮件 escalate)
- AI 摘要 + 版本管理 + diff
- CEO 周记 + 匿名意见箱
- 新员工必读 (入职解锁机制)

**工期**: 2~3 周

---

### P2-5 · Launchpad (PRD §3.7)

**现状**: 文档完整, 代码为 0.

**DoD**:
- 卡片网格 (业务系统/通讯/学习)
- SSO 一键跳转 + 凭据自存 (AES 加密)
- 部门权限 + AI 今日推荐
- 使用统计 (admin 看哪些跳板活跃)

**工期**: 1~2 周

---

### P2-6 · 音视频会议 + 文件 + 协同文档 (PRD §3.3)

**现状**:
- 腾讯会议 ISV API: 文档有, 代码 0
- MinIO: docker-compose 有容器, UI 未接入
- Univer/Tiptap+Yjs: 未开始

**DoD**:
- 腾讯会议 OAuth + 一键开会 API
- 分身代参 (腾讯会议 + 水印)
- MinIO 文件上传/下载/频道附件 UI
- 协同文档 (V1 先单人编辑, V1.5 多人)

**工期**: 4~5 周

---

### P2-7 · 1on1 / 360 完整工作流

**现状**: API 有 (`/api/1on1/*`, `/api/360/*`), 但 e2e 只在 InMemory 跑过, **未在 Prisma PG 验证**.

**DoD**:
- 1on1: 主管预约 → 员工预填 → 会议 → 纪要 → ActionItem
- 360: cycle 创建 → 匿名 peer 邀请 → 提交 → 经理汇总 → 员工查看
- Prisma 模式 e2e 全过

**工期**: 1 周 (G2 预算) + 1 周 (UI 打磨)

---

## 五、P3 · 运营就绪 (交付不了客户)

### P3-1 · 容器化与 CI/CD

**现状**: 无 Dockerfile / 无 CI pipeline.

**DoD**:
- `Dockerfile` (multi-stage, standalone)
- GitHub Actions / 自建 CI:
  - `tsc --noEmit` + ESLint
  - `e2e-v1.ps1` (InMemory 模式)
  - `e2e-v1.ps1` (Prisma 模式, 需 PG service)
  - `docker build` + `docker compose up` smoke test
- 版本号自动打 tag

**工期**: 2~3 天

---

### P3-2 · 监控与告警

**现状**: 无.

**DoD**:
- 应用层: `/api/health` 扩展 (PG/MinIO/DeepSeek 连通性)
- 日志: 结构化 JSON log + 聚合 (Loki / ELK 或云厂商)
- 告警: Prometheus + Alertmanager 或云监控
  - API 5xx 率 > 1%
  - PG 连接池耗尽
  - DeepSeek 连续 3 次失败 → 切 Qwen-Max
  - 磁盘 > 85%

**工期**: 3~5 天

---

### P3-3 · 种子客户 Pilot SOP

**现状**: `PILOT-ONBOARDING.md` 有, 但**未实际跑过任何客户**.

**DoD**:
1. 私有化部署包 (docker-compose + .env 模板 + 部署脚本)
2. 数据迁移工具 (Excel/企微/钉钉 通讯录导入)
3. 7 天 Pilot 检查清单:
   - Day 1: 部署 + 管理员 onboarding + 首批 5 用户邀请
   - Day 2-3: OKR 设定 + 议事室演练
   - Day 4-5: IM 日常 + @persona 试用
   - Day 6: 1on1 + 360 体验
   - Day 7: 反馈收集 + 续约意向
4. 客户成功手册 (FAQ + 故障排查)

**工期**: 1~2 周 (文档 + 工具)

---

### P3-4 · 端到端测试硬化

**现状**:
- `scripts/e2e-v1.ps1` 28 步 PowerShell (无浏览器自动化)
- `tests/e2e/convergence.spec.ts` 有但 `@ts-nocheck` (Playwright 未装)
- 单元测试仅 3 个文件

**DoD**:
1. 安装 Playwright + 4 个核心场景自动化:
   - 登录 → 发起议事室 → COMMIT → VETO
   - 登录 → IM 发消息 → spawn-room → promote-to-memory
   - 登录 → 创建 OKR → 写日报 → 查看 Dashboard
   - 登录 → 1on1 预约 → 360 提交
2. 单元测试覆盖 > 60% (核心: auth / privacy / convergence / okr)

**工期**: 1~2 周

---

## 六、P4 · 规模扩展 (不做 SaaS)

### P4-1 · 多租户 SaaS 切面

**现状**: Schema 有 `tenantId` 字段, 但**查询未隔离, 无租户管理后台**.

**工期**: 2~3 月

### P4-2 · 移动端 iOS/Android

**现状**: 0.

**工期**: 2~3 月 (React Native / Flutter)

### P4-3 · 钉钉/企微/飞书上架

**现状**: 文档有 OAuth 规划, 代码未开始.

**工期**: 1~2 月

### P4-4 · BI + 国际化

**工期**: 1~2 月

---

## 七、时间线汇总

### 路径 A: 最小商业可用 (推荐)

```
Month 0 (现在)  V1 PoC 28/28 ✅
  │
  ├─ Week 1-2   P0 致命修复 (DB 持久化 + 审计持久化 + 部署硬化 + auth gate 补完)
  │             = 2 周, 1 人
  │
  ├─ Week 3-4   P2 核心功能补齐 (Dashboard + 日报 + 1on1/360 Prisma e2e)
  │             = 2 周, 1 人
  │
  ├─ Week 5-6   P3 运营硬化 (CI/CD + 监控 + Pilot SOP + 测试硬化)
  │             = 2 周, 1 人
  │
  ├─ Week 7     P1 合规启动 (隐私政策 + DPA + 密钥硬化, 等保启动)
  │             = 1 周, 0.5 人 (法务外包)
  │
  └─ Week 8-10  种子客户 Pilot (3 家友好客户, 7 天 each, 反馈迭代)
                = 3 周, 1 人 (客户成功)

Month 2.5      第一家客户付费上线
```

**总投入**: ~2.5 月, 1~2 人全职 + 法务外包
**总预算**: 15~20 万 RMB (人力) + 5~10 万 (等保测评, 可延后)

---

### 路径 B: PRD V1 GA 完整版 (7 个月)

按 `PRODUCT-DEFINITION.md` §6 原路线:

```
Month 1   OKR 5 层骨架 + KR 软绑定 + UI 重构
Month 2   日报闭环 + 中央 AI 拦截器 + Launchpad 骨架
Month 3   三层 Dashboard + Intranet 完整
Month 4   IM 升级 (会议/文件/文档)
Month 5   Persona 双层 + 邮件回路
Month 6   法务 + 等保 + 性能
Month 7   GA + Pilot
```

**投入**: 7 个月, 12 人, ~1200 万 RMB
**风险**: 资源要求极高, 创业早期不建议.

---

### 路径 C: 折中路线 (推荐, 基于现实资源)

```
Phase 1  (现在 ~ Month 1)   商业可用 MVP
  • P0 全部 (DB/审计/部署/auth)
  • P2 核心 (Dashboard + 日报 + 1on1/360)
  • P3 基础 (CI/CD + 监控 + Pilot)
  = 1 个月, 2 人

Phase 2  (Month 2 ~ 3)      种子客户验证
  • 3 家 pilot, 7 天 each
  • 根据反馈砍/加功能
  = 2 个月, 2 人

Phase 3  (Month 4 ~ 6)      V1.5 功能补齐
  • 邮件回路 + Intranet 完整 + Launchpad
  • 等保拿证
  = 3 个月, 3~4 人

Phase 4  (Month 7 ~ 12)     V2 规模扩展
  • 移动端 + SaaS 多租户 + 钉企飞上架
  = 6 个月, 6~8 人
```

**总投入**: 12 个月, 从 2 人逐步扩到 8 人, ~400~600 万 RMB

---

## 八、立即执行的 Next 3 件事

如果明天开始, 按这个顺序:

| 排序 | 任务 | 工期 | 阻塞解除 |
|---|---|---|---|
| **D+1~D+2** | P0-1: Prisma PG 持久化 + e2e 全过 | 2 天 | 数据不再丢 |
| **D+3~D+4** | P0-2: 审计日志持久化 + SHA256 | 2 天 | 合规基础 |
| **D+5~D+7** | P0-3: Dockerfile + docker-compose.prod + 部署 SOP | 3 天 | 客户可部署 |

**一周后**: 产品从"演示玩具"变为"可给客户试用的系统".

---

## 九、诚实结论

**当前代码不是商业软件. 但地基极好.**

好的地方 (不要浪费):
- 宪章 18 条 + 产品哲学极其清晰, 与竞品差异化明确
- 核心独创模块 (议事室/3+1/Memory 签批/Persona 双层) 已跑通, 不是 PPT
- 代码质量高 (tsc 0 错误, pre-commit gate, 61 commit 0 推倒重写)
- Auth/隐私/审计的意识已注入架构, 不是事后补丁

差的地方 (必须补):
- **数据在内存里** = 唯一致命伤, 1~2 天可修
- 产品功能完整度约 **40%** (PRD v0.3 的 60+ 功能, 约 25 个已实现, 35 个未实现)
- 无生产部署经验, 无真实客户验证
- 团队规模 = 实际 1 人 (你), PRD 规划的 12 人是愿景

**建议策略**:
1. **不要现在招 12 人** — 先 1~2 人把商业可用 MVP 做出来
2. **不要现在做等保** — 等保 3 个月周期, 等第一家客户签约后再启动
3. **不要现在做移动端** — 客户痛点在 Web, 移动端是 nice-to-have
4. **现在立刻修 P0** — DB 持久化 + 部署硬化, 一周后给种子客户看

---

> **签字**:
>
> 创始人: ____________  日期: ____
> 技术负责人: ____________  日期: ____
>
> **诚实是最高效的策略.**
