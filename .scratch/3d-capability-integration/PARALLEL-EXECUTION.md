# Parallel Execution Plan

## Wave 0: Start Immediately

1. `issues/01-unified-viewer-shell-persisted-draft-and-ifc.md`
2. `issues/02-legacy-designer-redirect.md`

## Wave 1: Start After Issue 01

These can run in parallel after the unified page state contract and draft persistence are in place:

1. `issues/03-generated-hvac-model-persistence-and-selection.md`
2. `issues/04-ifc-glb-source-parity-and-model-records.md`
3. `issues/05-load-equipment-compliance-persistence.md`
4. `issues/09-3d-component-catalog-left-panel.md`

## Wave 2: Start After Issue 03

1. `issues/10-expanded-component-instance-contract.md`

This can run while Issues 04, 05 and 09 continue, as long as the agent coordinates API type changes with Issue 03.

## Wave 3: Start After Issues 09 and 10

1. `issues/11-drag-to-place-3d-components.md`

## Wave 4: Start After Issue 10 or 11

These can partially overlap:

1. `issues/12-selected-component-editing-and-drag-update.md` after Issue 11
2. `issues/13-legacy-designer-2d-to-3d-conversion.md` after Issue 10

## Wave 5: Start After Issues 05, 10 and 12

1. `issues/14-manual-components-bom-quote-rollup.md`

## Existing Downstream Work

1. `issues/06-model-crud-workflow.md` after Issues 01, 03 and 04
2. `issues/07-2d-bom-quote-database-backed-handoff.md` after Issues 01 and 05

## Final Verification

1. `issues/08-unified-viewer-acceptance-regression-qa.md`

Update this issue to include the new component CRUD and 2D-to-3D acceptance paths before final execution.

## Practical Parallel Assignment

- Agent A: Issue 01
- Agent B: Issue 02
- Agent C: Issue 03 after Issue 01 lands
- Agent D: Issue 04 after Issue 01 lands
- Agent E: Issue 05 after Issue 01 lands
- Agent F: Issue 09 after Issue 01 lands
- Agent G: Issue 10 after Issue 03 lands
- Agent H: Issue 06 after Issues 01, 03 and 04 land
- Agent I: Issue 11 after Issues 09 and 10 land
- Agent J: Issue 13 after Issue 10 lands
- Agent K: Issue 12 after Issue 11 lands
- Agent L: Issue 14 after Issues 05, 10 and 12 land
- Agent M: Issue 07 after Issues 01 and 05 land
- Agent N: Issue 08 after all implementation issues land

## Comments

- Use separate branches per issue.
- Avoid editing the same React container file in parallel after Issue 01; later issues should use extension points created by Issue 01.
- Issue 09 and Issue 10 are the main parallel enablers for manual 3D component CRUD.
- Issue 13 should use the same component contract as Issue 10; it must not create a separate 2D-to-3D model shape.
- Issue 13 uses `4001/designer.html` as the standard 2D source/reference. Do not depend on `4003/floor-plan`.
