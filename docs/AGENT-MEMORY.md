# 瑞诺瓦AI舒适家 AI Engineering Memory

This document holds detailed agent memory that was moved out of `AGENTS.md` to
reduce always-loaded context. Keep hard rules in `AGENTS.md`; keep background,
roadmaps, and long explanations here.

## Product Identity

Software platform name: **Rhautt Nexus / 瑞合数智枢纽**.

**Software platform positioning: Rhautt Nexus / 瑞合数智枢纽 is the marketing system software platform delivered to Rhautt Comfort / 瑞合瑞德暖通科技集团 as flagship customer instance #1. The independent software vendor is Rysnova / 瑞诺瓦; delivered instances are white-labeled under the customer name and marked `Powered by Rysnova`.**

**【不可变定位 · 永久锁定】Rhautt Comfort 是瑞合瑞德集团门户网站的唯一定位。任何时候、任何人、任何需求都不得更改此定位。**

Rhautt Comfort / 瑞合瑞德暖通科技集团 is the group English/Chinese expression, not the software product name. 瑞诺瓦 / Rysnova is the dealer-enablement system brand pair (瑞诺瓦 = Chinese name, Rysnova = English name); Rysnova is the independent, neutral vertical-software vendor for the HVAC comfort-home industry, and covers 瑞诺瓦 AI 问诊 / Rysnova AI Diagnosis (C-end), 瑞诺瓦舒适家居 CRM / Rysnova Comfort-Home CRM, and 瑞诺瓦技术支持 BIM / Rysnova BIM. Rhautt Comfort is Rysnova's flagship customer #1; delivered platform instances are white-labeled under the customer name (e.g. `Rhautt Nexus / 瑞合数智枢纽`) and marked `Powered by Rysnova`. Rheem / Ruud / Everhot are equipment brands configured inside 瑞诺瓦 system proposals; each also has its own independent brand site (`apps/rheem-cn`, `apps/ruud-cn`, `apps/everhot-cn`) that links to the Rhautt group portal and to 瑞诺瓦 AI 问诊. Lithnova is a newly incubated equipment brand focused on new-energy storage products, with its own independent brand site (`apps/lithnova-cn`, board-1). The Rysnova BIM technical namespace uses the `rysnova-bim` slug (`apps/rysnova-bim-workbench`, `/api/v2/rysnova-bim`).

瑞诺瓦AI舒适家 is the digital software platform for dealers, designers, sales teams, store managers, headquarters, and homeowners. It must not become a loose demo collection. Judge the product by the closed-loop workflow:

`lead -> pain diagnosis -> design -> system pack -> quote -> contract -> construction -> acceptance -> lifecycle IoT care`

The current production-facing surface is the China/Rhautt active public-page workflow plus the v2 backend modules. Legacy pages and prototype engines may contain useful assets, but they are not automatically product surface.

## Current Architecture Facts

- Current production entry: `server-production.js`.
- Target production API direction: `/api/v2/*`.
- Existing v2 modules:
  - `server/modules/auth`
  - `server/modules/crm`
  - `server/modules/health`
  - `server/modules/lifecycle`
  - `server/modules/system-packs`
- Route ownership registry: `server/modules/routeOwnership.js`.
- Active checks:
  - `npm run harness:arch`
  - `npm run harness:consolidation`
  - `npm run harness:integrity`
  - `npm run harness:operational`
  - `npm run harness:evolution`
  - `npm run test:production-readiness`

## Non-Negotiable Engineering Rules

- Do not add new inline business routes to `server-production.js` unless preserving a legacy compatibility path.
- New production APIs belong under `/api/v2/*`.
- Every route must have an owner in `server/modules/routeOwnership.js`.
- Do not promote a page into active product navigation unless all its API calls map to backend routes.
- Rheem/Rhautt system packs must include standards metadata with `level`, `edition`, and `softwareCheck`.
- China mandatory general codes come first; older design standards can be used only as detailed references.
- Lifecycle IoT handover must preserve customer, home, contract, installed devices, capabilities, warranty, service plan, and binding status.
- MongoDB-backed tenant isolation is the production target. Demo/in-memory fallback is not production readiness.

## Current Known Gaps

- `server-production.js` remains too large and route-heavy.
- Duplicate route groups still exist.
- React `src/services` is not aligned with the current backend.
- Many public HTML files are legacy/prototype surfaces.
- Some core engines are production-orphan candidates and need domain consolidation.
- OpenTelemetry, SLO burn alerts, and full target-scale scenario load testing are not complete.

## Preferred Refactor Order

1. Keep active product pages stable.
2. Expand contract tests before deleting or moving legacy routes.
3. Extract route registrar groups from `server-production.js`.
4. Move one business domain at a time into `/api/v2/*`.
5. Remove duplicate legacy routes only after the module owner passes contract tests.
6. Archive or reconnect orphan engines by domain: hot water, heating, air/DOAS, water quality, smart control, quote/pricing, BIM/drawing, CRM, lifecycle IoT.

## Anthropic-Inspired AI Control Layer

Use project agents and guard scripts as an engineering control plane:

- `architecture-governor`: module ownership, API contracts, duplicate routes.
- `sre-guardian`: readiness, SLOs, observability, load, incident safety.
- `security-supply-chain`: secrets, dependencies, SBOM/provenance, tenant/PII safety.
- `product-domain-critic`: comfort-home workflow, HVAC/water/IOT depth, competitive quality.
- `frontend-contract-auditor`: page/API matching and active surface checks.
- `hvac-standards-auditor`: standards hierarchy and system-pack compliance.
- `iot-lifecycle-architect`: accepted project to controllable home handover.
- `ui-vi-director`: Ruud-informed VI, Microsoft Fluent-style enterprise workbench architecture, and active page visual acceptance.

When changing product, backend, standards, or lifecycle code, run the relevant harness before claiming completion.

## Rheem Design Director Skill

Design and UI work is governed by the `rheem-design-director` skill at `skills/rheem-design-director/`.

**Invoke:** `Use $rheem-design-director to [task]`

**Route by task:**
- New page / redesign → `ui-design-skill.md` + `vi-brand-system-skill.md`
- Brand / color / Chinese naming → `vi-brand-system-skill.md` + `rheem-chinese-localization.md`
- Design tokens / component library → `design-system-agent.md` + `rheem-design-system-standard.md`
- Code implementation → `frontend-implementation-skill.md` + `responsive-qa-skill.md`
- Production VI readiness → `rhautt-production-migration.md` + `npm run guard:rheem-vi-production`
- Visual quality check → `visual-audit-agent.md`

**Non-negotiable gates (V1.5):**
- Rheem Red = `#E4002B` (not `#C41230`)
- Token sources: `public/css/rheem-official-tokens.css` + `public/design-tokens/rheem-official.tokens.json`
- Release gate: `npm run guard:rheem-vi-production:strict` must pass with zero critical/high findings
- Visual audit score ≥ 4 in all categories before approval

## Target Architecture (2026-06-07 决策锁定)

**选定方向：NestJS + PostgreSQL + TypeScript**（已有骨架在 `services/api/`）

```
services/api/          NestJS + Fastify (已有骨架，逐步填充)
  src/modules/auth/    ← 优先级1：迁移 server/modules/auth
  src/modules/crm/     ← 优先级2：迁移 server/modules/crm
  src/modules/quote/   ← 优先级3：迁移 server/modules/quotation
  ...

packages/domain/       共享领域类型（已有占位）
packages/contracts/    OpenAPI 合同（已有生成客户端）

apps/dealer-workbench/ Next.js 经销商工作台（骨架待填）
apps/consumer-diagnosis/ 瑞诺瓦AI问诊（骨架待填）
...
```

**迁移规则（不可违反）：**
1. 新增业务逻辑必须写在 `services/api/src/modules/` 里，不再往 `server/modules/` 加
2. `server/` 遗留体系继续维持服务，直到对应 NestJS 模块通过合同测试
3. PostgreSQL 接入顺序：auth → tenant → crm → quote（每个域独立迁移，不大爆炸）
4. MongoDB 文档库保留用于：DiagnosisReport、RysnovaArtifact、设计上下文、AI 对话记录
5. 迁移完成的模块从 `productionRouteCatalog.js` 中下线，不保留双写

**PII 密钥迁移：**
- 脚本：`scripts/migrate-pii-reencrypt.js`
- 运行前必须在 staging 验证，再在生产执行
- 先 `--dry-run` 确认数量，再正式运行

**React 候选面转正条件（三项必须同时满足）：**
1. `npm run test:production-readiness` 全部通过
2. `npm run guard:frontend-api-contract` 无 unmatched
3. `ENABLE_REACT_CANDIDATE=true` 在 staging 跑 `npm run guard:browser-visual` 无失败
