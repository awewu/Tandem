# Unified Viewer Acceptance Regression QA

Status: blocked-by-repository-gates
Type: AFK
Parallel wave: Final verification

## What to build

Add acceptance and regression coverage for the unified `4003/viewer` workflow. The goal is to prove the page is visually unified, data is persisted, IFC loading still works, old static URL is redirect-only, and architecture gates do not regress.

This final verification must also cover the manual 3D component modeling scope: component catalog, drag-to-place, selected component editing, delete, refresh-restore, 2D-to-3D conversion and BOM/quote rollup.

## Acceptance criteria

- [ ] Browser smoke coverage proves `4003/viewer` renders the dark three-column workbench.
- [ ] Browser visual coverage checks desktop and mobile layouts for overlapping panels, unreadable controls and blank canvas.
- [ ] Browser visual coverage verifies Chinese text renders correctly with the required Chinese-capable font stack and no mojibake or missing-glyph boxes.
- [ ] Model-loading coverage proves local IFC loading still works or is covered through an agreed fixture/mock boundary.
- [ ] Database-backed tests prove draft/model/calculation/equipment summaries are persisted and reloadable.
- [ ] Browser coverage proves the left panel can switch to the 3D component catalog and render wall, door, window, room/zone, equipment and pipe categories.
- [ ] Browser coverage proves wall, equipment and pipe templates can be placed into the 3D viewport and persisted.
- [ ] Browser coverage proves selected components can be edited with type-specific dimensions and business fields.
- [ ] Browser coverage proves selected components can be dragged or route-edited, deleted and restored correctly after refresh/reopen.
- [ ] 2D-to-3D coverage proves a migrated `4001/designer.html` 2D drawing/component model converts into the same persisted component instance structure.
- [ ] BOM/quote handoff coverage proves manually placed or edited equipment and pipes are included in persisted summaries.
- [ ] Redirect coverage proves `4001/rysnova-bim-designer.html` redirects to `4003/viewer`.
- [ ] The implementation uses no iframe.
- [ ] Relevant project gates are run and results are recorded honestly:
  - `npm run harness:arch`
  - `npm run harness:consolidation`
  - `npm run harness:integrity`
  - `npm run harness:operational`
  - `npm run harness:evolution`
  - `npm run test:production-readiness`

## Blocked by

- `issues/01-unified-viewer-shell-persisted-draft-and-ifc.md`
- `issues/02-legacy-designer-redirect.md`
- `issues/03-generated-hvac-model-persistence-and-selection.md`
- `issues/04-ifc-glb-source-parity-and-model-records.md`
- `issues/05-load-equipment-compliance-persistence.md`
- `issues/06-model-crud-workflow.md`
- `issues/07-2d-bom-quote-database-backed-handoff.md`
- `issues/09-3d-component-catalog-left-panel.md`
- `issues/10-expanded-component-instance-contract.md`
- `issues/11-drag-to-place-3d-components.md`
- `issues/12-selected-component-editing-and-drag-update.md`
- `issues/13-legacy-designer-2d-to-3d-conversion.md`
- `issues/14-manual-components-bom-quote-rollup.md`

## Comments

- If a gate fails for unrelated pre-existing reasons, capture the output and isolate whether the unified viewer changes introduced a new failure.
- 2026-07-20 execution: unified viewer focused regression passed after fixing manual route BOM metadata to persist `unit: 'm'`.
- Passed: `node node_modules\jest\bin\jest.js --runTestsByPath test\production-readiness\unified-viewer-acceptance-regression.test.js test\production-readiness\unified-viewer-component-catalog.test.js test\production-readiness\unified-viewer-handoff.test.js test\production-readiness\unified-viewer-legacy-designer-conversion.test.js test\production-readiness\unified-viewer-model-crud.test.js test\production-readiness\unified-viewer-model-source-parity.test.js test\production-readiness\unified-viewer-selected-component-editing.test.js test\production-readiness\unified-viewer-shell.test.js test\production-readiness\unified-viewer-summary.test.js --runInBand` => 9 suites / 33 tests passed.
- Passed: `TS_NODE_PROJECT=services/api/tsconfig.json node --test -r ts-node/register/transpile-only services/api/src/modules/rysnova-bim/*.nodetest.ts` => 52 tests passed.
- Passed: `TS_NODE_PROJECT=apps/designer-workbench/tsconfig.json node --test -r ts-node/register/transpile-only apps/designer-workbench/test/*.nodetest.cts` => 10 tests passed.
- Passed: `pnpm.cmd --filter designer-workbench build`.
- Passed once before dev-server restart: `pnpm.cmd --filter designer-workbench acceptance:viewer`, desktop and mobile both passed with zero console errors/failures, nonblank canvas, no horizontal mobile overflow, three panels on desktop, Chinese-capable font stack and IFC file-input boundary.
- Blocked: required harness scripts are absent from the current checkout: `audit/architecture-harness.js`, `audit/product-consolidation-harness.js`, `audit/system-integrity-harness.js`, `audit/operational-readiness-harness.js`, `audit/auto-evolution-loop.js`. The corresponding npm scripts fail with `MODULE_NOT_FOUND`.
- Blocked: full `npm.cmd run test:production-readiness` still fails outside unified viewer scope: missing release/audit evidence scripts and files such as `scripts/release/temporal-runtime-smoke`, `scripts/release/rysnova-bim-launch-runbook`, `scripts/release/rysnova-bim-external-proof-preflight`, `public/rysnova-bim-designer.html`, capacity reports, object-storage smoke, agent progress board, plus existing Redis cache evidence failures. Unified viewer suites pass.
