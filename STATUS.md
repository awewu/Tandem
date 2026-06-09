# Tandem · 全量验证状态报告

**最后更新**: 2026-06-09 PT (生产级部署冲刺)
**生成方式**: 由门禁脚本 + git/文件实测汇总
**当前服务**: `http://localhost:3005` (dev mode, PG 在 localhost:5432)

## 2026-06-09 · 生产级部署冲刺快照

**6 道门全绿** (本次冲刺新测):

| 门禁 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ 干净 |
| `npm test` (vitest run) | ✅ **937 passed** (91 文件) |
| UI Charter `--strict` | ✅ 0 违规 (allowlist 0) |
| 内链 `--strict` | ✅ 0 悬空 · 304 路由 |
| docs 索引 `--strict` | ✅ INDEX 与 77 docs 同步 |
| `npm run build` | ✅ 全路由编译 (next/font/google 已替换为系统字体栈) |

**冲刺修复**:
- `app/layout.tsx`: 移除 `next/font/google` (生产容器构建 ECONNRESET), 改用 CSS fallback 链 (Inter → -apple-system / PingFang SC). 视觉无损, 零外网依赖.
- `docker-compose.prod.yml`: MinIO 同时自动建 `tandem-drive` + `tandem-attachments` 两个 bucket (修首次附件上传 `NoSuchBucket`); app 容器同步注入 `S3_BUCKET_ATTACHMENTS`.
- `docs/INDEX.md`: 补登 3 个新 .md (CASCADE-STATUS-PROTOCOL / DAZI-BEYOND-COWORK / DB-AUDIT-2026-06-09); §8 归档区改为纯文本纪念清单 (清除 38 条悬空 backtick 引用); 修 PITCH-DECK 引用 (仅剩 .pdf/.pptx).
- `lib/persona/reflexion.ts`: B-024 结构化反推数据收集层 (LLM schema 增 category + skillId; tags `category:xxx` + `skill:xxx`; 新增 `analyzeReflexionPatterns(userId, windowDays)` 聚合 API).

**部署入口验收**: `scripts/deploy-bootstrap.sh` + `docker-compose.prod.yml` + `.env.production.example` 三件套对齐, Owner 拿 `DEPLOY-CHECKLIST.md` 直接上.

**已知警告 (非阻塞)**:
- 单副本默认 `REDIS_URL` 未设 → rate-limit / cron 退化为内存 (单副本安全; 多副本必须配 Redis, production-guard 会拦).
- `SENTRY_DSN` 未设 → 错误仅 stdout, 无远程聚合.

---

> **口径说明**: 本文是**点位验证状态报告**。项目权威总览见 `docs/PROJECT-OVERVIEW.md`。战略定位为**二者并存 · 分阶段** (2026-06-02 Owner 裁定): **目标形态** = 200-1000 人生产级交付产品 (`PRD.md`/`MASTER-UPGRADE.md`)，**当前阶段路径** = 自用优先 (`docs/SELF-USE-FIRST.md`)。文中"试用邀请/100 人通用码"指**当前自用阶段的内部同事 onboarding**, 对外销售属目标形态规划 (`PRD.md` §9)，自用阶段尚不执行。

---

## 当前快照 (2026-05-31 实测)

### 代码规模

| 维度 | 数量 |
|---|---|
| app 页面 (`page.tsx`) | 104 |
| API 路由 (`route.ts`) | 170 |
| 组件 (`components/*.tsx`) | 100 |
| lib 模块 (`*.ts`) | 217 |
| 测试文件 | 59 |
| 文档 (`docs/*.md`) | 91 |
| TS/TSX 代码行 (app+lib+components) | ~97,400 |

### 质量门禁 — 6 道全绿

| 门禁 | 结果 |
|---|---|
| `tsc --noEmit` | ✅ 干净 |
| `vitest run` | ✅ **722 passed** (67 文件, 2026-05-31 实测) |
| UI Charter (`check-ui-charter.mjs --strict`) | ✅ 0 违规 (allowlist 90 遗留待清零) |
| 内链 (`check-deeplinks.mjs --strict`) | ✅ 0 悬空 · 279 路由 |
| docs 索引 (`check-docs-index.mjs --strict`) | ✅ INDEX 与 91 docs 同步 |
| `npm run build` | ✅ 路由全编译 |

### 进行中 (未提交工作区)

- **外部协作申请 + RBAC**: `lib/auth/{applications,roles,module-scope}` + `app/register/apply` + `app/admin/user-applications` + `app/forbidden`
- **三省六部治理协同**: `lib/governance/projects` + `app/governance/three-departments` + `app/api/governance`
- **KPI 强类型化 (B-019)**: `drizzle/migrations/0005_kpi_typed_tables.sql` + 8 个 typed Repository (含 `KpiCausalLink` BSC 因果链)
- **Persona Constitution (B-027)**: `lib/types/persona-constitution` + `lib/persona/constitution` + prompt 硬前置 + `app/api/persona/[userId]/constitution`
- **Ownership SSOT + Org 后端化 (D/F-pragma)**: 见 `docs/OWNERSHIP-SSOT-2026-05-31.md`

---

## 一句话总结 (2026-05-25 基线 · 历史)

- **后端 / API**：✅ 闭环全通 (18/18 业务调用 + 95/95 单元 + 12/12 E2E)
- **手机端**：✅ 3 viewport × 6 页面 (19/19) — 布局密集但可用
- **PWA**：✅ manifest / icons / sw 全部正确供送
- **单机生产**：✅ Dockerfile + docker-compose.prod 完整可直接 build
- **云端部署**：✅ 4 种方案文档 (本机 / VPS / Vercel / Railway) 见 `DEPLOY.md`
- **试用邀请**：✅ `scripts/issue-trial-invite.mjs` 一键生成 100 人通用码

---

## 详细验证结果 (2026-05-25 快照 · 历史归档, 数字以上方「当前快照」为准)

### Phase 1 · 业务闭环 (18/18) — 真实 PG 写入

```
§1 系统健康度
  ✅ GET /api/health           HTTP 200
  ✅ GET /api/llm-health       DeepSeek latency 169ms
§2 三角色登录
  ✅ employee / manager / hr   全部 200 OK + cookie
§3 身份正确性
  ✅ 各账号 /api/auth/me 角色字段精确
§4 公共数据读路径
  ✅ /api/tandem-okr           objectives=1
  ✅ /api/org/users (manager)  users=7
  ✅ /api/360/cycles (hr)      cycles=1
  ✅ /api/tandem/memory/list   memories=5
  ✅ /api/dashboard/stats      cards=4, memories=6
§5 employee 写入路径
  ✅ POST /api/convergence     真创建议事到 PG
§6 跨角色可见性
  ✅ manager 真实读到 employee 刚建的议事
§7 hr 视角
  ✅ users=7, 隐私脱敏正确 (EVO-7 by design)
§8 LLM 真流式 SSE
  ✅ DeepSeek 流式 chunks=5
§9 logout
  ✅ POST /api/auth/logout 清 cookie
```

跑法: `node scripts/full-loop-verify.mjs`

### Phase 2 · 单元 + Build

| 测试 | 结果 |
|---|---|
| `vitest run` | **95/95 通过**, 1.2s (2026-05-25 基线; 现已 **722 passed** / 67 文件) |
| `npm run build` | **154 路由**全部编译, Exit 0 (现已 **170 路由**) |
| Production standalone 输出 | `.next/standalone/` 已生成 |

### Phase 3 · 手机端 (19/19)

| Viewport | 验证页面数 | 结果 |
|---|---|---|
| iPhone SE 375×667 | 6 | ✅ 6/6 |
| iPhone 14 390×844 | 6 | ✅ 6/6 |
| iPad mini 768×1024 | 6 | ✅ 6/6 |

**说明**: 当前 shell 是固定 `AppRail (64px) + SubSidebar (240px) + main` 横向布局。在 375px 屏幕上虽然能显示, 但拥挤. **完整 mobile-first 改造** 在 backlog (见 LAUNCH-CHECKLIST §C2).

### Phase 4 · PWA 资源

```
public/manifest.webmanifest   ✅ Content-Type: application/manifest+json
public/sw.js                  ✅ Content-Type: application/javascript
public/icon.svg               ✅ 矢量, 1.4 KB
public/icon-192.png           ✅ 9.9 KB  (PWA 标准)
public/icon-512.png           ✅ 76.9 KB (PWA splash)
public/icon-180.png           ✅ 9.5 KB  (iOS apple-touch-icon)
public/favicon-32.png         ✅ 1.0 KB  (浏览器 tab)
```

修复的真 Bug:

- `middleware.ts` 缺少 `/sw.js` 白名单 → 之前 SW 被重定向到 /login 导致 Content-Type 错 → 已修

### Phase 5 · PWA 安装能力

| 检查项 | 状态 |
|---|---|
| manifest 链接在 layout | ✅ `<link rel="manifest" href="/manifest.webmanifest">` |
| theme_color 一致 | ✅ #C8202C (manifest + viewport meta) |
| icons 192/512 + maskable | ✅ |
| service worker 注册 | ✅ `PwaRegister` 组件在 layout.tsx |
| SW 正确 MIME 供送 | ✅ application/javascript |
| HTTPS (生产) | ⚠️ 需在部署侧配 (Caddy/Cloudflare/Vercel 自带) |

### Phase 6 · 云端部署文件

| 文件 | 状态 | 说明 |
|---|---|---|
| `Dockerfile` | ✅ | Multi-stage, Node 22 alpine, standalone, non-root, healthcheck |
| `docker-compose.prod.yml` | ✅ | App + PG + Redis + MinIO, env 守门 |
| `.env.production.example` | ✅ | 全部生产必填项 + CHANGE_ME 占位 |
| `DEPLOY.md` | ✅ | 4 套方案 (本机 / VPS / Vercel / Railway) |

新增的 docker-compose 环境变量:

- `TANDEM_BOOTSTRAP_OWNER_*` → 首次启动自动建 owner
- `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` → AI 功能开关
- `SESSION_SECRET` / `MFA_ENCRYPTION_KEY` → 生产必填

### Phase 7 · 试用邀请

`scripts/issue-trial-invite.mjs` 一行命令生成:

```bash
node scripts/issue-trial-invite.mjs 100 168 employee
# 输出: 邀请码 V4ZZ-8MFR-Z5GC-H5F4
# 注册地址: http://localhost:3005/register?invite=V4ZZ-8MFR-Z5GC-H5F4
# 有效期: 7 天 (168h)  最多 100 人
# + 完整邮件模板
```

### Phase 8 · 文档清单

| 文件 | 用途 |
|---|---|
| `STATUS.md` (本文件) | 当前验证状态 |
| `LAUNCH-CHECKLIST.md` | 上线前必查项 |
| `DEPLOY.md` | 部署指南 (4 套方案) |
| `DESKTOP.md` | 桌面端 (Tauri 旧版, 与 A2 后端不兼容, 推荐 PWA) |
| `docs/README.md` | 文档总入口 |
| `docs/CHARTER-TECH-v2.md` | 技术宪章 |
| `docs/PRODUCT-SPIRIT.md` | 产品精神 |
| `docs/AI-SETUP.md` | LLM 接入指南 |

---

## 已知问题 / 局限

| 严重度 | 项 | 影响 | 缓解 |
|---|---|---|---|
| 🟡 Medium | 当前 shell 对 375px 拥挤 | 手机端用户操作不顺 | mobile-first responsive 重做 (4-8h 工作量) |
| 🟡 Medium | rate limit 走 in-memory | 重启 app = 清零 | 配 Redis (compose 已就绪) |
| 🟡 Medium | Tauri 桌面端跟 A2 后端不兼容 | 装 .exe 后大部分功能 throw | 用 PWA 安装替代 (Chrome/Edge 都支持) |
| 🟢 Low | PowerShell 终端中文乱码 | 仅显示, 数据正确 | `chcp 65001` 切 UTF-8 |
| 🟢 Low | Vercel 部署函数 10s 超时 | LLM SSE 长响应可能截断 | 用 Vercel Pro (60s) 或 VPS |

---

## 接下来

打开 `LAUNCH-CHECKLIST.md`, 按表格 check off 一项项. 全过即可上线试用.
