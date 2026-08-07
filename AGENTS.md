# Rhautt Nexus Agent Rules

Always-loaded only. **Single source of truth: `docs/NEXUS-MARKETING-PLATFORM-BASELINE.md`** (营销中台新阶段基线；charter v2 口径)。派生指标/清单：`docs/NEXUS-MARKETING-METRICS-SYSTEM.md` · `docs/NEXUS-CODE-INVENTORY.md`。历史 `docs/NEXUS-CHARTER-PRD.md` 仅保留门禁校验口径，定位以基线为准。

## Product

- **Nexus = 营销中台 (marketing middle platform)**. Core = **brand building**, along **7P**, breaking through via **product + GEO**, effectiveness validated by **dealer-enablement tools**. Owns the brand; owns the customer's professionalism.
- Platform **Rhautt Nexus / 瑞合数智枢纽**; instance **Rhautt Comfort / 瑞合瑞德暖通科技集团**; vendor **Rysnova / 瑞诺瓦** (`Powered by Rysnova`).
- Rhautt Comfort is the customer/group instance and is **not the software platform name**（客户/集团实例不替换软件平台名）。
- Rheem/Ruud/Everhot/Lithnova are equipment brands.
- **两支柱 + 贯穿层**：🛡️ 产品与技术事实基座（护城河）· 🗡️ AI-GEO 引擎（差异矛头）· AI 贯穿层。功能主轴 = 十大模块体系（见基线文档）。
- **术语锁**：「客户」= **经销商**；最终业主称「终端用户」，不得简称客户。营销中台前台 = 4 个品牌站（发布产物）+ 品牌控制台。
- **客户赋能 = 独立产品线**（已从营销中台可逆剥离/停挂载，模块 quote/design/delivery/contracts/bim 目录留存）：获客→选型→报价→成交→交付→**终身运维（Lifecycle IoT）**→售后 全链路，独立售卖与演进。营销中台聚焦**品牌赋能 + CORE + 线索飞轮**（保留 ingress/diagnosis/crm/dispatch 护飞轮）；接缝 = 产品事实发布 / 线索派单 / 成效回流。
- **北极星（当期）= GEO→高意向线索数**，副指标 = 经销商成交率。总部与经销商各有一张验收表（charter §6.1）。
- **技术支持是核心价值**：`packages/domain/hvac-kernels` (9 domains) + system-packs feed BOTH brand-authority content (L2) and dealer tools (L4).
- **Tandem / 搭子 = 复制体系, NOT part of Nexus.** Only dependency: the AI governance gateway. Do not expand into other Tandem modules.

## Architecture

- Production entry `server-production.js`; no inline business routes except compatibility.
- v2 routes: `/api/v2/*` with owners in `server/modules/routeOwnership.js`.
- Target API: NestJS/PostgreSQL/TypeScript in `services/api/`; new business logic in `services/api/src/modules/`.
- Keep legacy `server/` until matching NestJS contract tests pass.
- App DB connection MUST use non-superuser role `rhautt_app` (NOSUPERUSER/NOBYPASSRLS); superuser only for migrations/ops. Superusers bypass RLS entirely, voiding tenant isolation. Verify: `npm run guard:rls-enforcement`.
- With RLS enforced, the outbox sweep can no longer see tenant-scoped events without context: operating tenants MUST be enumerated via `<SLUG>_TENANT_ID` env vars, else cross-domain reactions stall in `pending`. Verify: `npm run test:integration:flywheel`.

## Domain

- Rheem/Rhautt packs require `level`, `edition`, `softwareCheck`; China mandatory general codes first.
- **Tenant isolation is PostgreSQL RLS** (charter §5.5.1) — the legacy Express+MongoDB isolation under `server/` is NOT production-grade and is being retired. (Corrected 2026-08-04: the previous "isolation is MongoDB-backed" line contradicted the charter and the proven RLS enforcement.)
- Design calc compliance gate: any kernel failure or incomplete coverage MUST block. No partial compliance. Verify: `guard:core-domain-coverage`.

## Verify

- For product/backend/standards/lifecycle changes, run relevant existing gates before claiming completion.
- Common gates: `npm run harness:arch`, `npm run harness:consolidation`, `npm run harness:integrity`, `npm run harness:operational`, `npm run harness:evolution`, `npm run test:production-readiness`.
- React promotion also needs `npm run guard:frontend-api-contract` and staging `ENABLE_REACT_CANDIDATE=true npm run guard:browser-visual`.
- Report skipped/failed gates.

## Token

- Start from user-named paths; inventory only if scope is unknown.
- Use scoped `rg -m`/globs; read ranges, not whole manifests/logs.
- Path-scope `git status`/`git diff`; avoid repo-wide output until needed.
- Respect `.rgignore`; do not default-search generated output, dependencies, or `docs/`.
- Run narrow tests first; broad suites only for cross-module/release work.
- No specialist agents unless explicitly requested.

## GEO (A-engine measuring stick)

- Outward sites (`brand-registry.json` type ∈ group/brand-site/consumer-app) must stay machine-readable for AI engines: canonical/OG/Twitter/JSON-LD per page + robots.txt (AI bot allowlist) + sitemap.xml.
- After adding or editing any outward-site page, run `npm run geo:build` (idempotent, injects between `<!-- GEO:START/END -->`, covers all sites). Verify with `npm run guard:geo`.
- `guard:geo` only scans static HTML under `{app}/public`. Sites reported `unmeasured-next-app` are NOT verified — their GEO readiness is an open gap tracked in `evidence/release-evidence.json#geoUnmeasuredSites`.
- Product-page JSON-LD must derive from the D2 product fact base (`/api/v2/brand/{slug}/products`), never hand-authored facts.

## Design

- **对外品牌 VI（权威）**：Rheem Red `#E4002B` —— 真实 token 在 `packages/tokens/rheem-cn.css`（`--brand-primary`）。
  （更正 2026-08-04：原指向 `public/css/rheem-official-tokens.css` 与 `public/design-tokens/rheem-official.tokens.json`，**两者均不存在**。）
- ⚠️ **不得把 Tandem 的内部 UI 标准套到对外品牌站**：Tandem `docs/UI-DESIGN-COMMUNICATION.md` 的 `--brand-500: #C8202C` 是**内部员工工具**用色，与 Rheem 对外官方红 `#E4002B` 不同。对外站守 Rheem 官方 VI；内部工作台（dealer-workbench）可对齐 Tandem UI 标准。
- Production VI: `npm run guard:rheem-vi-production:strict`, zero critical/high findings.
