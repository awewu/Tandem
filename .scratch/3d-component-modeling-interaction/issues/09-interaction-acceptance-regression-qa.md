# 3D Modeling Interaction Acceptance Regression QA

Status: proposed
Type: AFK
Parallel wave: Final verification

## What to build

Run final acceptance for the 3D modeling interaction optimization PRD. Prove the viewport selection behavior, tool-palette component library, pre-placement defaults, rotation editing, object tree, Chinese UI and IFC/GLB protected behavior are all working together in `4003/viewer`.

## Acceptance criteria

- [ ] Browser smoke proves `4003/viewer` renders the unified page with the upgraded modeling UI.
- [ ] Viewport click does not select helper frames or outer scene boundary as business components.
- [ ] Real wall, door/window, equipment and pipe/route components remain selectable.
- [ ] Left tool palette renders vertical rail, categories and Chinese component cards.
- [ ] Pre-placement default editing affects newly placed components.
- [ ] Selected doors/windows/equipment can be rotated and saved.
- [ ] Rotation, dimensions, position, visibility, lock state and Chinese display name restore after refresh/reopen.
- [ ] Right panel object tree groups generated/manual/imported model objects with Chinese labels.
- [ ] IFC/GLB open and view behavior still works or is covered through the existing fixture/mock boundary.
- [ ] Manual component edits continue feeding equipment, BOM and quote summaries.
- [ ] Mobile and desktop visual checks show no overlapping text, clipped controls or unusable panels.
- [ ] Focused viewer tests pass.
- [ ] `designer-workbench` build passes.
- [ ] Any repository-level gate failure is recorded honestly and separated from this PRD's feature behavior.

## Blocked by

- `issues/01-selectable-object-policy-and-helper-locking.md`
- `issues/02-component-instance-contract-rotation-visibility-lock.md`
- `issues/03-tool-palette-component-library-and-default-parameters.md`
- `issues/04-drag-place-with-edited-defaults-and-chinese-display.md`
- `issues/05-rotation-and-type-specific-property-editing.md`
- `issues/06-model-object-tree-layer-panel.md`
- `issues/07-ifc-glb-protected-regression-and-source-tree-integration.md`
- `issues/08-bom-quote-rollup-after-interaction-edits.md`

## Notes

Do not close this issue by issue status alone. Run the focused tests and, where available, browser acceptance. If full repository gates fail for unrelated existing release/evidence reasons, capture the blocker separately.
