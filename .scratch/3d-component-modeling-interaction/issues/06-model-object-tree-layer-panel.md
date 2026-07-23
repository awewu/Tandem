# Model Object Tree and Layer Panel

Status: proposed
Type: AFK
Parallel wave: Wave 3 - after Issue 02

## What to build

Replace or demote the right-side debug-style “模型来源” card with a model object tree / layer panel. The panel should organize generated model components, manual components and imported IFC/GLB model sources in a Photoshop-like tree, with Chinese labels and visible selection state.

## Acceptance criteria

- [ ] “模型来源” is no longer the primary right-panel debug card.
- [ ] Right panel provides an object tree or layer-style model organization panel.
- [ ] Object tree groups nodes at minimum by 当前项目、生成模型、手工构件、墙体、门窗、房间/区域、设备、管线、IFC/GLB 导入模型.
- [ ] Each node displays a Chinese business label.
- [ ] UUID/internal ID appears only as secondary metadata, not the main label.
- [ ] Selecting a tree node selects or highlights the corresponding component where applicable.
- [ ] Visibility state can be toggled from the tree for generated/manual component nodes.
- [ ] Lock state can be shown and enforced where supported by the component contract.
- [ ] Imported IFC/GLB sources appear as source nodes without requiring deep BIM hierarchy extraction.
- [ ] Object tree does not replace or break existing IFC/GLB loading behavior.
- [ ] Tests cover grouping, Chinese labels, selection and visibility/lock behavior.

## Blocked by

- `issues/02-component-instance-contract-rotation-visibility-lock.md`

## Notes

IFC/GLB model sources should be represented as manageable source nodes. Do not use this issue to edit geometry inside imported files.
