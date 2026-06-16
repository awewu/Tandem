---
trigger: always_on
---

# Module Map — Key Files per Feature Area

## OKR (事半)
- Types/store: `lib/okr/`  
- Rollup: `lib/okr/rollup.ts`, `lib/okr/execution-rollup.ts`  
- API: `app/api/okr/`

## 学院 (Learning)
- Types: `lib/learning/types.ts` (extended with CMS fields: `contentMarkdown`, `tenantId`, `publishedAt`, `archivedAt`, `publishedBy`)
- Fixtures: `lib/learning/fixtures.ts`
- Closure (completion side-effects): `lib/learning/closure.ts`
- Viewer component: `components/learning/LessonViewer.tsx`
- API: `app/api/learning/lessons/` (CRUD) · `app/api/learning/complete/`
- Pages: `app/learning/page.tsx` (catalog) · `app/learning/lesson/[id]/page.tsx`
- Admin CMS: `app/admin/learning/` *(pending)*

## 内网门户 (Intranet)
- View helpers: `lib/intranet/post-view.ts`
- API: `app/api/intranet/posts/` (list + `[id]` single + `[id]/read`)
- Pages: `app/intranet/page.tsx` · `app/intranet/posts/[id]/page.tsx` · `app/intranet/category/[cat]/page.tsx`

## 中央 AI (Atlas / BossAI)
- Portal: `app/atlas/page.tsx`
- BossAI stream: `app/api/boss-ai/stream/route.ts`
- Perception: `lib/persona/company-brain-perception.ts`
- Reasoning pass: `lib/decision-layer/reasoning-pass.ts`
- Reflection / S5 flywheel: `lib/persona/company-brain-reflection.ts`
- Active brain version: `lib/persona/company-brain-version.ts`

## 拿捏 (Niece / Expert Matching)
- Navigation label: "寻找外部专家" (was "外部AI接入") in `components/nav-modules.ts`

## 搭子手抄 (Shouchao)
- Route: `app/shouchao/`  
- External users' primary entry module.

## Governance / 议事
- Three-plus-one engine: `lib/decision-layer/three-plus-one-engine.ts`
- Baseline: `lib/governance/delivery-baseline.ts`
- Calibration: `lib/governance/baseline-calibration.ts`

## IM
- Service: `lib/im/service.ts` (`invokeCompanyBrainReply`, `invokePersonaReply`)

## Ontology / Actions
- Action registration: `lib/ontology/`  
- `proposeAction`: `lib/ontology/propose-action.ts`
- Write skills (S1 limb): `lib/taf/skills/persona-write.ts`

## Navigation
- Module list: `components/nav-modules.ts`
- Launchpad service: `lib/services/launchpad-service.ts`

## Testing
- Unit tests: `tests/unit/`  
- Run: `npx vitest run`  
- Type check: `npx tsc --noEmit` (ignore `vendor/paperclip` errors — unrelated monorepo)
