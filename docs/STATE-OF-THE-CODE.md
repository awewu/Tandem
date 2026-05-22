# Tandem 当前真实状态 (Single Source of Truth)

> **生成**: 2026-05-20 · **基准 commit**: A2 cutover (`201aff8` 之后)
> **取代**: `COMMERCIAL-READINESS-GAP.md` (2026-05-12) 的过时项 + 合并 `A2-PROGRESS.md` 终态
> **维护**: 每次大变动后人工 refresh 此表; 当事实与下表不一致时, **以代码为准**, 改本文档

---

## §0 一句话现状

> **后端 ~60% 真**, **前端 shell 90% 全**, **故事链断点 = A3 跨模块 wire (3–4d)**.
> P0 中 DB 持久化 ✅ / Docker ✅; **审计日志 + 备份 + edge auth secret 是剩余 P0 缺**.

---

## §1 P0 致命阻塞 · 当前清算

| 编号 | 项 | gap doc 状态 | **当前真实** | 证据 |
|---|---|:-:|:-:|---|
| P0-1 | DB 持久化 (Drizzle+PG) | ❌ | **✅** | `lib/boot.ts:59-73` · `DATABASE_URL → DrizzleStore` |
| P0-2 | 审计日志持久化 + SHA256 | ❌ | **⏸** 内存数组 + 非加密 hash | `lib/audit/log.ts:69-80` (注释自标 TODO) |
| P0-3 | Dockerfile + compose.prod | ❌ | **✅** | `Dockerfile` + `docker-compose.{db,prod,tandem}.yml` |
| P0-4 | 数据备份与恢复脚本 | ❌ | **❌** | 仓库 grep 无任何 backup/restore 脚本 |
| P0-5 | 剩余 API auth gate | ⚠️ | **✅** A2.2 已覆盖 | `lib/auth/require-auth.ts` + 11 endpoint 接入 |
| P0-6 | edge middleware secret 生产检查 | (新发现) | **❌** | `lib/auth/session-edge.ts:29-33` 无 production throw |

### P0 剩余工期估算

| 项 | 工期 | 说明 |
|---|---|---|
| P0-2 审计日志 → drizzle 表 + sha256 | **1d** | 加 `auditLog` 表 + 改 hashEntry 为 `crypto.createHash('sha256')` |
| P0-4 备份脚本 | **0.5d** | `pg_dump` cron 包装 + S3 上传 + 文档化恢复 SOP |
| P0-6 edge secret | **15min** | session-edge.ts:31 加 `NODE_ENV==='production' && !s → throw` |

**P0 真正剩余 ≈ 1.7d**.

---

## §2 后端覆盖度 (Drizzle schema + kvStore)

| 域 | 存储模式 | 强类型表 | API 完整度 |
|---|:-:|---|:-:|
| User / Session / Invite | 强类型 | `user` | ✅ |
| Document / 协作文档 | 强类型 | `document` | ✅ |
| Calendar | 强类型 | `calendarEvent` | ✅ |
| Drive / S3 | 强类型 | `driveFile` (presign + breadcrumbs) | ✅ |
| Launchpad | 强类型 | `launchpadApp` + `launchpadClick` | ✅ |
| Notification | 强类型 | `notification` (含 push VAPID) | ✅ |
| **OKR** (Objective/KR/CheckIn/Initiative) | 强类型 | A2.1a/c 已加 | ✅ |
| **1on1** (Meeting/ActionItem) | 强类型 | A2.1b 已加 | ✅ |
| **360** (Cycle/Submission/Assignment) | 强类型 | A2.1b 已加 | ✅ |
| Convergence / DecisionCard | kvStore JSON | (V2 候选强类型化) | ✅ orchestrator |
| Memory (Material/Memory/Promotion) | kvStore JSON | (V2 候选) | ✅ API 通 |
| Persona / Evolution | kvStore JSON | (V2 候选) | ✅ + 后台 scanner |
| IM (channel/dm/message) | kvStore JSON | (V2 候选) | ✅ service |

`kvStore` 是过渡方案; 热表 V2 可按需提升为强类型表.

---

## §3 前端 ↔ 后端切换状态

| 页面 | 数据源 | 状态 |
|---|---|:-:|
| `/convergence` `/convergence/[id]` | `/api/convergence` 真 | ✅ |
| `/1on1` | A2.3 双写, useOneOnOneStore loadFromApi | ✅ |
| `/360` | A2.3 双写, useReview360Store | ✅ |
| `/memories` | A2.3 仅 drop persist · 后端 API 已通但 UI 仍 zustand demo | ⏸ |
| `/organization` | A2.3 仅 drop persist · useOrgStore 仍 fixture | ⏸ |
| `/okr` `/okr/cascade` `/okr/dashboard` `/okr/calendar` | `/api/tandem-okr` `/api/okr/*` | ✅ |
| `/im` | `/api/im/channels` + `/api/im/dm` | ✅ |
| `/persona` `/persona/evolution` | `/api/tandem/persona/*` | ✅ |
| `/agents` | `/api/agent/*` | ✅ |
| `/chat` | `/api/llm-stream` | ✅ |
| `/documents` `/documents/[id]` | `/api/documents` + yjs | ✅ |
| `/drive` | `/api/drive/*` + S3 presign | ✅ |
| `/calendar` | `/api/calendar` | ✅ |
| `/meetings` `/meetings/room/[id]` | LiveKit + `/api/meetings/*` | ✅ |
| `/notifications` | `/api/notifications/*` | ✅ |
| `/approvals` | `/api/approvals` | ✅ |
| `/workflows` | `/api/workflows/run` + builtin triggers | ✅ |
| `/mail` | `/api/mail/send` + `/api/mail/status` | ✅ |
| `/admin/launchpad` | `/api/admin/launchpad` | ✅ |
| **(KPI 后端)** `/api/kpi/{cycles,subjects,manual-entry,[id]}` | 7 endpoint + 12 audit events + 3 权限位 + canManualEntry 守卫 | ✅ M2a-Core |
| `/admin/kpi/{setup,subjects,manual-entry,health-dashboard}` + `/kpi` | 5 页 + nav 入口 + ExcelImportExport 嵌入 | ✅ M2a-UI |
| `/api/kpi/{export,import,subjects/{export,import}}` | 4 endpoint + dry-run + 错误行回显 | ✅ M2a-Excel |
| `/api/kpi/analytics?view=...` (8 视图) + `/api/kpi/erp/sync` + 9-box 纵轴 | ERP adapter + 8 分析 + 9-box 接 KPI 加权完成率 | ✅ M2b |
| `/api/audit/verify` + Drizzle `AuditLog` 表 | SHA-256 链 + 跨重启保存 + verify endpoint | ✅ P0 audit-persist |
| `/admin/baseline` | `/api/tandem/memory/*` (baseline 走 memory) | ⏸ 待验证 |
| `/admin/steward` | `/api/tandem/memory/{promotion,downgrade}` + SLA 监控 | ✅ 3 tab 完整工作台 (升级/降级/SLA) |
| `/admin/intranet` | (新加, 后端待补) | ❌ |
| `/intranet/*` (7 个 stub) | seed 静态 | ⏸ 设计阶段 |
| `/skills` `/skills/learning` `/admin/skills` `/admin/tandem-skills` | `/api/skills/*` + `/api/tandem-skills/*` | ✅ |
| `/insights` | `/api/dashboard/stats` + `lib/insights/derive` | ✅ |
| `/analytics` | (查证中) | ⏸ |
| `/nine-box` | `/api/nine-box` 横轴 = TTI (= KR 完成率) ✅ · 纵轴 KPI placeholder 0, 待 M2a | ⏸ 纵轴 |
| `/search` | `/api/search` | ✅ (但 ⌘K 已覆盖, 模块入口已删) |

**Frontend 切 API 总进度**: 约 **75%**.

---

## §4 后台 cron scanner (`lib/boot.ts:140-221`)

| Scanner | 周期 | 作用 |
|---|---|---|
| `startConvergenceTickLoop` | 30s | 议事室 17min 硬上限 ESCALATE |
| `scanRetrospectives` | 10min | 7 天后决议自动复盘 |
| `escalateOverduePromotions` | 10min | Memory 升级签批 SLA 逾期 escalate |
| `scanLowReferenceMemories` | 10min | Memory 引用率低 → 建议降级 |
| `scanPersonaUpgrades` | 10min | Persona 阶段自动升级 (低风险静默) |

所有 4 类后台治理任务**真在跑**, 不是 TODO.

---

## §5 故事链断点 (PRD 差异化叙事)

PRD `MANIFESTO.md` 的核心链:

```
① 议 (Convergence) → ② 沉 (Memory) → ③ 拿 (Persona) → ④ 算 (OKR/TTI)
```

| 链节点 | 后端 | UI | 断点 |
|---|:-:|:-:|---|
| ① 议事 → DecisionCard | ✅ | ✅ | 无 |
| DecisionCard → Material (auto-push) | ✅ orchestrator commit hook | ⏸ | Material 待办 UI 暴露在哪? |
| Material → Memory 签批 (Lv1/2/3) | ✅ promotion-flow + SLA | ⏸ | `/memories` UI 仍 zustand demo |
| Memory → Persona 引用 | ✅ scanPersonaUpgrades | ⏸ | "我的 Persona 引用了哪些 Memory" UI 缺 |
| Persona → 1on1 / Initiative 建议 | ✅ schema + API | ⏸ | A3: ActionItem→Initiative UI 按钮缺 |
| 1on1 / 360 → 9-box | ✅ schema | ⏸ | A3: 9-box 算法仍 TTI 而非 360 均分 |
| KR 进度 → OKR Cascade | ✅ | ✅ | 无 |

**A3 跨模块 wire 工期**: 3–4 天即可点亮整条链.

---

## §6 立即可做的小修 (0.5d total)

| 项 | 工期 | 优先 |
|---|---|:-:|
| `session-edge.ts:31` 加 production secret 检查 | 15min | 🔴 |
| audit log hashEntry → SHA256 (不改持久化, 先升 hash) | 20min | 🟡 |
| `/memories` `/organization` 删 zustand demo, 直接 fetch | 1h | 🟡 |
| settings/email 暴露入口 (已在 nav P3 加, 验证 page 存在) | 5min | 🟢 |

---

## §7 下一步建议 (按 ROI 排)

```
今天    0.5d    P0-6 edge secret fix + audit log SHA256 升级 + 本文档维护
本周    3-4d    A3 跨模块 wire (1on1→Initiative / 9-box→360 / Memory promotion UI)
                + /memories /organization 真切 API
                + Playwright 装 + 3 主流程 e2e
下周    2-3d    P0-2 审计日志 → drizzle 表 (持久化) + P0-4 备份脚本
                → 完成后 product is "可发给 pilot 客户" 状态
之后    持续    P1 合规 (等保/AGPL/PIPL) + P3 监控告警 等客户节奏触发
```

---

## §9 设计冻结 (2026-05-20)

### 9.1 知识层 4 页分层 (已认可冻结)

```
/documents   实时协作 (yjs)          - 写作
/knowledge   4 级归属知识树          - 累积 (个人/团队/部门/公司)
/memories    公司 Memory artifact    - 权威 (SOP/Case/Redline/Value, 经 Lv1/2/3 签批)
/drive       原始文件存储             - 文件
```

**未来重构方向** (不在当前 sprint, 不动代码):

- `/knowledge` 吃下当前 `/memories` 的个人记事本内容 (需求/共识/标准/上下文 → 个人级 KNode)
- `/memories` 重写为 artifact 浏览 + Steward 签批工作流 (调 `/api/tandem/memory/list` + `/api/tandem/memory/promotion`)
- `/knowledge` 加 "晋升到 Memory" 按钮 (个人/团队/部门级 → 触发 Lv1/2/3 promotion)

### 9.2 /organization 分工 (已认可冻结)

- `/organization` 保留**三省六部制 Agent 工作组**可视化 (项目机制, fixture data)
- 真员工列表归 `/admin/organization` (PRD UI-IA §1)
- 两者不冲突, 是两件事

### 9.3 不再动的决定

- AppRail 10 模块, 不再增删
- 首页 4 段式 (PRD §2 + v2 evolution)
- 邮箱独立顶级模块
- 上述 9.1 / 9.2 分层

### 9.4 KPI/TTI 双轨绩效宽章 (已认可冻结, 见 `docs/CHARTER-KPI-TTI.md`)

- **KPI** = 9-box **纵轴** · 双 scope (`bonus` 进 9-box+奖金 / `monitor` 仅全维度健康看板) · 数据**三通道** (A 管理 + B ERP + C 财务/HR/内勤补录) · 被考核人零写权限 · 科目动态主数据 + Excel 导入导出
- **TTI** (= OKR 体系, 战略成长, 与奖金分离) = 9-box **横轴** · 员工自填为核心 · 信任不审批
- 独立 `TTI` interface (`lib/types/okr-tti.ts:127`) 已 deprecate, V2 合并到 `Objective`
- 必须分析机制: 体系目标同步 / YTD / 环比 / 同比 / 季度分布 / 趋势 / 分布 / 预警
- TTI 四要素: 改进实现 / 推进事项 / 关键障碍 / 预期目标值 / 实际进度

---

## §10 KPI 体系建设里程碑 (新加 2026-05-20)

| M | 内容 | 工期 | 状态 | 依赖 |
|---|---|---|:-:|---|
| **M1** | 双轨语义对齐 (Charter + 9-box 轴换位 + deprecate TTI) | 30min | ✅ | — |
| **M2a-Core** | KPI types + Repository + audit + 权限 + 7 API 端点 (cycles/subjects/kpis/manual-entry) | 1d | ✅ | M1 |
| **M2a-UI** | 4 个 admin 页 + 个人只读页 + nav 接入 | 1d | ✅ | M2a-Core |
| **M2a-Excel** | xlsx 库 + 4 import/export endpoint + dry-run + 错误回显 + 可复用组件 | 1d | ✅ | M2a-Core |
| **M2b** | KPI ERP adapter (骨架) + 8 个分析 endpoint + 9-box 纵轴真接 KPI | 1d | ✅ | M2a 全 |
| **M2c** | TTI 四要素 UI + 主管只读限制 | 0.5d | ⏸ | M2a-UI |
| **M3** | 绩效奖金计算引擎 + 年终关闭 | 1d | ⏸ | M2 全 |
| **M4** | 9-box 联动决策卡片 / Persona 升级 | 0.5d | ⏸ | M3 |

**已完成 ≈ 4.5d** (M1 + M2a-Core + M2a-UI + M2a-Excel + M2b) · **剩余 ≈ 2d** (M2c + M3 + M4)

**P0 差补完成** (2026-05-21):

- ✅ audit log Drizzle 持久化 (SHA-256 链 + 跨重启保存 + tenantId 维度 + `/api/audit/verify`)
- ✅ pg_dump 备份脚本 (·sh + ·ps1) + S3 上传 + `docs/RECOVERY-SOP.md`
- ⚠ ERP adapter 仅交付接口 + noop 默认实现· 真实租户需注入具体 ERP adapter (SAP/用友/金蝶)

完成全部 M 后: 9-box 真双轨投影 + KPI 与奖金挂钩闭环 + 公司全维度健康度可观测 + Excel 互通.

---

## §8 维护规则

- 每次完成 PR 后, 在 §1 / §3 表格更新一行
- 不要让本文档与代码不一致超过 1 周; 不一致时**改文档不改代码**
- 与 `COMMERCIAL-READINESS-GAP.md` 冲突时, **以本文档为准** (那份是 2026-05-12 snapshot)
- 与 `A2-PROGRESS.md` 共存: 那是 A2 阶段 retrospective, 本文档是 ongoing snapshot
