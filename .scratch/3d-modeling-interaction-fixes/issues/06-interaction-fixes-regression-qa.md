# 3D Modeling Interaction Fixes Regression QA

Status: proposed
Type: AFK
Parallel wave: Final verification

## What to build

Run final regression for the 3D modeling interaction fixes PRD. Prove equipment list cleanup, component library cleanup, elevated placement, drag coordinate alignment, camera control recovery and IFC/GLB protected behavior all work together in `4003/viewer`.

## Acceptance criteria

- [ ] Equipment list does not show internal IDs, UUIDs, `manual-*`, `hvac-*`, template IDs or BOM codes.
- [ ] Equipment list still shows Chinese equipment name, quantity, capacity/load and system.
- [ ] Component library cards hide seed source, BOM code, template ID and test hints.
- [ ] Component library cards still show icon, Chinese name and core dimensions.
- [ ] Equipment can be placed or edited on a non-ground floor/elevation.
- [ ] Refresh/reopen restores elevated equipment.
- [ ] Dragging keeps model aligned with mouse after zoom/orbit/pan/resize.
- [ ] Editing height/elevation/installHeight does not break camera orbit/pan/zoom.
- [ ] Editing rotation does not break camera orbit/pan/zoom.
- [ ] BOM/quote summaries continue to work for elevated/manual equipment and pipes.
- [ ] IFC/GLB open/view behavior still works or remains covered by the existing fixture/mock boundary.
- [ ] Focused viewer tests pass.
- [ ] `designer-workbench` build passes.
- [ ] Any repository-level gate failure is recorded separately from feature behavior.

## Blocked by

- `issues/01-equipment-list-presentation-cleanup.md`
- `issues/02-component-library-presentation-cleanup.md`
- `issues/03-floor-elevation-install-height-persistence.md`
- `issues/04-height-aware-drag-coordinate-alignment.md`
- `issues/05-camera-control-recovery-after-property-editing.md`

## Notes

Do not close this issue by issue status alone. Run focused tests and browser/manual verification where possible.
