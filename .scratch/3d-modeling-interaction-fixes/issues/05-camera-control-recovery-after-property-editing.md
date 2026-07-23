# Camera Control Recovery After Property Editing

Status: proposed
Type: AFK
Parallel wave: Wave 2 - after Issue 03

## What to build

Fix the bug where editing model height, elevation, install height or rotation causes the 3D viewport to lose orbit/pan/zoom capability. Property editing, component dragging and camera orbiting must have distinct interaction states, and camera controls must be restored after input commit, blur, save/cancel, pointer up/cancel, drag end and selection change.

## Acceptance criteria

- [ ] Editing height/elevation/installHeight does not permanently disable orbit, pan or zoom.
- [ ] Editing rotation does not permanently disable orbit, pan or zoom.
- [ ] Clicking back into the 3D viewport after a numeric input allows camera orbit without refreshing.
- [ ] Temporary editing/dragging state is cleared on blur, Enter, Escape, save, cancel, pointer up, pointer cancel and selection change.
- [ ] If OrbitControls or equivalent controls are disabled during component drag, they are re-enabled on all completion/cancel paths.
- [ ] Pointer capture, if used, is released on pointer up/cancel and selection change.
- [ ] Updating component transform does not mutate camera controls.
- [ ] Regression tests or browser evidence cover orbit after height edit and orbit after rotation edit.
- [ ] Existing drag/select/edit behavior remains usable.
- [ ] No IFC/GLB loader logic is changed.

## Blocked by

- `issues/03-floor-elevation-install-height-persistence.md`

## Notes

Use a small interaction state guard if needed, such as idle, editing-property, dragging-component and orbiting-camera. Keep this scoped to interaction state; do not rewrite model loading.
