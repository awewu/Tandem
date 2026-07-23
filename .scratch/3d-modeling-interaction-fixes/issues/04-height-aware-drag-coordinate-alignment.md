# Height-Aware Drag Coordinate Alignment

Status: proposed
Type: AFK
Parallel wave: Wave 2 - after Issue 03

## What to build

Fix drag placement and drag movement so the model stays aligned with the mouse pointer. Screen coordinates must map through the active camera to the current ground/floor/elevation placement plane, apply a stable component anchor and pointer offset, and update the component position without jump, lag or drift.

## Acceptance criteria

- [ ] Drag placement maps pointer coordinates through camera raycasting to a placement plane.
- [ ] Placement plane respects selected floor/elevation/install-height where applicable.
- [ ] Drag start records pointer offset from component anchor to avoid initial jump.
- [ ] Equipment anchor is stable, preferably bottom center or configured placement anchor.
- [ ] Wall, door/window and pipe route anchors remain consistent with their current model semantics.
- [ ] Dragging after zoom, orbit, pan or viewport resize remains aligned.
- [ ] Dragged component updates visually while moving.
- [ ] Dragged component saves through the existing backend component update flow.
- [ ] Tests cover screen-to-world conversion or placement helper behavior where practical.
- [ ] Browser/manual acceptance proves model and mouse stay aligned.
- [ ] No IFC/GLB loader logic is changed.

## Blocked by

- `issues/03-floor-elevation-install-height-persistence.md`

## Notes

This issue should work with the established vertical-axis convention from Issue 03. Do not hardcode every placement to ground plane.
